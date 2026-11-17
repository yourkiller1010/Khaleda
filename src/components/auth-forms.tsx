"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { loginAction, registerAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";

export function LoginForm({ locale, google, telegram }: { locale: string; google: boolean; telegram: boolean }) {
  const t = useTranslations("auth");
  return <><ActionForm action={loginAction} className="mt-8 grid gap-5"><input type="hidden" name="locale" value={locale} /><div className="field"><label className="label" htmlFor="identifier">{t("identifier")}</label><input className="input" id="identifier" name="identifier" autoComplete="username" required minLength={3} /></div><div className="field"><label className="label" htmlFor="password">{t("password")}</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div><SubmitButton className="btn btn-primary w-full">{t("login")}<ArrowRight size={15} /></SubmitButton></ActionForm>
    {(google || telegram) && <><div className="my-6 flex items-center gap-3"><span className="hairline flex-1" /><span className="micro text-muted">{t("or")}</span><span className="hairline flex-1" /></div><div className="grid gap-2">{google && <a className="btn btn-secondary w-full" href={`/api/auth/google?locale=${locale}`}>{t("google")}</a>}{telegram && <a className="btn btn-secondary w-full" href={`/${locale}/telegram`}>{t("telegram")}</a>}</div></>}
  </>;
}

export function RegisterForm({ locale, referral = "", google, telegram }: { locale: string; referral?: string; google: boolean; telegram: boolean }) {
  const t = useTranslations("auth");
  return <><ActionForm action={registerAction} className="mt-8 grid gap-5"><input type="hidden" name="locale" value={locale} /><div className="grid gap-5 sm:grid-cols-2"><div className="field"><label className="label" htmlFor="username">{t("username")}</label><input className="input" id="username" name="username" autoComplete="username" required pattern="[A-Za-z0-9_]{3,24}" /></div><div className="field"><label className="label" htmlFor="email">{t("email")}</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div></div><div className="grid gap-5 sm:grid-cols-2"><div className="field"><label className="label" htmlFor="new-password">{t("password")}</label><input className="input" id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required aria-describedby="password-hint" /></div><div className="field"><label className="label" htmlFor="confirm">{t("confirmPassword")}</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></div></div><p id="password-hint" className="-mt-3 text-xs text-muted">{t("passwordHint")}</p><div className="field"><label className="label" htmlFor="referral">{t("referralCode")}</label><input className="input" id="referral" name="referral" defaultValue={referral} /></div><SubmitButton className="btn btn-primary w-full">{t("register")}<ArrowRight size={15} /></SubmitButton></ActionForm>
    {(google || telegram) && <div className="mt-6 grid gap-2">{google && <a className="btn btn-secondary w-full" href={`/api/auth/google?locale=${locale}`}>{t("google")}</a>}{telegram && <a className="btn btn-secondary w-full" href={`/${locale}/telegram`}>{t("telegram")}</a>}</div>}
  </>;
}
