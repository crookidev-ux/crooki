import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPaidOrderEmail, parseRecipients } from "./notify.ts";

const order = {
  id: "3f2a9c1e-aaaa-bbbb-cccc-000000000000",
  customer_name: "PRUEBA",
  customer_email: "prueba@example.com",
  customer_phone: "3001234567",
  customer_address: "Calle 36 # 5-70",
  notes: "Sin nueces",
  total: 45400,
  fulfillment: "delivery" as const,
  delivery_zone: "Bocagrande",
  delivery_fee: 6000,
  recipient_phone: "3009876543",
  order_items: [
    { product_name: "Galleta Red Velvet", quantity: 2, unit_price: 12000 },
    { product_name: "Caja x4", quantity: 1, unit_price: 15400 },
  ],
};

test("subject has the short order id and the total", () => {
  const { subject } = buildPaidOrderEmail(order, "BOLD-TX-1");
  assert.equal(subject, `Pedido pagado #3F2A9C1E — $${(45400).toLocaleString("es-CO")}`);
});

test("text carries delivery, zone, address, phones, items, fee, total and Bold ref", () => {
  const { text } = buildPaidOrderEmail(order, "BOLD-TX-1");
  for (const part of [
    "Domicilio",
    "Bocagrande",
    "Calle 36 # 5-70",
    "3001234567",
    "3009876543",
    "Galleta Red Velvet x2",
    `$${(24000).toLocaleString("es-CO")}`,
    `$${(6000).toLocaleString("es-CO")}`,
    `$${(45400).toLocaleString("es-CO")}`,
    "BOLD-TX-1",
    "Sin nueces",
    "PRUEBA",
  ]) {
    assert.ok(text.includes(part), `missing: ${part}\n${text}`);
  }
});

test("pickup: no address or zone lines; numeric strings from the DB are formatted", () => {
  const { subject, text } = buildPaidOrderEmail({
    ...order,
    fulfillment: "pickup",
    delivery_zone: null,
    delivery_fee: "0",
    customer_address: "",
    recipient_phone: null,
    notes: "",
    total: "39400",
    order_items: [{ product_name: "Caja x4", quantity: 1, unit_price: "39400" }],
  });
  assert.ok(subject.endsWith(`$${(39400).toLocaleString("es-CO")}`));
  assert.ok(text.includes("Recoger en tienda"));
  assert.ok(!text.includes("Barrio"));
  assert.ok(!text.includes("Dirección"));
  assert.ok(!text.includes("Notas"));
  assert.ok(text.includes("Ref. Bold: (sin referencia)"));
});

test("parseRecipients splits a comma list and drops blanks", () => {
  assert.deepEqual(parseRecipients(" a@x.co, b@y.co ,,"), ["a@x.co", "b@y.co"]);
  assert.deepEqual(parseRecipients(""), []);
});
