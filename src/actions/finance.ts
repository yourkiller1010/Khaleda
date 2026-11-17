"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { reference, randomToken } from "@/lib/utils";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/actions/account";

export async function createDepositAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const current = await getCurrentUser();
  if (!current) return { error: "Sign in to create a deposit." };
  const parsed = z.object({ amount: z.coerce.number().positive().max(100000), methodId: z.string().min(1), planId: z.string().optional(), locale: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid amount and payment method." };
  const method = await db.paymentMethod.findFirst({ where: { id: parsed.data.methodId, enabled: true, type: { in: ["BOTH", "DEPOSIT"] } } });
  if (!method) return { error: "This payment method is not available." };
  const amount = new Prisma.Decimal(parsed.data.amount.toFixed(2));
  if (amount.lt(method.minAmount) || amount.gt(method.maxAmount)) return { error: `Amount must be between ${method.minAmount} and ${method.maxAmount} ${typeof method.config === "object" && method.config !== null && !Array.isArray(method.config) && "currency" in method.config ? String(method.config.currency) : "USD"}.` };
  if (parsed.data.planId) {
    const plan = await db.membershipPlan.findFirst({ where: { id: parsed.data.planId, enabled: true } });
    if (!plan || !amount.equals(plan.price)) return { error: "The amount must exactly match the selected membership plan." };
  }
  if (method.provider !== "manual" && !process.env.OXAPAY_API_KEY) return { error: "This provider is not configured. Choose manual transfer or contact support." };
  const ref = reference("DEP");
  const deposit = await db.deposit.create({ data: { reference: ref, userId: current.id, methodId: method.id, planId: parsed.data.planId || null, amount, currency: current.walletCurrency, idempotencyKey: randomToken(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  await db.paymentEvent.create({ data: { depositId: deposit.id, methodId: method.id, eventType: "INVOICE_CREATED", payloadHash: ref } });
  await audit({ actorId: current.id, action: "DEPOSIT_CREATE", targetType: "Deposit", targetId: deposit.id, metadata: { amount: amount.toString(), provider: method.provider } });
  revalidatePath(`/${parsed.data.locale}/wallet`);
  return { ok: true, reference: ref, message: method.provider === "manual" ? `Deposit ${ref} created. Submit the transfer using the shown instructions; an administrator must verify it.` : `Deposit ${ref} created. The provider will confirm payment by verified webhook.` };
}

export async function createWithdrawalAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const current = await getCurrentUser();
  if (!current) return { error: "Sign in to request a withdrawal." };
  const parsed = z.object({ amount: z.coerce.number().positive().max(100000), methodId: z.string().min(1), destination: z.string().trim().min(6).max(300), locale: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid amount, method, and destination." };
  const method = await db.paymentMethod.findFirst({ where: { id: parsed.data.methodId, enabled: true, type: { in: ["BOTH", "WITHDRAWAL"] } } });
  if (!method) return { error: "This withdrawal method is not available." };
  const amount = new Prisma.Decimal(parsed.data.amount.toFixed(2));
  if (amount.lt(method.minAmount) || amount.gt(method.maxAmount)) return { error: `Amount must be between ${method.minAmount} and ${method.maxAmount} ${current.walletCurrency}.` };
  const fee = method.feeType === "PERCENT" ? amount.mul(method.feeValue).div(100) : method.feeValue;
  const net = amount.sub(fee);
  if (net.lte(0)) return { error: "The amount does not cover the withdrawal fee." };
  const ref = reference("WDR");
  try {
    await db.$transaction(async (tx) => {
      const result = await tx.user.updateMany({ where: { id: current.id, walletBalance: { gte: amount }, status: "ACTIVE" }, data: { walletBalance: { decrement: amount } } });
      if (result.count !== 1) throw new Error("INSUFFICIENT_BALANCE");
      const updated = await tx.user.findUniqueOrThrow({ where: { id: current.id } });
      await tx.withdrawal.create({ data: { reference: ref, userId: current.id, methodId: method.id, amount, fee, netAmount: net, currency: current.walletCurrency, destination: { value: parsed.data.destination }, idempotencyKey: randomToken() } });
      await tx.financialLedgerEntry.create({ data: { userId: current.id, type: "WITHDRAWAL", reference: ref, amount: amount.neg(), balanceAfter: updated.walletBalance, currency: current.walletCurrency, metadata: { status: "PENDING" } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") return { error: "Your available wallet balance is insufficient." };
    throw error;
  }
  await audit({ actorId: current.id, action: "WITHDRAWAL_CREATE", targetType: "Withdrawal", targetId: ref, severity: "WARNING", metadata: { amount: amount.toString(), fee: fee.toString() } });
  revalidatePath(`/${parsed.data.locale}/wallet`);
  return { ok: true, reference: ref, message: `Withdrawal ${ref} submitted. The amount is reserved while it is reviewed.` };
}
