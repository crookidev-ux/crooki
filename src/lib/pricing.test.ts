import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comboUnitPrice,
  boxUnitPrice,
  heladoUnitPrice,
  lineDisplayName,
} from "./pricing.ts";

test("comboUnitPrice adds the cookie extra", () => {
  assert.equal(comboUnitPrice(12000, 2000), 14000);
});

test("boxUnitPrice adds cookie extras and gift card", () => {
  const cookies = [
    { quantity: 2, extraPrice: 1000 },
    { quantity: 4, extraPrice: 0 },
  ];
  assert.equal(boxUnitPrice(30000, cookies, "card_and_cake", 3000, 5000), 37000);
  assert.equal(boxUnitPrice(30000, cookies, "card", 3000, 5000), 35000);
  assert.equal(boxUnitPrice(30000, cookies, "none", 3000, 5000), 32000);
  assert.equal(boxUnitPrice(30000, cookies, "card", null, null), 32000);
});

test("heladoUnitPrice adds salsa extras", () => {
  assert.equal(heladoUnitPrice(9000, [{ quantity: 2, extraPrice: 1500 }]), 12000);
  assert.equal(heladoUnitPrice(9000, []), 9000);
});

test("lineDisplayName: combo", () => {
  assert.equal(
    lineDisplayName("Combo", { combo: { cookieName: "Chips", includedSalsaName: "Arequipe" } }),
    "Combo · Chips + Salsa Arequipe",
  );
  assert.equal(lineDisplayName("Combo", { combo: { cookieName: "Chips" } }), "Combo · Chips");
  assert.equal(
    lineDisplayName("Combo", {
      combo: {
        cookieName: "Chips",
        includedSalsaName: "Arequipe",
        additionalSalsas: [{ salsaName: "Fresa", quantity: 2 }],
      },
    }),
    "Combo · Chips + Salsa Arequipe + 2× Fresa",
  );
});

test("lineDisplayName: box", () => {
  const cookies = [
    { cookieName: "A", quantity: 2 },
    { cookieName: "B", quantity: 1 },
  ];
  assert.equal(
    lineDisplayName("Caja", { box: { cookies, giftCard: "card" } }),
    "Caja · 2× A + 1× B · Gift card",
  );
  assert.equal(
    lineDisplayName("Caja", { box: { cookies, giftCard: "card_and_cake" } }),
    "Caja · 2× A + 1× B · Gift card + vela",
  );
  assert.equal(
    lineDisplayName("Caja", { box: { cookies, giftCard: "none" } }),
    "Caja · 2× A + 1× B",
  );
});

test("lineDisplayName: helado", () => {
  assert.equal(
    lineDisplayName("Helado", { helado: { salsas: [{ salsaName: "S", quantity: 1 }] } }),
    "Helado · 1× S",
  );
  assert.equal(lineDisplayName("Helado", { helado: { salsas: [] } }), "Helado");
  assert.equal(lineDisplayName("Galleta", {}), "Galleta");
});
