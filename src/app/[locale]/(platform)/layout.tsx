import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getNavigation } from "@/lib/navigation";
import { getSystemSetting } from "@/lib/settings";
import { AppShell } from "@/components/app-shell";
import { Logo } from "@/components/logo";

export default async function PlatformLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const maintenance = await getSystemSetting("maintenance.enabled", false);
  if (maintenance && !["OWNER", "ADMIN"].includes(user.role.key)) {
    const t = await getTranslations("maintenance");
    return <main className="grid min-h-dvh place-items-center p-6"><section className="surface max-w-xl p-10 text-center"><div className="flex justify-center"><Logo href={`/${locale}`} /></div><p className="micro text-muted mt-10">MAINTENANCE / SCHEDULED</p><h1 className="display mt-4 text-5xl">{t("title")}</h1><p className="text-muted mt-5">{t("body")}</p><a className="btn btn-secondary mt-8" href={`/${locale}/login`}>{t("admin")}</a></section></main>;
  }
  const [items, languages, notificationCount] = await Promise.all([
    getNavigation(user), db.language.findMany({ where: { enabled: true }, orderBy: { englishName: "asc" } }), db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return <AppShell locale={locale} user={{ displayName: user.displayName, email: user.email, role: user.role.name }} items={items} languages={languages} notificationCount={notificationCount}>{children}</AppShell>;
}
