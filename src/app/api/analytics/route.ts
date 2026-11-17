import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { routing } from "@/i18n/routing";

const schema = z.object({ event: z.literal("page_view"), path: z.string().startsWith("/").max(500), locale: z.string().max(12), sessionKey: z.string().uuid(), device: z.enum(["mobile", "desktop"]) });

export async function POST(request: NextRequest) {
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success || !routing.locales.includes(parsed.data.locale as never)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const since = new Date(Date.now() - 60_000);
  const recent = await db.analyticsEvent.count({ where: { sessionKey: parsed.data.sessionKey, createdAt: { gte: since } } });
  if (recent >= 120) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  const user = await getCurrentUser();
  const country = request.headers.get("x-vercel-ip-country");
  await db.analyticsEvent.create({ data: { ...parsed.data, userId: user?.id ?? null, country: country && /^[A-Z]{2}$/.test(country) ? country : null } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
