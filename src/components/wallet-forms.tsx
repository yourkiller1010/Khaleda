"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { createDepositAction, createWithdrawalAction } from "@/actions/finance";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { formatMoney } from "@/lib/utils";

type Method = { id: string; name: string; provider: string; instructions: string | null; minAmount: string; maxAmount: string; feeType: string; feeValue: string; type: string };
type Plan = { id: string; name: string; price: string; durationDays: number };

export function WalletForms({ locale, methods, plans, initialPlanId }: { locale: string; methods: Method[]; plans: Plan[]; initialPlanId?: string }) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const initialPlan = plans.find((plan) => plan.id === initialPlanId);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState(initialPlan?.price ?? "");
  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const t = useTranslations("wallet");
  const method = methods.find((item) => item.id === methodId);
  const fee = method?.feeType === "PERCENT" ? Number(amount || 0) * Number(method.feeValue) / 100 : Number(method?.feeValue ?? 0);
  const available = methods.filter((item) => tab === "deposit" ? ["BOTH", "DEPOSIT"].includes(item.type) : ["BOTH", "WITHDRAWAL"].includes(item.type));
  return <section className="surface overflow-hidden"><div className="grid grid-cols-2 border-b border-border"><button type="button" onClick={() => { setTab("deposit"); setMethodId(methods.find((item) => ["BOTH", "DEPOSIT"].includes(item.type))?.id ?? ""); }} className={`min-h-14 text-sm transition-colors ${tab === "deposit" ? "bg-foreground text-background" : "text-muted hover:bg-elevated"}`}><ArrowDownLeft className="mr-2 inline" size={15} />{t("deposit")}</button><button type="button" onClick={() => { setTab("withdraw"); setMethodId(methods.find((item) => ["BOTH", "WITHDRAWAL"].includes(item.type))?.id ?? ""); }} className={`min-h-14 text-sm transition-colors ${tab === "withdraw" ? "bg-foreground text-background" : "text-muted hover:bg-elevated"}`}><ArrowUpRight className="mr-2 inline" size={15} />{t("withdraw")}</button></div>
    <div className="p-6">{tab === "deposit" ? <ActionForm action={createDepositAction} className="grid gap-5"><input type="hidden" name="locale" value={locale} /><div className="field"><label className="label" htmlFor="deposit-method">{t("method")}</label><select className="select" id="deposit-method" name="methodId" value={methodId} onChange={(event) => setMethodId(event.target.value)} required>{available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="field"><label className="label" htmlFor="plan">{t("plan")}</label><select className="select" id="plan" name="planId" value={planId} onChange={(event) => { setPlanId(event.target.value); const plan = plans.find((item) => item.id === event.target.value); if (plan) setAmount(plan.price); }}><option value="">{t("noPlan")}</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {formatMoney(plan.price)}</option>)}</select></div><div className="field"><label className="label" htmlFor="deposit-amount">{t("amount")}</label><input className="input mono" id="deposit-amount" name="amount" type="number" min={method?.minAmount} max={method?.maxAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required readOnly={Boolean(planId)} /></div>{method?.instructions && <div className="inset p-4"><p className="micro text-muted mb-2">{t("instructions")}</p><p className="text-sm text-muted">{method.instructions}</p></div>}<SubmitButton>{t("deposit")}<ArrowDownLeft size={15} /></SubmitButton></ActionForm> : <ActionForm action={createWithdrawalAction} className="grid gap-5"><input type="hidden" name="locale" value={locale} /><div className="field"><label className="label" htmlFor="withdraw-method">{t("method")}</label><select className="select" id="withdraw-method" name="methodId" value={methodId} onChange={(event) => setMethodId(event.target.value)} required>{available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="field"><label className="label" htmlFor="withdraw-amount">{t("amount")}</label><input className="input mono" id="withdraw-amount" name="amount" type="number" min={method?.minAmount} max={method?.maxAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><div className="field"><label className="label" htmlFor="destination">{t("destination")}</label><input className="input" id="destination" name="destination" required minLength={6} autoComplete="off" /></div><div className="flex justify-between border-y border-border py-3 text-sm"><span className="text-muted">{t("fee")}</span><span className="mono">{formatMoney(fee)}</span></div><SubmitButton>{t("withdraw")}<ArrowUpRight size={15} /></SubmitButton></ActionForm>}</div>
  </section>;
}
