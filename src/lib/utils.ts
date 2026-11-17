import { randomBytes, createHash } from "node:crypto";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function reference(prefix: string) {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}_${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function referralCode(username: string) {
  const base = username.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "KB";
  return `${base}${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function formatMoney(value: number | string, currency = "USD") {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function safeJson<T>(value: unknown, fallback: T): T {
  return value as T ?? fallback;
}

export function absoluteUrl(path: string) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}
