import { createHash } from "node:crypto";
import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { CronExpressionParser } from "cron-parser";
import nodemailer from "nodemailer";

const db = new PrismaClient();
const integer = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.trunc(parsed))) : fallback;
};
const settings = {
  pollMs: integer(process.env.WORKER_POLL_MS, 3000, 500, 60000),
  batchSize: integer(process.env.WORKER_BATCH_SIZE, 10, 1, 50),
  maxAttempts: integer(process.env.WORKER_MAX_ATTEMPTS, 5, 1, 10),
  retryBaseMs: integer(process.env.WORKER_RETRY_BASE_MS, 30000, 1000, 300000),
  staleMs: integer(process.env.WORKER_STALE_MS, 600000, 60000, 3600000),
  webhookTimeoutMs: integer(process.env.WORKER_WEBHOOK_TIMEOUT_MS, 10000, 1000, 30000),
};
const workerId = process.env.KB_INSTANCE_ID ?? `worker-${process.pid}`;
const levelWeight = { debug: 10, info: 20, warn: 30, error: 40 };
const minimumLogLevel = levelWeight[process.env.LOG_LEVEL] ?? 20;
let mailer;
let stopping = false;

function log(level, message, context = {}) {
  if ((levelWeight[level] ?? 20) < minimumLogLevel) return;
  const entry = { timestamp: new Date().toISOString(), level, service: "worker", workerId, message, ...context };
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(JSON.stringify(entry));
}

class ActionError extends Error {
  constructor(message, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

export function actionIdempotencyKey(executionId, actionIndex) {
  return createHash("sha256").update(`killbyte-action:${executionId}:${actionIndex}`).digest("hex");
}

export function actionFingerprint(action) {
  return createHash("sha256").update(JSON.stringify(action)).digest("hex");
}

const record = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value, maximum = 2000) => typeof value === "string" && value.trim().length > 0 && value.length <= maximum;

export function readPath(source, path) {
  if (typeof path !== "string" || !/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/.test(path) || path.length > 160) return undefined;
  let value = source;
  for (const part of path.split(".")) {
    if (!record(value) || !Object.hasOwn(value, part)) return undefined;
    value = value[part];
  }
  return value;
}

export function renderTemplate(value, payload) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_match, path) => {
    const replacement = readPath(payload, path);
    return replacement === undefined || replacement === null ? "" : typeof replacement === "object" ? JSON.stringify(replacement) : String(replacement);
  }).slice(0, 20000);
}

export function evaluateConditions(conditions, payload) {
  if (!Array.isArray(conditions)) throw new ActionError("Conditions must be a JSON array");
  if (conditions.length > 25) throw new ActionError("A maximum of 25 conditions is allowed");
  for (const condition of conditions) {
    if (!record(condition) || typeof condition.path !== "string") throw new ActionError("Each condition requires a valid path");
    const actual = readPath(payload, condition.path);
    const expected = condition.value;
    const operator = condition.operator ?? "equals";
    let matched;
    switch (operator) {
      case "equals": matched = actual === expected; break;
      case "not_equals": matched = actual !== expected; break;
      case "contains": matched = typeof actual === "string" && actual.includes(String(expected ?? "")); break;
      case "in": matched = Array.isArray(expected) && expected.includes(actual); break;
      case "exists": matched = expected === false ? actual === undefined : actual !== undefined; break;
      case "gt": matched = Number.isFinite(Number(actual)) && Number(actual) > Number(expected); break;
      case "gte": matched = Number.isFinite(Number(actual)) && Number(actual) >= Number(expected); break;
      case "lt": matched = Number.isFinite(Number(actual)) && Number(actual) < Number(expected); break;
      case "lte": matched = Number.isFinite(Number(actual)) && Number(actual) <= Number(expected); break;
      default: throw new ActionError(`Unsupported condition operator: ${String(operator)}`);
    }
    if (!matched) return false;
  }
  return true;
}

function normalizeAction(action, payload) {
  if (!record(action) || !text(action.type, 40)) throw new ActionError("Each action requires a supported type");
  const type = action.type.toLowerCase();
  if (!["notification", "email", "webhook", "badge"].includes(type)) throw new ActionError(`Unsupported action type: ${type}`);
  return { action, type, payload };
}

