import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user, "content.manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const locale = request.nextUrl.searchParams.get("locale") ?? "en";
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(locale)) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  const keys = await db.translationKey.findMany({ include: { values: { where: { locale, published: true } } }, orderBy: [{ namespace: "asc" }, { key: "asc" }] });
  const catalog = Object.fromEntries(keys.map((key) => [`${key.namespace}.${key.key}`, key.values[0]?.value ?? key.englishText]));
  return new NextResponse(JSON.stringify(catalog, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="killbyte-${locale}.json"`, "Cache-Control": "no-store" } });
}
