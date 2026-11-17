import { db } from "@/lib/db";

export const defaultAppearance = {
  background: "#0b0b0b",
  surface: "#121212",
  elevated: "#191919",
  foreground: "#f4f4f2",
  muted: "#a3a3a3",
  border: "#2b2b2b",
  glow: 34,
  radius: 18,
  fontScale: 100,
  animationIntensity: 70,
  lightBackground: "#f2f2ef",
  lightSurface: "#fafaf8",
  lightForeground: "#151515",
};

export const defaultLoading = {
  enabled: true,
  pageTransitions: true,
  animation: "byte-scan",
  background: "obsidian",
  logoAnimation: "draw",
  text: "Initializing secure workspace",
  progress: "indeterminate",
  speed: 900,
  minimumDuration: 500,
  mobile: true,
  desktop: true,
};

export async function getSystemSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await db.systemSetting.findUnique({ where: { key } });
  return record ? (record.value as T) : fallback;
}

export async function getAppearance() {
  const version = await db.appearanceVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
  return { ...defaultAppearance, ...((version?.tokens as object | undefined) ?? {}) };
}

export async function getLoadingSettings() {
  const version = await db.loadingVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
  return { ...defaultLoading, ...((version?.config as object | undefined) ?? {}) };
}
