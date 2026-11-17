import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";

function csv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user, "finance.manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const entries = await db.financialLedgerEntry.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { username: true, email: true } } } });
  const rows = [["created_at", "reference", "username", "email", "type", "amount", "balance_after", "currency"], ...entries.map((entry) => [entry.createdAt.toISOString(), entry.reference, entry.user.username, entry.user.email, entry.type, entry.amount.toString(), entry.balanceAfter.toString(), entry.currency])];
  return new NextResponse(rows.map((row) => row.map(csv).join(",")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="killbyte-ledger.csv"', "Cache-Control": "no-store" } });
}
