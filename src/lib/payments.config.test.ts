import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boldCustomerPhone,
  buildBoldClientConfig,
  orderDescription,
  redirectionUrl,
  qrSwitchBlockReason,
  qrSwitchBoldAction,
  retryBlockReason,
} from "./payments.config.ts";
import { AMOUNT_MISMATCH_NOTE } from "./payments.confirm.ts";
import { integritySignature } from "./bold.ts";

const input = {
  orderId: "3f2a9c1e-aaaa-bbbb-cccc-000000000000",
  boldOrderId: "CRK-3F2A9C1E-ABC",
  amount: 39400,
  locale: "es" as const,
  customer: { name: "PRUEBA", email: "prueba@example.com", phone: "3001234567" },
  siteUrl: "https://crookibakebar.com/",
  identityKey: "identity-key",
  secretKey: "super-secret",
};

test("buildBoldClientConfig fills every field and signs the amount", () => {
  const c = buildBoldClientConfig(input);
  assert.equal(c.orderId, "CRK-3F2A9C1E-ABC");
  assert.equal(c.amount, "39400");
  assert.equal(c.currency, "COP");
  assert.equal(c.apiKey, "identity-key");
  assert.equal(c.integritySignature, integritySignature("CRK-3F2A9C1E-ABC", 39400, "COP", "super-secret"));
  assert.match(c.integritySignature, /^[0-9a-f]{64}$/);
  assert.equal(c.description, "Pedido Crooki #3F2A9C1E");
  assert.equal(c.redirectionUrl, "https://crookibakebar.com/pedido/3f2a9c1e-aaaa-bbbb-cccc-000000000000");
  assert.deepEqual(JSON.parse(c.customerData), {
    email: "prueba@example.com",
    fullName: "PRUEBA",
    phone: "3001234567",
    dialCode: "+57",
  });
});

test("the secret key never appears in the config", () => {
  const c = buildBoldClientConfig(input);
  assert.ok(!JSON.stringify(c).includes("super-secret"));
});

test("redirectionUrl adds /en for English", () => {
  assert.equal(redirectionUrl("http://localhost:3001", "en", "abc"), "http://localhost:3001/en/pedido/abc");
  assert.equal(redirectionUrl("http://localhost:3001", "es", "abc"), "http://localhost:3001/pedido/abc");
});

test("orderDescription uses the first 8 characters uppercased", () => {
  assert.equal(orderDescription("abcdef12-3456"), "Pedido Crooki #ABCDEF12");
});

test("retryBlockReason allows only unpaid, open Bold orders", () => {
  const ok = { payment_method: "bold", payment_status: "awaiting_payment", status: "pending" };
  assert.equal(retryBlockReason(ok), null);
  assert.equal(retryBlockReason({ ...ok, payment_status: "rejected" }), null);
  assert.equal(retryBlockReason({ ...ok, status: "confirmed" }), null);
  assert.equal(retryBlockReason({ ...ok, payment_method: "qr" }), "not_bold");
  assert.equal(retryBlockReason({ ...ok, payment_status: "paid" }), "paid");
  assert.equal(retryBlockReason({ ...ok, status: "cancelled" }), "closed");
  assert.equal(retryBlockReason({ ...ok, status: "delivered" }), "closed");
});

test("retryBlockReason blocks orders Bold already charged", () => {
  const ok = { payment_method: "bold", payment_status: "awaiting_payment", status: "pending" };
  assert.equal(retryBlockReason(ok, { hasApprovedAttempt: false, amountMismatch: false }), null);
  assert.equal(retryBlockReason(ok, { hasApprovedAttempt: true }), "review");
  assert.equal(retryBlockReason(ok, { amountMismatch: true }), "review");
  assert.equal(retryBlockReason({ ...ok, payment_status: "rejected" }, { hasApprovedAttempt: true }), "review");
  // The stronger reasons still win.
  assert.equal(retryBlockReason({ ...ok, payment_status: "paid" }, { hasApprovedAttempt: true }), "paid");
});

