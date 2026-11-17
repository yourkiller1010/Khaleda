"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import sanitizeHtml from "sanitize-html";
import { db } from "@/lib/db";
import { requirePermission, type PermissionKey } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { randomToken } from "@/lib/utils";
import type { ActionResult } from "@/actions/account";

async function admin(locale: string, permission: PermissionKey = "content.manage") { return requirePermission(locale, permission); }
function refresh() { revalidatePath("/", "layout"); }
function text(data: FormData, key: string, max = 500) { return String(data.get(key) ?? "").trim().slice(0, max); }
function bool(data: FormData, key: string) { return data.get(key) === "on" || data.get(key) === "true"; }
function date(data: FormData, key: string) { const value = text(data, key, 80); return value ? new Date(value) : null; }
function list(data: FormData, key: string) { return text(data, key, 2000).split(",").map((item) => item.trim()).filter(Boolean); }
async function snapshotPopup(id: string) { const popup = await db.popupCampaign.findUnique({ where: { id }, include: { translations: true } }); if (popup) await db.popupVersion.create({ data: { popupId: id, snapshot: popup } }); }

export async function saveNavigationAction(formData: FormData) {
  const locale = text(formData, "locale", 12); const actor = await admin(locale);
  const schema = z.object({ labelKey: z.string().min(1).max(120), href: z.string().regex(/^\/(?!\/)/).max(300), icon: z.string().max(50), sortOrder: z.coerce.number().int().min(0).max(10000), customLabel: z.string().max(80).optional() });
  const parsed = schema.safeParse({ labelKey: text(formData, "labelKey"), href: text(formData, "href"), icon: text(formData, "icon") || "Circle", sortOrder: text(formData, "sortOrder") || "0", customLabel: text(formData, "customLabel") || undefined });
  if (!parsed.success) return;
  const id = text(formData, "id", 60); const parentId = text(formData, "parentId", 60) || null;
  const data = { ...parsed.data, customLabel: parsed.data.customLabel || null, parentId, enabled: bool(formData, "enabled"), mobileVisible: bool(formData, "mobileVisible"), desktopVisible: bool(formData, "desktopVisible"), guestVisible: bool(formData, "guestVisible"), roles: list(formData, "roles"), plans: list(formData, "plans"), badgeText: text(formData, "badgeText", 30) || null, badgeStyle: text(formData, "badgeStyle", 30) || "silver", badgeSize: text(formData, "badgeSize", 20) || "sm", badgePosition: text(formData, "badgePosition", 20) || "inline", badgeStartsAt: date(formData, "badgeStartsAt"), badgeEndsAt: date(formData, "badgeEndsAt"), highlight: text(formData, "highlight", 30) as "NONE" | "SOFT_GLOW" | "SILVER" | "BACKGROUND" | "UNDERLINE" | "BORDER" | "CUSTOM", createdById: actor.id };
  if (id) await db.navigationItem.update({ where: { id }, data }); else await db.navigationItem.create({ data });
  await audit({ actorId: actor.id, action: id ? "NAVIGATION_UPDATE" : "NAVIGATION_CREATE", targetType: "NavigationItem", targetId: id || parsed.data.href }); refresh();
}

export async function deleteNavigationAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); await db.navigationItem.delete({ where: { id } }); await audit({ actorId: actor.id, action: "NAVIGATION_DELETE", targetType: "NavigationItem", targetId: id, severity: "WARNING" }); refresh(); }
export async function moveNavigationAction(formData: FormData) { await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); const direction = Number(text(formData, "direction", 5)); const item = await db.navigationItem.findUnique({ where: { id } }); if (item) await db.navigationItem.update({ where: { id }, data: { sortOrder: Math.max(0, item.sortOrder + direction) } }); refresh(); }

