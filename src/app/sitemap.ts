import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { legalDocs } from "@/content/legal";
import { SITE_URL, localizedUrl } from "@/lib/seo";

const PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/menu", priority: 0.9 },
  { path: "/merch", priority: 0.7 },
  { path: "/legal", priority: 0.3 },
  ...legalDocs.map((d) => ({ path: `/legal/${d.slug}`, priority: 0.3 })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority }) => ({
    url: `${SITE_URL}${localizedUrl(path, routing.defaultLocale)}`,
    priority,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${SITE_URL}${localizedUrl(path, l)}`]),
      ),
    },
  }));
}
