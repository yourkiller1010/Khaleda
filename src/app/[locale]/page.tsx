import Image from "next/image";
import { ArrowDown, ArrowUpRight, Check, Globe2, Layers3, ScanLine, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PublicHeader } from "@/components/public-header";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/motion";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, user, languages] = await Promise.all([getTranslations(), getCurrentUser(), db.language.findMany({ where: { enabled: true }, orderBy: { englishName: "asc" } })]);
  const destination = user ? `/${locale}/dashboard` : `/${locale}/register`;
  return <><PublicHeader locale={locale} signedIn={Boolean(user)} languages={languages} /><main>
    <section className="page-shell relative grid min-h-dvh items-center gap-12 pb-20 pt-32 lg:grid-cols-[1.12fr_.88fr] lg:pb-16 lg:pt-28">
      <Reveal className="relative z-10"><div className="mb-7 flex items-center gap-3"><span className="status-dot" /><span className="micro text-muted">{t("landing.eyebrow")}</span></div><h1 className="display text-balance text-[clamp(4rem,9vw,8.8rem)]"><span className="block">{t("landing.titleA")}</span><span className="block text-muted">{t("landing.titleB")}</span></h1><p className="text-muted mt-8 max-w-xl text-lg leading-relaxed">{t("landing.body")}</p><div className="mt-9 flex flex-wrap gap-3"><a className="btn btn-primary" href={destination}>{t("landing.primary")}<ArrowUpRight size={16} /></a><a className="btn btn-secondary" href="#platform">{t("landing.secondary")}<ArrowDown size={15} /></a></div><p className="micro text-muted mt-8 normal-case tracking-normal">{t("landing.proof")}</p></Reveal>
      <Reveal delay={.08} className="relative"><div className="surface group relative aspect-[.88] overflow-hidden"><Image src="/images/network-hero.png" alt="Platinum network routes connecting monochrome enterprise server infrastructure" fill priority className="object-cover object-[68%_center] transition-transform duration-700 group-hover:scale-[1.025]" sizes="(max-width: 1024px) 100vw, 44vw" /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" /><div className="absolute inset-x-0 top-0 flex items-center justify-between p-6 text-white md:p-8"><span className="micro opacity-70">{t("landing.live")}</span><ScanLine size={18} /></div><div className="absolute inset-x-0 bottom-0 border-t border-white/20 bg-black/45 p-6 backdrop-blur-md md:p-8"><p className="micro mb-4 text-white/55">PLATINUM ROUTING FABRIC / KB-01</p><p className="text-xl font-medium tracking-tight text-white">{t("landing.panelTitle")}</p><p className="mt-2 text-sm text-white/65">{t("landing.panelBody")}</p></div></div></Reveal>
    </section>

    <section id="platform" className="border-y border-border bg-foreground py-24 text-background md:py-32"><div className="page-shell"><Reveal><p className="micro mb-6 opacity-60">KILLBYTE / INFRASTRUCTURE</p><h2 className="display max-w-5xl text-balance text-5xl md:text-7xl">{t("landing.featureTitle")}</h2><p className="mt-8 max-w-2xl text-base leading-relaxed opacity-70">{t("landing.featureBody")}</p></Reveal>
      <div className="mt-16 grid gap-px overflow-hidden border border-background/20 bg-background/20 md:grid-cols-12">{[
        { icon: WalletCards, title: t("landing.finance"), body: t("landing.financeBody"), span: "md:col-span-5" },
        { icon: Globe2, title: t("landing.global"), body: t("landing.globalBody"), span: "md:col-span-7" },
        { icon: Layers3, title: t("landing.control"), body: t("landing.controlBody"), span: "md:col-span-12" },
      ].map((feature, index) => <Reveal key={feature.title} delay={index * .05} className={`${feature.span} bg-foreground p-7 md:p-10`}><feature.icon size={25} strokeWidth={1.4} /><h3 className="mt-10 text-2xl font-medium tracking-tight">{feature.title}</h3><p className="mt-3 max-w-xl text-sm leading-relaxed opacity-65">{feature.body}</p></Reveal>)}</div>
    </div></section>

    <section className="page-shell py-24 md:py-36"><Reveal className="grid gap-10 lg:grid-cols-[1fr_1.2fr]"><div><p className="micro text-muted">SERVER-SIDE / BY DEFAULT</p><h2 className="display mt-5 text-5xl md:text-6xl">{t("landing.ctaTitle")}</h2></div><div className="lg:pt-12"><p className="text-muted max-w-xl text-lg">{t("landing.ctaBody")}</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{[t("auth.protected"), t("landing.globalBody"), t("landing.financeBody"), t("landing.controlBody")].map((item) => <div key={item} className="flex gap-3 border-t border-border pt-4 text-sm"><Check className="mt-1 shrink-0" size={15} /> <span className="text-muted">{item}</span></div>)}</div><a className="btn btn-primary mt-9" href={destination}>{t("landing.primary")}<ArrowUpRight size={16} /></a></div></Reveal></section>
  </main><footer className="border-t border-border"><div className="page-shell grid gap-10 py-12 md:grid-cols-[1fr_auto_auto]"><div><Logo href={`/${locale}`} /><p className="text-muted mt-4 max-w-sm text-sm">{t("footer.tagline")}</p></div><div><p className="micro text-muted mb-4">{t("footer.platform")}</p><div className="grid gap-2 text-sm"><a href={`/${locale}/pricing`}>{t("nav.pricing")}</a><a href={destination}>{t("nav.dashboard")}</a><a href={`/${locale}/security`}>{t("footer.legal")}</a></div></div><div><p className="micro text-muted mb-4">{t("footer.account")}</p><div className="grid gap-2 text-sm"><a href={`/${locale}/login`}>{t("nav.login")}</a><a href={`/${locale}/register`}>{t("nav.register")}</a></div></div></div><div className="page-shell border-t border-border py-5"><p className="micro text-muted">{t("footer.copyright", { year: new Date().getFullYear() })}</p></div></footer></>;
}
