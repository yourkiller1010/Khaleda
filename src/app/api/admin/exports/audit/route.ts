import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";

function csv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user, "security.manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, include: { actor: { select: { username: true, email: true } } } });
  const rows = [["created_at", "severity", "actor", "email", "action", "target_type", "target_id", "ip_address", "metadata"], ...logs.map((log) => [log.createdAt.toISOString(), log.severity, log.actor?.username, log.actor?.email, log.action, log.targetType, log.targetId, log.ipAddress, log.metadata ? JSON.stringify(log.metadata) : ""])];
  return new NextResponse(rows.map((row) => row.map(csv).join(",")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="killbyte-audit.csv"', "Cache-Control": "no-store" } });
}
