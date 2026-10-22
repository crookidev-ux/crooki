import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderItems,
  buildOrderPayload,
  buildWhatsAppOrder,
  orderAddress,
} from "./order-payload.ts";
import type { CheckoutInput } from "./schema.ts";

const base: CheckoutInput = {
  locale: "es",
  customer: { name: "PRUEBA", email: "prueba@example.com", phone: "3001234567" },
  fulfillment: "pickup",
  notes: "",
  paymentMethod: "bold",
  acceptedPolicy: true,
  items: [{ productId: "p1", quantity: 2 }],
};

const lines = [{ product_id: "p1", product_name: "Galleta", quantity: 2, unit_price: 5000 }];

test("pickup order: empty address, no zone, no recipient phone, unpaid", () => {
  const p = buildOrderPayload(base, { lines, deliveryFee: 0, total: 10000 });
  assert.deepEqual(p, {
    customer_name: "PRUEBA",
    customer_email: "prueba@example.com",
    customer_phone: "3001234567",
    customer_address: "",
    notes: "",
    total: 10000,
    fulfillment: "pickup",
    delivery_zone: null,
    delivery_fee: 0,
    recipient_phone: null,
    payment_method: "bold",
    payment_status: "unpaid",
  });
});

test("delivery order carries zone name, fee and recipient phone", () => {
  const input: CheckoutInput = {
    ...base,
    fulfillment: "delivery",
    paymentMethod: "qr",
    notes: "Timbre 2",
    delivery: { zoneId: "1-de-mayo", address: "Cra 1 #2-3", recipientPhone: "3109876543" },
  };
  const zone = { id: "1-de-mayo", name: "1° de Mayo", sector: "UCG 6", fee: 19500 };
  const p = buildOrderPayload(input, { lines, deliveryFee: 19500, total: 29500, zone });
  assert.equal(p.customer_address, "Cra 1 #2-3");
  assert.equal(p.delivery_zone, "1° de Mayo");
  assert.equal(p.delivery_fee, 19500);
  assert.equal(p.recipient_phone, "3109876543");
  assert.equal(p.payment_method, "qr");
  assert.equal(p.payment_status, "unpaid");
});

test("outside-city address is prefixed with the city", () => {
  const input: CheckoutInput = {
    ...base,
    fulfillment: "delivery",
    delivery: {
      zoneId: "fuera-de-cartagena",
      address: "Calle 10 #5-20",
      recipientPhone: "3100000000",
      city: "Medellín",
    },
  };
  assert.equal(orderAddress(input), "Medellín · Calle 10 #5-20");
});

test("buildOrderItems keeps only the RPC fields", () => {
  const extra = [{ ...lines[0], secret: "x" } as (typeof lines)[0]];
  assert.deepEqual(buildOrderItems(extra), lines);
});

test("WhatsApp order falls back to the customer phone and null notes", () => {
  const p = buildOrderPayload(base, { lines, deliveryFee: 0, total: 10000 });
  const w = buildWhatsAppOrder("abcd1234-0000", p, lines);
  assert.equal(w.id, "abcd1234-0000");
  assert.equal(w.recipient_phone, "3001234567");
  assert.equal(w.notes, null);
  assert.equal(w.total, 10000);
  assert.equal(w.fulfillment, "pickup");
  assert.equal(w.delivery_zone, null);
  assert.equal(w.delivery_fee, 0);
  assert.equal(w.payment_status, "unpaid");
  assert.deepEqual(w.order_items, [{ product_name: "Galleta", quantity: 2, unit_price: 5000 }]);
});
