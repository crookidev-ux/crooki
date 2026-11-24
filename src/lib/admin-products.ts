import { isSaleActive, type PromoFields } from "./promo.ts";

// Pure filters and grouping of the admin product list (/admin/productos).

export const PRODUCT_FILTERS = [
  { id: "agotados", label: "Agotados" },
  { id: "oferta", label: "En oferta" },
  { id: "sin-foto", label: "Sin foto" },
] as const;

export type ProductFilter = (typeof PRODUCT_FILTERS)[number]["id"];

export function parseProductFilter(v: unknown): ProductFilter | null {
  return PRODUCT_FILTERS.some((f) => f.id === v) ? (v as ProductFilter) : null;
}

type ListProduct = PromoFields & {
  name_es: string;
  name_en: string;
  category: string;
  available: boolean;
  product_images?: unknown[] | null;
};

/** Lowercase without accents, so «limon» finds «Limón». */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesProductFilter(p: ListProduct, f: ProductFilter, now: Date = new Date()): boolean {
  if (f === "agotados") return !p.available;
  if (f === "oferta") return isSaleActive(p, now);
  return !p.product_images?.length;
}

export function filterProducts<T extends ListProduct>(
  list: T[],
  opts: { q?: string; f?: ProductFilter | null },
  now: Date = new Date(),
): T[] {
  const q = fold(opts.q ?? "");
  return list.filter(
    (p) =>
      (!q || fold(p.name_es).includes(q) || fold(p.name_en ?? "").includes(q)) &&
      (!opts.f || matchesProductFilter(p, opts.f, now)),
  );
}

/**
 * Products under each category, in the categories' order. Categories with no
 * match are kept only when `keepEmpty` (no search or filter active), so a
 * filtered view shows just what matches.
 */
export function groupByCategory<C extends { slug: string }, T extends { category: string }>(
  categories: C[],
  products: T[],
  keepEmpty: boolean,
): { category: C; products: T[] }[] {
  return categories
    .map((category) => ({ category, products: products.filter((p) => p.category === category.slug) }))
    .filter((g) => keepEmpty || g.products.length > 0);
}
