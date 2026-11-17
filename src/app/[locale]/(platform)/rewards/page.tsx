import { Award, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageIntro } from "@/components/motion";
import { EmptyState } from "@/components/empty-state";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { claimDailyRewardAction, toggleBadgeAction } from "@/actions/account";
import { formatMoney } from "@/lib/utils";

export default async function RewardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const [t, badges, history, today] = await Promise.all([
    getTranslations(), db.userBadge.findMany({ where: { userId: user.id }, include: { badge: true }, orderBy: { badge: { priority: "desc" } } }),
    db.rewardTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.rewardTransaction.findUnique({ where: { reference: `LUCKY_${user.id}_${new Date().toISOString().slice(0, 10)}` } }),
  ]);
  return <div className="grid gap-8"><PageIntro eyebrow="REWARDS / PERMANENT RECORDS" title={t("rewards.title")} subtitle={t("rewards.subtitle")} /><div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section><h2 className="mb-5 text-xl font-medium">{t("rewards.badges")}</h2>{badges.length ? <div className="grid gap-4 sm:grid-cols-2">{badges.map(({ badge, displayed, earnedAt, badgeId }) => <article key={badge.id} className="surface flex min-h-64 flex-col p-6"><div className="flex items-start justify-between"><Award size={29} strokeWidth={1.25} /><span className="badge">{badge.rarity}</span></div><h3 className="mt-8 text-xl font-medium">{badge.name}</h3><p className="text-muted mt-2 flex-1 text-sm">{badge.description}</p><p className="micro text-muted mt-5">{earnedAt.toLocaleDateString(locale)}</p><form action={toggleBadgeAction} className="mt-4"><input type="hidden" name="badgeId" value={badgeId} /><input type="hidden" name="locale" value={locale} /><button type="submit" className="btn btn-secondary w-full">{displayed ? t("rewards.displayed") : t("rewards.display")}</button></form></article>)}</div> : <EmptyState title={t("common.noData")} body={t("rewards.emptyBadges")} />}</section>
      <section className="surface relative overflow-hidden p-7"><div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-border" /><Sparkles size={27} strokeWidth={1.3} /><h2 className="mt-8 text-2xl font-medium tracking-tight">{t("rewards.lucky")}</h2><p className="text-muted mt-3 text-sm">{t("rewards.luckyBody")}</p>{today ? <div className="mt-8 border-y border-border py-6"><p className="micro text-muted">{today.createdAt.toLocaleDateString(locale)}</p><p className="mono mt-2 text-3xl">{formatMoney(today.amount.toString())}</p><p className="mt-2 text-xs text-muted">{today.reference}</p></div> : <ActionForm action={claimDailyRewardAction} className="mt-8"><input type="hidden" name="locale" value={locale} /><SubmitButton className="btn btn-primary w-full">{t("rewards.claim")}</SubmitButton></ActionForm>}</section></div>
    <section><h2 className="mb-5 text-xl font-medium">{t("rewards.history")}</h2>{history.length ? <div className="table-wrap"><table className="table"><thead><tr><th>{t("wallet.type")}</th><th>{t("common.amount")}</th><th>{t("common.reference")}</th><th>{t("common.date")}</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><span className="badge">{item.type}</span></td><td className="mono">{formatMoney(item.amount.toString())}</td><td className="mono text-xs">{item.reference}</td><td className="text-muted">{item.createdAt.toLocaleString(locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("common.noData")} body={t("common.noDataHint")} />}</section></div>;
}
