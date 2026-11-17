import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { MfaVerifyForm } from "@/components/mfa-controls";

export default async function MfaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getCurrentSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.user.mfaEnabled || session.mfaVerifiedAt) redirect(`/${locale}/dashboard`);
  const languages = await db.language.findMany({ where: { enabled: true }, orderBy: { englishName: "asc" } });
  return <AuthShell locale={locale} languages={languages} title="Verify your identity." body="Your password or identity provider has been accepted. Complete the second factor before account data or privileged workflows become available." footer={<form action={logoutAction}><input type="hidden" name="locale" value={locale} /><button className="text-muted underline underline-offset-4" type="submit">Cancel and sign out</button></form>}><MfaVerifyForm locale={locale} /></AuthShell>;
}
