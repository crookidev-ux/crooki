import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBoldClientConfig,
  orderDescription,
  redirectionUrl,
  retryBlockReason,
} from "./payments.config.ts";
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
