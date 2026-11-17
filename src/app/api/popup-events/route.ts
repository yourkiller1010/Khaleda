import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ popupId: z.string().max(50), event: z.enum(["impression", "click", "close", "conversion"]), sessionKey: z.string().uuid(), locale: z.string().max(12), device: z.enum(["mobile", "desktop", "tablet"]), path: z.string().max(500) });

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const user = await getCurrentUser();
  const popup = await db.popupCampaign.findFirst({ where: { id: parsed.data.popupId, enabled: true, status: "PUBLISHED" }, select: { id: true } });
  if (!popup) return NextResponse.json({ error: "Popup unavailable" }, { status: 404 });
  const { popupId, ...data } = parsed.data;
  await db.$transaction(async (tx) => {
    await tx.popupEvent.create({ data: { popupId, ...data, userId: user?.id } });
    if (data.event === "close") await tx.popupDismissal.create({ data: { popupId, userId: user?.id, sessionKey: data.sessionKey } });
  });
  return NextResponse.json({ ok: true });
}