function requireUserId(action, payload) {
  const userId = String(action.userId ?? readPath(payload, "userId") ?? "");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(userId)) throw new ActionError("A valid userId is required in the action or event payload");
  return userId;
}

function internalHref(value) {
  if (value === undefined || value === null || value === "") return null;
  const href = String(value);
  if (!/^\/(?!\/)[a-zA-Z0-9/_?=&%.-]{0,240}$/.test(href)) throw new ActionError("Notification href must be an internal absolute path");
  return href;
}

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function webhookAllowlist() {
  return new Set((process.env.AUTOMATION_WEBHOOK_ALLOWLIST ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
}

export function validateWebhookUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw new ActionError("Webhook URL is invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new ActionError("Webhooks require HTTPS on the standard port without URL credentials");
  if (!webhookAllowlist().has(url.hostname.toLowerCase())) throw new ActionError("Webhook host is not in AUTOMATION_WEBHOOK_ALLOWLIST");
  if (net.isIP(url.hostname) && !isPublicIp(url.hostname)) throw new ActionError("Webhook IP address is not public");
  return url;
}

export function isPublicIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 192 && b === 0 && parts[2] === 2) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && parts[2] === 100) || (a === 203 && b === 0 && parts[2] === 113) || a >= 224);
  }
  if (family === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff")) return false;
    if (normalized.startsWith("::ffff:")) return isPublicIp(normalized.slice(7));
    if (normalized === "2001:db8::" || normalized.startsWith("2001:db8:")) return false;
    return true;
  }
  return false;
}

function getMailer() {
  if (mailer) return mailer;
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from || !validEmail(from)) throw new ActionError("SMTP_HOST and a valid SMTP_FROM are required", true);
  mailer = nodemailer.createTransport({
    host,
    port: integer(process.env.SMTP_PORT, 587, 1, 65535),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
  return mailer;
}

async function postWebhook(url, action, payload, execution) {
  const body = JSON.stringify(action.body === undefined ? { trigger: execution.automation.trigger, payload, executionId: execution.id } : action.body);
  if (Buffer.byteLength(body) > 65536) throw new ActionError("Webhook body exceeds 64 KiB");
  const deliveryKey = actionIdempotencyKey(execution.id, action.index);
  const headers = {
    "content-type": "application/json",
    "user-agent": "KillByte-Automation/1.0",
    "idempotency-key": deliveryKey,
    "x-killbyte-execution-id": execution.id,
    "x-killbyte-action-index": String(action.index),
  };
  if (action.headers !== undefined) {
    if (!record(action.headers) || Object.keys(action.headers).length > 12) throw new ActionError("Webhook headers must be an object with at most 12 entries");
    for (const [name, value] of Object.entries(action.headers)) {
      const normalized = name.toLowerCase();
      if (!/^[a-z0-9-]{1,60}$/.test(normalized) || ["host", "content-length", "connection", "transfer-encoding", "upgrade", "idempotency-key", "x-killbyte-execution-id", "x-killbyte-action-index"].includes(normalized) || typeof value !== "string" || value.length > 2000) throw new ActionError("Webhook contains an invalid header");
      headers[normalized] = value;
    }
  }
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "POST",
      headers,
      timeout: settings.webhookTimeoutMs,
      lookup(hostname, options, callback) {
        dns.lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
          if (error) return callback(error);
          if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) return callback(new ActionError("Webhook DNS resolved to a non-public address"));
          if (options.all) return callback(null, addresses);
          return callback(null, addresses[0].address, addresses[0].family);
        });
      },
    }, (response) => {
      let received = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        if (received > 16384) response.destroy();
      });
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        if (status >= 200 && status < 300) return resolve({ status });
        const retryable = status === 408 || status === 429 || status >= 500;
        reject(new ActionError(`Webhook returned HTTP ${status}`, retryable));
      });
      response.on("error", (error) => reject(new ActionError(`Webhook response failed: ${error.message}`, true)));
    });
    request.on("timeout", () => request.destroy(new ActionError("Webhook request timed out", true)));
    request.on("error", (error) => reject(error instanceof ActionError ? error : new ActionError(`Webhook request failed: ${error.message}`, true)));
    request.end(body);
  });
}

