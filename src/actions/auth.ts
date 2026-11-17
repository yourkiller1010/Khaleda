"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, isLoginLimited, recordLogin } from "@/lib/auth";
import { referralCode } from "@/lib/utils";
import { triggerAutomations } from "@/lib/automation";
import { audit } from "@/lib/audit";

export type AuthState = { error?: string; fieldErrors?: Record<string, string[]> };

const credentials = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(200),
  locale: z.string().min(2).max(12),
});

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your account credentials and try again." };
  const { identifier, password, locale } = parsed.data;
  if (await isLoginLimited(identifier)) {
    await recordLogin(identifier, false, undefined, "RATE_LIMITED");
    return { error: "Too many attempts. Wait 15 minutes before trying again." };
  }
  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] },
    include: { role: true },
  });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    await recordLogin(identifier, false, user?.id, "INVALID_CREDENTIALS");
    return { error: "The credentials do not match an active KillByte account." };
  }
  if (user.status !== "ACTIVE") {
    await recordLogin(identifier, false, user.id, "ACCOUNT_RESTRICTED");
    return { error: "This account is restricted. Contact support for a review." };
  }
  await recordLogin(identifier, true, user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastActiveAt: new Date() } });
  await createSession(user.id, !user.mfaEnabled);
  await audit({ actorId: user.id, action: "AUTH_LOGIN", targetType: "User", targetId: user.id });
  redirect(`/${locale}/${user.mfaEnabled ? "mfa" : "dashboard"}`);
}

const registration = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,24}$/),
  email: z.string().trim().email().max(160),
  password: z.string().min(12).max(200).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  confirm: z.string(),
  referral: z.string().trim().max(30).optional(),
  locale: z.string().min(2).max(12),
}).refine((value) => value.password === value.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function registerAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registration.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the form. Use a 12+ character password with upper/lowercase letters and a number.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { username, email, password, referral, locale } = parsed.data;
  if (await isLoginLimited(email)) return { error: "Registration is temporarily rate limited from this network." };
  const existing = await db.user.findFirst({ where: { OR: [{ email: email.toLowerCase() }, { username }] }, select: { id: true } });
  if (existing) return { error: "An account already uses this email or username." };
  const memberRole = await db.role.findUnique({ where: { name: "Member" } });
  if (!memberRole) return { error: "The platform is not initialized. Run the database seed first." };
  const referrer = referral ? await db.user.findUnique({ where: { referralCode: referral }, select: { id: true, referralCode: true } }) : null;
  const referralSetting = referrer ? await db.systemSetting.findUnique({ where: { key: "referrals.pointsPerSignup" }, select: { value: true } }) : null;
  const configuredPoints = referralSetting?.value;
  const signupPoints = typeof configuredPoints === "number" && Number.isInteger(configuredPoints) && configuredPoints >= 0 && configuredPoints <= 100000 ? configuredPoints : 10;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        displayName: username,
        passwordHash,
        roleId: memberRole.id,
        referralCode: referralCode(username),
        referredById: referrer?.id,
        locale,
      },
    });
    if (referrer) {
      await tx.referral.create({ data: { referrerId: referrer.id, referredId: created.id, code: referrer.referralCode, points: signupPoints } });
      if (signupPoints > 0) await tx.user.update({ where: { id: referrer.id }, data: { referralPoints: { increment: signupPoints } } });
      await tx.rewardTransaction.create({ data: { userId: referrer.id, type: "REFERRAL_SIGNUP", amount: 0, reference: `REF_${created.id}`, metadata: { referredUserId: created.id, points: signupPoints } } });
    }
    await tx.notification.create({ data: { userId: created.id, type: "SUCCESS", title: "Welcome to KillByte", body: "Your secure workspace is ready.", href: `/${locale}/dashboard` } });
    return created;
  });
  await createSession(user.id, true);
  await triggerAutomations("USER_REGISTERED", { userId: user.id, email: user.email, role: "MEMBER" }, user.id);
  await audit({ actorId: user.id, action: "AUTH_REGISTER", targetType: "User", targetId: user.id });
  redirect(`/${locale}/dashboard`);
}

export async function logoutAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  await destroySession();
  redirect(`/${locale}`);
}
