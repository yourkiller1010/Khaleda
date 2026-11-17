import { notFound } from "next/navigation";
import { adminSectionPermissions, adminTitles } from "@/components/admin/admin-config";
import { requirePermission } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/primitives";
import { AnimationModule, AppearanceModule, LanguagesModule, LoadingModule, NavigationModule, TranslationsModule } from "@/components/admin/content-modules";
import { AnnouncementsModule, AutomationModule, NotificationsModule, PopupsModule } from "@/components/admin/engagement-modules";
import { DepositsModule, PricingModule, ProvidersModule, ReferralsModule, SubscriptionsModule, TransactionsModule, WithdrawalsModule } from "@/components/admin/finance-modules";
import { ApiKeysModule, JobsModule, MaintenanceModule, RolesModule, SecurityModule, SettingsModule, UsersModule } from "@/components/admin/access-modules";
import { AntiFraudModule, BadgesModule, ChatModule, CommunityModule, RewardsModule, TicketsModule } from "@/components/admin/community-modules";
import { AnalyticsModule, AuditLogsModule } from "@/components/admin/insight-modules";

const descriptions: Record<string, string> = {
  users: "Live account administration, membership, access, sessions, and audited wallet operations.",
  roles: "Role hierarchy and explicit permission records with protected system roles.",
  navigation: "Database-driven routes, nesting, scheduling, badges, visibility, and independent highlights.",
  appearance: "Monochrome design tokens, live preview, publishing, and non-destructive restoration.",
  loading: "A separately versioned branded loading system with responsive behavior and live preview.",
  animation: "Global motion policy with reduced-motion behavior and restrained interaction timing.",
  languages: "Extensible locale catalogs, native names, enablement, defaults, fallbacks, and RTL direction.",
  translations: "Searchable translation editing, publication, JSON portability, and version restoration.",
  popups: "Targeted multilingual campaigns, independent activation, real event analytics, and restorable versions.",
  announcements: "Targeted operational communications persisted to the same account workspace.",
  notifications: "Direct and broadcast in-app notifications backed by real recipient records.",
  community: "Actual registered-member participation and community activity.",
  chat: "Authenticated community moderation, reports, room controls, slow mode, and server-side filters.",
  rewards: "Reward definitions and genuine issuance history without synthetic transactions.",
  badges: "Badge definitions, assignment, display rarity, and audited revocation.",
  referrals: "Real registration attribution, conversion state, and transactional point adjustments.",
  subscriptions: "Membership lifecycle, expiration, and active-plan synchronization.",
  pricing: "Database-backed membership pricing, features, visibility, and ordering.",
  deposits: "Verified manual review and provider-originated payment records.",
  withdrawals: "Reserved-balance processing, completion, rejection, and exact refunds.",
  providers: "Payment directions, limits, fees, instructions, and availability.",
  transactions: "Append-only financial entries with balance-after evidence and CSV export.",
  "anti-fraud": "User-submitted risk reports and accountable manual investigation states.",
  tickets: "Customer support assignment, public replies, internal notes, and closure.",
  automation: "Versioned trigger definitions, real worker executions, test mode, and retries.",
  jobs: "Bounded background maintenance schedules and actual execution timestamps.",
  analytics: "Real application traffic, engagement, account, and payment aggregates.",
  "audit-logs": "Searchable accountability records for sensitive operations.",
  security: "Authentication policy, valid sessions, login attempts, and critical audit visibility.",
  "api-keys": "Scoped, hashed, expirable integration credentials with one-time secret disclosure.",
  settings: "Typed, audited system configuration with explicit public visibility.",
  maintenance: "Global operational switches and platform safeguards.",
};

export default async function AdminSectionPage({ params, searchParams }: { params: Promise<{ locale: string; section: string }>; searchParams: Promise<{ q?: string; targetLocale?: string; edit?: string }> }) {
  const { locale, section } = await params;
  if (!adminTitles[section]) notFound();
  await requirePermission(locale, adminSectionPermissions[section]);
  const search = await searchParams;
  let sectionContent: React.ReactNode;
  switch (section) {
    case "navigation": sectionContent = <NavigationModule locale={locale} />; break;
    case "appearance": sectionContent = <AppearanceModule locale={locale} />; break;
    case "loading": sectionContent = <LoadingModule locale={locale} />; break;
    case "animation": sectionContent = <AnimationModule locale={locale} />; break;
    case "languages": sectionContent = <LanguagesModule locale={locale} />; break;
    case "translations": sectionContent = <TranslationsModule locale={locale} targetLocale={search.targetLocale} query={search.q} />; break;
    case "popups": sectionContent = <PopupsModule locale={locale} edit={search.edit} />; break;
    case "announcements": sectionContent = <AnnouncementsModule locale={locale} />; break;
    case "notifications": sectionContent = <NotificationsModule locale={locale} />; break;
    case "automation": sectionContent = <AutomationModule locale={locale} />; break;
    case "deposits": sectionContent = <DepositsModule locale={locale} />; break;
    case "withdrawals": sectionContent = <WithdrawalsModule locale={locale} />; break;
    case "providers": sectionContent = <ProvidersModule locale={locale} />; break;
    case "transactions": sectionContent = <TransactionsModule />; break;
    case "pricing": sectionContent = <PricingModule locale={locale} />; break;
    case "subscriptions": sectionContent = <SubscriptionsModule locale={locale} />; break;
    case "referrals": sectionContent = <ReferralsModule locale={locale} />; break;
    case "users": sectionContent = <UsersModule locale={locale} query={search.q} />; break;
    case "roles": sectionContent = <RolesModule locale={locale} />; break;
    case "security": sectionContent = <SecurityModule locale={locale} />; break;
    case "api-keys": sectionContent = <ApiKeysModule locale={locale} />; break;
    case "settings": sectionContent = <SettingsModule locale={locale} />; break;
    case "maintenance": sectionContent = <MaintenanceModule locale={locale} />; break;
    case "jobs": sectionContent = <JobsModule locale={locale} />; break;
    case "rewards": sectionContent = <RewardsModule locale={locale} />; break;
    case "badges": sectionContent = <BadgesModule locale={locale} />; break;
    case "community": sectionContent = <CommunityModule />; break;
    case "chat": sectionContent = <ChatModule locale={locale} />; break;
    case "tickets": sectionContent = <TicketsModule locale={locale} />; break;
    case "anti-fraud": sectionContent = <AntiFraudModule locale={locale} />; break;
    case "analytics": sectionContent = <AnalyticsModule locale={locale} />; break;
    case "audit-logs": sectionContent = <AuditLogsModule query={search.q} />; break;
    default: notFound();
  }
  return <><AdminHeader eyebrow={`KILLBYTE / ${section.toUpperCase()}`} title={adminTitles[section]} description={descriptions[section]} />{sectionContent}</>;
}
