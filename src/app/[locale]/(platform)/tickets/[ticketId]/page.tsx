import { ArrowLeft, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { replyTicketAction } from "@/actions/account";

export default async function TicketDetailPage({ params }: { params: Promise<{ locale: string; ticketId: string }> }) {
  const { locale, ticketId } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations();
  const ticket = await db.supportTicket.findFirst({ where: { id: ticketId, userId: user.id }, include: { messages: { where: { internal: false }, include: { author: { select: { displayName: true, username: true, role: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!ticket) notFound();
  return <div className="mx-auto max-w-4xl"><a className="btn btn-ghost -ml-4 mb-6" href={`/${locale}/tickets`}><ArrowLeft size={15} />{t("tickets.openAnother")}</a><div className="border-b border-border pb-7"><div className="flex flex-wrap items-center gap-2"><span className="badge">{ticket.status}</span><span className="badge">{ticket.priority}</span><span className="micro text-muted">{ticket.reference}</span></div><h1 className="display mt-5 text-4xl md:text-5xl">{ticket.subject}</h1><p className="text-muted mt-4 text-sm">{ticket.category} · {ticket.createdAt.toLocaleString(locale)}</p></div><section className="py-8"><h2 className="sr-only">{t("tickets.conversation")}</h2><div className="grid gap-5">{ticket.messages.map((message) => <article key={message.id} className={`max-w-[88%] rounded-2xl border border-border p-5 ${message.authorId === user.id ? "ml-auto bg-elevated" : "bg-surface"}`}><div className="mb-3 flex items-center gap-2"><span className="text-sm font-medium">{message.author.displayName}</span><span className="badge">{message.author.role.name}</span></div><p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p><p className="micro text-muted mt-4">{message.createdAt.toLocaleString(locale)}</p></article>)}</div></section>{ticket.status !== "CLOSED" ? <section className="surface p-5"><ActionForm action={replyTicketAction} className="grid gap-4"><input type="hidden" name="ticketId" value={ticket.id} /><input type="hidden" name="locale" value={locale} /><div className="field"><label className="label" htmlFor="reply">{t("tickets.reply")}</label><textarea className="textarea" id="reply" name="body" required minLength={2} maxLength={6000} /></div><div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-xs text-muted"><LockKeyhole size={13} />{t("common.secure")}</span><SubmitButton>{t("tickets.send")}</SubmitButton></div></ActionForm></section> : <p className="surface p-5 text-center text-sm text-muted">{ticket.status}</p>}</div>;
}
