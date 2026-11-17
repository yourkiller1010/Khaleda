"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  const path = String(formData.get("path") ?? "/");
  const language = await db.language.findFirst({ where: { code: locale, enabled: true } });
  if (!language) redirect(path);
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://");
  jar.set("kb_locale", locale, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale } });
  const segments = path.split("/").filter(Boolean);
  if (segments.length && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(segments[0])) segments[0] = locale;
  else segments.unshift(locale);
  redirect(`/${segments.join("/")}`);
}
