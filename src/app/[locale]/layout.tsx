import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { MotionConfig } from "framer-motion";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAppearance, getLoadingSettings, getSystemSetting } from "@/lib/settings";
import { ThemeProvider } from "@/components/theme-provider";
import { LoadingExperience } from "@/components/loading-experience";
import { PopupProvider, type PopupData } from "@/components/popup-provider";
import { PwaRegistration } from "@/components/pwa-registration";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import "../globals.css";

const space = localFont({ src: "../../../public/fonts/space-grotesk.woff2", variable: "--font-space", display: "swap" });
const mono = localFont({ src: "../../../public/fonts/jetbrains-mono.woff2", variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "KillByte — Precision, without compromise", template: "%s · KillByte" },
  description: "A secure, globally accessible workspace for accounts, payments, community, rewards, and support.",
  applicationName: "KillByte",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b0b" };
export const dynamic = "force-dynamic";

function mergeTranslations(messages: Record<string, unknown>, values: Array<{ locale: string; value: string; key: { namespace: string; key: string } }>, locale: string) {
  for (const item of values.filter((value) => value.locale === locale)) {
    const namespace = messages[item.key.namespace] as Record<string, unknown> | undefined;
    if (namespace) namespace[item.key.key] = item.value;
  }
  return messages;
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(locale)) notFound();
  const activeLocale = await db.language.findFirst({ where: { code: locale, enabled: true }, select: { code: true, direction: true } });
  if (!activeLocale) notFound();
  setRequestLocale(locale);
  const [baseMessages, user, appearance, loading, popupEnabled, animationsEnabled] = await Promise.all([
    getMessages(), getCurrentUser(), getAppearance(), getLoadingSettings(),
    getSystemSetting("popups.enabled", true),
    getSystemSetting("animations.enabled", true),
  ]);
  const translationValues = await db.translationValue.findMany({ where: { locale, published: true }, include: { key: true } });
  const messages = mergeTranslations(baseMessages as Record<string, unknown>, translationValues, locale);
  let popups: PopupData[] = [];
  if (popupEnabled) {
    const now = new Date();
    const campaigns = await db.popupCampaign.findMany({
      where: { enabled: true, status: "PUBLISHED", AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
      include: { translations: true }, orderBy: { priority: "asc" }, take: 20,
    });
    const dismissed = user ? await db.popupDismissal.findMany({ where: { userId: user.id }, select: { popupId: true } }) : [];
    const dismissedIds = new Set(dismissed.map((item) => item.popupId));
    popups = campaigns.filter((item) => !(item.frequency === "ONCE_USER" && dismissedIds.has(item.id))).map((item) => ({
      id: item.id, name: item.name, type: item.type, title: item.title, description: item.description, htmlSafeContent: item.htmlSafeContent, imageUrl: item.imageUrl, mobileImageUrl: item.mobileImageUrl,
      buttonText: item.buttonText, buttonHref: item.buttonHref, width: item.width, height: item.height, borderRadius: item.borderRadius, position: item.position, overlay: item.overlay,
      glowIntensity: item.glowIntensity, animation: item.animation, animationSpeed: item.animationSpeed, audience: item.audience, roles: item.roles, plans: item.plans,
      pages: item.pages, device: item.device, delaySeconds: item.delaySeconds, frequency: item.frequency, frequencyCap: item.frequencyCap, repeatIntervalHours: item.repeatIntervalHours,
      translations: item.translations.map((translation) => ({ locale: translation.locale, title: translation.title, description: translation.description, buttonText: translation.buttonText })),
    }));
  }
  const style = {
    "--kb-bg": appearance.background, "--kb-surface": appearance.surface, "--kb-elevated": appearance.elevated,
    "--kb-text": appearance.foreground, "--kb-muted": appearance.muted, "--kb-border": appearance.border,
    "--kb-glow": String(appearance.glow / 100), "--kb-radius": `${appearance.radius}px`, "--kb-animation": String(appearance.animationIntensity / 100),
  } as React.CSSProperties;
  return <html lang={locale} dir={activeLocale.direction === "rtl" ? "rtl" : "ltr"} className={`${space.variable} ${mono.variable} dark`} style={style} data-animations={animationsEnabled ? "on" : "off"} suppressHydrationWarning>
    <body><NextIntlClientProvider messages={messages} locale={locale}><MotionConfig reducedMotion={animationsEnabled ? "user" : "always"}><ThemeProvider><div className="ambient" aria-hidden="true" /><div className="noise" aria-hidden="true" /><LoadingExperience config={{ ...loading, enabled: loading.enabled && animationsEnabled }} />{children}<PopupProvider popups={popups} locale={locale} signedIn={Boolean(user)} role={user?.role.key} planId={user?.membershipPlanId} /><Toaster position="bottom-right" toastOptions={{ className: "surface !text-foreground !bg-surface !border-border" }} /><PwaRegistration /><AnalyticsTracker locale={locale} /></ThemeProvider></MotionConfig></NextIntlClientProvider></body>
  </html>;
}
