import http from "node:http";
import { createHash } from "node:crypto";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const db = new PrismaClient();
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
const subscriber = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
const clients = new Map();
const roomConnections = new Map();
const hashToken = (value) => createHash("sha256").update(value).digest("hex");
const parseCookies = (header = "") => Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...rest]) => [key, decodeURIComponent(rest.join("="))]));
const channel = (roomId) => `killbyte:chat:${roomId}`;

function localBroadcast(roomId, payload, except) {
  const encoded = JSON.stringify(payload);
  for (const [socket, context] of clients) {
    if (context.roomId === roomId && socket !== except && socket.readyState === WebSocket.OPEN) socket.send(encoded);
  }
}
function publish(roomId, payload, except) {
  if (redis?.status === "ready") redis.publish(channel(roomId), JSON.stringify({ payload, origin: process.env.KB_INSTANCE_ID ?? "local" })).catch(() => localBroadcast(roomId, payload, except));
  else localBroadcast(roomId, payload, except);
}
function presence(roomId) {
  const users = new Map();
  for (const [socket, context] of clients) if (context.roomId === roomId && socket.readyState === WebSocket.OPEN) users.set(context.user.id, { id: context.user.id, username: context.user.username, displayName: context.user.displayName, avatarUrl: context.user.avatarUrl, role: context.user.role.name });
  publish(roomId, { type: "presence", users: [...users.values()] });
}
function send(socket, payload) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
function canModerate(role) { return ["OWNER", "ADMIN", "MODERATOR"].includes(role); }

async function authenticate(request) {
  const token = parseCookies(request.headers.cookie).kb_session;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { role: true } } } });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || (session.user.mfaEnabled && !session.mfaVerifiedAt)) return null;
  return session.user;
}

await app.prepare();
if (redis && subscriber) {
  await Promise.all([redis.connect().catch(() => undefined), subscriber.connect().catch(() => undefined)]);
  if (subscriber.status === "ready") {
    await subscriber.psubscribe("killbyte:chat:*");
    subscriber.on("pmessage", (_pattern, _channel, message) => {
      try { const parsed = JSON.parse(message); const roomId = _channel.replace("killbyte:chat:", ""); localBroadcast(roomId, parsed.payload); } catch { /* malformed internal messages are ignored */ }
    });
  }
}
const server = http.createServer((request, response) => handle(request, response));
const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (url.pathname !== "/api/ws") { socket.destroy(); return; }
  try {
    const user = await authenticate(request);
    const room = await db.chatRoom.findFirst({ where: { slug: url.searchParams.get("room") ?? "global", enabled: true } });
    if (!user || !room) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request, user, room));
  } catch { socket.destroy(); }
});

