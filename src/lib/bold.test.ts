import { test } from "node:test";
import assert from "node:assert/strict";
import {
  integritySignature,
  verifyWebhookSignature,
  newBoldOrderId,
  isBoldConfigured,
  BOLD_MIN_AMOUNT,
} from "./bold.ts";

test("integritySignature matches Bold docs example", () => {
  assert.equal(
    integritySignature("inv0334", 39400, "COP", "kgfq2nN0o52XqnuXZWIN2F"),
    "620a64c6eab8858d0f96d4f818a1d77be5e9b9eb9dc681f527de1af54fc1b739",
  );
});

test("verifyWebhookSignature", () => {
  const body = '{"type":"SALE_APPROVED"}';
  const sig = "9937c5df6b43b00bf829a5682bb5646e0e078bd5542629ec9b7452a47bd57e55";
  assert.equal(verifyWebhookSignature(body, sig, "test-secret"), true);
  assert.equal(verifyWebhookSignature('{"type":"SALE_APPROVEE"}', sig, "test-secret"), false);
  assert.equal(verifyWebhookSignature(body, null, "test-secret"), false);
  assert.equal(verifyWebhookSignature(body, "abc", "test-secret"), false);
});

test("newBoldOrderId format", () => {
  const id = newBoldOrderId("3f2a9c1e-aaaa-bbbb-cccc-000000000000", 1700000000000);
  assert.match(id, /^CRK-3F2A9C1E-[0-9A-Z]+$/);
  assert.ok(id.length <= 60);
});

test("isBoldConfigured", () => {
  assert.equal(isBoldConfigured({ BOLD_IDENTITY_KEY: "a", BOLD_SECRET_KEY: "" }), false);
  assert.equal(isBoldConfigured({ BOLD_IDENTITY_KEY: "a", BOLD_SECRET_KEY: "b" }), true);
  assert.equal(BOLD_MIN_AMOUNT, 1000);
});
