"use client";

import { usePathname } from "next/navigation";
import { adminGroups, adminSectionPermissions } from "./admin-config";
import { cn } from "@/lib/utils";

export function AdminNav({ locale, permissions }: { locale: string; permissions: string[] }) {
  const pathname = usePathname();
  const groups = adminGroups.map((group) => ({ ...group, items: group.items.filter((item) => permissions.includes(adminSectionPermissions[item.slug])) })).filter((group) => group.items.length);
  return <nav aria-label="Administration modules" className="scrollbar flex max-h-none gap-5 overflow-x-auto pb-3 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-110px)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-6">
    {groups.map((group) => <div key={group.label} className="min-w-44 lg:min-w-0"><p className="micro text-muted mb-2 px-2">{group.label}</p><div className="grid gap-0.5">{group.items.map((item) => {
      const href = `/${locale}/admin${item.slug ? `/${item.slug}` : ""}`;
      const active = item.slug ? pathname.startsWith(href) : pathname === href;
      return <a key={item.slug || "overview"} href={href} className={cn("flex min-h-9 items-center rounded-lg px-3 text-xs transition-colors", active ? "bg-foreground text-background" : "text-muted hover:bg-elevated hover:text-foreground")} aria-current={active ? "page" : undefined}>{item.label}</a>;
    })}</div></div>)}
  </nav>;
}
