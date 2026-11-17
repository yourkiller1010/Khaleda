"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function AnalyticsTracker({ locale }: { locale: string }) {
  const pathname = usePathname();
  const previous = useRef("");
  useEffect(() => {
    if (!pathname || previous.current === pathname) return;
    previous.current = pathname;
    const existing = sessionStorage.getItem("kb-session-key");
    const sessionKey = existing || crypto.randomUUID();
    if (!existing) sessionStorage.setItem("kb-session-key", sessionKey);
    const payload = JSON.stringify({ event: "page_view", path: pathname, locale, sessionKey, device: matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop" });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
    else void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
  }, [pathname, locale]);
  return null;
}
