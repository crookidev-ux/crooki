import { test } from "node:test";
import assert from "node:assert/strict";
import { priceCart, type Catalog, type CatalogProduct } from "./price-cart.ts";
import { parseCheckoutInput, type CheckoutInput } from "./schema.ts";

function product(p: Partial<CatalogProduct> & { id: string }): CatalogProduct {
  return {
    name_es: `ES ${p.id}`,
    name_en: `EN ${p.id}`,
    price: 5000,
    available: true,
    isMerch: false,
    category: "galletas",
    categoryVisible: true,
    ...p,
  };
}

function makeCatalog(): Catalog {
  const products = [
    product({ id: "galleta", price: 5000, name_es: "Galleta", name_en: "Cookie" }),
    product({ id: "choco", price: 6000, name_es: "Chocolate", name_en: "Chocolate EN" }),
    product({ id: "nutella", price: 7000, name_es: "Nutella ES", name_en: "Nutella EN" }),
    product({ id: "arequipe", price: 2000, name_es: "Arequipe", name_en: "Dulce de leche", category: "salsas", categoryVisible: false }),
    product({ id: "fresa", price: 2000, name_es: "Fresa", name_en: "Strawberry", category: "salsas", categoryVisible: false }),
    product({ id: "galleta-agotada", available: false }),
    product({ id: "combo-vacio", price: 15000, category: "combos" }),
    product({
      id: "combo",
      price: 15000,
      name_es: "Combo Clásico",
      name_en: "Classic Combo",
      category: "combos",
      includes_salsa: true,
    }),
    product({
      id: "caja",
      price: 30000,
      name_es: "Caja x6",
      name_en: "Box of 6",
      category: "cajas",
      box_cookie_count: 6,
      gift_card_price: 3000,
      gift_card_cake_price: null,
    }),
    product({
      id: "helado",
      price: 9000,
      name_es: "Helado",
      name_en: "Ice cream",
      category: "helados",
      included_salsas_count: 2,
    }),
    product({ id: "helado-extra", price: 9000, category: "helados", included_salsas_count: 0 }),
    product({ id: "agotado", available: false }),
    product({ id: "camiseta", price: 50000, isMerch: true, category: "camisetas" }),
  ];
  return {
    products: new Map(products.map((p) => [p.id, p])),
    comboCookies: new Map([
      ["combo:choco", 0],
      ["combo:nutella", 2000],
      ["combo:galleta-agotada", 0],
      ["combo:fantasma", 0],
    ]),
    comboSalsas: new Map([
      ["combo:arequipe", 0],
      ["helado:arequipe", 0],
      ["helado:fresa", 0],
      ["helado-extra:arequipe", 1500],
    ]),
    boxCookies: new Map([
      ["caja:choco", 0],
      ["caja:nutella", 1000],
    ]),
  };
}

function input(over: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    locale: "es",
    customer: { name: "Ana", email: "ana@example.com", phone: "3001234567" },
    fulfillment: "delivery",
    delivery: { zoneId: "bocagrande", address: "Cra 1 #2-3", recipientPhone: "3001234567" },
    notes: "",
    paymentMethod: "bold",
    acceptedPolicy: true,
    items: [{ productId: "galleta", quantity: 2 }],
    ...over,
  };
}

test("simple x2 + delivery to bocagrande", () => {
  const r = priceCart(input(), makeCatalog());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.subtotal, 10000);
  assert.equal(r.deliveryFee, 8500);
  assert.equal(r.total, 18500);
  assert.equal(r.zone?.id, "bocagrande");
  assert.equal(r.hasMerch, false);
  assert.deepEqual(r.lines, [
    { product_id: "galleta", product_name: "Galleta", quantity: 2, unit_price: 5000 },
  ]);
});

test("pickup: fee 0 and no delivery required", () => {
  const r = priceCart(input({ fulfillment: "pickup", delivery: undefined }), makeCatalog());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.deliveryFee, 0);
  assert.equal(r.total, 10000);
  assert.equal(r.zone, undefined);
});

