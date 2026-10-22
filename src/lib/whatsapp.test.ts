import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsAppMessage,
  buildWhatsAppOrderUrl,
  customerNotes,
  WHATSAPP_NUMBER,
  type WhatsAppOrder,
} from "./whatsapp.ts";
import { AMOUNT_MISMATCH_NOTE, DOUBLE_CHARGE_NOTE } from "./payments.confirm.ts";

const delivery: WhatsAppOrder = {
  id: "abcd1234-0000-0000-0000-000000000000",
  customer_name: "PRUEBA",
  customer_address: "Calle 30 #10-20",
  recipient_phone: "3009998888",
  notes: "Sin nueces",
  total: 17000,
  fulfillment: "delivery",
  delivery_zone: "Getsemaní",
  delivery_fee: 7000,
  payment_status: "unpaid",
  order_items: [{ product_name: "Galleta", quantity: 2, unit_price: 5000 }],
};

const lines = (o: WhatsAppOrder) => buildWhatsAppMessage(o).split("\n");

test("delivery order: zone, fee, address and recipient phone", () => {
  const l = lines(delivery);
  assert.ok(l.includes("*Pedido #ABCD1234*"));
  assert.ok(l.includes("  • Galleta x2 — $10.000"));
  assert.ok(l.includes("*Entrega:* Domicilio · Getsemaní"));
  assert.ok(l.includes("*Domicilio:* $7.000"));
  assert.ok(l.includes("*Total: $17.000*"));
  assert.ok(l.includes("*Dirección:* Calle 30 #10-20"));
  assert.ok(l.includes("*Tel. destinatario:* 3009998888"));
  assert.ok(l.includes("*Notas:* Sin nueces"));
  assert.ok(!l.some((x) => x.includes("Pagado en línea")));
});

test("fee line is omitted when the fee is 0 and the zone may be missing", () => {
  const l = lines({ ...delivery, delivery_fee: 0, delivery_zone: null });
  assert.ok(!l.some((x) => x.startsWith("*Domicilio:*")));
  assert.ok(l.includes("*Entrega:* Domicilio"));
});

test("pickup and dine-in omit address and recipient phone", () => {
  for (const [fulfillment, label] of [
    ["pickup", "Recoger en el local"],
    ["dine_in", "Comer en el local"],
  ] as const) {
    const l = lines({ ...delivery, fulfillment, delivery_zone: null, delivery_fee: 0, customer_address: "" });
    assert.ok(l.includes(`*Entrega:* ${label}`));
    assert.ok(!l.some((x) => x.startsWith("*Dirección:*")));
    assert.ok(!l.some((x) => x.startsWith("*Tel. destinatario:*")));
  }
});

test("paid order carries the Bold reference", () => {
  const l = lines({ ...delivery, payment_status: "paid", bold_payment_id: "TX123" });
  assert.ok(l.includes("✅ *Pagado en línea* · ref TX123"));
  const noRef = lines({ ...delivery, payment_status: "paid", bold_payment_id: null });
  assert.ok(noRef.includes("✅ *Pagado en línea*"));
});

test("internal payment warnings are not sent with the customer's notes", () => {
  assert.equal(customerNotes(`Sin nueces\n${AMOUNT_MISMATCH_NOTE}`), "Sin nueces");
  assert.equal(customerNotes(`${DOUBLE_CHARGE_NOTE}`), null);
  assert.equal(customerNotes(null), null);
  const l = lines({ ...delivery, notes: AMOUNT_MISMATCH_NOTE });
  assert.ok(!l.some((x) => x.startsWith("*Notas:*")));
});

test("URL points at the shop number with the encoded message", () => {
  const url = buildWhatsAppOrderUrl(delivery);
  assert.ok(url.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), buildWhatsAppMessage(delivery));
});
