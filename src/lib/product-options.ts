// Admin side of product_options: the form's draft rows → validated rows that
// satisfy the table CHECKs (migration 20261126000000), so a save never sends
// something the database (or price-cart.ts) would reject.
import { MAX_LINE_QTY } from "./cart-limits.ts";

/** One editable row of the form; numbers are the raw input strings. */
export interface OptionDraft {
  id: string;
  label_es: string;
  label_en: string;
  price: string;
  min_qty: string;
  bulk_min_qty: string;
  bulk_price: string;
}

export interface OptionRow {
  id: string;
  product_id: string;
  label_es: string;
  label_en: string;
  price: number;
  min_qty: number;
  bulk_min_qty: number | null;
  bulk_price: number | null;
  display_order: number;
}

const MAX_LABEL = 120;

/** Positive integer from an input string, or null. */
function int(v: string): number | null {
  const s = v.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 ? n : null;
}

export function parseOptionDrafts(
  drafts: OptionDraft[],
  productId: string,
): { ok: true; rows: OptionRow[] } | { ok: false; error: string } {
  const rows: OptionRow[] = [];
  for (const [i, d] of drafts.entries()) {
    const n = `Presentación ${i + 1}`;
    const label_es = d.label_es.trim();
    const label_en = d.label_en.trim();
    if (!label_es) return { ok: false, error: `${n}: falta el nombre en español.` };
    if (label_es.length > MAX_LABEL || label_en.length > MAX_LABEL) {
      return { ok: false, error: `${n}: el nombre es muy largo (máx. ${MAX_LABEL}).` };
    }
    const price = int(d.price);
    if (price === null) return { ok: false, error: `${n}: el precio debe ser un número entero mayor que 0.` };
    const min_qty = d.min_qty.trim() === "" ? 1 : int(d.min_qty);
    if (min_qty === null || min_qty > MAX_LINE_QTY) {
      return { ok: false, error: `${n}: el mínimo debe estar entre 1 y ${MAX_LINE_QTY}.` };
    }
    const hasBulkQty = d.bulk_min_qty.trim() !== "";
    const hasBulkPrice = d.bulk_price.trim() !== "";
    let bulk_min_qty: number | null = null;
    let bulk_price: number | null = null;
    if (hasBulkQty || hasBulkPrice) {
      bulk_min_qty = int(d.bulk_min_qty);
      bulk_price = int(d.bulk_price);
      if (bulk_min_qty === null || bulk_price === null) {
        return { ok: false, error: `${n}: el precio por cantidad necesita la cantidad y el precio.` };
      }
      if (bulk_min_qty <= min_qty || bulk_min_qty > MAX_LINE_QTY) {
        return { ok: false, error: `${n}: el precio por cantidad debe empezar por encima del mínimo (y hasta ${MAX_LINE_QTY}).` };
      }
      if (bulk_price >= price) {
        return { ok: false, error: `${n}: el precio por cantidad debe ser menor que el precio normal.` };
      }
    }
    rows.push({ id: d.id, product_id: productId, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price, display_order: i });
  }
  return { ok: true, rows };
}
