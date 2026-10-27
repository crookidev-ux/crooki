import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOrderCode, orderIdRange, phoneDigits, phonesMatch } from "./order-lookup.ts";

test("normalizeOrderCode accepts the code as shown on the order page", () => {
  assert.equal(normalizeOrderCode("A7D97215"), "a7d97215");
  assert.equal(normalizeOrderCode(" #a7d9-7215 "), "a7d97215");
});

test("normalizeOrderCode rejects anything that is not 8 hex characters", () => {
  assert.equal(normalizeOrderCode("a7d9721"), null);
  assert.equal(normalizeOrderCode("a7d97215x"), null);
  assert.equal(normalizeOrderCode("zzzzzzzz"), null);
  assert.equal(normalizeOrderCode(""), null);
});

test("phoneDigits drops formatting and the 57 country code", () => {
  assert.equal(phoneDigits("+57 302 719 0084"), "3027190084");
  assert.equal(phoneDigits("302-719-0084"), "3027190084");
});

test("phonesMatch compares the last 10 digits", () => {
  assert.equal(phonesMatch("+57 3027190084", "302 719 0084"), true);
  assert.equal(phonesMatch("3027190084", "3027190085"), false);
  assert.equal(phonesMatch("123", "123"), false);
});

test("orderIdRange spans every uuid with that prefix", () => {
  const { from, to } = orderIdRange("a7d97215");
  assert.equal(from, "a7d97215-0000-0000-0000-000000000000");
  assert.equal(to, "a7d97215-ffff-ffff-ffff-ffffffffffff");
});
