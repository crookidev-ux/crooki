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

/** Integer pesos, or null when the value is not a finite, non-negative amount. */
function toMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

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
    for (const r of rows) {
      // A row with unusable money is dropped, so choosing it fails with 400.
      const extra = toMoney(r.extra_price);
      if (extra !== null) map.set(`${r.parent}:${r.child}`, extra);
    }
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

  // Category kind/visibility is looked up separately (products.category is a
  // slug, not a guaranteed foreign key, so a PostgREST embed is not relied on).
  // A slug missing from `categories` is treated as hidden: the public pages
  // only render listed categories.
  const slugs = [...new Set(rows.map((r) => r.category))];
  const merchSlugs = new Set<string>();
  const visibleSlugs = new Set<string>();
  if (slugs.length > 0) {
    const catRes = await supabase.from("categories").select("slug, kind, visible").in("slug", slugs);
    for (const c of unwrap<{ slug: string; kind: string; visible?: boolean | null }>(catRes, "categories")) {
      if (c.kind === "merch") merchSlugs.add(c.slug);
      if (c.visible !== false) visibleSlugs.add(c.slug);
    }
  }

  for (const r of rows) {
    const price = toMoney(r.price);
    const giftPrice = toMoney(r.gift_card_price);
    const giftCakePrice = toMoney(r.gift_card_cake_price);
    // Unusable money (non-finite or negative) makes the product unavailable.
    const badGift = (raw: unknown, parsed: number | null) =>
      raw !== null && raw !== undefined && parsed === null;
    const moneyOk =
      price !== null &&
      !badGift(r.gift_card_price, giftPrice) &&
      !badGift(r.gift_card_cake_price, giftCakePrice);
    const p: CatalogProduct = {
      id: r.id,
      name_es: r.name_es,
      name_en: r.name_en,
      price: price ?? 0,
      available: r.available === true && moneyOk,
      isMerch: merchSlugs.has(r.category),
      category: r.category,
      categoryVisible: visibleSlugs.has(r.category),
    };
    if (r.includes_salsa != null) p.includes_salsa = r.includes_salsa;
    if (r.box_cookie_count != null) p.box_cookie_count = r.box_cookie_count;
    if (r.included_salsas_count != null) p.included_salsas_count = r.included_salsas_count;
    p.gift_card_price = giftPrice;
    p.gift_card_cake_price = giftCakePrice;
    catalog.products.set(p.id, p);
  }
  return catalog;
}

/** Convenience for the checkout route: loads the catalog with the service role. */
export async function loadCheckoutCatalog(productIds: string[]): Promise<Catalog> {
  const supabase = await createAdminClient();
  return loadCatalog(supabase, productIds);
}