export async function saveAppearanceAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const locale = text(formData, "locale", 12); const actor = await admin(locale);
  const color = (key: string, fallback: string) => { const value = text(formData, key, 20); return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback; };
  const tokens = { background: color("background", "#0b0b0b"), surface: color("surface", "#121212"), elevated: color("elevated", "#191919"), foreground: color("foreground", "#f4f4f2"), muted: color("muted", "#a3a3a3"), border: color("border", "#2b2b2b"), lightBackground: color("lightBackground", "#f2f2ef"), lightSurface: color("lightSurface", "#fafaf8"), lightForeground: color("lightForeground", "#151515"), glow: Math.min(100, Math.max(0, Number(formData.get("glow") ?? 34))), radius: Math.min(36, Math.max(0, Number(formData.get("radius") ?? 18))), fontScale: Math.min(120, Math.max(85, Number(formData.get("fontScale") ?? 100))), animationIntensity: Math.min(100, Math.max(0, Number(formData.get("animationIntensity") ?? 70))) };
  const publish = text(formData, "intent", 20) === "publish";
  const version = await db.appearanceVersion.create({ data: { name: text(formData, "name", 100) || `Appearance ${new Date().toLocaleString("en")}`, status: publish ? "PUBLISHED" : "DRAFT", tokens, publishedAt: publish ? new Date() : null } });
  await audit({ actorId: actor.id, action: publish ? "APPEARANCE_PUBLISH" : "APPEARANCE_DRAFT", targetType: "AppearanceVersion", targetId: version.id }); refresh();
  return { ok: true, message: publish ? "Appearance published across the platform." : "Appearance draft saved." };
}
export async function restoreAppearanceAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const source = await db.appearanceVersion.findUnique({ where: { id: text(formData, "id", 60) } }); if (source) await db.appearanceVersion.create({ data: { name: `Restored: ${source.name}`, status: "PUBLISHED", tokens: source.tokens as Prisma.InputJsonValue, publishedAt: new Date(), restoredFromId: source.id } }); await audit({ actorId: actor.id, action: "APPEARANCE_RESTORE", targetType: "AppearanceVersion", targetId: source?.id }); refresh(); }

export async function saveLoadingAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await admin(text(formData, "locale", 12));
  const config = { enabled: bool(formData, "enabled"), pageTransitions: bool(formData, "pageTransitions"), animation: text(formData, "animation", 40) || "byte-scan", background: text(formData, "background", 40) || "obsidian", logoAnimation: text(formData, "logoAnimation", 40) || "draw", text: text(formData, "text", 120) || "Initializing secure workspace", progress: text(formData, "progress", 30) || "indeterminate", speed: Math.min(3000, Math.max(200, Number(formData.get("speed") ?? 900))), minimumDuration: Math.min(3000, Math.max(0, Number(formData.get("minimumDuration") ?? 500))), mobile: bool(formData, "mobile"), desktop: bool(formData, "desktop") };
  const publish = text(formData, "intent", 20) === "publish";
  const version = await db.loadingVersion.create({ data: { name: `Loading ${new Date().toLocaleString("en")}`, status: publish ? "PUBLISHED" : "DRAFT", config, publishedAt: publish ? new Date() : null } });
  await audit({ actorId: actor.id, action: publish ? "LOADING_PUBLISH" : "LOADING_DRAFT", targetType: "LoadingVersion", targetId: version.id }); refresh(); return { ok: true, message: publish ? "Loading experience published." : "Loading draft saved." };
}
export async function restoreLoadingAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const source = await db.loadingVersion.findUnique({ where: { id: text(formData, "id", 60) } }); if (source) await db.loadingVersion.create({ data: { name: `Restored: ${source.name}`, status: "PUBLISHED", config: source.config as Prisma.InputJsonValue, publishedAt: new Date() } }); await audit({ actorId: actor.id, action: "LOADING_RESTORE", targetType: "LoadingVersion", targetId: source?.id }); refresh(); }

export async function saveLanguageAction(formData: FormData) {
  const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); const code = text(formData, "code", 12).toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(code)) return;
  const data = { code, englishName: text(formData, "englishName", 80), nativeName: text(formData, "nativeName", 80), flag: text(formData, "flag", 20) || null, direction: text(formData, "direction", 3) === "rtl" ? "rtl" : "ltr", enabled: bool(formData, "enabled") };
  if (!data.englishName || !data.nativeName) return;
  const isDefault = bool(formData, "isDefault"); const isFallback = bool(formData, "isFallback");
  await db.$transaction(async (tx) => {
    if (isDefault) await tx.language.updateMany({ data: { isDefault: false } });
    if (isFallback) await tx.language.updateMany({ data: { isFallback: false } });
    if (id) await tx.language.update({ where: { id }, data: { ...data, isDefault, isFallback } }); else await tx.language.create({ data: { ...data, isDefault, isFallback } });
  });
  await audit({ actorId: actor.id, action: "LANGUAGE_SAVE", targetType: "Language", targetId: id || code }); refresh();
}
export async function deleteLanguageAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); const language = await db.language.findUnique({ where: { id } }); if (!language || language.isDefault || language.isFallback) return; await db.language.delete({ where: { id } }); await audit({ actorId: actor.id, action: "LANGUAGE_DELETE", targetType: "Language", targetId: id, severity: "WARNING" }); refresh(); }

