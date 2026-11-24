import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { legalDocs } from "@/content/legal";
import { SITE_URL, localizedUrl } from "@/lib/seo";
import { loadNavidadCategories, loadNavidadProducts } from "@/lib/navidad";

const PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/menu", priority: 0.9 },
  { path: "/merch", priority: 0.7 },
  { path: "/legal", priority: 0.3 },
  ...legalDocs.map((d) => ({ path: `/legal/${d.slug}`, priority: 0.3 })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The Christmas pages exist only while a navidad category is visible.
  const [navidadCategories, navidadProducts] = await Promise.all([
    loadNavidadCategories(),
    loadNavidadProducts(),
  ]);
  const pages = [
    ...PAGES,
    ...(navidadCategories.length > 0 ? [{ path: "/navidad", priority: 0.8 }] : []),
    ...navidadProducts.map((p) => ({ path: `/navidad/${p.slug}`, priority: 0.7 })),
  ];
  return pages.map(({ path, priority }) => ({
    url: `${SITE_URL}${localizedUrl(path, routing.defaultLocale)}`,
    priority,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${SITE_URL}${localizedUrl(path, l)}`]),
      ),
    },
  }));
}