async function checkpointedAction(execution, actionIndex, action, type, operation) {
  const actionHash = actionFingerprint(action);
  return db.$transaction(async (tx) => {
    const key = { executionId_actionIndex: { executionId: execution.id, actionIndex } };
    const existing = await tx.automationActionCheckpoint.findUnique({ where: key });
    if (existing) {
      if (existing.actionHash !== actionHash) throw new ActionError("Automation action changed during execution; enqueue a new execution");
      return existing.outcome;
    }
    const outcome = await operation(tx);
    await tx.automationActionCheckpoint.create({ data: { executionId: execution.id, actionIndex, actionType: type, actionHash, outcome } });
    return outcome;
  });
}

async function executeAction(action, payload, execution, testMode, actionIndex) {
  const normalized = normalizeAction(action, payload);
  const type = normalized.type;
  if (type === "notification") {
    const userId = requireUserId(action, payload);
    const title = renderTemplate(action.title, payload);
    const body = renderTemplate(action.body, payload);
    if (!text(title, 180) || !text(body, 2000)) throw new ActionError("Notification title and body are required");
    const href = internalHref(renderTemplate(action.href ?? "", payload));
    const notificationType = action.notificationType ?? "SYSTEM";
    if (!["INFO", "SUCCESS", "WARNING", "SECURITY", "PAYMENT", "REWARD", "SUPPORT", "SYSTEM"].includes(notificationType)) throw new ActionError("Notification type is invalid");
    if (testMode) return { type, outcome: "TEST_VALIDATED", userId };
    return checkpointedAction(execution, actionIndex, action, type, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, status: "ACTIVE" }, select: { id: true } });
      if (!user) throw new ActionError("Notification recipient is not an active user");
      const notification = await tx.notification.create({ data: { userId, title, body, href, type: notificationType }, select: { id: true } });
      return { type, outcome: "CREATED", notificationId: notification.id };
    });
  }
  if (type === "email") {
    let to = renderTemplate(action.to ?? "", payload);
    const userId = action.userId || readPath(payload, "userId");
    if (!to && userId) {
      const user = await db.user.findFirst({ where: { id: String(userId), status: "ACTIVE" }, select: { email: true } });
      to = user?.email ?? "";
    }
    const subject = renderTemplate(action.subject, payload);
    const body = renderTemplate(action.text ?? action.body, payload);
    if (!validEmail(to) || !text(subject, 200) || !text(body, 20000)) throw new ActionError("Email requires a valid recipient, subject, and text body");
    if (testMode) return { type, outcome: "TEST_VALIDATED", recipient: "redacted" };
    const deliveryKey = actionIdempotencyKey(execution.id, actionIndex);
    const info = await getMailer().sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text: body,
      messageId: `<${deliveryKey}@killbyte.local>`,
      headers: { "X-KillByte-Idempotency-Key": deliveryKey },
    });
    return { type, outcome: "SENT", messageId: String(info.messageId ?? "").slice(0, 200), deliveryKey };
  }
  if (type === "badge") {
    const userId = requireUserId(action, payload);
    const badgeSlug = String(action.badgeSlug ?? "");
    if (!/^[a-z0-9-]{2,80}$/.test(badgeSlug)) throw new ActionError("A valid badgeSlug is required");
    let expiresAt = null;
    if (action.expiresAt) {
      expiresAt = new Date(String(action.expiresAt));
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new ActionError("Badge expiresAt must be a future ISO date");
    }
    const badge = await db.badge.findFirst({ where: { slug: badgeSlug, enabled: true }, select: { id: true } });
    if (!badge) throw new ActionError("Badge is missing or disabled");
    if (testMode) return { type, outcome: "TEST_VALIDATED", badgeSlug };
    return checkpointedAction(execution, actionIndex, action, type, async (tx) => {
      const assignment = await tx.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        update: { expiresAt },
        create: { userId, badgeId: badge.id, expiresAt, assignedBy: `automation:${execution.automationId}` },
      });
      return { type, outcome: "ASSIGNED", badgeSlug, earnedAt: assignment.earnedAt.toISOString() };
    });
  }
  const url = validateWebhookUrl(renderTemplate(action.url, payload));
  if (testMode) return { type, outcome: "TEST_VALIDATED", host: url.hostname };
  const response = await postWebhook(url, { ...action, index: actionIndex }, payload, execution);
  return { type, outcome: "DELIVERED", host: url.hostname, status: response.status, deliveryKey: actionIdempotencyKey(execution.id, actionIndex) };
}

