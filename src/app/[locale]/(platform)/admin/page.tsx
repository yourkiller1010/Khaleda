import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { AdminHeader, DateTime, Empty, Metric, Panel } from "@/components/admin/primitives";

async function loadOverview() {
  const started = performance.now();
  const [users, activeSessions, pendingDeposits, pendingWithdrawals, openTickets, messages, ledger, wallets, jobs, executions, recentAudit] = await Promise.all([
    db.user.count(), db.session.count({ where: { expiresAt: { gt: new Date() } } }),
    db.deposit.count({ where: { status: "PENDING" } }), db.withdrawal.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }), db.chatMessage.count({ where: { status: { not: "DELETED" } } }),
    db.financialLedgerEntry.aggregate({ _sum: { amount: true }, where: { type: "DEPOSIT" } }),
    db.user.aggregate({ _sum: { walletBalance: true } }), db.scheduledJob.count({ where: { status: "ACTIVE" } }),
    db.automationExecution.count({ where: { status: { in: ["PENDING", "RETRYING"] } } }),
    db.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { actor: { select: { username: true } } } }),
  ]);
  return { users, activeSessions, pendingDeposits, pendingWithdrawals, openTickets, messages, ledger, wallets, jobs, executions, recentAudit, latency: Math.round(performance.now() - started) };
}

export default async function AdminOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission(locale, "system.manage");
  const { users, activeSessions, pendingDeposits, pendingWithdrawals, openTickets, messages, ledger, wallets, jobs, executions, recentAudit, latency } = await loadOverview();
  return <>
    <AdminHeader eyebrow="MISSION CONTROL / LIVE RECORDS" title="Administration" description="Every value on this screen is aggregated from the production database. No demo users, synthetic traffic, or fabricated revenue are included." action={<a href={`/${locale}/admin/maintenance`} className="btn btn-secondary">Operations<ArrowUpRight size={14} /></a>} />
    <section className="surface grid grid-cols-2 gap-6 p-6 md:grid-cols-4"><Metric label="Registered users" value={users} /><Metric label="Valid sessions" value={activeSessions} note="Database-backed, not a presence estimate" /><Metric label="Confirmed deposits" value={`${ledger._sum.amount?.toString() ?? "0"} USD`} /><Metric label="Wallet liabilities" value={`${wallets._sum.walletBalance?.toString() ?? "0"} USD`} /></section>
    <div className="mt-6 grid gap-6 xl:grid-cols-3"><Panel title="Requires attention" description="Actionable operational queues."><div className="grid grid-cols-2 gap-5"><Metric label="Pending deposits" value={pendingDeposits} /><Metric label="Withdrawal queue" value={pendingWithdrawals} /><Metric label="Open tickets" value={openTickets} /><Metric label="Pending automations" value={executions} /></div><div className="mt-6 flex flex-wrap gap-2"><a className="btn btn-secondary" href={`/${locale}/admin/deposits`}>Review deposits</a><a className="btn btn-secondary" href={`/${locale}/admin/withdrawals`}>Review withdrawals</a></div></Panel>
      <Panel title="System posture" description="Measured during this request."><dl className="grid gap-4 text-sm"><div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted">Database query batch</dt><dd className="mono">Healthy · {latency} ms</dd></div><div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted">Persisted chat messages</dt><dd className="mono">{messages}</dd></div><div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted">Active scheduled jobs</dt><dd className="mono">{jobs}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Worker connection</dt><dd><Link className="underline underline-offset-4" href="/api/health">Health endpoint</Link></dd></div></dl></Panel>
      <Panel title="Control boundaries" description="Non-negotiable behavior built into the platform."><ul className="grid gap-4 text-sm text-muted"><li>Payment credit occurs only after administrator review or verified provider webhooks.</li><li>Financial entries are append-only and every privileged change is audited.</li><li>Community presence and analytics represent actual records and connections.</li><li>Infrastructure testing is not exposed as an attack or denial-of-service capability.</li></ul></Panel></div>
    <Panel title="Recent audit trail" description="Newest persisted sensitive operations." className="mt-6">{recentAudit.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Severity</th></tr></thead><tbody>{recentAudit.map((item) => <tr key={item.id}><td><DateTime value={item.createdAt} /></td><td>{item.actor?.username ?? "System"}</td><td className="mono text-xs">{item.action}</td><td>{item.targetType}{item.targetId ? ` / ${item.targetId.slice(0, 12)}` : ""}</td><td><span className="badge">{item.severity}</span></td></tr>)}</tbody></table></div> : <Empty title="No audit events yet" body="Sensitive operations will appear here after they occur." />}</Panel>
  </>;
}
