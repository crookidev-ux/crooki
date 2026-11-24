import { test } from "node:test";
import assert from "node:assert/strict";
import { navidadJsonLd } from "./navidad-seo.ts";
import type { Product } from "./types.ts";

const base = {
  id: "p1",
  name_es: "Caja Navideña",
  name_en: "Christmas Box",
  description_es: "",
  description_en: "",
  price: 40000,
  category: "navidad",
  available: true,
  display_order: 0,
  created_at: "2026-11-01T00:00:00Z",
  slug: "caja-navidena",
  product_images: [
    { id: "a", product_id: "p1", url: "https://x/1.webp", display_order: 0 },
    { id: "b", product_id: "p1", url: "https://x/2.webp", display_order: 1 },
  ],
} satisfies Product;

const opts = {
  name: "Caja Navideña",
  description: "Galletas",
  pageUrl: "https://s/navidad/caja-navidena",
  catalogUrl: "https://s/navidad",
  homeUrl: "https://s/",
  labels: { home: "Inicio", catalog: "Navidad" },
};
const now = new Date("2026-12-01T12:00:00Z");

test("offer uses the active sale price, COP and its end date", () => {
  // Round-trip through JSON: what the page actually prints.
  const [product, crumbs] = JSON.parse(
    JSON.stringify(navidadJsonLd({ ...base, sale_price: 35000, sale_ends_at: "2026-12-24T04:59:00Z" }, opts, now)),
  );
  assert.equal(product["@type"], "Product");
  assert.deepEqual(product.image, ["https://x/1.webp", "https://x/2.webp"]);
  assert.equal(product.offers.price, 35000);
  assert.equal(product.offers.priceCurrency, "COP");
  assert.equal(product.offers.priceValidUntil, "2026-12-23", "Dec 23 23:59 in Bogotá");
  assert.equal(product.offers.availability, "https://schema.org/InStock");
  assert.equal(crumbs.itemListElement.length, 3);
  assert.equal(crumbs.itemListElement[2].item, opts.pageUrl);
});

test("ended sale → normal price, no end date; sold out → OutOfStock", () => {
  const [product] = JSON.parse(
    JSON.stringify(
      navidadJsonLd({ ...base, available: false, sale_price: 35000, sale_ends_at: "2026-11-30T00:00:00Z" }, opts, now),
    ),
  );
  assert.equal(product.offers.price, 40000);
  assert.equal(product.offers.priceValidUntil, undefined);
  assert.equal(product.offers.availability, "https://schema.org/OutOfStock");
});
