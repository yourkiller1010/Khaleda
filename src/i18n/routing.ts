import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "bn", "ar", "es", "fr", "de", "pt", "ru", "tr", "id", "hi", "zh", "ja", "ko", "it", "nl", "pl", "vi", "th", "ur"],
  defaultLocale: "en",
  localePrefix: "always",
});

export const rtlLocales = new Set(["ar", "ur"]);
export type AppLocale = (typeof routing.locales)[number];
