import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ru"] as const,
  defaultLocale: "en",
  // English at root (/...), Russian at /ru/...
  // SEO-friendly: no redirect from / to /en, default locale unprefixed.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
