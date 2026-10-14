import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

export const SITE_URL = "https://www.crookibakebar.com";

// URL of `path` in `locale` (localePrefix "as-needed": Spanish has no prefix).
export function localizedUrl(path: string, locale: string): string {
  const clean = path === "/" ? "" : path;
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}

// Canonical + hreflang alternates for a page available in every locale.
export function alternatesFor(path: string, locale: string): Metadata["alternates"] {
  return {
    canonical: localizedUrl(path, locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, localizedUrl(path, l)])),
      "x-default": localizedUrl(path, routing.defaultLocale),
    },
  };
}
