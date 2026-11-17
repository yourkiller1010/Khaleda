"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type LoadingConfig = { enabled: boolean; pageTransitions: boolean; text: string; speed: number; minimumDuration: number; mobile: boolean; desktop: boolean };

export function LoadingExperience({ config }: { config: LoadingConfig }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const first = useRef(true);
  const [visible, setVisible] = useState(config.enabled);
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const isMobile = matchMedia("(max-width: 767px)").matches;
    if (!config.enabled || (isMobile ? !config.mobile : !config.desktop) || (!first.current && !config.pageTransitions)) {
      setVisible(false); first.current = false; return;
    }
    setVisible(true); setProgress(8);
    const timer = window.setInterval(() => setProgress((value) => Math.min(92, value + 9)), Math.max(90, config.speed / 8));
    const timeout = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => setVisible(false), reduceMotion ? 0 : 140);
      window.clearInterval(timer);
    }, Math.max(first.current ? config.minimumDuration : 300, Math.min(config.speed, 1200)));
    first.current = false;
    return () => { window.clearInterval(timer); window.clearTimeout(timeout); };
  }, [pathname, config, reduceMotion]);
  return <AnimatePresence>{visible && <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-background" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .16 }} role="status" aria-live="polite">
    <div className="grid place-items-center gap-7 text-center px-6"><span className="byte-mark loader-mark" aria-hidden="true" /><div><p className="text-lg font-medium tracking-tight">KillByte<span className="text-muted">.</span></p><p className="micro text-muted mt-2 normal-case tracking-normal">{config.text}</p></div><div className="loader-track" aria-hidden="true" /><span className="micro text-muted">{progress.toString().padStart(3, "0")}%</span></div>
  </motion.div>}</AnimatePresence>;
}
