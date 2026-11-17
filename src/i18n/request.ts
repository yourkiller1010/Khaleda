import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value) && typeof result[key] === "object"
      ? deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>)
      : value;
  }
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && (hasLocale(routing.locales, requested) || /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(requested)) ? requested.toLowerCase() : routing.defaultLocale;
  const english = (await import(`@/messages/en.json`)).default;
  const localized = locale === "en" ? {} : await import(`@/messages/${locale}.json`).then((module) => module.default).catch(() => ({}));
  return { locale, messages: deepMerge(english, localized) };
});
