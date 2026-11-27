// Server-only: loads the slice of the catalog a checkout needs, straight from
// the database, so the prices used to charge the customer are never the
// browser's. Import only from Route Handlers / Server Components.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { parseDeliveryRule, type DeliveryRule } from "@/lib/delivery-zones";
import { effectivePrice } from "@/lib/promo";
import { isMissingTable } from "@/lib/missing-table";
import type { Catalog, CatalogOption, CatalogProduct } from "./price-cart";

type ProductRow = {
  id: string;
  name_es: string;
  name_en: string;
  price: number | string;
  // Promo columns (migration 20261124000000); absent until it is applied.
  sale_price?: number | string | null;
  sale_ends_at?: string | null;
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
 * product_options of `ids`, grouped by product. Money is parsed like the
 * products' (price-cart.ts drops rows that break the table CHECKs). Before
 * migration 20261126000000 the table does not exist: then no product has
 * options, which is safe because those products still cost 0 («Consultar»).
 */
async function loadOptions(supabase: SupabaseClient, ids: string[]): Promise<Map<string, CatalogOption[]>> {
  const res = await supabase
    .from("product_options")
    .select("id, product_id, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price, display_order")
    .in("product_id", ids)
    .order("display_order");
  const options = new Map<string, CatalogOption[]>();
  if (res.error && isMissingTable(res.error)) return options;
  for (const r of unwrap<Record<string, unknown>>(res, "product_options")) {
    const productId = String(r.product_id);
    const list = options.get(productId) ?? [];
    list.push({
      id: String(r.id),
      label_es: String(r.label_es ?? ""),
      label_en: String(r.label_en ?? ""),
      // An unparseable amount becomes NaN and makes the row invalid.
      price: toMoney(r.price) ?? Number.NaN,
      min_qty: Number(r.min_qty),
      bulk_min_qty: r.bulk_min_qty == null ? null : Number(r.bulk_min_qty),
      bulk_price: r.bulk_price == null ? null : (toMoney(r.bulk_price) ?? Number.NaN),
    });
    options.set(productId, list);
  }
  return options;
}

/**
 * Loads `productIds`, their combo/box/helado configuration rows, their options, and the
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

  const [comboCookies, comboSalsas, boxCookies, options] = await Promise.all([
    loadJunction(supabase, "combo_cookies", "combo_id", "cookie_id", ids),
    loadJunction(supabase, "combo_salsas", "combo_id", "salsa_id", ids),
    loadJunction(supabase, "box_cookies", "box_id", "cookie_id", ids),
    loadOptions(supabase, ids),
  ]);
  catalog.options = options;
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

  // "*" so checkout keeps working (at the normal price) if the promo
  // migration has not been applied yet; ProductRow lists what is read.
  const productsRes = await supabase
    .from("products")
    .select("*")
    .in("id", [...allIds]);
  const rows = unwrap<ProductRow>(productsRes, "products");

  // Category kind/visibility is looked up separately (products.category is a
  // slug, not a guaranteed foreign key, so a PostgREST embed is not relied on).
  // A slug missing from `categories` is treated as hidden: the public pages
  // only render listed categories.
  const slugs = [...new Set(rows.map((r) => r.category))];
  const merchSlugs = new Set<string>();
  const visibleSlugs = new Set<string>();
  const deliveryRules = new Map<string, DeliveryRule>();
  if (slugs.length > 0) {
    const catRes = await supabase.from("categories").select("slug, kind, visible, delivery_rule").in("slug", slugs);
    for (const c of unwrap<{ slug: string; kind: string; visible?: boolean | null; delivery_rule?: string | null }>(catRes, "categories")) {
      deliveryRules.set(c.slug, parseDeliveryRule(c.delivery_rule));
      if (c.kind === "merch") merchSlugs.add(c.slug);
      if (c.visible !== false) visibleSlugs.add(c.slug);
    }
  }

  for (const r of rows) {
    // The price charged is the sale price while the sale is active.
    const price = toMoney(r.price) === null ? null : toMoney(effectivePrice(r));
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
      deliveryRule: deliveryRules.get(r.category) ?? "none",
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
  const supabase = createServiceClient();
  return loadCatalog(supabase, productIds);
}
