import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { triggerAutomations } from "@/lib/automation";

function validSignature(raw: string, supplied: string, secret: string) {
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "oxapay") return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  const secret = process.env.OXAPAY_WEBHOOK_SECRET ?? process.env.OXAPAY_API_KEY;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-signature") ?? request.headers.get("x-oxapay-signature") ?? "";
  if (!signature || !validSignature(raw, signature, secret)) {
    await audit({ action: "PAYMENT_WEBHOOK_INVALID_SIGNATURE", targetType: "PaymentProvider", targetId: provider, severity: "CRITICAL" });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const externalId = String(payload.id ?? payload.track_id ?? payload.trackId ?? "");
  const reference = String(payload.order_id ?? payload.orderId ?? payload.reference ?? "");
  const status = String(payload.status ?? "").toLowerCase();
  if (!externalId || !reference) return NextResponse.json({ error: "Missing payment identity" }, { status: 400 });
  if (await db.paymentEvent.findUnique({ where: { externalId } })) return NextResponse.json({ ok: true, idempotent: true });
  const deposit = await db.deposit.findUnique({ where: { reference }, include: { plan: true } });
  if (!deposit) return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  if (payload.amount && Math.abs(Number(payload.amount) - Number(deposit.amount)) > 0.000001) return NextResponse.json({ error: "Amount mismatch" }, { status: 409 });
  const confirmed = ["paid", "confirmed", "complete", "completed"].includes(status);
  const failed = ["failed", "expired", "cancelled", "canceled"].includes(status);
  const result = await db.$transaction(async (tx) => {
    await tx.paymentEvent.create({ data: { depositId: deposit.id, methodId: deposit.methodId, externalId, eventType: status || "UNKNOWN", payloadHash: createHash("sha256").update(raw).digest("hex"), processedAt: new Date() } });
    if (confirmed) {
      const changed = await tx.deposit.updateMany({ where: { id: deposit.id, status: "PENDING" }, data: { status: "CONFIRMED", confirmedAt: new Date(), providerRef: externalId } });
      if (changed.count !== 1) return null;
      const user = await tx.user.update({ where: { id: deposit.userId }, data: { walletBalance: { increment: deposit.amount } } });
      await tx.financialLedgerEntry.create({ data: { userId: deposit.userId, type: "DEPOSIT", reference: deposit.reference, amount: deposit.amount, balanceAfter: user.walletBalance, currency: deposit.currency, metadata: { provider, externalId } } });
      if (deposit.plan) {
        const startsAt = new Date(); const endsAt = new Date(Date.now() + deposit.plan.durationDays * 86400000);
        await tx.subscription.create({ data: { userId: deposit.userId, planId: deposit.plan.id, status: "CONFIRMED", startsAt, endsAt } });
        await tx.user.update({ where: { id: deposit.userId }, data: { membershipPlanId: deposit.plan.id, membershipExpiresAt: endsAt } });
      }
      await tx.notification.create({ data: { userId: deposit.userId, type: "PAYMENT", title: "Deposit confirmed", body: `${deposit.amount} ${deposit.currency} has been credited by verified provider confirmation.`, href: "/wallet" } });
      return { confirmed: true };
    }
    if (failed) await tx.deposit.updateMany({ where: { id: deposit.id, status: "PENDING" }, data: { status: status === "expired" ? "EXPIRED" : "FAILED" } });
    return { confirmed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (result?.confirmed) await triggerAutomations("DEPOSIT_CONFIRMED", { depositId: deposit.id, userId: deposit.userId, amount: deposit.amount.toString(), provider }, deposit.id);
  return NextResponse.json({ ok: true });
}
