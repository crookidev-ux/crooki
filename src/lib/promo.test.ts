import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bogotaLocalToIso,
  effectivePrice,
  isoToBogotaLocal,
  isSaleActive,
  visibleTag,
} from "./promo.ts";

const now = new Date("2026-11-27T15:00:00.000Z");

test("no sale price → normal price", () => {
  assert.equal(isSaleActive({ price: 10000 }, now), false);
  assert.equal(isSaleActive({ price: 10000, sale_price: null }, now), false);
  assert.equal(effectivePrice({ price: 10000, sale_price: null }, now), 10000);
});

test("sale below price without end date is active", () => {
  const p = { price: 10000, sale_price: 8000 };
  assert.equal(isSaleActive(p, now), true);
  assert.equal(effectivePrice(p, now), 8000);
});

test("sale_price >= price or <= 0 is ignored", () => {
  assert.equal(effectivePrice({ price: 10000, sale_price: 10000 }, now), 10000);
  assert.equal(effectivePrice({ price: 10000, sale_price: 12000 }, now), 10000);
  assert.equal(effectivePrice({ price: 10000, sale_price: 0 }, now), 10000);
  assert.equal(effectivePrice({ price: 10000, sale_price: -5 }, now), 10000);
  assert.equal(effectivePrice({ price: 0, sale_price: 5000 }, now), 0);
});

test("end date: active strictly before, inactive at and after", () => {
  const p = (ends: string) => ({ price: 10000, sale_price: 8000, sale_ends_at: ends });
  assert.equal(isSaleActive(p("2026-11-27T15:00:00.001Z"), now), true);
  assert.equal(isSaleActive(p("2026-11-27T15:00:00.000Z"), now), false);
  assert.equal(isSaleActive(p("2026-11-27T14:59:59.999Z"), now), false);
  assert.equal(effectivePrice(p("2026-11-26T00:00:00Z"), now), 10000);
});

test("unparseable end date fails to the normal price", () => {
  assert.equal(effectivePrice({ price: 10000, sale_price: 8000, sale_ends_at: "mañana" }, now), 10000);
});

test("numeric strings from Postgres NUMERIC are accepted and rounded", () => {
  assert.equal(effectivePrice({ price: "10000.00", sale_price: "7999.60" }, now), 8000);
});

test("sale tags show only while the sale is active; others always", () => {
  const ended = "2026-11-01T00:00:00Z";
  assert.equal(visibleTag({ price: 10000, sale_price: 8000, promo_tag: "black_friday" }, now), "black_friday");
  assert.equal(visibleTag({ price: 10000, sale_price: 8000, sale_ends_at: ended, promo_tag: "black_friday" }, now), null);
  assert.equal(visibleTag({ price: 10000, promo_tag: "oferta" }, now), null);
  assert.equal(visibleTag({ price: 10000, promo_tag: "nuevo" }, now), "nuevo");
  assert.equal(visibleTag({ price: 10000, promo_tag: "inventada" }, now), null);
  assert.equal(visibleTag({ price: 10000 }, now), null);
});

test("Bogotá wall clock round-trips through ISO", () => {
  assert.equal(bogotaLocalToIso("2026-11-27T23:59"), "2026-11-28T04:59:00.000Z");
  assert.equal(isoToBogotaLocal("2026-11-28T04:59:00.000Z"), "2026-11-27T23:59");
  assert.equal(bogotaLocalToIso(""), null);
  assert.equal(bogotaLocalToIso("nope"), null);
  assert.equal(isoToBogotaLocal(null), "");
});
