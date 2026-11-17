import { ArrowUpRight, Award, LayoutDashboard, LifeBuoy, MessagesSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageIntro, Reveal } from "@/components/motion";

export default async function HubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(locale);
  const t = await getTranslations();
  const modules = [
    { href: "/dashboard", icon: LayoutDashboard, title: t("hub.workspace"), body: t("hub.workspaceBody"), span: "md:col-span-7" },
    { href: "/chat", icon: MessagesSquare, title: t("hub.community"), body: t("hub.communityBody"), span: "md:col-span-5" },
    { href: "/tickets", icon: LifeBuoy, title: t("hub.support"), body: t("hub.supportBody"), span: "md:col-span-5" },
    { href: "/rewards", icon: Award, title: t("hub.rewards"), body: t("hub.rewardsBody"), span: "md:col-span-7" },
  ];
  return <div><PageIntro eyebrow="KILLBYTE / CONNECTED SERVICES" title={t("hub.title")} subtitle={t("hub.subtitle")} /><div className="mt-8 grid gap-4 md:grid-cols-12">{modules.map((module, index) => <Reveal key={module.href} delay={index * .04} className={module.span}><a href={`/${locale}${module.href}`} className="surface group flex min-h-[280px] flex-col justify-between p-7 transition-transform hover:-translate-y-1"><div className="flex items-start justify-between"><module.icon size={28} strokeWidth={1.25} /><span className="badge">{t("hub.access")}</span></div><div><h2 className="text-2xl font-medium tracking-tight">{module.title}</h2><p className="text-muted mt-3 max-w-md text-sm">{module.body}</p><span className="btn btn-ghost mt-6 -ml-4">{t("hub.open")}<ArrowUpRight className="transition-transform group-hover:translate-x-1" size={15} /></span></div></a></Reveal>)}</div></div>;
}
