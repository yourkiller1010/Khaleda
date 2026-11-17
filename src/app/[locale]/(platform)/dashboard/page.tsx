import { ArrowUpRight, Bell, Check, CircleDollarSign, LifeBuoy, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageIntro, Reveal } from "@/components/motion";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/utils";
import { markNotificationsReadAction } from "@/actions/account";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const [t, ledger, notifications, announcements, openTickets, membership] = await Promise.all([
    getTranslations(), db.financialLedgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.announcement.findMany({ where: { status: "PUBLISHED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }], take: 3 }),
    db.supportTicket.count({ where: { userId: user.id, status: { in: ["OPEN", "PENDING"] } } }),
    user.membershipPlanId ? db.membershipPlan.findUnique({ where: { id: user.membershipPlanId } }) : null,
  ]);
  const metrics = [
    { label: t("dashboard.balance"), value: formatMoney(user.walletBalance.toString(), user.walletCurrency), icon: WalletCards },
    { label: t("dashboard.membership"), value: membership?.name ?? t("dashboard.noMembership"), icon: ShieldCheck },
    { label: t("dashboard.referralPoints"), value: user.referralPoints.toLocaleString(), icon: UsersRound },
    { label: t("dashboard.openTickets"), value: openTickets.toLocaleString(), icon: LifeBuoy },
  ];
  return <div className="grid gap-8"><PageIntro eyebrow={`KILLBYTE / ${user.role.name.toUpperCase()}`} title={t("dashboard.title", { name: user.displayName })} subtitle={t("dashboard.subtitle")} />
    <section className="grid gap-px overflow-hidden rounded-[var(--kb-radius)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="bg-surface p-5 md:p-6"><div className="flex items-center justify-between"><p className="micro text-muted">{metric.label}</p><metric.icon className="text-muted" size={17} strokeWidth={1.5} /></div><p className="mt-6 truncate text-2xl font-medium tracking-tight">{metric.value}</p></div>)}</section>
    <div className="grid gap-8 xl:grid-cols-[1.55fr_.75fr]"><div className="grid content-start gap-8"><Reveal><section><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-medium">{t("dashboard.quickActions")}</h2></div><div className="grid gap-3 sm:grid-cols-3">{[
      { href: `/${locale}/wallet`, icon: CircleDollarSign, label: t("dashboard.addFunds") }, { href: `/${locale}/pricing`, icon: ShieldCheck, label: t("dashboard.exploreMembership") }, { href: `/${locale}/tickets`, icon: LifeBuoy, label: t("dashboard.openSupport") },
    ].map((action) => <a key={action.href} href={action.href} className="surface group flex min-h-32 flex-col justify-between p-5 transition-transform hover:-translate-y-0.5"><action.icon size={21} strokeWidth={1.4} /><span className="flex items-center justify-between gap-2 text-sm">{action.label}<ArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={15} /></span></a>)}</div></section></Reveal>
      <section><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-medium">{t("dashboard.recentActivity")}</h2><a className="micro text-muted hover:text-foreground" href={`/${locale}/wallet`}>{t("common.viewAll")}</a></div>{ledger.length ? <div className="table-wrap"><table className="table"><thead><tr><th>{t("wallet.type")}</th><th>{t("common.reference")}</th><th>{t("common.amount")}</th><th>{t("common.date")}</th></tr></thead><tbody>{ledger.map((entry) => <tr key={entry.id}><td><span className="badge">{entry.type}</span></td><td className="mono text-xs">{entry.reference}</td><td className="mono">{formatMoney(entry.amount.toString(), entry.currency)}</td><td className="text-muted">{entry.createdAt.toLocaleDateString(locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("common.noData")} body={t("dashboard.emptyActivity")} />}</section>
      <section><h2 className="mb-5 text-xl font-medium">{t("dashboard.announcements")}</h2>{announcements.length ? <div className="grid gap-3">{announcements.map((announcement) => <article key={announcement.id} className="surface p-5"><div className="flex items-center gap-3"><span className="micro text-muted">{announcement.publishedAt?.toLocaleDateString(locale)}</span>{announcement.pinned && <span className="badge">PINNED</span>}</div><h3 className="mt-3 text-lg font-medium">{announcement.title}</h3><p className="text-muted mt-2 whitespace-pre-wrap text-sm">{announcement.body}</p></article>)}</div> : <EmptyState title={t("common.noData")} body={t("common.noDataHint")} />}</section>
    </div>
    <aside className="grid content-start gap-8"><section id="notifications"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-medium">{t("dashboard.notifications")}</h2>{notifications.some((item) => !item.readAt) && <form action={markNotificationsReadAction}><input type="hidden" name="locale" value={locale} /><button className="micro text-muted hover:text-foreground" type="submit">{t("dashboard.markRead")}</button></form>}</div><div className="surface divide-y divide-border">{notifications.length ? notifications.map((notification) => <a key={notification.id} href={notification.href ?? `/${locale}/dashboard`} className="block p-4 transition-colors hover:bg-elevated"><div className="flex gap-3"><Bell className="mt-1 shrink-0 text-muted" size={15} /><div><p className="text-sm font-medium">{notification.title}</p><p className="text-muted mt-1 text-xs">{notification.body}</p><p className="micro text-muted mt-3">{notification.createdAt.toLocaleDateString(locale)}</p></div>{!notification.readAt && <span className="status-dot ml-auto mt-2" />}</div></a>) : <p className="text-muted p-6 text-sm">{t("common.noData")}</p>}</div></section>
      <section className="surface p-6"><h2 className="text-lg font-medium">{t("dashboard.accountHealth")}</h2><div className="mt-5 grid gap-4">{[{ label: t("dashboard.verified"), value: user.status }, { label: t("dashboard.session"), value: t("common.active") }, { label: t("dashboard.language"), value: user.locale.toUpperCase() }].map((item) => <div key={item.label} className="flex items-center justify-between border-b border-border pb-3 last:border-0"><span className="text-sm text-muted">{item.label}</span><span className="flex items-center gap-2 text-xs"><Check size={13} />{item.value}</span></div>)}</div></section>
    </aside></div>
  </div>;
}