wss.on("connection", async (socket, _request, user, room) => {
  const context = { user, roomId: room.id, lastMessageAt: 0, alive: true };
  clients.set(socket, context);
  if (!roomConnections.has(room.id)) roomConnections.set(room.id, new Set());
  roomConnections.get(room.id).add(socket);
  send(socket, { type: "ready", userId: user.id, slowModeSeconds: room.slowModeSeconds });
  presence(room.id);
  socket.on("pong", () => { context.alive = true; });
  socket.on("message", async (raw) => {
    let input;
    try { input = JSON.parse(raw.toString()); } catch { return; }
    try {
      if (input.type === "typing") { publish(room.id, { type: "typing", userId: user.id, displayName: user.displayName }, socket); return; }
      if (input.type === "message") {
        const body = String(input.body ?? "").trim();
        if (!body || body.length > 3000 || user.role.key === "MUTED") return;
        const moderation = await db.chatModeration.findFirst({ where: { userId: user.id, active: true, action: { in: ["MUTE", "BAN", "TIMEOUT"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
        if (moderation) return send(socket, { type: "error", code: "MODERATED" });
        const now = Date.now();
        if (now - context.lastMessageAt < Math.max(room.slowModeSeconds * 1000, 700)) return send(socket, { type: "error", code: "SLOW_MODE" });
        const filters = await db.chatWordFilter.findMany({ where: { enabled: true } });
        if (filters.some((filter) => filter.action === "BLOCK" && body.toLowerCase().includes(filter.pattern.toLowerCase()))) return send(socket, { type: "error", code: "FILTERED" });
        if (input.replyToId && !(await db.chatMessage.findFirst({ where: { id: String(input.replyToId), roomId: room.id }, select: { id: true } }))) return;
        context.lastMessageAt = now;
        const message = await db.chatMessage.create({ data: { roomId: room.id, userId: user.id, body, replyToId: input.replyToId ? String(input.replyToId) : null }, include: { user: { include: { role: true } }, reactions: true, replyTo: { include: { user: { select: { displayName: true } } } } } });
        await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
        publish(room.id, { type: "message", message });
      }
      if (input.type === "edit") {
        const message = await db.chatMessage.findFirst({ where: { id: String(input.id), roomId: room.id, userId: user.id, status: { not: "DELETED" } } });
        const body = String(input.body ?? "").trim();
        if (!message || !body || body.length > 3000 || Date.now() - message.createdAt.getTime() > 15 * 60 * 1000) return;
        const updated = await db.chatMessage.update({ where: { id: message.id }, data: { body, status: "EDITED" }, include: { user: { include: { role: true } }, reactions: true, replyTo: { include: { user: { select: { displayName: true } } } } } });
        publish(room.id, { type: "update", message: updated });
      }
      if (input.type === "delete") {
        const message = await db.chatMessage.findFirst({ where: { id: String(input.id), roomId: room.id } });
        if (!message || (message.userId !== user.id && !canModerate(user.role.key))) return;
        await db.chatMessage.update({ where: { id: message.id }, data: { status: "DELETED", deletedAt: new Date(), body: "" } });
        publish(room.id, { type: "delete", id: message.id });
      }
      if (input.type === "reaction") {
        const messageId = String(input.id); const emoji = String(input.emoji ?? "").slice(0, 16);
        if (!messageId || !emoji || !(await db.chatMessage.findFirst({ where: { id: messageId, roomId: room.id }, select: { id: true } }))) return;
        const existing = await db.chatReaction.findUnique({ where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } } });
        if (existing) await db.chatReaction.delete({ where: { id: existing.id } });
        else await db.chatReaction.create({ data: { messageId, userId: user.id, emoji } });
        publish(room.id, { type: "reaction", messageId, userId: user.id, emoji, removed: Boolean(existing) });
      }
      if (input.type === "pin" && canModerate(user.role.key)) {
        const messageId = String(input.id);
        if (!(await db.chatMessage.findFirst({ where: { id: messageId, roomId: room.id }, select: { id: true } }))) return;
        const existing = await db.chatPin.findUnique({ where: { messageId_roomId: { messageId, roomId: room.id } } });
        if (existing) await db.chatPin.delete({ where: { messageId_roomId: { messageId, roomId: room.id } } });
        else await db.chatPin.create({ data: { messageId, roomId: room.id } });
        publish(room.id, { type: "pin", messageId, pinned: !existing });
      }
    } catch { send(socket, { type: "error", code: "REQUEST_FAILED" }); }
  });
  socket.on("close", () => { clients.delete(socket); roomConnections.get(room.id)?.delete(socket); presence(room.id); });
  socket.on("error", () => socket.terminate());
});
const heartbeat = setInterval(() => { for (const [socket, context] of clients) { if (!context.alive) { socket.terminate(); continue; } context.alive = false; socket.ping(); } }, 30000);
server.listen(port, hostname, () => console.log(`KillByte ready on http://${hostname}:${port} (${dev ? "development" : "production"})`));
async function shutdown() { clearInterval(heartbeat); for (const socket of clients.keys()) socket.close(); await db.$disconnect(); server.close(() => process.exit(0)); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
