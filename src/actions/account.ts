"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { reference } from "@/lib/utils";
import { triggerAutomations } from "@/lib/automation";

export type ActionResult = { ok?: boolean; error?: string; message?: string; reference?: string };

async function user() {
  const current = await getCurrentUser();
  if (!current) throw new Error("UNAUTHORIZED");
  return current;
}

export async function updateProfileAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const current = await user();
  const parsed = z.object({ displayName: z.string().trim().min(2).max(60), timezone: z.string().max(80), locale: z.string().min(2).max(12) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid display name, locale, and time zone." };
  await db.user.update({ where: { id: current.id }, data: parsed.data });
  await audit({ actorId: current.id, action: "PROFILE_UPDATE", targetType: "User", targetId: current.id });
  revalidatePath(`/${parsed.data.locale}/profile`);
  return { ok: true, message: "Profile preferences saved." };
}

export async function toggleBadgeAction(formData: FormData) {
  const current = await user();
  const badgeId = String(formData.get("badgeId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const badge = await db.userBadge.findUnique({ where: { userId_badgeId: { userId: current.id, badgeId } } });
  if (!badge || (badge.expiresAt && badge.expiresAt < new Date())) return;
  await db.$transaction([
    db.userBadge.updateMany({ where: { userId: current.id }, data: { displayed: false } }),
    db.userBadge.update({ where: { userId_badgeId: { userId: current.id, badgeId } }, data: { displayed: !badge.displayed } }),
  ]);
  revalidatePath(`/${locale}/rewards`);
}

export async function createTicketAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const current = await user();
  const parsed = z.object({ subject: z.string().trim().min(4).max(140), category: z.string().min(2).max(50), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), body: z.string().trim().min(10).max(6000), locale: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Add a subject, category, and a detailed message (at least 10 characters)." };
  const { locale, ...data } = parsed.data;
  const ticket = await db.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({ data: { reference: reference("KB"), userId: current.id, category: data.category, subject: data.subject, priority: data.priority } });
    await tx.ticketMessage.create({ data: { ticketId: created.id, authorId: current.id, body: data.body } });
    return created;
  });
  await triggerAutomations("SUPPORT_TICKET_CREATED", { ticketId: ticket.id, userId: current.id, priority: ticket.priority }, ticket.id);
  await audit({ actorId: current.id, action: "TICKET_CREATE", targetType: "SupportTicket", targetId: ticket.id });
  revalidatePath(`/${locale}/tickets`);
  return { ok: true, message: `Ticket ${ticket.reference} created.`, reference: ticket.reference };
}

export async function replyTicketAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const current = await user();
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");
  if (body.length < 2 || body.length > 6000) return { error: "Write a reply between 2 and 6,000 characters." };
  const ticket = await db.supportTicket.findFirst({ where: { id: ticketId, userId: current.id, status: { not: "CLOSED" } } });
  if (!ticket) return { error: "This ticket is unavailable or closed." };
  await db.$transaction([
    db.ticketMessage.create({ data: { ticketId, authorId: current.id, body } }),
    db.supportTicket.update({ where: { id: ticketId }, data: { status: "OPEN" } }),
  ]);
  revalidatePath(`/${locale}/tickets/${ticketId}`);
  return { ok: true, message: "Reply added to the conversation." };
}

export async function markNotificationsReadAction(formData: FormData) {
  const current = await user();
  const locale = String(formData.get("locale") ?? "en");
  await db.notification.updateMany({ where: { userId: current.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath(`/${locale}/dashboard`);
}

export async function claimDailyRewardAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const current = await user();
  const locale = String(formData.get("locale") ?? "en");
  const day = new Date().toISOString().slice(0, 10);
  const key = `LUCKY_${current.id}_${day}`;
  const existing = await db.rewardTransaction.findUnique({ where: { reference: key } });
  if (existing) return { error: "Today’s lucky deal has already been claimed. Come back tomorrow." };
  const amount = (Math.floor(Math.random() * 191) + 10) / 100;
  await db.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: current.id }, data: { walletBalance: { increment: amount } } });
    await tx.rewardTransaction.create({ data: { userId: current.id, type: "LUCKY_DEAL", amount, reference: key } });
    await tx.financialLedgerEntry.create({ data: { userId: current.id, type: "REWARD", reference: key, amount, balanceAfter: updated.walletBalance, currency: updated.walletCurrency } });
    await tx.notification.create({ data: { userId: current.id, type: "REWARD", title: "Lucky deal credited", body: `$${amount.toFixed(2)} was added to your wallet.`, href: `/${locale}/wallet` } });
  });
  await audit({ actorId: current.id, action: "REWARD_CLAIM", targetType: "User", targetId: current.id, metadata: { amount } });
  revalidatePath(`/${locale}/rewards`);
  return { ok: true, message: `$${amount.toFixed(2)} has been credited to your wallet.` };
}

export async function reportFraudAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const current = await user();
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (subject.length < 4 || description.length < 20) return { error: "Provide a subject and at least 20 characters of evidence." };
  const report = await db.fraudReport.create({ data: { reporterId: current.id, subject, description } });
  await audit({ actorId: current.id, action: "FRAUD_REPORT", targetType: "FraudReport", targetId: report.id, severity: "WARNING" });
  return { ok: true, message: "Your report was submitted for administrator review." };
}
