import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (await getCurrentUser()) redirect(`/${locale}/dashboard`);
  const [t, languages] = await Promise.all([getTranslations(), db.language.findMany({ where: { enabled: true }, orderBy: { englishName: "asc" } })]);
  return <AuthShell locale={locale} languages={languages} title={t("auth.loginTitle")} body={t("auth.loginBody")} footer={<>{t("auth.noAccount")} <a className="text-foreground underline underline-offset-4" href={`/${locale}/register`}>{t("nav.register")}</a></>}><LoginForm locale={locale} google={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} telegram={Boolean(process.env.TELEGRAM_BOT_TOKEN)} /></AuthShell>;
}
