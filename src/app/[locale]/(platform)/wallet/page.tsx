import { ArrowDownLeft, ArrowUpRight, LockKeyhole } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageIntro } from "@/components/motion";
import { WalletForms } from "@/components/wallet-forms";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/utils";

export default async function WalletPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ plan?: string }> }) {
  const { locale } = await params;
  const { plan } = await searchParams;
  const user = await requireUser(locale);
  const [t, methods, plans, deposits, withdrawals, ledger] = await Promise.all([
    getTranslations(), db.paymentMethod.findMany({ where: { enabled: true }, orderBy: { name: "asc" } }),
    db.membershipPlan.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
    db.deposit.findMany({ where: { userId: user.id }, include: { method: true, plan: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.withdrawal.findMany({ where: { userId: user.id }, include: { method: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.financialLedgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const methodData = methods.map((method) => ({ ...method, minAmount: method.minAmount.toString(), maxAmount: method.maxAmount.toString(), feeValue: method.feeValue.toString() }));
  const planData = plans.map((item) => ({ id: item.id, name: item.name, price: item.price.toString(), durationDays: item.durationDays }));
  return <div className="grid gap-8"><PageIntro eyebrow="FINANCE / VERIFIED FLOWS" title={t("wallet.title")} subtitle={t("wallet.subtitle")} />
    <div className="grid gap-8 xl:grid-cols-[.85fr_1.15fr]"><div className="grid content-start gap-6"><section className="surface relative overflow-hidden p-7"><div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-border shadow-[0_0_70px_rgb(255_255_255/_.06)]" /><p className="micro text-muted">{t("wallet.balance")}</p><p className="mono mt-5 text-4xl tracking-tight">{formatMoney(user.walletBalance.toString(), user.walletCurrency)}</p><div className="mt-7 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted"><LockKeyhole size={14} />{t("wallet.reserved")}</div></section><WalletForms locale={locale} methods={methodData} plans={planData} initialPlanId={plan} /></div>
      <div className="grid content-start gap-8"><section><h2 className="mb-5 text-xl font-medium">{t("wallet.history")}</h2>{deposits.length || withdrawals.length ? <div className="table-wrap"><table className="table"><thead><tr><th>{t("wallet.type")}</th><th>{t("common.reference")}</th><th>{t("common.amount")}</th><th>{t("common.status")}</th><th>{t("common.date")}</th></tr></thead><tbody>{[
        ...deposits.map((item) => ({ id: item.id, type: t("wallet.deposits"), reference: item.reference, amount: formatMoney(item.amount.toString(), item.currency), status: item.status, date: item.createdAt, detail: item.plan?.name ?? item.method.name })),
        ...withdrawals.map((item) => ({ id: item.id, type: t("wallet.withdrawals"), reference: item.reference, amount: formatMoney(item.amount.toString(), item.currency), status: item.status, date: item.createdAt, detail: item.method.name })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()).map((item) => <tr key={item.id}><td><span className="flex items-center gap-2">{item.type === t("wallet.deposits") ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{item.type}</span><span className="mt-1 block text-xs text-muted">{item.detail}</span></td><td className="mono text-xs">{item.reference}</td><td className="mono">{item.amount}</td><td><span className="badge">{item.status}</span></td><td className="text-muted">{item.date.toLocaleDateString(locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("common.noData")} body={t("wallet.empty")} />}</section>
        <section><h2 className="mb-5 text-xl font-medium">{t("wallet.ledger")}</h2>{ledger.length ? <div className="surface divide-y divide-border">{ledger.map((entry) => <div key={entry.id} className="grid grid-cols-[1fr_auto] gap-4 p-4 text-sm"><div><p>{entry.type}</p><p className="mono mt-1 text-[10px] text-muted">{entry.reference}</p></div><div className="text-right"><p className="mono">{formatMoney(entry.amount.toString(), entry.currency)}</p><p className="mt-1 text-xs text-muted">{entry.createdAt.toLocaleDateString(locale)}</p></div></div>)}</div> : <EmptyState title={t("common.noData")} body={t("common.noDataHint")} />}</section>
      </div></div>
  </div>;
}
