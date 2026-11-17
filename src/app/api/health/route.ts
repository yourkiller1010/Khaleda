import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected", latencyMs: Date.now() - started, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "unavailable", database: "disconnected", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