async function claimExecution() {
  const now = new Date();
  const candidates = await db.automationExecution.findMany({
    where: { status: { in: ["PENDING", "RETRYING"] }, runAfter: { lte: now } },
    orderBy: { runAfter: "asc" },
    take: settings.batchSize * 3,
    select: { id: true },
  });
  for (const candidate of candidates) {
    const claimed = await db.automationExecution.updateMany({
      where: { id: candidate.id, status: { in: ["PENDING", "RETRYING"] }, runAfter: { lte: now } },
      data: { status: "RUNNING", attempt: { increment: 1 }, startedAt: now, error: null },
    });
    if (claimed.count === 1) return db.automationExecution.findUnique({ where: { id: candidate.id }, include: { automation: true } });
  }
  return null;
}

async function finishExecution(execution, data) {
  await db.automationExecution.updateMany({ where: { id: execution.id, status: "RUNNING" }, data });
}

async function processExecution(execution) {
  const testMode = execution.automation.testMode || execution.payload?.test === true;
  try {
    if (execution.automation.status !== "ACTIVE" && execution.payload?.test !== true) {
      await finishExecution(execution, { status: "CANCELLED", completedAt: new Date(), result: { reason: "Automation is not active" } });
      return;
    }
    if (!evaluateConditions(execution.automation.conditions, execution.payload)) {
      await finishExecution(execution, { status: "SUCCESS", completedAt: new Date(), result: { matched: false, outcomes: [] } });
      return;
    }
    const actions = execution.automation.actions;
    if (!Array.isArray(actions) || actions.length > 10) throw new ActionError("Actions must be a JSON array containing at most 10 entries");
    const checkpoints = await db.automationActionCheckpoint.findMany({ where: { executionId: execution.id }, orderBy: { actionIndex: "asc" } });
    const completed = new Map(checkpoints.map((checkpoint) => [checkpoint.actionIndex, checkpoint]));
    const outcomes = [];
    for (const [actionIndex, action] of actions.entries()) {
      const checkpoint = completed.get(actionIndex);
      if (checkpoint) {
        if (checkpoint.actionHash !== actionFingerprint(action)) throw new ActionError("Automation action changed during execution; enqueue a new execution");
        outcomes[actionIndex] = checkpoint.outcome;
        continue;
      }
      const outcome = await executeAction(action, execution.payload, execution, testMode, actionIndex);
      await db.automationActionCheckpoint.upsert({
        where: { executionId_actionIndex: { executionId: execution.id, actionIndex } },
        update: { outcome, actionHash: actionFingerprint(action) },
        create: { executionId: execution.id, actionIndex, actionType: String(action?.type ?? "unknown"), actionHash: actionFingerprint(action), outcome },
      });
      outcomes[actionIndex] = outcome;
      await finishExecution(execution, { result: { matched: true, testMode, outcomes } });
    }
    await finishExecution(execution, { status: "SUCCESS", completedAt: new Date(), result: { matched: true, testMode, outcomes } });
    log("info", "Automation execution completed", { executionId: execution.id, automationId: execution.automationId, attempt: execution.attempt, testMode });
  } catch (error) {
    const retryable = !(error instanceof ActionError) || error.retryable;
    const canRetry = retryable && execution.attempt < settings.maxAttempts;
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown worker failure";
    const runAfter = canRetry ? new Date(Date.now() + Math.min(settings.retryBaseMs * 2 ** Math.max(0, execution.attempt - 1), 900000)) : null;
    await finishExecution(execution, {
      status: canRetry ? "RETRYING" : "FAILED",
      error: message,
      runAfter: runAfter ?? new Date(),
      completedAt: canRetry ? null : new Date(),
      result: { failedAction: true, testMode },
    });
    log(canRetry ? "warn" : "error", canRetry ? "Automation execution scheduled for retry" : "Automation execution failed", { executionId: execution.id, automationId: execution.automationId, attempt: execution.attempt, runAfter, error: message });
  }
}

