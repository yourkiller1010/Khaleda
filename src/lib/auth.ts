import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/utils";
import type { Prisma, User, Role, Session } from "@prisma/client";

export const SESSION_COOKIE = "kb_session";
export type CurrentUser = User & { role: Role };
export type CurrentSession = Session & { user: CurrentUser };
export type PermissionKey = "platform.read" | "users.manage" | "content.manage" | "finance.manage" | "chat.moderate" | "security.manage" | "system.manage";

export async function createSession(userId: string, mfaVerified = false) {
  const token = randomToken();
  const jar = await cookies();
  const headerList = await headers();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      mfaVerifiedAt: mfaVerified ? new Date() : null,
      ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim()?.slice(0, 100) ?? null,
      userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
    },
  });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return session;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getCurrentSession();
  if (!session || (session.user.mfaEnabled && !session.mfaVerifiedAt)) return null;
  if (["OWNER", "ADMIN"].includes(session.user.role.key)) {
    const policy = await db.systemSetting.findUnique({ where: { key: "security.mfaRequiredForAdmins" }, select: { value: true } });
    if (policy?.value === true && !session.user.mfaEnabled) return null;
  }
  return session.user;
}

export async function requireUser(locale: string) {
  const session = await getCurrentSession();
  if (!session) redirect(`/${locale}/login`);
  if (session.user.mfaEnabled && !session.mfaVerifiedAt) redirect(`/${locale}/mfa`);
  return session.user;
}

async function enforceMfaPolicy(user: CurrentUser, locale: string) {
  const setting = await db.systemSetting.findUnique({ where: { key: "security.mfaRequiredForAdmins" }, select: { value: true } });
  if (setting?.value === true && !user.mfaEnabled) redirect(`/${locale}/profile#mfa`);
}

export async function requireAdmin(locale: string) {
  const user = await requireUser(locale);
  if (!["OWNER", "ADMIN"].includes(user.role.key)) redirect(`/${locale}/dashboard`);
  await enforceMfaPolicy(user, locale);
  return user;
}

export async function requirePermission(locale: string, permission: PermissionKey) {
  const user = await requireUser(locale);
  if (user.role.key !== "OWNER") {
    const granted = await db.rolePermission.findFirst({
      where: { roleId: user.roleId, permission: { key: permission } },
      select: { roleId: true },
    });
    if (!granted) redirect(`/${locale}/dashboard`);
  }
  await enforceMfaPolicy(user, locale);
  return user;
}

export async function hasPermission(user: CurrentUser, permission: PermissionKey, tx: Prisma.TransactionClient | typeof db = db) {
  if (user.role.key === "OWNER") return true;
  return Boolean(await tx.rolePermission.findFirst({ where: { roleId: user.roleId, permission: { key: permission } }, select: { roleId: true } }));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function recordLogin(identifier: string, successful: boolean, userId?: string, reason?: string) {
  const headerList = await headers();
  const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim()?.slice(0, 100) ?? null;
  await db.loginAttempt.create({ data: { identifier: identifier.toLowerCase().slice(0, 160), successful, userId, reason, ipAddress } });
  return ipAddress;
}

export async function isLoginLimited(identifier: string) {
  const headerList = await headers();
  const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const failures = await db.loginAttempt.count({
    where: { successful: false, createdAt: { gte: since }, OR: [{ identifier: identifier.toLowerCase().slice(0, 160) }, ...(ipAddress ? [{ ipAddress }] : [])] },
  });
  return failures >= 8;
}
