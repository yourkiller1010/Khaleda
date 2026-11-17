import Script from "next/script";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { absoluteUrl } from "@/lib/utils";

export default async function TelegramPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("auth");
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  return <main className="grid min-h-dvh place-items-center p-6"><section className="surface w-full max-w-md p-8 text-center"><Logo href={`/${locale}`} /><h1 className="mt-8 text-2xl font-medium">{t("telegram")}</h1><p className="text-muted mt-3 text-sm">{t("protected")}</p>{bot ? <><div id="telegram-login" className="mt-7 flex min-h-12 justify-center" /><Script src="https://telegram.org/js/telegram-widget.js?22" strategy="afterInteractive" onLoad={() => undefined} data-telegram-login={bot} data-size="large" data-auth-url={absoluteUrl(`/api/auth/telegram?locale=${locale}`)} data-request-access="write" /></> : <p className="mt-6 text-sm text-muted">Telegram authentication is not configured.</p>}<a className="btn btn-secondary mt-7" href={`/${locale}/login`}>{t("login")}</a></section></main>;
}
