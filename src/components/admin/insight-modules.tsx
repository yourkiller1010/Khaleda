import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { DateTime, Empty, Metric, Panel } from "./primitives";
import { LocaleChart, TrafficChart, type TrafficPoint } from "./traffic-chart";

export async function AnalyticsModule({ locale }: { locale: string }) {
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 29); since.setUTCHours(0, 0, 0, 0);
  const [events, popupEvents, users, deposits] = await Promise.all([
    db.analyticsEvent.findMany({ where: { createdAt: { gte: since }, event: "page_view" }, select: { createdAt: true, sessionKey: true, locale: true, path: true }, take: 20000, orderBy: { createdAt: "asc" } }),
    db.popupEvent.groupBy({ by: ["event"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.deposit.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: since }, status: "CONFIRMED" } }),
  ]);
  const daily = new Map<string, { views: number; sessions: Set<string> }>();
  for (let offset = 0; offset < 30; offset++) { const date = new Date(since.getTime() + offset * 86400000).toISOString().slice(0, 10); daily.set(date, { views: 0, sessions: new Set() }); }
  const locales = new Map<string, number>();
  for (const event of events) {
    const key = event.createdAt.toISOString().slice(0, 10);
    const bucket = daily.get(key); if (bucket) { bucket.views++; bucket.sessions.add(event.sessionKey); }
    locales.set(event.locale, (locales.get(event.locale) ?? 0) + 1);
  }
  const traffic: TrafficPoint[] = Array.from(daily, ([date, value]) => ({ date: date.slice(5), views: value.views, visitors: value.sessions.size }));
  const localeData = Array.from(locales, ([code, views]) => ({ locale: code, views })).sort((a, b) => b.views - a.views).slice(0, 10);
  const popupStats = Object.fromEntries(popupEvents.map((item) => [item.event, item._count._all]));
  const impressions = popupStats.impression ?? 0;
  const conversion = impressions ? ((popupStats.conversion ?? 0) / impressions * 100).toFixed(1) : "0.0";
  return <div className="grid gap-6"><section className="surface relative min-h-64 overflow-hidden p-6 md:p-8"><Image src="/images/infrastructure-monitoring.png" alt="Monochrome routing core and network topology" fill priority={false} className="object-cover opacity-35" /><div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" /><div className="relative max-w-xl"><p className="micro text-muted">OBSERVABILITY / APPLICATION TRAFFIC</p><h2 className="display mt-4 text-4xl">Real signals. Clear operations.</h2><p className="text-muted mt-4 text-sm">Page views and unique sessions are recorded from actual application navigation. This dashboard does not synthesize bandwidth, visitors, revenue, or infrastructure health.</p></div></section>
    <section className="surface grid grid-cols-2 gap-6 p-6 md:grid-cols-4"><Metric label="30-day page views" value={events.length} /><Metric label="New accounts" value={users} /><Metric label="Confirmed deposits" value={`${deposits._sum.amount?.toString() ?? "0"} USD`} /><Metric label="Popup conversion" value={`${conversion}%`} note={impressions ? `${impressions} measured impressions` : "No measured impressions"} /></section>
    <Panel title="Application traffic" description="Daily page views and unique session identifiers for the last 30 UTC days."><TrafficChart data={traffic} /></Panel>
    <div className="grid gap-6 xl:grid-cols-2"><Panel title="Locales in use" description="Measured page-view distribution.">{localeData.length ? <LocaleChart data={localeData} /> : <Empty title="No traffic recorded" body="The chart will populate after real application navigation." />}</Panel><Panel title="Engagement events" description="Persisted popup event totals for the same period."><div className="grid grid-cols-2 gap-6"><Metric label="Impressions" value={impressions} /><Metric label="Clicks" value={popupStats.click ?? 0} /><Metric label="Conversions" value={popupStats.conversion ?? 0} /><Metric label="Dismissals" value={(popupStats.close ?? 0) + (popupStats.dismiss ?? 0)} /></div><a className="btn btn-secondary mt-8" href={`/${locale}/admin/popups`}>Open popup center</a></Panel></div>
  </div>;
}

export async function AuditLogsModule({ query = "" }: { query?: string }) {
  const logs = await db.auditLog.findMany({ where: query ? { OR: [{ action: { contains: query, mode: "insensitive" } }, { targetType: { contains: query, mode: "insensitive" } }, { actor: { username: { contains: query, mode: "insensitive" } } }] } : {}, take: 200, orderBy: { createdAt: "desc" }, include: { actor: { select: { username: true, email: true } } } });
  return <div className="grid gap-6"><Panel title="Audit search" description="Filter persisted actions, targets, and accountable actors."><form method="get" className="flex flex-col gap-3 sm:flex-row"><input className="input" name="q" defaultValue={query} placeholder="Search action, target, or actor" /><button className="btn btn-secondary" type="submit">Search</button><Link className="btn btn-secondary" href="/api/admin/exports/audit">Export CSV</Link></form></Panel><Panel title={`${logs.length} audit records`} description="Security, financial, content, and operational changes in reverse chronological order.">{logs.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Time</th><th>Severity</th><th>Actor</th><th>Action</th><th>Target</th><th>Network</th><th>Metadata</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><DateTime value={log.createdAt} /></td><td><span className="badge">{log.severity}</span></td><td>{log.actor?.username ?? "System"}</td><td className="mono text-xs">{log.action}</td><td>{log.targetType}<p className="mono text-muted mt-1 text-xs">{log.targetId ?? "—"}</p></td><td className="mono text-xs">{log.ipAddress ?? "—"}</td><td>{log.metadata ? <details><summary className="cursor-pointer text-xs">Inspect</summary><pre className="mono mt-2 max-w-80 whitespace-pre-wrap break-all text-xs">{JSON.stringify(log.metadata, null, 2)}</pre></details> : "—"}</td></tr>)}</tbody></table></div> : <Empty title="No matching audit records" body="Sensitive operations will create searchable events here." />}</Panel></div>;
}
