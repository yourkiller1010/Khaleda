import { PrismaClient, RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { defaultAppearance, defaultLoading } from "../src/lib/settings";

const db = new PrismaClient();

const roles: Array<{ name: string; key: RoleKey; priority: number }> = [
  { name: "Owner", key: "OWNER", priority: 100 },
  { name: "Administrator", key: "ADMIN", priority: 90 },
  { name: "Moderator", key: "MODERATOR", priority: 70 },
  { name: "VIP", key: "VIP", priority: 50 },
  { name: "Premium", key: "PREMIUM", priority: 40 },
  { name: "Verified", key: "VERIFIED", priority: 30 },
  { name: "Member", key: "MEMBER", priority: 10 },
  { name: "Muted", key: "MUTED", priority: 0 },
];

const languages = [
  ["en", "English", "English", "🇬🇧", "ltr"], ["bn", "Bengali", "বাংলা", "🇧🇩", "ltr"],
  ["ar", "Arabic", "العربية", "🇸🇦", "rtl"], ["es", "Spanish", "Español", "🇪🇸", "ltr"],
  ["fr", "French", "Français", "🇫🇷", "ltr"], ["de", "German", "Deutsch", "🇩🇪", "ltr"],
  ["pt", "Portuguese", "Português", "🇵🇹", "ltr"], ["ru", "Russian", "Русский", "🇷🇺", "ltr"],
  ["tr", "Turkish", "Türkçe", "🇹🇷", "ltr"], ["id", "Indonesian", "Bahasa Indonesia", "🇮🇩", "ltr"],
  ["hi", "Hindi", "हिन्दी", "🇮🇳", "ltr"], ["zh", "Chinese", "中文", "🇨🇳", "ltr"],
  ["ja", "Japanese", "日本語", "🇯🇵", "ltr"], ["ko", "Korean", "한국어", "🇰🇷", "ltr"],
  ["it", "Italian", "Italiano", "🇮🇹", "ltr"], ["nl", "Dutch", "Nederlands", "🇳🇱", "ltr"],
  ["pl", "Polish", "Polski", "🇵🇱", "ltr"], ["vi", "Vietnamese", "Tiếng Việt", "🇻🇳", "ltr"],
  ["th", "Thai", "ไทย", "🇹🇭", "ltr"], ["ur", "Urdu", "اردو", "🇵🇰", "rtl"],
] as const;

async function main() {
  const permissionKeys = ["platform.read", "users.manage", "content.manage", "finance.manage", "chat.moderate", "security.manage", "system.manage"];
  for (const key of permissionKeys) {
    await db.permission.upsert({ where: { key }, update: {}, create: { key, description: `Allows ${key.replace(".", " ")}` } });
  }
  for (const role of roles) {
    const record = await db.role.upsert({ where: { name: role.name }, update: { key: role.key, priority: role.priority }, create: { ...role, isSystem: true } });
    if (["OWNER", "ADMIN"].includes(role.key)) {
      const permissions = await db.permission.findMany();
      await db.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: record.id, permissionId: permission.id })), skipDuplicates: true });
    }
    if (role.key === "MODERATOR") {
      const permissions = await db.permission.findMany({ where: { key: { in: ["platform.read", "chat.moderate"] } } });
      await db.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: record.id, permissionId: permission.id })), skipDuplicates: true });
    }
  }

  for (const [code, englishName, nativeName, flag, direction] of languages) {
    await db.language.upsert({ where: { code }, update: { englishName, nativeName, flag, direction }, create: { code, englishName, nativeName, flag, direction, isDefault: code === "en", isFallback: code === "en" } });
  }

  const plans = [
    { slug: "core", name: "Core", description: "A focused workspace for independent operators.", price: 19, durationDays: 30, sortOrder: 1, features: ["Full account workspace", "Community and rewards", "Standard support"] },
    { slug: "studio", name: "Studio", description: "Advanced controls for growing technical teams.", price: 49, durationDays: 30, sortOrder: 2, features: ["Everything in Core", "Priority support", "Advanced API scopes"] },
    { slug: "enterprise", name: "Enterprise", description: "A private plan for high-touch operations.", price: 149, durationDays: 30, sortOrder: 3, isPrivate: true, features: ["Everything in Studio", "Dedicated onboarding", "Custom operational limits"] },
  ];
  for (const plan of plans) {
    await db.membershipPlan.upsert({ where: { slug: plan.slug }, update: plan, create: { ...plan, price: plan.price } });
  }

  const nav = [
    ["nav.dashboard", "/dashboard", "LayoutDashboard", 1], ["nav.hub", "/hub", "Boxes", 2],
    ["nav.chat", "/chat", "MessagesSquare", 3], ["nav.rewards", "/rewards", "Award", 4],
    ["nav.wallet", "/wallet", "WalletCards", 5], ["nav.pricing", "/pricing", "Layers3", 6],
    ["nav.referrals", "/referrals", "UsersRound", 7], ["nav.tickets", "/tickets", "LifeBuoy", 8],
    ["nav.profile", "/profile", "UserRound", 9], ["nav.admin", "/admin", "ShieldCheck", 10],
  ] as const;
  for (const [labelKey, href, icon, sortOrder] of nav) {
    const existing = await db.navigationItem.findFirst({ where: { href, parentId: null } });
    const data = { labelKey, href, icon, sortOrder, roles: href === "/admin" ? ["OWNER", "ADMIN"] : [], badgeText: href === "/chat" ? "LIVE" : null, highlight: href === "/hub" ? "SOFT_GLOW" as const : "NONE" as const };
    if (existing) await db.navigationItem.update({ where: { id: existing.id }, data });
    else await db.navigationItem.create({ data });
  }

  const manual = await db.paymentMethod.upsert({
    where: { slug: "manual-usd" },
    update: {},
    create: { slug: "manual-usd", name: "Verified bank transfer", provider: "manual", type: "BOTH", minAmount: 5, maxAmount: 50000, feeType: "FIXED", feeValue: 1, instructions: "Use your unique deposit reference in the transfer note. Transfers are credited only after administrator verification." },
  });
  await db.paymentMethod.upsert({ where: { slug: "oxapay" }, update: {}, create: { slug: "oxapay", name: "OxaPay", provider: "oxapay", type: "DEPOSIT", minAmount: 10, maxAmount: 100000, instructions: "Payment status is accepted only from a verified provider webhook." } });

  await db.chatRoom.upsert({ where: { slug: "global" }, update: {}, create: { slug: "global", name: "Global lounge", description: "Registered KillByte members only." } });
  await db.badge.upsert({ where: { slug: "founding-member" }, update: {}, create: { slug: "founding-member", name: "Founding Member", description: "Awarded by KillByte administrators to early contributors.", icon: "Sparkles", rarity: "RARE", priority: 10 } });
  await db.badge.upsert({ where: { slug: "community-voice" }, update: {}, create: { slug: "community-voice", name: "Community Voice", description: "Recognizes constructive, sustained community participation.", icon: "MessagesSquare", rarity: "UNCOMMON" } });

  const settings = [
    ["popups.enabled", true, true], ["maintenance.enabled", false, true], ["animations.enabled", true, true],
    ["security.mfaRequiredForAdmins", false, false], ["referrals.pointsPerSignup", 10, false],
    ["site.name", "KillByte", true], ["site.supportEmail", "support@example.com", true],
  ] as const;
  for (const [key, value, isPublic] of settings) await db.systemSetting.upsert({ where: { key }, update: {}, create: { key, value, public: isPublic } });

  if (!(await db.appearanceVersion.count())) await db.appearanceVersion.create({ data: { name: "KillByte Monochrome 1.0", status: "PUBLISHED", tokens: defaultAppearance, publishedAt: new Date() } });
  if (!(await db.loadingVersion.count())) await db.loadingVersion.create({ data: { name: "Byte Scan 1.0", status: "PUBLISHED", config: defaultLoading, publishedAt: new Date() } });

  const popupExists = await db.popupCampaign.findFirst({ where: { name: "Welcome to KillByte" } });
  if (!popupExists) await db.popupCampaign.create({
    data: {
      name: "Welcome to KillByte", type: "WELCOME", status: "PUBLISHED", enabled: true, priority: 50,
      title: "Your workspace, precisely controlled.", description: "Explore your dashboard, manage your wallet, and join the registered-member community from one secure platform.",
      buttonText: "Enter dashboard", buttonHref: "/dashboard", pages: ["/"], audience: "everyone", frequency: "ONCE_SESSION", delaySeconds: 1,
      translations: { create: [
        { locale: "bn", title: "KillByte-এ স্বাগতম", description: "একটি নিরাপদ প্ল্যাটফর্ম থেকে আপনার অ্যাকাউন্ট, ওয়ালেট ও কমিউনিটি পরিচালনা করুন।", buttonText: "ড্যাশবোর্ড খুলুন" },
        { locale: "ar", title: "مرحباً بك في KillByte", description: "أدر حسابك ومحفظتك ومجتمعك من منصة واحدة آمنة.", buttonText: "فتح لوحة التحكم" },
      ] },
    },
  });

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
    const ownerRole = await db.role.findUniqueOrThrow({ where: { name: "Owner" } });
    await db.user.upsert({
      where: { email: adminEmail },
      update: { roleId: ownerRole.id, status: "ACTIVE" },
      create: { email: adminEmail, username: process.env.ADMIN_USERNAME ?? "owner", displayName: "KillByte Owner", passwordHash: await bcrypt.hash(adminPassword, 12), roleId: ownerRole.id, referralCode: `OWNER${randomBytes(3).toString("hex").toUpperCase()}`, emailVerifiedAt: new Date() },
    });
  }
  console.log(`KillByte initialized: ${languages.length} languages, ${roles.length} roles, ${plans.length} plans, payment method ${manual.slug}.`);
}

main().finally(() => db.$disconnect());
