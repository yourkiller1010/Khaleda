"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, type PermissionKey } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hashToken, randomToken, reference } from "@/lib/utils";
import { triggerAutomations } from "@/lib/automation";
import type { ActionResult } from "@/actions/account";

function text(data: FormData, key: string, max = 500) { return String(data.get(key) ?? "").trim().slice(0, max); }
function bool(data: FormData, key: string) { return data.get(key) === "on" || data.get(key) === "true"; }
function list(data: FormData, key: string) { return text(data, key, 3000).split(",").map((item) => item.trim()).filter(Boolean); }
async function admin(formData: FormData, permission: PermissionKey) { return requirePermission(text(formData, "locale", 12), permission); }
function refresh() { revalidatePath("/", "layout"); }

export async function updateUserAction(formData: FormData) {
  const actor = await admin(formData, "users.manage"); const id = text(formData, "id", 60); const roleId = text(formData, "roleId", 60); const status = text(formData, "status", 30);
  if (!["ACTIVE", "SUSPENDED", "FROZEN", "PENDING", "DELETED"].includes(status)) return;
  const [target, nextRole] = await Promise.all([db.user.findUnique({ where: { id }, include: { role: true } }), db.role.findUnique({ where: { id: roleId } })]);
  if (!target || !nextRole || (actor.role.key !== "OWNER" && (target.role.key === "OWNER" || nextRole.key === "OWNER"))) return;
  if (actor.id === id && (status !== "ACTIVE" || nextRole.key !== "OWNER") && actor.role.key === "OWNER") return;
  const data: Prisma.UserUpdateInput = { status: status as Prisma.UserUpdateInput["status"], role: { connect: { id: roleId } }, membershipPlan: text(formData, "membershipPlanId", 60) ? { connect: { id: text(formData, "membershipPlanId", 60) } } : { disconnect: true } };
  if (text(formData, "membershipDays", 10)) { const days = Math.max(1, Math.min(3650, Number(formData.get("membershipDays")))); data.membershipExpiresAt = new Date(Date.now() + days * 86400000); }
  await db.user.update({ where: { id }, data }); if (status !== "ACTIVE") await db.session.deleteMany({ where: { userId: id } });
  await audit({ actorId: actor.id, action: "USER_UPDATE", targetType: "User", targetId: id, severity: status === "ACTIVE" ? "INFO" : "WARNING", metadata: { roleId, status } }); refresh();
}
export async function addAdminNoteAction(formData: FormData) { const actor = await admin(formData, "users.manage"); const userId = text(formData, "id", 60); const body = text(formData, "note", 3000); if (body) await db.adminNote.create({ data: { userId, authorId: actor.id, body } }); refresh(); }

