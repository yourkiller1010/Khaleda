import { UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageIntro } from "@/components/motion";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";

export default async function ReferralsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const [t, referrals] = await Promise.all([getTranslations(), db.referral.findMany({ where: { referrerId: user.id }, include: { referred: { select: { username: true, createdAt: true } } }, orderBy: { createdAt: "desc" } })]);
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host") ?? "localhost:3000";
  const protocol = (await headers()).get("x-forwarded-proto") ?? "http";
  const link = `${protocol}://${host}/${locale}/register?ref=${user.referralCode}`;
  return <div className="grid gap-8"><PageIntro eyebrow="NETWORK / VERIFIED CONVERSIONS" title={t("referrals.title")} subtitle={t("referrals.subtitle")} /><div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section className="surface p-7"><p className="micro text-muted">{t("referrals.code")}</p><div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="mono break-all text-3xl tracking-tight">{user.referralCode}</p><CopyButton value={user.referralCode} /></div><div className="mt-8 border-t border-border pt-6"><p className="label">{t("referrals.link")}</p><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-3 text-xs text-muted">{link}</code><CopyButton value={link} /></div></div></section><section className="surface grid grid-cols-2 gap-px overflow-hidden bg-border p-0"><div className="bg-surface p-6"><UsersRound size={18} className="text-muted" /><p className="micro text-muted mt-8">{t("referrals.points")}</p><p className="mono mt-2 text-3xl">{user.referralPoints}</p></div><div className="bg-surface p-6"><p className="micro text-muted mt-[86px]">{t("referrals.total")}</p><p className="mono mt-2 text-3xl">{referrals.length}</p></div></section></div>
    <section><h2 className="mb-5 text-xl font-medium">{t("referrals.history")}</h2>{referrals.length ? <div className="table-wrap"><table className="table"><thead><tr><th>{t("common.user")}</th><th>{t("common.status")}</th><th>{t("common.date")}</th></tr></thead><tbody>{referrals.map((referral) => <tr key={referral.id}><td>@{referral.referred.username}</td><td><span className="badge">{referral.convertedAt ? "CONVERTED" : "REGISTERED"}</span></td><td className="text-muted">{referral.createdAt.toLocaleDateString(locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("common.noData")} body={t("referrals.empty")} />}</section><section className="border-t border-border pt-7"><h2 className="text-xl font-medium">{t("referrals.how")}</h2><p className="text-muted mt-3 max-w-3xl">{t("referrals.howBody")}</p></section></div>;
}
