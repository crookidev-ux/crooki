import { test } from "node:test";
import assert from "node:assert/strict";
import { filterProducts, fold, groupByCategory, parseProductFilter } from "./admin-products.ts";

const NOW = new Date("2026-11-24T20:00:00Z");
const p = (name_es: string, over: Record<string, unknown> = {}) => ({
  name_es,
  name_en: "",
  category: "galletas",
  available: true,
  price: 20000,
  sale_price: null as number | null,
  sale_ends_at: null as string | null,
  product_images: [{}] as unknown[],
  ...over,
});

test("search ignores accents and case, in both languages", () => {
  const list = [p("Limón Bliss", { name_en: "Lemon Bliss" }), p("Red Velvet")];
  assert.deepEqual(filterProducts(list, { q: "limon" }, NOW).map((x) => x.name_es), ["Limón Bliss"]);
  assert.deepEqual(filterProducts(list, { q: "LEMON" }, NOW).map((x) => x.name_es), ["Limón Bliss"]);
  assert.equal(filterProducts(list, { q: "" }, NOW).length, 2);
  assert.equal(fold("  Ñandú "), "nandu");
});

test("filters: sold out, active sale, no photo", () => {
  const list = [
    p("A", { available: false }),
    p("B", { sale_price: 17000 }),
    p("C", { sale_price: 17000, sale_ends_at: "2026-11-01T00:00:00Z" }), // ended
    p("D", { product_images: [] }),
    p("E", { product_images: null }),
  ];
  assert.deepEqual(filterProducts(list, { f: "agotados" }, NOW).map((x) => x.name_es), ["A"]);
  assert.deepEqual(filterProducts(list, { f: "oferta" }, NOW).map((x) => x.name_es), ["B"]);
  assert.deepEqual(filterProducts(list, { f: "sin-foto" }, NOW).map((x) => x.name_es), ["D", "E"]);
  assert.deepEqual(filterProducts(list, { q: "a", f: "agotados" }, NOW).map((x) => x.name_es), ["A"]);
  assert.equal(parseProductFilter("oferta"), "oferta");
  assert.equal(parseProductFilter("nope"), null);
});

test("groupByCategory keeps category order and drops empty groups when filtering", () => {
  const cats = [{ slug: "galletas" }, { slug: "cajas" }, { slug: "salsas" }];
  const prods = [p("Caja", { category: "cajas" }), p("Galleta"), p("Otra", { category: "huerfana" })];
  assert.deepEqual(
    groupByCategory(cats, prods, true).map((g) => [g.category.slug, g.products.length]),
    [["galletas", 1], ["cajas", 1], ["salsas", 0]],
  );
  assert.deepEqual(groupByCategory(cats, prods, false).map((g) => g.category.slug), ["galletas", "cajas"]);
});
