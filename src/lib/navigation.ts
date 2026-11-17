import { db } from "@/lib/db";
import { hasPermission, type CurrentUser } from "@/lib/auth";

export async function getNavigation(user: CurrentUser | null) {
  const now = new Date();
  const items = await db.navigationItem.findMany({
    where: { enabled: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { children: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
  });
  const canAccessAdmin = user ? await hasPermission(user, "platform.read") : false;
  const visible = (item: Omit<(typeof items)[number], "children">) => {
    if (user && item.guestVisible) return false;
    if (!user && !item.guestVisible && (item.href.includes("dashboard") || item.href.includes("admin"))) return false;
    if (item.href === "/admin") return canAccessAdmin;
    if (item.roles.length && (!user || !item.roles.includes(user.role.key))) return false;
    if (item.plans.length && (!user?.membershipPlanId || !item.plans.includes(user.membershipPlanId))) return false;
    if (item.badgeStartsAt && item.badgeStartsAt > now) item.badgeText = null;
    if (item.badgeEndsAt && item.badgeEndsAt <= now) item.badgeText = null;
    return true;
  };
  return items.filter(visible).map((item) => ({ ...item, children: item.children.filter(visible) }));
}
