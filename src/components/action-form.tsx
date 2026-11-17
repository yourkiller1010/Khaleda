"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type State = { ok?: boolean; error?: string; message?: string; reference?: string };
const initial: State = {};

export function ActionForm({ action, children, className, id, onInput, onChange }: { action: (state: State, data: FormData) => Promise<State>; children: React.ReactNode; className?: string; id?: string; onInput?: React.FormEventHandler<HTMLFormElement>; onChange?: React.FormEventHandler<HTMLFormElement> }) {
  const [state, formAction, pending] = useActionState(action, initial);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state]);
  return <form id={id} action={formAction} className={className} aria-busy={pending} onInput={onInput} onChange={onChange}>{children}<div data-form-pending={pending} className="hidden" /></form>;
}

export function SubmitButton({ children, className = "btn btn-primary", pendingLabel, name, value }: { children: React.ReactNode; className?: string; pendingLabel?: string; name?: string; value?: string }) {
  const t = useTranslations("common");
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} className={className} disabled={pending}>{pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" aria-hidden="true" />}{pending ? (pendingLabel ?? t("loading")) : children}</button>;
}
