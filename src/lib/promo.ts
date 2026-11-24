// Pure sale-price and promo-tag rules shared by the checkout (what is charged)
// and the UI (what is shown). One source of truth: never re-derive elsewhere.

export const PROMO_TAGS = [
  "black_friday",
  "oferta",
  "navidad",
  "nuevo",
  "mas_vendido",
  "edicion_limitada",
] as const;

export type PromoTag = (typeof PROMO_TAGS)[number];

/** Tags that only make sense while a sale price is active. */
const SALE_TAGS: readonly PromoTag[] = ["black_friday", "oferta"];

export interface PromoFields {
  price: number | string;
  sale_price?: number | string | null;
  sale_ends_at?: string | null;
  promo_tag?: string | null;
}

export function isPromoTag(v: unknown): v is PromoTag {
  return typeof v === "string" && (PROMO_TAGS as readonly string[]).includes(v);
}

/**
 * Active ⇔ 0 < sale_price < price and (no end date or it is still in the
 * future). An unparseable end date counts as ended: fail to the normal price.
 */
export function isSaleActive(p: PromoFields, now: Date = new Date()): boolean {
  if (p.sale_price === null || p.sale_price === undefined || p.sale_price === "") return false;
  const sale = Number(p.sale_price);
  const price = Number(p.price);
  if (!Number.isFinite(sale) || !Number.isFinite(price)) return false;
  if (!(sale > 0 && sale < price)) return false;
  if (p.sale_ends_at) return Date.parse(p.sale_ends_at) > now.getTime();
  return true;
}

/** Integer pesos the customer pays for the base product right now. */
export function effectivePrice(p: PromoFields, now: Date = new Date()): number {
  return Math.round(Number(isSaleActive(p, now) ? p.sale_price : p.price));
}

/** The tag to render, or null (sale tags hide once the sale is over). */
export function visibleTag(p: PromoFields, now: Date = new Date()): PromoTag | null {
  if (!isPromoTag(p.promo_tag)) return null;
  if (SALE_TAGS.includes(p.promo_tag) && !isSaleActive(p, now)) return null;
  return p.promo_tag;
}

// Admin input: the shop types the end in Colombia time (UTC-5, no DST).
const BOGOTA_OFFSET = "-05:00";

/** "2026-11-27T23:59" (Bogotá wall clock) → ISO instant, or null if empty/invalid. */
export function bogotaLocalToIso(local: string): string | null {
  if (!local) return null;
  const ms = Date.parse(`${local.length === 16 ? `${local}:00` : local}${BOGOTA_OFFSET}`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** ISO instant → "YYYY-MM-DDTHH:mm" in Bogotá time, for a datetime-local input. */
export function isoToBogotaLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms - 5 * 3600_000).toISOString().slice(0, 16);
}
