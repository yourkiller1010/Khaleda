import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { locale } = await params;
  const { ref } = await searchParams;
  if (await getCurrentUser()) redirect(`/${locale}/dashboard`);
  const [t, languages] = await Promise.all([getTranslations(), db.language.findMany({ where: { enabled: true }, orderBy: { englishName: "asc" } })]);
  return <AuthShell locale={locale} languages={languages} title={t("auth.registerTitle")} body={t("auth.registerBody")} footer={<>{t("auth.hasAccount")} <a className="text-foreground underline underline-offset-4" href={`/${locale}/login`}>{t("nav.login")}</a></>}><RegisterForm locale={locale} referral={ref} google={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} telegram={Boolean(process.env.TELEGRAM_BOT_TOKEN)} /></AuthShell>;
}
