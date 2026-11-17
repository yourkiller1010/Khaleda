"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Globe2, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { setLocaleAction } from "@/actions/locale";
import { useTranslations } from "next-intl";

type Language = { code: string; englishName: string; nativeName: string; flag: string | null };

export function LanguageSelector({ languages, current }: { languages: Language[]; current: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const t = useTranslations("common");
  const active = languages.find((language) => language.code === current);
  const filtered = useMemo(() => languages.filter((language) => `${language.englishName} ${language.nativeName} ${language.code}`.toLowerCase().includes(query.toLowerCase())), [languages, query]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <div className="relative">
    <button type="button" className="icon-btn relative" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" aria-label={t("language")}><Globe2 size={17} /><span className="absolute -bottom-1 -right-1 bg-background border border-border rounded px-1 micro text-[8px]">{current.toUpperCase()}</span></button>
    <AnimatePresence>{open && <>
      <button className="fixed inset-0 z-40 cursor-default bg-black/30" aria-label={t("close")} onClick={() => setOpen(false)} />
      <motion.div role="dialog" aria-label={t("language")} className="fixed left-3 right-3 top-20 z-50 mx-auto max-w-md surface p-4 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[380px]" initial={{ opacity: 0, y: -8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: .98 }} transition={{ duration: .18 }}>
        <div className="flex items-center justify-between gap-4 px-1 pb-3"><div><p className="font-medium">{t("language")}</p><p className="text-xs text-muted">{active?.nativeName}</p></div><button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t("close")}><X size={16} /></button></div>
        <div className="relative"><Search className="absolute left-3 top-3.5 text-muted" size={16} /><input autoFocus className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} /></div>
        <div className="scrollbar mt-3 max-h-[320px] space-y-1 overflow-y-auto">
          {filtered.map((language) => <form key={language.code} action={setLocaleAction}><input type="hidden" name="locale" value={language.code} /><input type="hidden" name="path" value={pathname} /><button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-elevated" onClick={() => setOpen(false)}><span className="w-7 text-lg" aria-hidden="true">{language.flag ?? language.code.toUpperCase()}</span><span className="flex-1"><span className="block text-sm">{language.nativeName}</span><span className="block text-xs text-muted">{language.englishName}</span></span>{language.code === current && <Check size={16} />}</button></form>)}
          {!filtered.length && <p className="py-8 text-center text-sm text-muted">{t("noData")}</p>}
        </div>
      </motion.div>
    </>}</AnimatePresence>
  </div>;
}
