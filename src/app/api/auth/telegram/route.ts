import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { absoluteUrl, referralCode } from "@/lib/utils";
import { triggerAutomations } from "@/lib/automation";

export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const locale = request.nextUrl.searchParams.get("locale") ?? "en";
  if (!token) return NextResponse.json({ error: "Telegram authentication is not configured" }, { status: 503 });
  const values = Object.fromEntries(request.nextUrl.searchParams.entries());
  const supplied = values.hash;
  if (!supplied || !values.id || !values.auth_date) return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=telegram`));
  if (Math.abs(Date.now() / 1000 - Number(values.auth_date)) > 600) return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=telegram_expired`));
  const checkString = Object.keys(values).filter((key) => !["hash", "locale"].includes(key)).sort().map((key) => `${key}=${values[key]}`).join("\n");
  const secret = createHash("sha256").update(token).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest("hex");
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=telegram_signature`));
  const telegramId = String(values.id);
  let user = await db.user.findUnique({ where: { telegramId } });
  if (user?.status && user.status !== "ACTIVE") return NextResponse.redirect(absoluteUrl(`/${locale}/login?error=restricted`));
  if (!user) {
    const role = await db.role.findUniqueOrThrow({ where: { name: "Member" } });
    const username = `tg_${telegramId}`.slice(0, 24);
    user = await db.user.create({ data: { telegramId, username, displayName: [values.first_name, values.last_name].filter(Boolean).join(" ") || values.username || username, avatarUrl: values.photo_url || null, email: `tg_${telegramId}@telegram.killbyte.local`, roleId: role.id, referralCode: referralCode(username), locale } });
    await triggerAutomations("USER_REGISTERED", { userId: user.id, email: user.email, role: "MEMBER", provider: "telegram" }, user.id);
  }
  await createSession(user.id, !user.mfaEnabled);
  return NextResponse.redirect(absoluteUrl(`/${locale}/${user.mfaEnabled ? "mfa" : "dashboard"}`));
}