export async function saveTranslationAction(formData: FormData) {
  const actor = await admin(text(formData, "locale", 12)); const namespace = text(formData, "namespace", 80); const keyName = text(formData, "key", 120); const englishText = text(formData, "englishText", 5000); const targetLocale = text(formData, "targetLocale", 12); const value = text(formData, "value", 5000); if (!namespace || !keyName || !englishText || !targetLocale) return;
  const key = await db.translationKey.upsert({ where: { namespace_key: { namespace, key: keyName } }, update: { englishText }, create: { namespace, key: keyName, englishText } });
  const previous = await db.translationValue.findUnique({ where: { keyId_locale: { keyId: key.id, locale: targetLocale } } });
  if (previous) await db.translationVersion.create({ data: { keyId: key.id, locale: targetLocale, value: previous.value } });
  await db.translationValue.upsert({ where: { keyId_locale: { keyId: key.id, locale: targetLocale } }, update: { value, published: bool(formData, "published") }, create: { keyId: key.id, locale: targetLocale, value, published: bool(formData, "published") } });
  await audit({ actorId: actor.id, action: "TRANSLATION_SAVE", targetType: "TranslationKey", targetId: key.id, metadata: { locale: targetLocale } }); refresh();
}
export async function importTranslationsAction(formData: FormData) {
  const actor = await admin(text(formData, "locale", 12)); const file = formData.get("file"); if (!(file instanceof File) || file.size > 2_000_000) return;
  const input = JSON.parse(await file.text()) as Record<string, string>; let count = 0;
  for (const [compound, value] of Object.entries(input).slice(0, 5000)) {
    const [namespace, keyName] = compound.split("."); const targetLocale = text(formData, "targetLocale", 12); if (!namespace || !keyName || typeof value !== "string") continue;
    const key = await db.translationKey.upsert({ where: { namespace_key: { namespace, key: keyName } }, update: {}, create: { namespace, key: keyName, englishText: value } });
    await db.translationValue.upsert({ where: { keyId_locale: { keyId: key.id, locale: targetLocale } }, update: { value, published: false }, create: { keyId: key.id, locale: targetLocale, value, published: false } }); count++;
  }
  await audit({ actorId: actor.id, action: "TRANSLATION_IMPORT", targetType: "TranslationValue", metadata: { count } }); refresh();
}
export async function restoreTranslationAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const version = await db.translationVersion.findUnique({ where: { id: text(formData, "id", 60) }, include: { key: true } }); if (version) await db.translationValue.upsert({ where: { keyId_locale: { keyId: version.keyId, locale: version.locale } }, update: { value: version.value, published: false }, create: { keyId: version.keyId, locale: version.locale, value: version.value, published: false } }); await audit({ actorId: actor.id, action: "TRANSLATION_RESTORE", targetType: "TranslationVersion", targetId: version?.id }); refresh(); }

