import { LockKeyhole } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeToggle } from "@/components/theme-provider";

type Language = React.ComponentProps<typeof LanguageSelector>["languages"][number];

export async function AuthShell({ locale, languages, title, body, children, footer }: { locale: string; languages: Language[]; title: string; body: string; children: React.ReactNode; footer: React.ReactNode }) {
  const t = await getTranslations("auth");
  return <main className="grid min-h-dvh lg:grid-cols-[.86fr_1.14fr]"><section className="relative hidden overflow-hidden border-r border-border p-12 lg:flex lg:flex-col lg:justify-between"><div><Logo href={`/${locale}`} /></div><div className="relative"><div className="mb-16 grid h-52 w-52 place-items-center rounded-full border border-border shadow-[0_0_100px_rgb(255_255_255/_.06)]"><div className="grid h-32 w-32 place-items-center rounded-full border border-dashed border-border"><span className="byte-mark scale-150" /></div></div><p className="micro text-muted">IDENTITY / ACCESS / CONTROL</p><p className="display mt-5 max-w-lg text-5xl">One identity.<br /><span className="text-muted">Zero ambiguity.</span></p></div><div className="flex items-center gap-3 text-sm text-muted"><LockKeyhole size={16} /><span>{t("protected")}</span></div></section><section className="flex min-h-dvh flex-col px-5 py-6 sm:px-10"><div className="flex items-center justify-between"><div className="lg:hidden"><Logo href={`/${locale}`} /></div><div className="ml-auto flex gap-2"><LanguageSelector languages={languages} current={locale} /><ThemeToggle /></div></div><div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12"><p className="micro text-muted mb-5">KILLBYTE / SECURE ACCESS</p><h1 className="display text-5xl md:text-6xl">{title}</h1><p className="text-muted mt-5 max-w-lg">{body}</p>{children}<div className="mt-7 text-sm text-muted">{footer}</div></div></section></main>;
}
