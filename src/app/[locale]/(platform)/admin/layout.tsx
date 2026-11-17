import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requirePermission(locale, "platform.read");
  const grants = user.role.key === "OWNER" ? [] : await db.rolePermission.findMany({ where: { roleId: user.roleId }, include: { permission: { select: { key: true } } } });
  const permissions = user.role.key === "OWNER" ? ["platform.read", "users.manage", "content.manage", "finance.manage", "chat.moderate", "security.manage", "system.manage"] : grants.map((grant) => grant.permission.key);
  return <div className="grid min-w-0 gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8"><AdminNav locale={locale} permissions={permissions} /><div className="min-w-0">{children}</div></div>;
}