export async function savePopupAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); if (id) await snapshotPopup(id);
  const data = {
    name: text(formData, "name", 120), type: text(formData, "type", 40) as "WELCOME", status: text(formData, "intent", 20) === "publish" ? "PUBLISHED" as const : "DRAFT" as const,
    title: text(formData, "title", 300), description: text(formData, "description", 5000), imageUrl: text(formData, "imageUrl", 1000) || null, mobileImageUrl: text(formData, "mobileImageUrl", 1000) || null,
    imagePosition: text(formData, "imagePosition", 30) || "center", background: text(formData, "background", 40) || "surface", textColor: text(formData, "textColor", 40) || "primary", border: text(formData, "border", 40) || "silver",
    borderRadius: Math.min(60, Math.max(0, Number(formData.get("borderRadius") ?? 20))), width: Math.min(1400, Math.max(280, Number(formData.get("width") ?? 560))), height: Number(formData.get("height")) || null,
    position: text(formData, "position", 30) || "center", overlay: text(formData, "overlay", 30) || "dim", glowIntensity: Math.min(100, Math.max(0, Number(formData.get("glowIntensity") ?? 35))),
    buttonText: text(formData, "buttonText", 100) || null, buttonHref: text(formData, "buttonHref", 500) || null, buttonStyle: text(formData, "buttonStyle", 30) || "primary", closeStyle: text(formData, "closeStyle", 30) || "icon",
    animation: text(formData, "animation", 30) || "scale", animationSpeed: Math.min(1000, Math.max(0, Number(formData.get("animationSpeed") ?? 220))), typography: text(formData, "typography", 40) || "default", spacing: Math.min(80, Math.max(8, Number(formData.get("spacing") ?? 24))), htmlSafeContent: sanitizeHtml(text(formData, "htmlSafeContent", 10000), { allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a"], allowedAttributes: { a: ["href", "title"] }, allowedSchemes: ["https"] }) || null,
    audience: text(formData, "audience", 30) || "everyone", roles: list(formData, "roles"), plans: list(formData, "plans"), userGroups: list(formData, "userGroups"), pages: list(formData, "pages"), device: text(formData, "device", 20) as "ALL", delaySeconds: Math.min(3600, Math.max(0, Number(formData.get("delaySeconds") ?? 0))), triggerAction: text(formData, "triggerAction", 60) || null,
    frequency: text(formData, "frequency", 30) as "ONCE_SESSION", repeatIntervalHours: Number(formData.get("repeatIntervalHours")) || null, frequencyCap: Math.min(100, Math.max(1, Number(formData.get("frequencyCap") ?? 1))), startsAt: date(formData, "startsAt"), endsAt: date(formData, "endsAt"), timezone: text(formData, "timezone", 80) || "UTC",
  };
  if (!data.name || !data.title || !data.description) return { error: "Name, title, and description are required." };
  let popup;
  if (id) popup = await db.popupCampaign.update({ where: { id }, data }); else popup = await db.popupCampaign.create({ data: { ...data, enabled: data.status === "PUBLISHED" } });
  const translationLocale = text(formData, "translationLocale", 12); const translatedTitle = text(formData, "translatedTitle", 300); const translatedDescription = text(formData, "translatedDescription", 5000);
  if (translationLocale && translatedTitle && translatedDescription) await db.popupTranslation.upsert({ where: { popupId_locale: { popupId: popup.id, locale: translationLocale } }, update: { title: translatedTitle, description: translatedDescription, buttonText: text(formData, "translatedButtonText", 100) || null }, create: { popupId: popup.id, locale: translationLocale, title: translatedTitle, description: translatedDescription, buttonText: text(formData, "translatedButtonText", 100) || null } });
  await audit({ actorId: actor.id, action: "POPUP_SAVE", targetType: "PopupCampaign", targetId: popup.id, metadata: { status: data.status } }); refresh(); return { ok: true, message: data.status === "PUBLISHED" ? "Popup published with its own activation controls." : "Popup draft and version snapshot saved." };
}
export async function togglePopupAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); const popup = await db.popupCampaign.findUniqueOrThrow({ where: { id } }); await db.popupCampaign.update({ where: { id }, data: { enabled: !popup.enabled } }); await audit({ actorId: actor.id, action: "POPUP_TOGGLE", targetType: "PopupCampaign", targetId: id, metadata: { enabled: !popup.enabled } }); refresh(); }
export async function archivePopupAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); await snapshotPopup(id); await db.popupCampaign.update({ where: { id }, data: { status: "ARCHIVED", enabled: false } }); await audit({ actorId: actor.id, action: "POPUP_ARCHIVE", targetType: "PopupCampaign", targetId: id }); refresh(); }
export async function duplicatePopupAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const source = await db.popupCampaign.findUnique({ where: { id: text(formData, "id", 60) }, include: { translations: true } }); if (source) { const { id: _id, createdAt: _c, updatedAt: _u, translations, ...data } = source; void _id; void _c; void _u; const copy = await db.popupCampaign.create({ data: { ...data, recurrence: source.recurrence === null ? Prisma.JsonNull : source.recurrence as Prisma.InputJsonValue, name: `${source.name} (Copy)`, enabled: false, status: "DRAFT" } }); if (translations.length) await db.popupTranslation.createMany({ data: translations.map((item) => ({ popupId: copy.id, locale: item.locale, title: item.title, description: item.description, buttonText: item.buttonText })) }); } await audit({ actorId: actor.id, action: "POPUP_DUPLICATE", targetType: "PopupCampaign", targetId: source?.id }); refresh(); }
export async function restorePopupAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const version = await db.popupVersion.findUnique({ where: { id: text(formData, "id", 60) }, include: { popup: true } }); if (version) { const snapshot = version.snapshot as Record<string, unknown>; const allowed = ["title", "description", "enabled", "status", "priority", "width", "height", "position", "animation", "frequency"] as const; const data = Object.fromEntries(allowed.filter((key) => key in snapshot).map((key) => [key, snapshot[key]])); await db.popupCampaign.update({ where: { id: version.popupId }, data }); await audit({ actorId: actor.id, action: "POPUP_RESTORE", targetType: "PopupCampaign", targetId: version.popupId }); } refresh(); }

