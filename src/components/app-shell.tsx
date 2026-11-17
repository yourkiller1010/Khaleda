"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Award, Bell, Boxes, ChevronDown, Circle, Layers3, LayoutDashboard, LifeBuoy, LogOut, Menu, MessagesSquare, ShieldCheck, UserRound, UsersRound, WalletCards, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeToggle } from "@/components/theme-provider";
import { logoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

const icons = { LayoutDashboard, Boxes, MessagesSquare, Award, WalletCards, Layers3, UsersRound, LifeBuoy, UserRound, ShieldCheck, Circle };
type Item = { id: string; labelKey: string; customLabel: string | null; href: string; icon: string; badgeText: string | null; badgeStyle: string; highlight: string; mobileVisible: boolean; desktopVisible: boolean; children: Array<Omit<Item, "children">> };
type Language = React.ComponentProps<typeof LanguageSelector>["languages"][number];

function Navigation({ items, locale, pathname, onNavigate }: { items: Item[]; locale: string; pathname: string; onNavigate?: () => void }) {
  const t = useTranslations();
  return <nav className="grid gap-1" aria-label={t("nav.workspace")}>{items.map((item) => {
    const Icon = icons[item.icon as keyof typeof icons] ?? Circle;
    const href = `/${locale}${item.href}`;
    const active = pathname === href || (item.href !== "/dashboard" && pathname.startsWith(href));
    return <div key={item.id}><a href={href} onClick={onNavigate} className={cn("nav-link", active && "active", item.highlight === "SOFT_GLOW" && "nav-glow", item.highlight === "UNDERLINE" && "nav-underline", item.highlight === "BORDER" && "nav-border", item.highlight === "SILVER" && "nav-silver", !item.desktopVisible && "md:hidden")}>
      <Icon size={17} strokeWidth={1.7} /><span className="flex-1 text-sm">{item.customLabel ?? t(item.labelKey)}</span>{item.badgeText && <span className={cn("badge", `badge-${item.badgeStyle}`)}>{item.badgeText}</span>}{item.children.length > 0 && <ChevronDown size={13} />}
    </a>{item.children.length > 0 && <div className="ml-5 border-l border-border pl-3">{item.children.map((child) => <a key={child.id} href={`/${locale}${child.href}`} onClick={onNavigate} className="nav-link text-xs"><span className="flex-1">{child.customLabel ?? t(child.labelKey)}</span>{child.badgeText && <span className="badge">{child.badgeText}</span>}</a>)}</div>}</div>;
  })}</nav>;
}

export function AppShell({ children, locale, user, items, languages, notificationCount }: { children: React.ReactNode; locale: string; user: { displayName: string; email: string; role: string }; items: Item[]; languages: Language[]; notificationCount: number }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const t = useTranslations();
  const mobileItems = items.filter((item) => item.mobileVisible && ["/dashboard", "/chat", "/hub", "/wallet", "/profile"].includes(item.href)).slice(0, 5);
  return <div className="min-h-dvh">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-background/90 p-5 backdrop-blur-xl md:flex"><div className="mb-8 px-2"><Logo href={`/${locale}`} /></div><p className="micro text-muted mb-3 px-3">{t("nav.workspace")}</p><div className="scrollbar flex-1 overflow-y-auto"><Navigation items={items} locale={locale} pathname={pathname} /></div>
      <div className="mt-5 border-t border-border pt-4"><div className="mb-3 px-2"><p className="truncate text-sm font-medium">{user.displayName}</p><p className="truncate text-xs text-muted">{user.email}</p></div><div className="flex items-center justify-between px-2"><span className="badge">{user.role}</span><form action={logoutAction}><input type="hidden" name="locale" value={locale} /><button className="icon-btn" type="submit" aria-label={t("common.logout")}><LogOut size={16} /></button></form></div></div>
    </aside>
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl md:ml-[248px] md:px-8"><div className="flex items-center gap-3"><button type="button" className="icon-btn md:hidden" onClick={() => setDrawer(true)} aria-label={t("nav.menu")}><Menu size={18} /></button><div className="md:hidden"><Logo href={`/${locale}`} compact /></div><div className="hidden items-center gap-2 md:flex"><span className="status-dot" /><span className="micro text-muted">{t("common.secure")}</span></div></div><div className="flex items-center gap-2"><a className="icon-btn relative" href={`/${locale}/dashboard#notifications`} aria-label={t("dashboard.notifications")}><Bell size={17} />{notificationCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[10px] text-background">{notificationCount}</span>}</a><LanguageSelector languages={languages} current={locale} /><ThemeToggle /></div></header>
    <main className="min-w-0 pb-28 md:ml-[248px] md:pb-8"><div className="mx-auto max-w-[1500px] p-4 md:p-8">{children}</div></main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label={t("nav.workspace")}>{mobileItems.map((item) => { const Icon = icons[item.icon as keyof typeof icons] ?? Circle; const href = `/${locale}${item.href}`; const active = pathname === href; return <a key={item.id} href={href} className={cn("relative flex min-h-[64px] min-w-14 flex-col items-center justify-center gap-1 px-2 text-[10px]", active ? "text-foreground" : "text-muted")}><Icon size={item.href === "/hub" ? 24 : 19} className={item.href === "/hub" ? "-mt-5 rounded-full bg-foreground p-1 text-background" : ""} /><span>{item.customLabel ?? t(item.labelKey)}</span></a>; })}</nav>
    <AnimatePresence>{drawer && <><motion.button className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setDrawer(false)} aria-label={t("common.close")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,88vw)] flex-col bg-background p-5 md:hidden" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: .22, ease: "easeOut" }}><div className="mb-8 flex items-center justify-between"><Logo href={`/${locale}`} /><button type="button" className="icon-btn" onClick={() => setDrawer(false)} aria-label={t("common.close")}><X size={17} /></button></div><div className="scrollbar flex-1 overflow-y-auto"><Navigation items={items} locale={locale} pathname={pathname} onNavigate={() => setDrawer(false)} /></div><form action={logoutAction} className="mt-4"><input type="hidden" name="locale" value={locale} /><button className="btn btn-secondary w-full" type="submit"><LogOut size={15} />{t("common.logout")}</button></form></motion.aside></>}</AnimatePresence>
  </div>;
}
