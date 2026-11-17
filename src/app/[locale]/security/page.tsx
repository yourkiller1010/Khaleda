import { ArrowUpRight, Database, KeyRound, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSystemSetting } from "@/lib/settings";
import { PublicHeader } from "@/components/public-header";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/motion";

const safeguards = [
  { icon: KeyRound, title: "Account and session protection", body: "Passwords are bcrypt-hashed. Opaque session tokens are stored only as hashes, delivered in HTTP-only cookies, expired server-side, and can be revoked. Optional TOTP MFA adds a verified session state and single-use recovery codes." },
  { icon: WalletCards, title: "Verified financial workflows", body: "A browser cannot confirm a payment. Deposits require administrator review or a signature-verified provider event. Wallet movements use database transactions, balance checks, idempotency records, and append-only ledger entries." },
  { icon: Database, title: "Persistent, accountable data", body: "PostgreSQL replaces publicly co-located text and JSON stores. Sensitive administration is permission-checked and audited. Analytics are collected from actual application events; no synthetic users, traffic, revenue, or presence are generated." },
  { icon: LockKeyhole, title: "Controlled integrations", body: "OAuth state and Telegram signatures are validated. Automation webhooks require an explicit host allowlist, public HTTPS destinations, DNS and IP restrictions, bounded payloads, timeouts, and no redirect following." },
];

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [user, languages, supportEmail] = await Promise.all([
    getCurrentUser(),
    db.language.findMany({ where: { enabled: true }, orderBy: { englishName: "asc" } }),
    getSystemSetting("site.supportEmail", "support@example.com"),
  ]);
  return <><PublicHeader locale={locale} signedIn={Boolean(user)} languages={languages} /><main className="page-shell pb-24 pt-32">
    <Reveal><p className="micro text-muted">SECURITY / RESPONSIBLE OPERATION</p><h1 className="display mt-6 max-w-5xl text-balance text-6xl md:text-8xl">Trust is an engineering discipline.</h1><p className="text-muted mt-7 max-w-3xl text-lg">KillByte is designed around explicit identity, server-side authorization, reviewable financial state, and restrained operational access. This page describes implemented safeguards without implying an external certification or guarantee.</p></Reveal>
    <section className="mt-16 grid gap-4 md:grid-cols-2">{safeguards.map((item, index) => <Reveal key={item.title} delay={index * .04}><article className="surface h-full p-7"><item.icon size={23} strokeWidth={1.4} /><h2 className="mt-6 text-2xl font-medium tracking-tight">{item.title}</h2><p className="text-muted mt-4 text-sm leading-7">{item.body}</p></article></Reveal>)}</section>
    <Reveal className="mt-16"><section className="surface grid gap-8 p-7 md:p-10 lg:grid-cols-[1fr_.8fr]"><div><p className="micro text-muted">RESPONSIBLE USE</p><h2 className="display mt-4 text-4xl">Infrastructure controls have boundaries.</h2><p className="text-muted mt-5 text-sm leading-7">Performance or diagnostic functionality must be used only on infrastructure you own or are explicitly authorized to test. This rebuild does not include attack, takedown, third-party denial-of-service, fake engagement, or evasion functionality. Administrative changes and sensitive operations leave an audit trail.</p></div><div className="inset flex flex-col justify-between p-6"><div><ShieldCheck size={24} strokeWidth={1.4} /><h3 className="mt-5 text-xl">Report a concern</h3><p className="text-muted mt-3 text-sm">Signed-in members can create a persistent support ticket. For a security concern, include reproduction steps and avoid exposing credentials or private records.</p></div><div className="mt-6 flex flex-wrap gap-3"><a className="btn btn-primary" href={user ? `/${locale}/tickets` : `/${locale}/login`}>Open secure support<ArrowUpRight size={15} /></a><a className="btn btn-secondary" href={`mailto:${supportEmail}`}>Email support</a></div></div></section></Reveal>
  </main><footer className="border-t border-border"><div className="page-shell flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between"><Logo href={`/${locale}`} /><p className="micro text-muted">© {new Date().getFullYear()} KillByte. Security and responsible use.</p></div></footer></>;
}
