import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { absoluteUrl, referralCode } from "@/lib/utils";
import { triggerAutomations } from "@/lib/automation";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("kb_oauth_state")?.value;
  const locale = request.cookies.get("kb_oauth_locale")?.value ?? "en";
  if (!code || !state || !storedState || state !== storedState) return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=oauth_state`));
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: absoluteUrl("/api/auth/google/callback"), grant_type: "authorization_code" }) });
  if (!tokenResponse.ok) return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=oauth_token`));
  const tokens = await tokenResponse.json() as { access_token?: string };
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (!profileResponse.ok) return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=oauth_profile`));
  const profile = await profileResponse.json() as { sub: string; email?: string; name?: string; picture?: string; email_verified?: boolean };
  if (!profile.email || !profile.email_verified) return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=oauth_email`));
  const existing = await db.user.findFirst({ where: { OR: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }] } });
  if (existing?.status && existing.status !== "ACTIVE") return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=restricted`));
  let user = existing;
  if (user) user = await db.user.update({ where: { id: user.id }, data: { googleId: profile.sub, avatarUrl: profile.picture, emailVerifiedAt: new Date(), lastLoginAt: new Date() } });
  else {
    const role = await db.role.findUniqueOrThrow({ where: { name: "Member" } });
    const base = profile.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").slice(0, 18) || "member";
    const username = `${base}_${profile.sub.slice(-5)}`;
    user = await db.user.create({ data: { email: profile.email.toLowerCase(), username, displayName: profile.name ?? base, googleId: profile.sub, avatarUrl: profile.picture, emailVerifiedAt: new Date(), roleId: role.id, referralCode: referralCode(username), locale, lastLoginAt: new Date() } });
    await triggerAutomations("USER_REGISTERED", { userId: user.id, email: user.email, role: "MEMBER", provider: "google" }, user.id);
  }
  await createSession(user.id, !user.mfaEnabled);
  const response = NextResponse.redirect(absoluteUrl(`/${locale}/${user.mfaEnabled ? "mfa" : "dashboard"}`));
  response.cookies.delete("kb_oauth_state"); response.cookies.delete("kb_oauth_locale");
  return response;
}
