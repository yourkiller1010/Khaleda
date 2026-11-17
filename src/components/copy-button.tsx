"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("common");
  return <button type="button" className="btn btn-secondary" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? t("copied") : (label ?? t("copy"))}</button>;
}
