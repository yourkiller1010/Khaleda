import type { PermissionKey } from "@/lib/auth";

export const adminSectionPermissions: Record<string, PermissionKey> = {
  "": "system.manage",
  analytics: "platform.read",
  "audit-logs": "security.manage",
  users: "users.manage",
  roles: "security.manage",
  security: "security.manage",
  "api-keys": "security.manage",
  navigation: "content.manage",
  appearance: "content.manage",
  loading: "content.manage",
  animation: "content.manage",
  languages: "content.manage",
  translations: "content.manage",
  popups: "content.manage",
  announcements: "content.manage",
  notifications: "content.manage",
  community: "platform.read",
  chat: "chat.moderate",
  tickets: "users.manage",
  rewards: "users.manage",
  badges: "users.manage",
  referrals: "users.manage",
  subscriptions: "finance.manage",
  pricing: "finance.manage",
  deposits: "finance.manage",
  withdrawals: "finance.manage",
  providers: "finance.manage",
  transactions: "finance.manage",
  "anti-fraud": "users.manage",
  automation: "system.manage",
  jobs: "system.manage",
  settings: "system.manage",
  maintenance: "system.manage",
};

export const adminGroups: Array<{ label: string; items: Array<{ slug: string; label: string }> }> = [
  { label: "Command", items: [{ slug: "", label: "Overview" }, { slug: "analytics", label: "Analytics" }, { slug: "audit-logs", label: "Audit logs" }] },
  { label: "Access", items: [{ slug: "users", label: "Users" }, { slug: "roles", label: "Roles & permissions" }, { slug: "security", label: "Security" }, { slug: "api-keys", label: "API keys" }] },
  { label: "Experience", items: [{ slug: "navigation", label: "Navigation" }, { slug: "appearance", label: "Appearance" }, { slug: "loading", label: "Loading system" }, { slug: "animation", label: "Animation" }, { slug: "languages", label: "Languages" }, { slug: "translations", label: "Translations" }] },
  { label: "Communication", items: [{ slug: "popups", label: "Popup center" }, { slug: "announcements", label: "Announcements" }, { slug: "notifications", label: "Notifications" }, { slug: "community", label: "Community" }, { slug: "chat", label: "Chat moderation" }, { slug: "tickets", label: "Support tickets" }] },
  { label: "Growth", items: [{ slug: "rewards", label: "Rewards" }, { slug: "badges", label: "Badges" }, { slug: "referrals", label: "Referrals" }, { slug: "subscriptions", label: "Subscriptions" }, { slug: "pricing", label: "Membership pricing" }] },
  { label: "Finance", items: [{ slug: "deposits", label: "Deposits" }, { slug: "withdrawals", label: "Withdrawals" }, { slug: "providers", label: "Payment providers" }, { slug: "transactions", label: "Immutable ledger" }, { slug: "anti-fraud", label: "Anti-fraud" }] },
  { label: "Operations", items: [{ slug: "automation", label: "Automation" }, { slug: "jobs", label: "Scheduled jobs" }, { slug: "settings", label: "System settings" }, { slug: "maintenance", label: "Maintenance" }] },
];

export const adminSections = adminGroups.flatMap((group) => group.items);
export const adminTitles = Object.fromEntries(adminSections.map((item) => [item.slug, item.label])) as Record<string, string>;