export async function saveAnnouncementAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); const title = text(formData, "title", 200); const body = text(formData, "body", 10000); if (!title || !body) return; const slug = (text(formData, "slug", 180) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 180); const publish = bool(formData, "published"); const data = { slug, title, body, status: publish ? "PUBLISHED" as const : "DRAFT" as const, pinned: bool(formData, "pinned"), targetRoles: list(formData, "targetRoles"), targetPlans: list(formData, "targetPlans"), emailNotify: bool(formData, "emailNotify"), publishedAt: publish ? new Date() : null, expiresAt: date(formData, "expiresAt") }; if (id) await db.announcement.update({ where: { id }, data }); else await db.announcement.create({ data }); await audit({ actorId: actor.id, action: "ANNOUNCEMENT_SAVE", targetType: "Announcement", targetId: id || slug }); refresh(); }
export async function deleteAnnouncementAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const id = text(formData, "id", 60); await db.announcement.delete({ where: { id } }); await audit({ actorId: actor.id, action: "ANNOUNCEMENT_DELETE", targetType: "Announcement", targetId: id, severity: "WARNING" }); refresh(); }
export async function sendNotificationAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12)); const username = text(formData, "username", 80); const title = text(formData, "title", 180); const body = text(formData, "body", 2000); if (!title || !body) return; const users = username ? await db.user.findMany({ where: { username }, select: { id: true } }) : await db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } }); if (users.length) await db.notification.createMany({ data: users.map((user) => ({ userId: user.id, title, body, href: text(formData, "href", 300) || null, type: "SYSTEM" })) }); await audit({ actorId: actor.id, action: "NOTIFICATION_SEND", targetType: "Notification", metadata: { recipients: users.length } }); refresh(); }

export async function saveAutomationAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12), "system.manage"); const id = text(formData, "id", 60); const name = text(formData, "name", 140); const trigger = text(formData, "trigger", 80); if (!name || !trigger) return; let conditions: Prisma.InputJsonValue = []; let actions: Prisma.InputJsonValue = []; try { conditions = JSON.parse(text(formData, "conditions", 10000) || "[]"); actions = JSON.parse(text(formData, "actions", 10000) || "[]"); } catch { return; } const data = { name, description: text(formData, "description", 1000), trigger, conditions, actions, status: bool(formData, "active") ? "ACTIVE" as const : "DISABLED" as const, testMode: bool(formData, "testMode") }; if (id) await db.automation.update({ where: { id }, data }); else await db.automation.create({ data }); await audit({ actorId: actor.id, action: "AUTOMATION_SAVE", targetType: "Automation", targetId: id || name }); refresh(); }
export async function toggleAutomationAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12), "system.manage"); const id = text(formData, "id", 60); const item = await db.automation.findUniqueOrThrow({ where: { id } }); await db.automation.update({ where: { id }, data: { status: item.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } }); await audit({ actorId: actor.id, action: "AUTOMATION_TOGGLE", targetType: "Automation", targetId: id }); refresh(); }
export async function runAutomationAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12), "system.manage"); const id = text(formData, "id", 60); const item = await db.automation.findUniqueOrThrow({ where: { id } }); await db.automationExecution.create({ data: { automationId: id, idempotencyKey: `TEST_${randomToken()}`, payload: { test: true, actorId: actor.id, trigger: item.trigger }, status: "PENDING" } }); await audit({ actorId: actor.id, action: "AUTOMATION_TEST", targetType: "Automation", targetId: id }); refresh(); }
export async function retryAutomationAction(formData: FormData) { const actor = await admin(text(formData, "locale", 12), "system.manage"); const id = text(formData, "id", 60); const execution = await db.automationExecution.findUniqueOrThrow({ where: { id } }); if (execution.status === "FAILED") await db.automationExecution.update({ where: { id }, data: { status: "PENDING", error: null, runAfter: new Date() } }); await audit({ actorId: actor.id, action: "AUTOMATION_RETRY", targetType: "AutomationExecution", targetId: id }); refresh(); }
