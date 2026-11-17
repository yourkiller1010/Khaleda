"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeToggle } from "@/components/theme-provider";

type Language = React.ComponentProps<typeof LanguageSelector>["languages"][number];

export function PublicHeader({ locale, signedIn, languages }: { locale: string; signedIn: boolean; languages: Language[] }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const links = [{ href: `/${locale}/pricing`, label: t("nav.pricing") }, { href: `/${locale}#platform`, label: t("admin.module") }, { href: signedIn ? `/${locale}/dashboard` : `/${locale}/login`, label: signedIn ? t("nav.dashboard") : t("nav.login") }];
  return <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl"><div className="page-shell flex h-[72px] items-center justify-between gap-4"><Logo href={`/${locale}`} />
    <nav className="hidden items-center gap-2 md:flex" aria-label={t("nav.menu")}>{links.map((link) => <a key={link.href} className="btn btn-ghost" href={link.href}>{link.label}</a>)}</nav>
    <div className="flex items-center gap-2"><LanguageSelector languages={languages} current={locale} /><ThemeToggle /><a className="btn btn-primary hidden sm:inline-flex" href={signedIn ? `/${locale}/hub` : `/${locale}/register`}>{signedIn ? t("nav.hub") : t("nav.register")}<ArrowUpRight size={15} /></a><button className="icon-btn md:hidden" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t("nav.menu")}>{open ? <X size={18} /> : <Menu size={18} />}</button></div></div>
    <AnimatePresence>{open && <motion.nav className="absolute inset-x-3 top-[76px] surface grid gap-1 p-3 md:hidden" initial={{ opacity: 0, y: -8, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>{links.map((link) => <a onClick={() => setOpen(false)} key={link.href} className="nav-link" href={link.href}>{link.label}</a>)}<a className="btn btn-primary mt-2" href={signedIn ? `/${locale}/hub` : `/${locale}/register`}>{signedIn ? t("nav.hub") : t("nav.register")}</a></motion.nav>}</AnimatePresence>
  </header>;
}
