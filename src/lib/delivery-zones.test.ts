import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getZone,
  searchZones,
  allowedFulfillments,
  zoneAllowed,
  onlinePaymentAllowed,
  deliveryFeeSettled,
  parseDeliveryRule,
  strictestRule,
  OUTSIDE_CITY_ZONE_ID,
} from "./delivery-zones.ts";
import { DELIVERY_ZONES } from "./delivery-zones.data.ts";

test("real fees from the spreadsheet", () => {
  assert.equal(getZone("bocagrande")?.fee, 8500);
  assert.equal(getZone("crespo")?.fee, 11000);
  assert.equal(getZone("los-ejecutivos")?.fee, 10000);
  assert.equal(getZone("serena-del-mar")?.fee, 20000);
  assert.equal(getZone("tierra-bomba")?.fee, null);
});

test("ids are unique ASCII slugs", () => {
  const all = [...DELIVERY_ZONES, getZone(OUTSIDE_CITY_ZONE_ID)!];
  const ids = all.map((z) => z.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("outside-city zone exists with null fee", () => {
  const z = getZone(OUTSIDE_CITY_ZONE_ID);
  assert.equal(z?.fee, null);
  assert.equal(z?.name, "Fuera de Cartagena (envío nacional)");
});

test("searchZones ignores accents and case", () => {
  assert.equal(searchZones("getsemani")[0].name, "Getsemaní");
  assert.equal(searchZones("GETSEMANÍ")[0].name, "Getsemaní");
  assert.ok(searchZones("a", 3).length <= 3);
});

test("allowedFulfillments", () => {
  assert.deepEqual(allowedFulfillments({ hasMerch: true }), ["delivery"]);
  assert.deepEqual(allowedFulfillments({ hasMerch: false }), ["delivery", "pickup", "dine_in"]);
});

test("zoneAllowed blocks food outside the city", () => {
  assert.equal(zoneAllowed("fuera-de-cartagena", { hasFood: true }), false);
  assert.equal(zoneAllowed("fuera-de-cartagena", { hasFood: false }), true);
  assert.equal(zoneAllowed("bocagrande", { hasFood: true }), true);
});

test("deliveryFeeSettled: the total is final unless a delivery fee is still to be agreed", () => {
  assert.equal(deliveryFeeSettled({ fulfillment: "delivery", delivery_fee: 8500 }), true);
  assert.equal(deliveryFeeSettled({ fulfillment: "delivery", delivery_fee: 0 }), false);
  assert.equal(deliveryFeeSettled({ fulfillment: "delivery", delivery_fee: "0.00" }), false);
  assert.equal(deliveryFeeSettled({ fulfillment: "pickup", delivery_fee: 0 }), true);
  assert.equal(deliveryFeeSettled({ fulfillment: "dine_in", delivery_fee: 0 }), true);
  assert.equal(deliveryFeeSettled({ fulfillment: null, delivery_fee: 0 }), false);
});

test("onlinePaymentAllowed", () => {
  assert.equal(onlinePaymentAllowed(getZone("tierra-bomba"), "delivery"), false);
  assert.equal(onlinePaymentAllowed(getZone("bocagrande"), "delivery"), true);
  assert.equal(onlinePaymentAllowed(undefined, "delivery"), false);
  assert.equal(onlinePaymentAllowed(undefined, "pickup"), true);
});

test("zones carry the driving distance from the spreadsheet", () => {
  assert.equal(getZone("bocagrande")?.km, 4.6);
  assert.equal(getZone("los-ejecutivos")?.km, 8.4);
  assert.equal(getZone("barcelona-de-indias")?.km, null);
  assert.equal(getZone(OUTSIDE_CITY_ZONE_ID)?.km, null);
});

test("strictestRule: none beats nearby beats any", () => {
  assert.equal(strictestRule([]), "any");
  assert.equal(strictestRule(["any", "any"]), "any");
  assert.equal(strictestRule(["any", "nearby"]), "nearby");
  assert.equal(strictestRule(["nearby", "none", "any"]), "none");
});

test("parseDeliveryRule fails closed on unknown values", () => {
  assert.equal(parseDeliveryRule("any"), "any");
  assert.equal(parseDeliveryRule("nearby"), "nearby");
  assert.equal(parseDeliveryRule("none"), "none");
  assert.equal(parseDeliveryRule(undefined), "none");
  assert.equal(parseDeliveryRule("cerca"), "none");
});

test("allowedFulfillments honors the cart's delivery rule", () => {
  assert.deepEqual(allowedFulfillments({ hasMerch: false, deliveryRule: "none" }), ["pickup", "dine_in"]);
  assert.deepEqual(
    allowedFulfillments({ hasMerch: false, deliveryRule: "nearby" }),
    ["delivery", "pickup", "dine_in"],
  );
  // Merch can only be delivered and drinks can't: no way to fulfill this cart.
  assert.deepEqual(allowedFulfillments({ hasMerch: true, deliveryRule: "none" }), []);
  assert.deepEqual(allowedFulfillments({ hasMerch: true, deliveryRule: "nearby" }), ["delivery"]);
});

test("nearby rule: up to 6 km inclusive, plus the El Laguito exception", () => {
  const nearby = { hasFood: true, deliveryRule: "nearby" as const };
  assert.equal(zoneAllowed("bocagrande", nearby), true);
  assert.equal(getZone("morros")?.km, 6);
  assert.equal(zoneAllowed("morros", nearby), true);
  assert.equal(getZone("el-laguito")?.km, 6.1);
  assert.equal(zoneAllowed("el-laguito", nearby), true);
  assert.equal(getZone("santa-maria")?.km, 6.1);
  assert.equal(zoneAllowed("santa-maria", nearby), false);
  assert.equal(zoneAllowed("los-ejecutivos", nearby), false);
});

test("nearby rule: no distance or no fixed fee stays out of reach", () => {
  const nearby = { hasFood: true, deliveryRule: "nearby" as const };
  assert.equal(zoneAllowed("barcelona-de-indias", nearby), false);
  // Tierra Bomba is an island: 5.7 km on the map but no fee.
  assert.equal(zoneAllowed("tierra-bomba", nearby), false);
  assert.equal(zoneAllowed("no-existe", nearby), false);
});

test("zoneAllowed: rule none blocks every zone; any keeps far zones", () => {
  assert.equal(zoneAllowed("bocagrande", { hasFood: true, deliveryRule: "none" }), false);
  assert.equal(zoneAllowed("los-ejecutivos", { hasFood: true, deliveryRule: "any" }), true);
  assert.equal(zoneAllowed("fuera-de-cartagena", { hasFood: false, deliveryRule: "any" }), true);
});
