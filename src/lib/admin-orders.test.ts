import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countsAsPending,
  isUnpaidBold,
  payLabelKey,
  sortOrdersForAdmin,
  warningLines,
} from "./admin-orders.ts";

const o = (status: string, payment_method: string | null, payment_status: string | null) => ({
  status,
  payment_method,
  payment_status,
});

test("payLabelKey maps every state", () => {
  assert.equal(payLabelKey(o("pending", "bold", "paid")), "paid");
  assert.equal(payLabelKey(o("pending", "bold", "awaiting_payment")), "awaiting");
  assert.equal(payLabelKey(o("pending", "bold", "unpaid")), "awaiting");
  assert.equal(payLabelKey(o("pending", "bold", "rejected")), "rejected");
  assert.equal(payLabelKey(o("pending", "qr", "unpaid")), "qr");
  assert.equal(payLabelKey(o("pending", null, null)), "qr");
});

test("unpaid online orders do not count as pending", () => {
  assert.equal(isUnpaidBold(o("pending", "bold", "awaiting_payment")), true);
  assert.equal(countsAsPending(o("pending", "bold", "awaiting_payment")), false);
  assert.equal(countsAsPending(o("pending", "bold", "rejected")), false);
  assert.equal(countsAsPending(o("pending", "bold", "paid")), true);
  assert.equal(countsAsPending(o("pending", "qr", "unpaid")), true);
  assert.equal(countsAsPending(o("confirmed", "qr", "unpaid")), false);
});

test("sortOrdersForAdmin sinks unpaid bold and keeps order otherwise", () => {
  const list = [
    { id: 1, ...o("pending", "bold", "awaiting_payment") },
    { id: 2, ...o("pending", "qr", "unpaid") },
    { id: 3, ...o("pending", "bold", "paid") },
    { id: 4, ...o("pending", "bold", "rejected") },
  ];
  assert.deepEqual(sortOrdersForAdmin(list).map((x) => x.id), [2, 3, 1, 4]);
});

test("warningLines extracts alert lines only", () => {
  assert.deepEqual(warningLines(null), []);
  assert.deepEqual(
    warningLines("sin cebolla\n⚠ Monto distinto: revisar en Bold"),
    ["⚠ Monto distinto: revisar en Bold"],
  );
});
