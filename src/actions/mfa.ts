"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentSession, isLoginLimited, recordLogin, requireUser } from "@/lib/auth";
import { generateMfaSecret, normalizeRecoveryCode, recoveryCode, verifyMfaCode } from "@/lib/mfa";
import { hashToken } from "@/lib/utils";
import { audit } from "@/lib/audit";

export type MfaState = { error?: string; message?: string; secret?: string; uri?: string; codes?: string[] };
const validLocale = (value: FormDataEntryValue | null) => /^[a-zA-Z0-9-]{2,12}$/.test(String(value ?? "")) ? String(value) : "en";

export async function beginMfaSetupAction(): Promise<MfaState> {
  const session = await getCurrentSession();
  if (!session || (session.user.mfaEnabled && !session.mfaVerifiedAt)) return { error: "Your session is not authorized to configure MFA." };
  if (session.user.mfaEnabled) return { error: "MFA is already enabled. Disable it before starting a new setup." };
  const secret = generateMfaSecret();
  await db.user.update({ where: { id: session.userId }, data: { mfaSecret: secret } });
  await audit({ actorId: session.userId, action: "MFA_SETUP_STARTED", targetType: "User", targetId: session.userId });
  const uri = `otpauth://totp/KillByte:${encodeURIComponent(session.user.email)}?secret=${secret}&issuer=KillByte`;
  return { secret, uri, message: "Scan or enter this secret, then verify a six-digit code. The secret is shown only for this setup session." };
}

export async function enableMfaAction(_: MfaState, formData: FormData): Promise<MfaState> {
  const locale = validLocale(formData.get("locale"));
  const session = await getCurrentSession();
  if (!session || session.user.mfaEnabled || !session.user.mfaSecret) return { error: "Start MFA setup before verifying a code." };
  const code = String(formData.get("code") ?? "");
  const identifier = `mfa-setup:${session.userId}`;
  if (await isLoginLimited(identifier)) return { error: "Too many verification attempts. Wait 15 minutes and try again." };
  if (!verifyMfaCode(session.user.mfaSecret, code)) {
    await recordLogin(identifier, false, session.userId, "MFA_SETUP_INVALID");
    return { error: "The authenticator code is not valid. Check the device time and try again." };
  }
  const codes = Array.from({ length: 10 }, () => recoveryCode());
  await db.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: session.userId } });
    await tx.mfaRecoveryCode.createMany({ data: codes.map((item) => ({ userId: session.userId, codeHash: hashToken(normalizeRecoveryCode(item)) })) });
    await tx.user.update({ where: { id: session.userId }, data: { mfaEnabled: true } });
    await tx.session.deleteMany({ where: { userId: session.userId, id: { not: session.id } } });
    await tx.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
  });
  await recordLogin(identifier, true, session.userId);
  await audit({ actorId: session.userId, action: "MFA_ENABLED", targetType: "User", targetId: session.userId, severity: "CRITICAL" });
  return { codes, message: `MFA is enabled for /${locale}. Store these single-use recovery codes offline; they cannot be shown again.` };
}

async function validCredential(userId: string, secret: string, supplied: string) {
  if (verifyMfaCode(secret, supplied)) return "TOTP" as const;
  const normalized = normalizeRecoveryCode(supplied);
  if (!/^[A-Z2-7]{8}-[A-Z2-7]{8}$/.test(normalized)) return null;
  const codeHash = hashToken(normalized);
  const consumed = await db.mfaRecoveryCode.updateMany({ where: { userId, codeHash, usedAt: null }, data: { usedAt: new Date() } });
  return consumed.count === 1 ? "RECOVERY" as const : null;
}

export async function verifyMfaAction(_: MfaState, formData: FormData): Promise<MfaState> {
  const locale = validLocale(formData.get("locale"));
  const session = await getCurrentSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.user.mfaEnabled || !session.user.mfaSecret) redirect(`/${locale}/dashboard`);
  if (session.mfaVerifiedAt) redirect(`/${locale}/dashboard`);
  const identifier = `mfa-login:${session.userId}`;
  if (await isLoginLimited(identifier)) return { error: "Too many verification attempts. Wait 15 minutes and try again." };
  const method = await validCredential(session.userId, session.user.mfaSecret, String(formData.get("code") ?? ""));
  if (!method) {
    await recordLogin(identifier, false, session.userId, "MFA_INVALID");
    return { error: "The authenticator or recovery code is not valid." };
  }
  await db.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
  await recordLogin(identifier, true, session.userId);
  await audit({ actorId: session.userId, action: "MFA_VERIFIED", targetType: "User", targetId: session.userId, metadata: { method } });
  redirect(`/${locale}/dashboard`);
}

export async function disableMfaAction(_: MfaState, formData: FormData): Promise<MfaState> {
  const locale = validLocale(formData.get("locale"));
  const user = await requireUser(locale);
  if (!user.mfaEnabled || !user.mfaSecret) return { error: "MFA is not enabled on this account." };
  const identifier = `mfa-disable:${user.id}`;
  if (await isLoginLimited(identifier)) return { error: "Too many verification attempts. Wait 15 minutes and try again." };
  const method = await validCredential(user.id, user.mfaSecret, String(formData.get("code") ?? ""));
  if (!method) {
    await recordLogin(identifier, false, user.id, "MFA_DISABLE_INVALID");
    return { error: "Enter a valid authenticator or recovery code to disable MFA." };
  }
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } }),
    db.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit({ actorId: user.id, action: "MFA_DISABLED", targetType: "User", targetId: user.id, severity: "CRITICAL", metadata: { method } });
  return { message: "MFA has been disabled. Existing password-authenticated sessions remain subject to the current security policy." };
}
