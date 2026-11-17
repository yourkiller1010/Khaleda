"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type PopupData = {
  id: string;
  name: string;
  type: string;
  title: string;
  description: string;
  htmlSafeContent: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  buttonText: string | null;
  buttonHref: string | null;
  width: number;
  height: number | null;
  borderRadius: number;
  position: string;
  overlay: string;
  glowIntensity: number;
  animation: string;
  animationSpeed: number;
  audience: string;
  roles: string[];
  plans: string[];
  pages: string[];
  device: string;
  delaySeconds: number;
  frequency: string;
  frequencyCap: number;
  repeatIntervalHours: number | null;
  translations: Array<{ locale: string; title: string; description: string; buttonText: string | null }>;
};

async function track(popupId: string, event: string, sessionKey: string, locale: string, path: string) {
  await fetch("/api/popup-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ popupId, event, sessionKey, locale, path, device: matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop" }),
  }).catch(() => undefined);
}

export function PopupProvider({ popups, locale, signedIn, role, planId }: { popups: PopupData[]; locale: string; signedIn: boolean; role?: string; planId?: string | null }) {
  const pathname = usePathname();
  const [sessionKey, setSessionKey] = useState("");
  const [device, setDevice] = useState<"MOBILE" | "DESKTOP">("DESKTOP");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const media = matchMedia("(max-width: 767px)");
    const update = () => setDevice(media.matches ? "MOBILE" : "DESKTOP");
    const frame = requestAnimationFrame(() => {
      const existing = sessionStorage.getItem("kb-session-key");
      const value = existing || crypto.randomUUID();
      if (!existing) sessionStorage.setItem("kb-session-key", value);
      setSessionKey(value);
      setNow(Date.now());
      update();
    });
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  const eligible = useMemo(() => {
    if (!sessionKey || !now) return [];
    return popups.filter((popup) => {
      if (popup.audience === "users" && !signedIn) return false;
      if (popup.audience === "guests" && signedIn) return false;
      if (popup.roles.length && (!role || !popup.roles.includes(role))) return false;
      if (popup.plans.length && (!planId || !popup.plans.includes(planId))) return false;
      if (popup.pages.length && !popup.pages.some((page) => pathname === `/${locale}${page}` || pathname === page || (page !== "/" && pathname.startsWith(`/${locale}${page}`)))) return false;
      if (popup.device !== "ALL" && device !== popup.device) return false;
      const count = Number(sessionStorage.getItem(`kb-popup-${popup.id}-count`) ?? 0);
      const closed = sessionStorage.getItem(`kb-popup-${popup.id}-closed`);
      if (closed && ["ONCE_SESSION", "ONCE_USER"].includes(popup.frequency)) return false;
      if (popup.frequency === "REPEAT_INTERVAL" && closed) {
        const elapsed = now - Number(closed);
        if (elapsed < (popup.repeatIntervalHours ?? 24) * 3_600_000) return false;
      }
      return popup.frequency === "ALWAYS" || popup.frequency === "REPEAT_INTERVAL" || count < popup.frequencyCap;
    });
  }, [popups, sessionKey, signedIn, role, planId, pathname, locale, device, now]);

  const active = eligible.find((popup) => popup.id === activeId) ?? null;

  useEffect(() => {
    if (!eligible.length || activeId || !sessionKey) return;
    const next = eligible[0];
    const timer = window.setTimeout(() => {
      setActiveId(next.id);
      const count = Number(sessionStorage.getItem(`kb-popup-${next.id}-count`) ?? 0) + 1;
      sessionStorage.setItem(`kb-popup-${next.id}-count`, String(count));
      void track(next.id, "impression", sessionKey, locale, window.location.pathname);
    }, next.delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [eligible, activeId, sessionKey, locale]);

  function close() {
    if (!active) return;
    sessionStorage.setItem(`kb-popup-${active.id}-closed`, String(Date.now()));
    if (active.frequency === "ONCE_USER") {
      void fetch("/api/popup-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ popupId: active.id, event: "dismiss", sessionKey, locale, path: pathname, device: device.toLowerCase() }) }).catch(() => undefined);
    } else {
      void track(active.id, "close", sessionKey, locale, pathname);
    }
    setActiveId(null);
  }

  useEffect(() => {
    if (!activeId) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab" && dialogRef.current) {
        const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])"));
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  });

  const translation = active?.translations.find((item) => item.locale === locale);
  return <AnimatePresence>{active && <div className={`fixed inset-0 z-[70] flex p-4 ${active.position === "bottom" ? "items-end" : active.position === "top" ? "items-start pt-20" : "items-center"} justify-center`}>
    <button className={`absolute inset-0 ${active.overlay === "none" ? "bg-transparent" : "bg-black/65 backdrop-blur-sm"}`} onClick={close} aria-label="Close popup" tabIndex={-1} />
    <motion.section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="popup-title" aria-describedby="popup-description" className="surface relative max-h-[90dvh] overflow-y-auto p-6 md:p-8" style={{ width: `min(${active.width}px, 100%)`, minHeight: active.height ? `min(${active.height}px, 90dvh)` : undefined, borderRadius: active.borderRadius, boxShadow: `0 0 ${active.glowIntensity}px rgb(255 255 255 / .12)` }} initial={reduced ? false : active.animation === "slide-up" ? { opacity: 0, y: 30 } : active.animation === "slide-down" ? { opacity: 0, y: -30 } : active.animation === "side" ? { opacity: 0, x: 30 } : { opacity: 0, scale: .95, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, x: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: .98 }} transition={{ duration: reduced ? 0 : Math.min(active.animationSpeed, 600) / 1000, ease: "easeOut" }}>
      <button autoFocus type="button" className="icon-btn absolute end-4 top-4 z-10 bg-background/70" onClick={close} aria-label="Close popup"><X size={16} /></button>
      {(active.mobileImageUrl || active.imageUrl) && <picture className="mb-6 block overflow-hidden rounded-xl"><source media="(max-width: 767px)" srcSet={active.mobileImageUrl ?? active.imageUrl ?? undefined} /><img src={active.imageUrl ?? active.mobileImageUrl ?? ""} alt="" className="max-h-56 w-full object-cover" /></picture>}
      <p className="micro text-muted mb-4">KillByte / {active.type.replaceAll("_", " ")}</p>
      <h2 id="popup-title" className="display max-w-[90%] text-3xl">{translation?.title || active.title}</h2>
      <p id="popup-description" className="text-muted mt-4 max-w-prose whitespace-pre-wrap">{translation?.description || active.description}</p>
      {active.htmlSafeContent && <div className="prose-kb mt-4" dangerouslySetInnerHTML={{ __html: active.htmlSafeContent }} />}
      {(translation?.buttonText || active.buttonText) && active.buttonHref && <a className="btn btn-primary mt-7" href={active.buttonHref.startsWith("/") ? `/${locale}${active.buttonHref}` : active.buttonHref} onClick={() => { void track(active.id, "click", sessionKey, locale, pathname); void track(active.id, "conversion", sessionKey, locale, pathname); setActiveId(null); }}>{translation?.buttonText || active.buttonText}<ArrowUpRight size={15} /></a>}
    </motion.section>
  </div>}</AnimatePresence>;
}