export async function confirmDepositAction(formData: FormData) {
  const actor = await admin(formData, "finance.manage"); const id = text(formData, "id", 60);
  const result = await db.$transaction(async (tx) => {
    const deposit = await tx.deposit.findFirst({ where: { id, status: "PENDING" }, include: { plan: true } });
    if (!deposit) return null;
    const updated = await tx.user.update({ where: { id: deposit.userId }, data: { walletBalance: { increment: deposit.amount } } });
    await tx.deposit.update({ where: { id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    await tx.financialLedgerEntry.create({ data: { userId: deposit.userId, type: "DEPOSIT", reference: deposit.reference, amount: deposit.amount, balanceAfter: updated.walletBalance, currency: deposit.currency } });
    if (deposit.plan) {
      const startsAt = new Date(); const endsAt = new Date(Date.now() + deposit.plan.durationDays * 86400000);
      await tx.subscription.create({ data: { userId: deposit.userId, planId: deposit.plan.id, status: "CONFIRMED", startsAt, endsAt } });
      await tx.user.update({ where: { id: deposit.userId }, data: { membershipPlanId: deposit.plan.id, membershipExpiresAt: endsAt } });
    }
    await tx.notification.create({ data: { userId: deposit.userId, type: "PAYMENT", title: "Deposit confirmed", body: `${deposit.amount} ${deposit.currency} has been credited.`, href: "/wallet" } });
    return deposit;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (result) { await triggerAutomations("DEPOSIT_CONFIRMED", { depositId: result.id, userId: result.userId, amount: result.amount.toString() }, result.id); await audit({ actorId: actor.id, action: "DEPOSIT_CONFIRM", targetType: "Deposit", targetId: id, severity: "WARNING", metadata: { amount: result.amount.toString() } }); } refresh();
}
export async function rejectDepositAction(formData: FormData) { const actor = await admin(formData, "finance.manage"); const id = text(formData, "id", 60); await db.deposit.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED" } }); await audit({ actorId: actor.id, action: "DEPOSIT_REJECT", targetType: "Deposit", targetId: id, severity: "WARNING" }); refresh(); }

export async function completeWithdrawalAction(formData: FormData) {
  const actor = await admin(formData, "finance.manage"); const id = text(formData, "id", 60);
  const withdrawal = await db.$transaction(async (tx) => {
    const item = await tx.withdrawal.findFirst({ where: { id, status: { in: ["PENDING", "PROCESSING"] } } }); if (!item) return null;
    return tx.withdrawal.update({ where: { id }, data: { status: "COMPLETED", processedBy: actor.id, processedAt: new Date(), adminNote: text(formData, "adminNote", 2000) || null } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (withdrawal) { await triggerAutomations("WITHDRAWAL_STATUS", { withdrawalId: id, userId: withdrawal.userId, status: "COMPLETED" }, id); await audit({ actorId: actor.id, action: "WITHDRAWAL_COMPLETE", targetType: "Withdrawal", targetId: id, severity: "CRITICAL" }); } refresh();
}
export async function rejectWithdrawalAction(formData: FormData) {
  const actor = await admin(formData, "finance.manage"); const id = text(formData, "id", 60);
  const withdrawal = await db.$transaction(async (tx) => {
    const item = await tx.withdrawal.findFirst({ where: { id, status: { in: ["PENDING", "PROCESSING"] } } }); if (!item) return null;
    const updated = await tx.user.update({ where: { id: item.userId }, data: { walletBalance: { increment: item.amount } } });
    const rejected = await tx.withdrawal.update({ where: { id }, data: { status: "REJECTED", processedBy: actor.id, processedAt: new Date(), adminNote: text(formData, "adminNote", 2000) || "Rejected and refunded" } });
    await tx.financialLedgerEntry.create({ data: { userId: item.userId, type: "REFUND", reference: `${item.reference}_REFUND`, amount: item.amount, balanceAfter: updated.walletBalance, currency: item.currency, metadata: { withdrawalId: item.id } } });
    return rejected;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (withdrawal) { await triggerAutomations("WITHDRAWAL_STATUS", { withdrawalId: id, userId: withdrawal.userId, status: "REJECTED" }, id); await audit({ actorId: actor.id, action: "WITHDRAWAL_REJECT_REFUND", targetType: "Withdrawal", targetId: id, severity: "WARNING" }); } refresh();
}

export async function savePlanAction(formData: FormData) { const actor = await admin(formData, "finance.manage"); const id = text(formData, "id", 60); const slug = text(formData, "slug", 80).toLowerCase().replace(/[^a-z0-9-]/g, "-"); const name = text(formData, "name", 100); if (!slug || !name) return; const data = { slug, name, description: text(formData, "description", 1000), price: new Prisma.Decimal(text(formData, "price", 30) || "0"), currency: text(formData, "currency", 8) || "USD", durationDays: Math.max(1, Math.min(3650, Number(formData.get("durationDays") ?? 30))), features: list(formData, "features"), isPrivate: bool(formData, "isPrivate"), enabled: bool(formData, "enabled"), sortOrder: Number(formData.get("sortOrder") ?? 0) }; if (id) await db.membershipPlan.update({ where: { id }, data }); else await db.membershipPlan.create({ data }); await audit({ actorId: actor.id, action: "PLAN_SAVE", targetType: "MembershipPlan", targetId: id || slug }); refresh(); }
export async function savePaymentMethodAction(formData: FormData) { const actor = await admin(formData, "finance.manage"); const id = text(formData, "id", 60); const slug = text(formData, "slug", 80).toLowerCase(); const data = { slug, name: text(formData, "name", 100), provider: text(formData, "provider", 60), type: text(formData, "type", 20) || "BOTH", enabled: bool(formData, "enabled"), feeType: text(formData, "feeType", 20) || "NONE", feeValue: new Prisma.Decimal(text(formData, "feeValue", 30) || "0"), minAmount: new Prisma.Decimal(text(formData, "minAmount", 30) || "1"), maxAmount: new Prisma.Decimal(text(formData, "maxAmount", 30) || "100000"), instructions: text(formData, "instructions", 3000) || null }; if (id) await db.paymentMethod.update({ where: { id }, data }); else await db.paymentMethod.create({ data }); await audit({ actorId: actor.id, action: "PAYMENT_METHOD_SAVE", targetType: "PaymentMethod", targetId: id || slug, severity: "WARNING" }); refresh(); }

export async function saveBadgeAction(formData: FormData) { const actor = await admin(formData, "users.manage"); const id = text(formData, "id", 60); const slug = text(formData, "slug", 80).toLowerCase(); const data = { slug, name: text(formData, "name", 100), description: text(formData, "description", 2000), artworkUrl: text(formData, "artworkUrl", 1000) || null, icon: text(formData, "icon", 60) || "Award", rarity: text(formData, "rarity", 30) || "COMMON", priority: Number(formData.get("priority") ?? 0), enabled: bool(formData, "enabled") }; if (id) await db.badge.update({ where: { id }, data }); else await db.badge.create({ data }); await audit({ actorId: actor.id, action: "BADGE_SAVE", targetType: "Badge", targetId: id || slug }); refresh(); }
export async function assignBadgeAction(formData: FormData) { const actor = await admin(formData, "users.manage"); const username = text(formData, "username", 80); const badgeId = text(formData, "badgeId", 60); const user = await db.user.findUnique({ where: { username } }); if (user) await db.userBadge.upsert({ where: { userId_badgeId: { userId: user.id, badgeId } }, update: { expiresAt: null }, create: { userId: user.id, badgeId, assignedBy: actor.id } }); await audit({ actorId: actor.id, action: "BADGE_ASSIGN", targetType: "UserBadge", targetId: user?.id, metadata: { badgeId } }); refresh(); }
export async function revokeBadgeAction(formData: FormData) { const actor = await admin(formData, "users.manage"); const userId = text(formData, "userId", 60); const badgeId = text(formData, "badgeId", 60); await db.userBadge.delete({ where: { userId_badgeId: { userId, badgeId } } }); await audit({ actorId: actor.id, action: "BADGE_REVOKE", targetType: "UserBadge", targetId: userId, metadata: { badgeId }, severity: "WARNING" }); refresh(); }

export async function adminTicketUpdateAction(formData: FormData) { const actor = await admin(formData, "users.manage"); const id = text(formData, "id", 60); const status = text(formData, "status", 30) as "OPEN" | "PENDING" | "RESOLVED" | "CLOSED"; const assignedToId = text(formData, "assignedToId", 60) || null; await db.supportTicket.update({ where: { id }, data: { status, assignedToId, closedAt: status === "CLOSED" ? new Date() : null } }); await audit({ actorId: actor.id, action: "TICKET_ADMIN_UPDATE", targetType: "SupportTicket", targetId: id }); refresh(); }
export async function adminTicketReplyAction(formData: FormData) { const actor = await admin(formData, "users.manage"); const ticketId = text(formData, "id", 60); const body = text(formData, "body", 6000); const internal = bool(formData, "internal"); if (body) { await db.ticketMessage.create({ data: { ticketId, authorId: actor.id, body, internal } }); await db.supportTicket.update({ where: { id: ticketId }, data: { status: internal ? undefined : "PENDING" } }); } refresh(); }

export async function saveSystemSettingAction(formData: FormData) { const actor = await admin(formData, "system.manage"); const key = text(formData, "key", 120); if (!/^[a-z][a-z0-9._-]+$/i.test(key)) return; let value: Prisma.InputJsonValue = text(formData, "value", 10000); if (text(formData, "type", 20) === "boolean") value = bool(formData, "value"); else if (text(formData, "type", 20) === "number") value = Number(value); else if (text(formData, "type", 20) === "json") { try { value = JSON.parse(String(value)); } catch { return; } } await db.systemSetting.upsert({ where: { key }, update: { value, public: bool(formData, "public"), updatedBy: actor.id }, create: { key, value, public: bool(formData, "public"), updatedBy: actor.id } }); await audit({ actorId: actor.id, action: "SYSTEM_SETTING_SAVE", targetType: "SystemSetting", targetId: key, severity: ["maintenance", "security"].some((part) => key.startsWith(part)) ? "CRITICAL" : "INFO" }); refresh(); }

export async function createApiKeyAction(_: ActionResult, formData: FormData): Promise<ActionResult> { const actor = await admin(formData, "security.manage"); const secret = `kb_${randomToken(36)}`; const prefix = secret.slice(0, 10); const item = await db.apiKey.create({ data: { userId: actor.id, name: text(formData, "name", 100) || "API key", prefix, secretHash: hashToken(secret), scopes: list(formData, "scopes"), expiresAt: text(formData, "expiresAt", 80) ? new Date(text(formData, "expiresAt", 80)) : null } }); await audit({ actorId: actor.id, action: "API_KEY_CREATE", targetType: "ApiKey", targetId: item.id, severity: "WARNING" }); refresh(); return { ok: true, reference: secret, message: `Copy this key now; it will not be shown again: ${secret}` }; }
export async function revokeApiKeyAction(formData: FormData) { const actor = await admin(formData, "security.manage"); const id = text(formData, "id", 60); await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }); await audit({ actorId: actor.id, action: "API_KEY_REVOKE", targetType: "ApiKey", targetId: id, severity: "WARNING" }); refresh(); }
export async function revokeUserSessionsAction(formData: FormData) { const actor = await admin(formData, "security.manage"); const userId = text(formData, "userId", 60); const count = await db.session.deleteMany({ where: { userId } }); await audit({ actorId: actor.id, action: "SESSIONS_REVOKE", targetType: "User", targetId: userId, severity: "CRITICAL", metadata: { count: count.count } }); refresh(); }
export async function updateFraudReportAction(formData: FormData) { const actor = await admin(formData, "users.manage"); const id = text(formData, "id", 60); await db.fraudReport.update({ where: { id }, data: { status: text(formData, "status", 30), riskScore: Math.min(100, Math.max(0, Number(formData.get("riskScore") ?? 0))) } }); await audit({ actorId: actor.id, action: "FRAUD_REPORT_UPDATE", targetType: "FraudReport", targetId: id, severity: "WARNING" }); refresh(); }
export async function saveScheduledJobAction(formData: FormData) { const actor = await admin(formData, "system.manage"); const id = text(formData, "id", 60); const data = { name: text(formData, "name", 120), queue: text(formData, "queue", 60) || "maintenance", cron: text(formData, "cron", 80), status: bool(formData, "active") ? "ACTIVE" as const : "PAUSED" as const, nextRunAt: text(formData, "nextRunAt", 80) ? new Date(text(formData, "nextRunAt", 80)) : null }; if (!data.name || !data.cron) return; if (id) await db.scheduledJob.update({ where: { id }, data }); else await db.scheduledJob.create({ data }); await audit({ actorId: actor.id, action: "SCHEDULED_JOB_SAVE", targetType: "ScheduledJob", targetId: id || data.name }); refresh(); }
export async function saveChatRoomAction(formData: FormData) { const actor = await admin(formData, "chat.moderate"); const id = text(formData, "id", 60); await db.chatRoom.update({ where: { id }, data: { enabled: bool(formData, "enabled"), slowModeSeconds: Math.min(3600, Math.max(0, Number(formData.get("slowModeSeconds") ?? 0))) } }); await audit({ actorId: actor.id, action: "CHAT_ROOM_SAVE", targetType: "ChatRoom", targetId: id }); refresh(); }
export async function saveWordFilterAction(formData: FormData) { const actor = await admin(formData, "chat.moderate"); const pattern = text(formData, "pattern", 160).toLowerCase(); if (pattern) await db.chatWordFilter.upsert({ where: { pattern }, update: { enabled: true }, create: { pattern, action: "BLOCK" } }); await audit({ actorId: actor.id, action: "CHAT_FILTER_SAVE", targetType: "ChatWordFilter", targetId: pattern }); refresh(); }
export async function moderateUserAction(formData: FormData) { const actor = await admin(formData, "chat.moderate"); const userId = text(formData, "userId", 60); const action = text(formData, "action", 30); const minutes = Math.min(43200, Math.max(1, Number(formData.get("minutes") ?? 60))); await db.chatModeration.create({ data: { userId, actorId: actor.id, action, reason: text(formData, "reason", 1000) || "Administrative moderation", expiresAt: ["MUTE", "TIMEOUT"].includes(action) ? new Date(Date.now() + minutes * 60000) : null } }); if (action === "BAN") await db.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } }); await audit({ actorId: actor.id, action: `CHAT_${action}`, targetType: "User", targetId: userId, severity: "WARNING" }); refresh(); }


export async function saveRoleAction(formData: FormData) {
  const actor = await admin(formData, "security.manage");
  const id = text(formData, "id", 60);
  const name = text(formData, "name", 80);
  const key = text(formData, "key", 20) as "OWNER" | "ADMIN" | "MODERATOR" | "VIP" | "PREMIUM" | "VERIFIED" | "MEMBER" | "MUTED" | "CUSTOM";
  const allowed = ["OWNER", "ADMIN", "MODERATOR", "VIP", "PREMIUM", "VERIFIED", "MEMBER", "MUTED", "CUSTOM"];
  if (!name || !allowed.includes(key)) return;
  const existing = id ? await db.role.findUnique({ where: { id } }) : null;
  if ((existing?.key === "OWNER" || key === "OWNER") && actor.role.key !== "OWNER") return;
  const permissions = await db.permission.findMany({ where: { key: { in: list(formData, "permissions") } }, select: { id: true } });
  const role = await db.$transaction(async (tx) => {
    const record = id
      ? await tx.role.update({ where: { id }, data: { name, key: existing?.isSystem ? existing.key : key, priority: Math.max(0, Math.min(100, Number(formData.get("priority") ?? 0))), description: text(formData, "description", 1000) || null } })
      : await tx.role.create({ data: { name, key, priority: Math.max(0, Math.min(100, Number(formData.get("priority") ?? 0))), description: text(formData, "description", 1000) || null } });
    await tx.rolePermission.deleteMany({ where: { roleId: record.id } });
    if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: record.id, permissionId: permission.id })) });
    return record;
  });
  await audit({ actorId: actor.id, action: "ROLE_SAVE", targetType: "Role", targetId: role.id, severity: "CRITICAL", metadata: { key, permissions: list(formData, "permissions") } });
  refresh();
}

export async function saveRewardAction(formData: FormData) {
  const actor = await admin(formData, "users.manage");
  const id = text(formData, "id", 60);
  const name = text(formData, "name", 120);
  if (!name) return;
  const data = {
    name,
    description: text(formData, "description", 2000),
    type: text(formData, "type", 40) || "MANUAL",
    value: new Prisma.Decimal(text(formData, "value", 30) || "0"),
    currency: text(formData, "currency", 8) || "USD",
    badgeId: text(formData, "badgeId", 60) || null,
    enabled: bool(formData, "enabled"),
  };
  const reward = id ? await db.reward.update({ where: { id }, data }) : await db.reward.create({ data });
  await audit({ actorId: actor.id, action: "REWARD_SAVE", targetType: "Reward", targetId: reward.id, severity: "WARNING", metadata: { value: data.value.toString() } });
  refresh();
}

export async function updateReferralAction(formData: FormData) {
  const actor = await admin(formData, "users.manage");
  const id = text(formData, "id", 60);
  const points = Math.trunc(Math.max(0, Math.min(1_000_000, Number(formData.get("points") ?? 0))));
  const referral = await db.$transaction(async (tx) => {
    const current = await tx.referral.findUnique({ where: { id } });
    if (!current) return null;
    const difference = points - current.points;
    const updated = await tx.referral.update({ where: { id }, data: { points, convertedAt: bool(formData, "converted") ? current.convertedAt ?? new Date() : null } });
    if (difference) await tx.user.update({ where: { id: current.referrerId }, data: { referralPoints: { increment: difference } } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (referral) await audit({ actorId: actor.id, action: "REFERRAL_UPDATE", targetType: "Referral", targetId: id, severity: "WARNING", metadata: { points } });
  refresh();
}

export async function updateSubscriptionAction(formData: FormData) {
  const actor = await admin(formData, "finance.manage");
  const id = text(formData, "id", 60);
  const status = text(formData, "status", 30) as "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED" | "REFUNDED" | "EXPIRED" | "FAILED";
  const allowed = ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED", "REFUNDED", "EXPIRED", "FAILED"];
  if (!allowed.includes(status)) return;
  const subscription = await db.$transaction(async (tx) => {
    const current = await tx.subscription.findUnique({ where: { id } });
    if (!current) return null;
    const endsAt = text(formData, "endsAt", 80) ? new Date(text(formData, "endsAt", 80)) : current.endsAt;
    const updated = await tx.subscription.update({ where: { id }, data: { status, endsAt } });
    if (status === "CONFIRMED") await tx.user.update({ where: { id: current.userId }, data: { membershipPlanId: current.planId, membershipExpiresAt: endsAt } });
    if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(status)) await tx.user.updateMany({ where: { id: current.userId, membershipPlanId: current.planId }, data: { membershipPlanId: null, membershipExpiresAt: null } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (subscription) await audit({ actorId: actor.id, action: "SUBSCRIPTION_UPDATE", targetType: "Subscription", targetId: id, severity: "WARNING", metadata: { status } });
  refresh();
}

export async function adjustWalletAction(formData: FormData) {
  const actor = await admin(formData, "finance.manage");
  const userId = text(formData, "userId", 60);
  const reason = text(formData, "reason", 1000);
  const amount = new Prisma.Decimal(text(formData, "amount", 30) || "0");
  if (!reason || amount.isZero() || amount.abs().gt(1_000_000)) return;
  const ref = reference("ADJ");
  const entry = await db.$transaction(async (tx) => {
    const updated = amount.isNegative()
      ? await tx.user.updateMany({ where: { id: userId, walletBalance: { gte: amount.abs() } }, data: { walletBalance: { increment: amount } } })
      : await tx.user.updateMany({ where: { id: userId }, data: { walletBalance: { increment: amount } } });
    if (updated.count !== 1) return null;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.financialLedgerEntry.create({ data: { userId, type: "ADJUSTMENT", reference: ref, amount, balanceAfter: user.walletBalance, currency: user.walletCurrency, metadata: { reason, actorId: actor.id } } });
    await tx.notification.create({ data: { userId, type: "PAYMENT", title: "Wallet adjustment", body: `${amount.toString()} ${user.walletCurrency}: ${reason}`, href: "/wallet" } });
    return user;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (entry) await audit({ actorId: actor.id, action: "WALLET_ADJUST", targetType: "User", targetId: userId, severity: "CRITICAL", metadata: { amount: amount.toString(), reason, reference: ref } });
  refresh();
}

export async function resolveMessageReportAction(formData: FormData) {
  const actor = await admin(formData, "chat.moderate");
  const id = text(formData, "id", 60);
  await db.messageReport.update({ where: { id }, data: { resolved: true } });
  await audit({ actorId: actor.id, action: "MESSAGE_REPORT_RESOLVE", targetType: "MessageReport", targetId: id });
  refresh();
}

export async function deleteChatMessageAction(formData: FormData) {
  const actor = await admin(formData, "chat.moderate");
  const id = text(formData, "id", 60);
  await db.chatMessage.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date(), body: "[removed by moderation]" } });
  await audit({ actorId: actor.id, action: "CHAT_MESSAGE_DELETE", targetType: "ChatMessage", targetId: id, severity: "WARNING" });
  refresh();
}