test("https base → redirectionUrl present, with /en for English", () => {
  const es = buildBoldClientConfig({ ...input, siteUrl: "https://crookibakebar.com" });
  assert.equal(es.redirectionUrl, `https://crookibakebar.com/pedido/${input.orderId}`);
  const en = buildBoldClientConfig({ ...input, siteUrl: "https://crookibakebar.com", locale: "en" });
  assert.equal(en.redirectionUrl, `https://crookibakebar.com/en/pedido/${input.orderId}`);
});

test("http://localhost base → redirectionUrl key absent", () => {
  const c = buildBoldClientConfig({ ...input, siteUrl: "http://localhost:3001" });
  assert.equal("redirectionUrl" in c, false);
  assert.equal(c.integritySignature.length, 64);
});

test("boldCustomerPhone keeps digits only and drops a leading 57 country code", () => {
  assert.equal(boldCustomerPhone("3001234567"), "3001234567");
  assert.equal(boldCustomerPhone("300 123 4567"), "3001234567");
  assert.equal(boldCustomerPhone("+57 300-123-4567"), "3001234567");
  assert.equal(boldCustomerPhone("573001234567"), "3001234567");
  // Only a 10-digit remainder means the 57 was a country code.
  assert.equal(boldCustomerPhone("5730012345"), "5730012345");
  assert.equal(boldCustomerPhone("(605) 660-1234"), "6056601234");
});

test("customerData.phone is sent digits only", () => {
  const c = buildBoldClientConfig({ ...input, customer: { ...input.customer, phone: "+57 300 123 4567" } });
  const data = JSON.parse(c.customerData);
  assert.equal(data.phone, "3001234567");
  assert.equal(data.dialCode, "+57");
});

test("qrSwitchBlockReason allows only open, unpaid Bold orders with no money taken", () => {
  const open = { payment_method: "bold", payment_status: "rejected", status: "pending", notes: null };
  assert.equal(qrSwitchBlockReason(open, false), null);
  assert.equal(qrSwitchBlockReason({ ...open, payment_status: "unpaid", notes: "Sin nueces" }, false), null);
  assert.equal(qrSwitchBlockReason({ ...open, payment_method: "qr" }, false), "not_bold");
  assert.equal(qrSwitchBlockReason({ ...open, payment_status: "paid" }, false), "paid");
  assert.equal(qrSwitchBlockReason({ ...open, status: "cancelled" }, false), "closed");
  assert.equal(qrSwitchBlockReason({ ...open, status: "delivered" }, false), "closed");
  assert.equal(qrSwitchBlockReason(open, true), "review");
  assert.equal(
    qrSwitchBlockReason({ ...open, notes: `Sin nueces\n${AMOUNT_MISMATCH_NOTE}` }, false),
    "review",
  );
});

test("qrSwitchBlockReason ignores the warning text inside a longer customer line", () => {
  const open = { payment_method: "bold", payment_status: "rejected", status: "pending" };
  assert.equal(qrSwitchBlockReason({ ...open, notes: `Hola ${AMOUNT_MISMATCH_NOTE}` }, false), null);
});

test("qrSwitchBoldAction maps Bold's live status of an open attempt", () => {
  assert.equal(qrSwitchBoldAction("APPROVED"), "confirm_approved");
  assert.equal(qrSwitchBoldAction("PENDING"), "in_progress");
  assert.equal(qrSwitchBoldAction("PROCESSING"), "in_progress");
  assert.equal(qrSwitchBoldAction("REJECTED"), "confirm_rejected");
  assert.equal(qrSwitchBoldAction("FAILED"), "confirm_rejected");
  assert.equal(qrSwitchBoldAction("NO_TRANSACTION_FOUND"), "proceed");
  assert.equal(qrSwitchBoldAction("VOIDED"), "proceed");
  assert.equal(qrSwitchBoldAction(null), "proceed");
  assert.equal(qrSwitchBoldAction(undefined), "proceed");
});
