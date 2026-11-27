import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOptionDrafts, type OptionDraft } from "./product-options.ts";

const draft = (d: Partial<OptionDraft> = {}): OptionDraft => ({
  id: "o1",
  label_es: "Caja x2",
  label_en: "Box of 2",
  price: "23000",
  min_qty: "1",
  bulk_min_qty: "",
  bulk_price: "",
  ...d,
});

test("parseOptionDrafts: valid rows keep their order; empty minimum means 1", () => {
  const r = parseOptionDrafts(
    [draft({ label_es: " Caja x2 " }), draft({ id: "o2", label_es: "Unidad", price: "10000", min_qty: "", bulk_min_qty: "12", bulk_price: "8900" })],
    "p1",
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.rows[0], {
    id: "o1", product_id: "p1", label_es: "Caja x2", label_en: "Box of 2", price: 23000, min_qty: 1,
    bulk_min_qty: null, bulk_price: null, display_order: 0,
  });
  assert.equal(r.rows[1].min_qty, 1);
  assert.equal(r.rows[1].bulk_min_qty, 12);
  assert.equal(r.rows[1].bulk_price, 8900);
  assert.equal(r.rows[1].display_order, 1);
});

test("parseOptionDrafts: rejects what the table CHECKs would reject", () => {
  for (const d of [
    { label_es: "  " },
    { label_es: "x".repeat(121) },
    { price: "0" },
    { price: "-5" },
    { price: "10.5" },
    { price: "" },
    { min_qty: "0" },
    { min_qty: "51" },
    { bulk_min_qty: "12" },
    { bulk_price: "8900" },
    { min_qty: "12", bulk_min_qty: "12", bulk_price: "9000" },
    { bulk_min_qty: "12", bulk_price: "23000" },
    { bulk_min_qty: "60", bulk_price: "9000" },
  ]) {
    assert.equal(parseOptionDrafts([draft(d)], "p1").ok, false, JSON.stringify(d).slice(0, 60));
  }
});