test("combo with a cookie not in the combo -> 400", () => {
  const r = priceCart(
    input({
      items: [{ productId: "combo", quantity: 1, combo: { cookieId: "galleta", includedSalsaId: "arequipe" } }],
    }),
    makeCatalog(),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("combo with includes_salsa but no salsa / foreign salsa -> 400", () => {
  for (const combo of [{ cookieId: "choco" }, { cookieId: "choco", includedSalsaId: "fresa" }]) {
    const r = priceCart(input({ items: [{ productId: "combo", quantity: 1, combo }] }), makeCatalog());
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 400);
  }
});

test("combo product sent as a plain line -> 400", () => {
  const r = priceCart(input({ items: [{ productId: "combo", quantity: 1 }] }), makeCatalog());
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("combo price adds the cookie extra and name uses locale + lineDisplayName", () => {
  const items = [
    { productId: "combo", quantity: 2, combo: { cookieId: "nutella", includedSalsaId: "arequipe" } },
  ];
  const es = priceCart(input({ items }), makeCatalog());
  assert.equal(es.ok, true);
  if (!es.ok) return;
  assert.deepEqual(es.lines, [
    {
      product_id: "combo",
      product_name: "Combo Clásico · Nutella ES + Salsa Arequipe",
      quantity: 2,
      unit_price: 17000,
    },
  ]);
  assert.equal(es.subtotal, 34000);

  const en = priceCart(input({ locale: "en", items }), makeCatalog());
  assert.equal(en.ok, true);
  if (!en.ok) return;
  assert.equal(en.lines[0].product_name, "Classic Combo · Nutella EN + Salsa Dulce de leche");
});

test("box with 5 cookies when box_cookie_count = 6 -> 400", () => {
  const r = priceCart(
    input({
      items: [
        {
          productId: "caja",
          quantity: 1,
          box: { cookies: [{ cookieId: "choco", quantity: 5 }], giftCard: "none" },
        },
      ],
    }),
    makeCatalog(),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("box with 6 cookies prices extras + gift card", () => {
  const r = priceCart(
    input({
      items: [
        {
          productId: "caja",
          quantity: 1,
          box: {
            cookies: [
              { cookieId: "choco", quantity: 4 },
              { cookieId: "nutella", quantity: 2 },
            ],
            giftCard: "card",
          },
        },
      ],
    }),
    makeCatalog(),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.lines[0].unit_price, 30000 + 2000 + 3000);
  assert.equal(r.lines[0].product_name, "Caja x6 · 4× Chocolate + 2× Nutella ES · Gift card");
});

test("box: foreign cookie or unavailable gift option -> 400", () => {
  const bad = [
    { cookies: [{ cookieId: "galleta", quantity: 6 }], giftCard: "none" as const },
    { cookies: [{ cookieId: "choco", quantity: 6 }], giftCard: "card_and_cake" as const },
  ];
  for (const box of bad) {
    const r = priceCart(input({ items: [{ productId: "caja", quantity: 1, box }] }), makeCatalog());
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 400);
  }
});

test("helado with 3 salsas when included_salsas_count = 2 -> 400", () => {
  const r = priceCart(
    input({
      items: [
        {
          productId: "helado",
          quantity: 1,
          helado: {
            salsas: [
              { salsaId: "arequipe", quantity: 2 },
              { salsaId: "fresa", quantity: 1 },
            ],
          },
        },
      ],
    }),
    makeCatalog(),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("helado extras are priced; helado without salsas is a plain line", () => {
  const r = priceCart(
    input({
      items: [
        { productId: "helado-extra", quantity: 1, helado: { salsas: [{ salsaId: "arequipe", quantity: 2 }] } },
        { productId: "helado", quantity: 1 },
        { productId: "helado", quantity: 1, helado: { salsas: [] } },
      ],
    }),
    makeCatalog(),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.lines[0].unit_price, 12000);
  assert.equal(r.lines[0].product_name, "ES helado-extra · 2× Arequipe");
  assert.equal(r.lines[1].unit_price, 9000);
  assert.equal(r.lines[1].product_name, "Helado");
  assert.equal(r.lines[2].unit_price, 9000);
});

test("helado with a salsa not configured for it -> 400", () => {
  const r = priceCart(
    input({ items: [{ productId: "helado-extra", quantity: 1, helado: { salsas: [{ salsaId: "fresa", quantity: 1 }] } }] }),
    makeCatalog(),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("unavailable or unknown product -> 409 with unavailable ids", () => {
  const r = priceCart(
    input({
      items: [
        { productId: "galleta", quantity: 1 },
        { productId: "agotado", quantity: 1 },
        { productId: "no-existe", quantity: 1 },
      ],
    }),
    makeCatalog(),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 409);
  assert.deepEqual(r.unavailable, ["agotado", "no-existe"]);
});

test("stale browser price cannot be sent: total comes from the catalog", () => {
  const parsed = parseCheckoutInput({
    ...input(),
    items: [{ productId: "galleta", quantity: 2, unit_price: 1, unitPrice: 1, price: 1 }],
    total: 1,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value.items, [{ productId: "galleta", quantity: 2 }]);
  const r = priceCart(parsed.value, makeCatalog());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.lines[0].unit_price, 5000);
  assert.equal(r.total, 18500);
});

test("merch + pickup -> 400; merch + delivery ok", () => {
  const items = [{ productId: "camiseta", quantity: 1 }];
  const bad = priceCart(input({ fulfillment: "pickup", delivery: undefined, items }), makeCatalog());
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.equal(bad.status, 400);
  const good = priceCart(input({ items }), makeCatalog());
  assert.equal(good.ok, true);
  if (!good.ok) return;
  assert.equal(good.hasMerch, true);
});

test("food + fuera-de-cartagena -> 400", () => {
  const r = priceCart(
    input({
      paymentMethod: "qr",
      delivery: { zoneId: "fuera-de-cartagena", address: "x", recipientPhone: "1", city: "Bogotá" },
    }),
    makeCatalog(),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("unknown zone -> 400", () => {
  const r = priceCart(
    input({ delivery: { zoneId: "atlantis", address: "x", recipientPhone: "1" } }),
    makeCatalog(),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("bold + tierra-bomba -> 400; qr -> ok with fee 0 and zone.fee null", () => {
  const delivery = { zoneId: "tierra-bomba", address: "x", recipientPhone: "1" };
  const bold = priceCart(input({ delivery }), makeCatalog());
  assert.equal(bold.ok, false);
  if (bold.ok) return;
  assert.equal(bold.status, 400);

  const qr = priceCart(input({ delivery, paymentMethod: "qr" }), makeCatalog());
  assert.equal(qr.ok, true);
  if (!qr.ok) return;
  assert.equal(qr.deliveryFee, 0);
  assert.equal(qr.zone?.fee, null);
  assert.equal(qr.total, 10000);
});

test("money is always integer", () => {
  const catalog = makeCatalog();
  catalog.products.set("galleta", product({ id: "galleta", price: 5000.4 }));
  const r = priceCart(input(), catalog);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(Number.isInteger(r.lines[0].unit_price), true);
  assert.equal(Number.isInteger(r.total), true);
});

// ---------- parseCheckoutInput ----------

function body(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...input(), ...over };
}

test("parseCheckoutInput accepts a valid body", () => {
  const r = parseCheckoutInput(body());
  assert.equal(r.ok, true);
});

test("parseCheckoutInput rejects invalid bodies", () => {
  const long = "x".repeat(201);
  const cases: unknown[] = [
    null,
    "str",
    body({ acceptedPolicy: false }),
    body({ acceptedPolicy: "true" }),
    body({ locale: "fr" }),
    body({ paymentMethod: "cash" }),
    body({ fulfillment: "drone" }),
    body({ customer: { name: "Ana", email: "no-at", phone: "1" } }),
    body({ customer: { name: long, email: "a@b.co", phone: "1" } }),
    body({ customer: { name: "", email: "a@b.co", phone: "1" } }),
    body({ notes: "x".repeat(1001) }),
    body({ items: [] }),
    body({ items: Array.from({ length: 101 }, () => ({ productId: "galleta", quantity: 1 })) }),
    body({ items: [{ productId: "galleta", quantity: 0 }] }),
    body({ items: [{ productId: "galleta", quantity: 51 }] }),
    body({ items: [{ productId: "galleta", quantity: 1.5 }] }),
    body({ items: [{ productId: "galleta", quantity: "2" }] }),
    body({ fulfillment: "delivery", delivery: undefined }),
    body({ delivery: { zoneId: "fuera-de-cartagena", address: "x", recipientPhone: "1" } }),
    body({ delivery: { zoneId: "bocagrande", address: long, recipientPhone: "1" } }),
    body({ items: [{ productId: "caja", quantity: 1, box: { cookies: [], giftCard: "gold" } }] }),
    body({ items: [{ productId: "combo", quantity: 1, combo: {} }] }),
    body({
      items: [{ productId: "helado", quantity: 1, helado: { salsas: [{ salsaId: "a", quantity: -1 }] } }],
    }),
  ];
  for (const c of cases) {
    const r = parseCheckoutInput(c);
    assert.equal(r.ok, false, `expected failure for ${JSON.stringify(c)?.slice(0, 160)}`);
  }
});

test("parseCheckoutInput: notes up to 1000, city for outside zone, pickup drops delivery", () => {
  assert.equal(parseCheckoutInput(body({ notes: "x".repeat(1000) })).ok, true);
  const outside = parseCheckoutInput(
    body({ delivery: { zoneId: "fuera-de-cartagena", address: "x", recipientPhone: "1", city: "Bogotá" } }),
  );
  assert.equal(outside.ok, true);
  const pickup = parseCheckoutInput(body({ fulfillment: "pickup", delivery: undefined }));
  assert.equal(pickup.ok, true);
  if (!pickup.ok) return;
  assert.equal(pickup.value.delivery, undefined);
});

// ---------- fix round 1 (R9–R11) ----------

function expectFail(r: ReturnType<typeof priceCart>, status: 400 | 409, unavailable?: string[]) {
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, status, r.error);
  if (unavailable) assert.deepEqual(r.unavailable, unavailable);
}

test("R9: price <= 0 ('Consultar') is not orderable -> 409", () => {
  const catalog = makeCatalog();
  catalog.products.set("gratis", product({ id: "gratis", price: 0 }));
  expectFail(priceCart(input({ items: [{ productId: "gratis", quantity: 1 }] }), catalog), 409, ["gratis"]);
});

test("R10: combo with zero junction rows always needs a selection -> 400", () => {
  const catalog = makeCatalog();
  expectFail(priceCart(input({ items: [{ productId: "combo-vacio", quantity: 1 }] }), catalog), 400);
  expectFail(
    priceCart(input({ items: [{ productId: "combo-vacio", quantity: 1, combo: { cookieId: "choco" } }] }), catalog),
    400,
  );
});

test("R10: box sent plain -> 400; plain product with a selection -> 400; helado with combo -> 400", () => {
  const catalog = makeCatalog();
  catalog.boxCookies.clear();
  expectFail(priceCart(input({ items: [{ productId: "caja", quantity: 1 }] }), catalog), 400);
  expectFail(
    priceCart(input({ items: [{ productId: "galleta", quantity: 1, helado: { salsas: [] } }] }), makeCatalog()),
    400,
  );
  expectFail(
    priceCart(input({ items: [{ productId: "galleta", quantity: 1, combo: { cookieId: "choco" } }] }), makeCatalog()),
    400,
  );
  expectFail(
    priceCart(input({ items: [{ productId: "helado", quantity: 1, combo: { cookieId: "choco" } }] }), makeCatalog()),
    400,
  );
});

test("R11: unavailable or missing component -> 409 listing the component id", () => {
  expectFail(
    priceCart(
      input({
        items: [{ productId: "combo", quantity: 1, combo: { cookieId: "galleta-agotada", includedSalsaId: "arequipe" } }],
      }),
      makeCatalog(),
    ),
    409,
    ["galleta-agotada"],
  );
  expectFail(
    priceCart(
      input({ items: [{ productId: "combo", quantity: 1, combo: { cookieId: "fantasma", includedSalsaId: "arequipe" } }] }),
      makeCatalog(),
    ),
    409,
    ["fantasma"],
  );
  const catalog = makeCatalog();
  catalog.products.set("fresa", { ...catalog.products.get("fresa")!, available: false });
  catalog.products.set("nutella", { ...catalog.products.get("nutella")!, available: false });
  expectFail(
    priceCart(
      input({
        items: [
          { productId: "helado", quantity: 1, helado: { salsas: [{ salsaId: "fresa", quantity: 1 }] } },
          {
            productId: "caja",
            quantity: 1,
            box: { cookies: [{ cookieId: "choco", quantity: 5 }, { cookieId: "nutella", quantity: 1 }], giftCard: "none" },
          },
        ],
      }),
      catalog,
    ),
    409,
    ["fresa", "nutella"],
  );
});

test("R11: invalid money makes the product unavailable / the row unusable", () => {
  const catalog = makeCatalog();
  catalog.products.set("nan", product({ id: "nan", price: Number.NaN }));
  catalog.products.set("neg", product({ id: "neg", price: -100 }));
  catalog.products.set(
    "caja-rara",
    product({ id: "caja-rara", price: 30000, category: "cajas", gift_card_price: Number.POSITIVE_INFINITY }),
  );
  expectFail(
    priceCart(
      input({
        items: [
          { productId: "nan", quantity: 1 },
          { productId: "neg", quantity: 1 },
          { productId: "caja-rara", quantity: 1 },
        ],
      }),
      catalog,
    ),
    409,
    ["nan", "neg", "caja-rara"],
  );
  catalog.comboCookies.set("combo:choco", -5000);
  expectFail(
    priceCart(input({ items: [{ productId: "combo", quantity: 1, combo: { cookieId: "choco", includedSalsaId: "arequipe" } }] }), catalog),
    400,
  );
});

test("R11: hidden category -> 409 for top-level, but hidden components still usable", () => {
  const catalog = makeCatalog();
  catalog.products.set("oculto", product({ id: "oculto", categoryVisible: false }));
  expectFail(priceCart(input({ items: [{ productId: "oculto", quantity: 1 }] }), catalog), 409, ["oculto"]);
  // arequipe is in the hidden "salsas" category but is a valid included salsa.
  const ok = priceCart(
    input({ items: [{ productId: "combo", quantity: 1, combo: { cookieId: "choco", includedSalsaId: "arequipe" } }] }),
    catalog,
  );
  assert.equal(ok.ok, true);
});
