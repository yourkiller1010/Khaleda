"use client";

import { motion, useReducedMotion } from "framer-motion";

export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 16, scale: .98 }} whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .24, delay, ease: "easeOut" }}>{children}</motion.div>;
}

export function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <Reveal className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between"><div className="max-w-3xl">{eyebrow && <p className="micro text-muted mb-4">{eyebrow}</p>}<h1 className="display text-balance text-4xl md:text-5xl">{title}</h1><p className="text-muted mt-4 max-w-2xl text-base">{subtitle}</p></div>{action}</Reveal>;
}
