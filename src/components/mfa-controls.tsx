"use client";

import { useActionState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { beginMfaSetupAction, disableMfaAction, enableMfaAction, verifyMfaAction, type MfaState } from "@/actions/mfa";
import { SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";

const initial: MfaState = {};

function StateMessage({ state }: { state: MfaState }) {
  if (state.error) return <p role="alert" className="border border-border bg-elevated p-3 text-sm">{state.error}</p>;
  if (state.message) return <p role="status" className="border border-border bg-elevated p-3 text-sm text-muted">{state.message}</p>;
  return null;
}

export function MfaVerifyForm({ locale }: { locale: string }) {
  const [state, action] = useActionState(verifyMfaAction, initial);
  return <form action={action} className="mt-8 grid gap-5"><input type="hidden" name="locale" value={locale} /><div className="field"><label className="label" htmlFor="mfa-code">Authenticator or recovery code</label><input className="input mono tracking-widest" id="mfa-code" name="code" autoComplete="one-time-code" inputMode="text" required autoFocus maxLength={20} placeholder="000000" /></div><StateMessage state={state} /><SubmitButton className="btn btn-primary w-full" pendingLabel="Verifying"><ShieldCheck size={15} />Verify secure session</SubmitButton></form>;
}

export function MfaPanel({ locale, enabled, pending }: { locale: string; enabled: boolean; pending: boolean }) {
  const [setup, startSetup] = useActionState(beginMfaSetupAction, initial);
  const [activation, activate] = useActionState(enableMfaAction, initial);
  const [disable, disableAction] = useActionState(disableMfaAction, initial);
  return <div id="mfa" className="grid gap-5">
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-medium"><KeyRound size={18} />Multi-factor authentication</h2><span className="badge">{enabled ? "Enabled" : "Disabled"}</span></div>
    <p className="text-sm text-muted">TOTP authenticator support and ten single-use recovery codes. Privileged sessions require verification whenever MFA is enabled.</p>
    {!enabled && <form action={startSetup}><input type="hidden" name="locale" value={locale} /><SubmitButton className="btn btn-secondary" pendingLabel="Generating">Begin secure setup</SubmitButton></form>}
    <StateMessage state={setup} />
    {setup.secret && <div className="inset grid gap-4 p-4"><p className="micro text-muted">Manual authenticator key</p><p className="mono break-all text-sm">{setup.secret}</p><div className="flex flex-wrap gap-2"><CopyButton value={setup.secret} label="Copy setup key" /><a className="btn btn-secondary" href={setup.uri}>Open authenticator</a></div></div>}
    {!enabled && (pending || setup.secret) && <form action={activate} className="grid gap-4 border-t border-border pt-5"><input type="hidden" name="locale" value={locale} /><div className="field"><label className="label" htmlFor="setup-code">Six-digit authenticator code</label><input className="input mono" id="setup-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></div><StateMessage state={activation} /><SubmitButton className="btn btn-primary w-fit">Verify & enable MFA</SubmitButton></form>}
    {activation.codes && <div className="inset p-4"><p className="micro text-muted">Single-use recovery codes — store offline now</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{activation.codes.map((code) => <code key={code} className="mono border border-border p-2 text-center text-xs">{code}</code>)}</div><div className="mt-4"><CopyButton value={activation.codes.join("\n")} label="Copy recovery codes" /></div></div>}
    {enabled && <form action={disableAction} className="grid gap-4 border-t border-border pt-5"><input type="hidden" name="locale" value={locale} /><div className="field"><label className="label" htmlFor="disable-code">Authenticator or recovery code</label><input className="input mono" id="disable-code" name="code" autoComplete="one-time-code" required maxLength={20} /></div><StateMessage state={disable} /><SubmitButton className="btn btn-danger w-fit">Disable MFA</SubmitButton></form>}
  </div>;
}
