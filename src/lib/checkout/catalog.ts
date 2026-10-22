// Server-only: loads the slice of the catalog a checkout needs, straight from
// the database, so the prices used to charge the customer are never the
// browser's. Import only from Route Handlers / Server Components.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import type { Catalog, CatalogProduct } from "./price-cart";

type ProductRow = {
  id: string;
  name_es: string;
  name_en: string;
  price: number | string;
  available: boolean;
  category: string;
  includes_salsa?: boolean | null;
  box_cookie_count?: number | null;
  gift_card_price?: number | string | null;
  gift_card_cake_price?: number | string | null;
  included_salsas_count?: number | null;
};

type JunctionRow = { parent: string; child: string; extra_price: number | string };

const toInt = (v: number | string) => Math.round(Number(v));
const toIntOrNull = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : toInt(v);

function unwrap<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`loadCatalog: ${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

async function loadJunction(
  supabase: SupabaseClient,
  table: "combo_cookies" | "combo_salsas" | "box_cookies",
  parentCol: string,
  childCol: string,
  ids: string[],
): Promise<JunctionRow[]> {
  const res = await supabase
    .from(table)
    .select(`${parentCol}, ${childCol}, extra_price`)
    .in(parentCol, ids);
  return unwrap<Record<string, unknown>>(res, table).map((r) => ({
    parent: String(r[parentCol]),
    child: String(r[childCol]),
    extra_price: r.extra_price as number | string,
  }));
}

/**
 * Loads `productIds`, their combo/box/helado configuration rows, and the
 * cookie/salsa products those rows point to (for line names).
 */
export async function loadCatalog(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Catalog> {
  const ids = [...new Set(productIds)];
  const catalog: Catalog = {
    products: new Map(),
    comboCookies: new Map(),
    comboSalsas: new Map(),
    boxCookies: new Map(),
  };
  if (ids.length === 0) return catalog;

  const [comboCookies, comboSalsas, boxCookies] = await Promise.all([
    loadJunction(supabase, "combo_cookies", "combo_id", "cookie_id", ids),
    loadJunction(supabase, "combo_salsas", "combo_id", "salsa_id", ids),
    loadJunction(supabase, "box_cookies", "box_id", "cookie_id", ids),
  ]);
  const fill = (map: Map<string, number>, rows: JunctionRow[]) => {
    for (const r of rows) map.set(`${r.parent}:${r.child}`, toInt(r.extra_price));
  };
  fill(catalog.comboCookies, comboCookies);
  fill(catalog.comboSalsas, comboSalsas);
  fill(catalog.boxCookies, boxCookies);

  const allIds = new Set(ids);
  for (const r of [...comboCookies, ...comboSalsas, ...boxCookies]) allIds.add(r.child);

  const productsRes = await supabase
    .from("products")
    .select(
      "id, name_es, name_en, price, available, category, includes_salsa, box_cookie_count, gift_card_price, gift_card_cake_price, included_salsas_count",
    )
    .in("id", [...allIds]);
  const rows = unwrap<ProductRow>(productsRes, "products");

  // Category kind is looked up separately (products.category is a slug, not a
  // guaranteed foreign key, so a PostgREST embed is not relied on).
  const slugs = [...new Set(rows.map((r) => r.category))];
  const merchSlugs = new Set<string>();
  if (slugs.length > 0) {
    const catRes = await supabase.from("categories").select("slug, kind").in("slug", slugs);
    for (const c of unwrap<{ slug: string; kind: string }>(catRes, "categories")) {
      if (c.kind === "merch") merchSlugs.add(c.slug);
    }
  }

  for (const r of rows) {
    const p: CatalogProduct = {
      id: r.id,
      name_es: r.name_es,
      name_en: r.name_en,
      price: toInt(r.price),
      available: r.available === true,
      isMerch: merchSlugs.has(r.category),
    };
    if (r.includes_salsa != null) p.includes_salsa = r.includes_salsa;
    if (r.box_cookie_count != null) p.box_cookie_count = r.box_cookie_count;
    if (r.included_salsas_count != null) p.included_salsas_count = r.included_salsas_count;
    p.gift_card_price = toIntOrNull(r.gift_card_price);
    p.gift_card_cake_price = toIntOrNull(r.gift_card_cake_price);
    catalog.products.set(p.id, p);
  }
  return catalog;
}

/** Convenience for the checkout route: loads the catalog with the service role. */
export async function loadCheckoutCatalog(productIds: string[]): Promise<Catalog> {
  const supabase = await createAdminClient();
  return loadCatalog(supabase, productIds);
}