async function recoverStaleExecutions() {
  const staleBefore = new Date(Date.now() - settings.staleMs);
  const stale = await db.automationExecution.findMany({ where: { status: "RUNNING", startedAt: { lt: staleBefore } }, take: 100, select: { id: true, attempt: true } });
  for (const execution of stale) {
    const retry = execution.attempt < settings.maxAttempts;
    await db.automationExecution.updateMany({
      where: { id: execution.id, status: "RUNNING", startedAt: { lt: staleBefore } },
      data: { status: retry ? "RETRYING" : "FAILED", error: "Worker lease expired after an interruption", runAfter: new Date(), completedAt: retry ? null : new Date() },
    });
  }
  if (stale.length) log("warn", "Recovered stale automation leases", { count: stale.length });
}

async function processAvailableExecutions() {
  let processed = 0;
  while (processed < settings.batchSize && !stopping) {
    const execution = await claimExecution();
    if (!execution) break;
    await processExecution(execution);
    processed += 1;
  }
  return processed;
}

async function expireSubscriptions(now) {
  const expired = await db.subscription.findMany({ where: { status: "CONFIRMED", endsAt: { lte: now } }, take: 500, select: { id: true, userId: true, planId: true, plan: { select: { name: true } } } });
  let count = 0;
  for (const subscription of expired) {
    const changed = await db.$transaction(async (tx) => {
      const result = await tx.subscription.updateMany({ where: { id: subscription.id, status: "CONFIRMED", endsAt: { lte: now } }, data: { status: "EXPIRED" } });
      if (result.count !== 1) return false;
      await tx.user.updateMany({ where: { id: subscription.userId, membershipPlanId: subscription.planId, membershipExpiresAt: { lte: now } }, data: { membershipPlanId: null, membershipExpiresAt: null } });
      await tx.notification.create({ data: { userId: subscription.userId, type: "SYSTEM", title: "Membership expired", body: `Your ${subscription.plan.name} membership has expired. Renew from the pricing page when ready.`, href: "/pricing" } });
      return true;
    });
    if (changed) count += 1;
  }
  return count;
}

async function runMaintenance(queue, payload = {}) {
  const supported = ["maintenance", "expire-subscriptions", "expire-sessions", "expire-deposits", "expire-badges", "expire-moderation", "cleanup-login-attempts", "cleanup-analytics"];
  if (!supported.includes(queue)) throw new ActionError(`Unsupported scheduled queue: ${queue}`);
  const now = new Date();
  const results = {};
  const selected = (name) => queue === "maintenance" || queue === name;
  if (selected("expire-subscriptions")) results.expiredSubscriptions = await expireSubscriptions(now);
  if (selected("expire-sessions")) results.expiredSessions = (await db.session.deleteMany({ where: { expiresAt: { lte: now } } })).count;
  if (selected("expire-deposits")) results.expiredDeposits = (await db.deposit.updateMany({ where: { status: "PENDING", expiresAt: { lte: now } }, data: { status: "EXPIRED" } })).count;
  if (selected("expire-badges")) results.expiredBadges = (await db.userBadge.deleteMany({ where: { expiresAt: { lte: now } } })).count;
  if (selected("expire-moderation")) results.expiredModeration = (await db.chatModeration.updateMany({ where: { active: true, expiresAt: { lte: now } }, data: { active: false } })).count;
  if (selected("cleanup-login-attempts")) {
    const days = integer(payload.retentionDays, 90, 7, 365);
    const old = await db.loginAttempt.findMany({ where: { createdAt: { lt: new Date(now.getTime() - days * 86400000) } }, take: 5000, select: { id: true } });
    results.deletedLoginAttempts = old.length ? (await db.loginAttempt.deleteMany({ where: { id: { in: old.map((item) => item.id) } } })).count : 0;
  }
  if (selected("cleanup-analytics")) {
    const days = integer(payload.retentionDays, 400, 30, 1825);
    const old = await db.analyticsEvent.findMany({ where: { createdAt: { lt: new Date(now.getTime() - days * 86400000) } }, take: 5000, select: { id: true } });
    results.deletedAnalyticsEvents = old.length ? (await db.analyticsEvent.deleteMany({ where: { id: { in: old.map((item) => item.id) } } })).count : 0;
  }
  return results;
}

