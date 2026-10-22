import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getZone,
  searchZones,
  allowedFulfillments,
  zoneAllowed,
  onlinePaymentAllowed,
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

test("onlinePaymentAllowed", () => {
  assert.equal(onlinePaymentAllowed(getZone("tierra-bomba"), "delivery"), false);
  assert.equal(onlinePaymentAllowed(getZone("bocagrande"), "delivery"), true);
  assert.equal(onlinePaymentAllowed(undefined, "delivery"), false);
  assert.equal(onlinePaymentAllowed(undefined, "pickup"), true);
});
