"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrafficPoint = { date: string; views: number; visitors: number };

const tooltipStyle = { background: "var(--kb-surface)", border: "1px solid var(--kb-border)", borderRadius: 12, color: "var(--kb-text)", fontSize: 12 };

export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  return <div className="h-[320px] w-full" role="img" aria-label="Application page views and unique sessions over time"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--kb-text)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--kb-text)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--kb-border)" strokeDasharray="2 6" vertical={false} /><XAxis dataKey="date" tick={{ fill: "var(--kb-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "var(--kb-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--kb-muted)" }} /><Area type="monotone" dataKey="views" name="Page views" stroke="var(--kb-text)" strokeWidth={2} fill="url(#trafficFill)" animationDuration={500} /><Area type="monotone" dataKey="visitors" name="Unique sessions" stroke="var(--kb-muted)" strokeWidth={1.5} fill="transparent" animationDuration={500} /></AreaChart></ResponsiveContainer></div>;
}

export function LocaleChart({ data }: { data: Array<{ locale: string; views: number }> }) {
  return <div className="h-[280px] w-full" role="img" aria-label="Application page views by locale"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}><CartesianGrid stroke="var(--kb-border)" strokeDasharray="2 6" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "var(--kb-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="locale" tick={{ fill: "var(--kb-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={42} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--kb-elevated)" }} /><Bar dataKey="views" name="Page views" fill="var(--kb-text)" radius={[0, 5, 5, 0]} animationDuration={500} /></BarChart></ResponsiveContainer></div>;
}