function nextRun(cron, currentDate) {
  return CronExpressionParser.parse(cron, { currentDate, tz: "UTC" }).next().toDate();
}

async function runScheduledJobs() {
  const now = new Date();
  const jobs = await db.scheduledJob.findMany({ where: { status: "ACTIVE", OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] }, take: 25 });
  for (const job of jobs) {
    let following;
    try { following = nextRun(job.cron, now); }
    catch (error) {
      await db.scheduledJob.updateMany({ where: { id: job.id, status: "ACTIVE" }, data: { status: "FAILED" } });
      await db.auditLog.create({ data: { action: "SCHEDULED_JOB_INVALID", targetType: "ScheduledJob", targetId: job.id, severity: "CRITICAL", metadata: { queue: job.queue, error: error instanceof Error ? error.message.slice(0, 300) : "Invalid cron" } } });
      continue;
    }
    const claimed = await db.scheduledJob.updateMany({
      where: { id: job.id, status: "ACTIVE", OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
      data: { lastRunAt: now, nextRunAt: following },
    });
    if (claimed.count !== 1) continue;
    try {
      const results = await runMaintenance(job.queue, record(job.payload) ? job.payload : {});
      await db.auditLog.create({ data: { action: "SCHEDULED_JOB_SUCCESS", targetType: "ScheduledJob", targetId: job.id, metadata: { queue: job.queue, results } } });
      log("info", "Scheduled job completed", { jobId: job.id, queue: job.queue, results });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Scheduled job failed";
      await db.auditLog.create({ data: { action: "SCHEDULED_JOB_FAILED", targetType: "ScheduledJob", targetId: job.id, severity: "CRITICAL", metadata: { queue: job.queue, error: message } } });
      log("error", "Scheduled job failed", { jobId: job.id, queue: job.queue, error: message });
    }
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await db.$queryRaw`SELECT 1`;
  log("info", "Worker started", { pollMs: settings.pollMs, batchSize: settings.batchSize, maxAttempts: settings.maxAttempts });
  let lastScheduleRun = 0;
  let lastRecoveryRun = 0;
  while (!stopping) {
    const cycleStarted = Date.now();
    try {
      if (cycleStarted - lastRecoveryRun >= 60000) {
        await recoverStaleExecutions();
        lastRecoveryRun = cycleStarted;
      }
      const processed = await processAvailableExecutions();
      if (cycleStarted - lastScheduleRun >= 15000) {
        await runScheduledJobs();
        lastScheduleRun = cycleStarted;
      }
      if (processed > 0) log("debug", "Worker cycle completed", { processed });
    } catch (error) {
      log("error", "Worker cycle failed", { error: error instanceof Error ? error.message.slice(0, 500) : "Unknown failure" });
    }
    if (!stopping) await delay(Math.max(100, settings.pollMs - (Date.now() - cycleStarted)));
  }
}

function requestShutdown(signal) {
  if (stopping) return;
  stopping = true;
  log("info", "Graceful shutdown requested", { signal });
}
process.on("SIGTERM", () => requestShutdown("SIGTERM"));
process.on("SIGINT", () => requestShutdown("SIGINT"));

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  try {
    await main();
  } catch (error) {
    log("error", "Worker terminated", { error: error instanceof Error ? error.message : "Unknown failure" });
    process.exitCode = 1;
  } finally {
    mailer?.close();
    await db.$disconnect();
    log("info", "Worker stopped");
  }
}
