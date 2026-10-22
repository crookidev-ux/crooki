import { test } from "node:test";
import assert from "node:assert/strict";
import { decideConfirmation } from "./payments.confirm.ts";

const created = { status: "created", amount: 39400 };

test("approved, same amount, order not paid → attempt approved, order paid, notify", () => {
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "awaiting_payment" }, { kind: "approved", amount: 39400 }),
    { attempt: "approved", order: "paid", notify: true, doubleCharge: false },
  );
});

test("approved, different amount → nothing changes", () => {
  const unchanged = { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false };
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "awaiting_payment" }, { kind: "approved", amount: 39399 }),
    unchanged,
  );
  // A missing amount is treated as a mismatch: never mark paid without checking it.
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "awaiting_payment" }, { kind: "approved" }),
    unchanged,
  );
});

test("approved, order already paid by another attempt → double charge, no notify", () => {
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "paid" }, { kind: "approved", amount: 39400 }),
    { attempt: "approved", order: "unchanged", notify: false, doubleCharge: true },
  );
});

test("approved, this attempt already approved → nothing changes (idempotent)", () => {
  assert.deepEqual(
    decideConfirmation(
      { status: "approved", amount: 39400 },
      { payment_status: "paid" },
      { kind: "approved", amount: 39400 },
    ),
    { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false },
  );
});

test("approved, attempt approved but order write was lost → order paid on retry", () => {
  // Recovery after a partial failure (attempt written, order write threw → 500 → Bold retries).
  assert.deepEqual(
    decideConfirmation(
      { status: "approved", amount: 39400 },
      { payment_status: "awaiting_payment" },
      { kind: "approved", amount: 39400 },
    ),
    { attempt: "unchanged", order: "paid", notify: true, doubleCharge: false },
  );
});

test("approved after an earlier rejection of the same attempt → paid", () => {
  assert.deepEqual(
    decideConfirmation(
      { status: "rejected", amount: 39400 },
      { payment_status: "rejected" },
      { kind: "approved", amount: 39400 },
    ),
    { attempt: "approved", order: "paid", notify: true, doubleCharge: false },
  );
});

test("rejected, order paid → order unchanged", () => {
  const d = decideConfirmation(created, { payment_status: "paid" }, { kind: "rejected" });
  assert.equal(d.order, "unchanged");
  assert.equal(d.notify, false);
  assert.equal(d.doubleCharge, false);
});

test("rejected, order not paid → attempt rejected, order rejected", () => {
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "awaiting_payment" }, { kind: "rejected" }),
    { attempt: "rejected", order: "rejected", notify: false, doubleCharge: false },
  );
});

test("rejected never downgrades an approved attempt", () => {
  assert.deepEqual(
    decideConfirmation({ status: "approved", amount: 39400 }, { payment_status: "paid" }, { kind: "rejected" }),
    { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false },
  );
});

test("rejected twice → second time nothing changes", () => {
  assert.deepEqual(
    decideConfirmation({ status: "rejected", amount: 39400 }, { payment_status: "rejected" }, { kind: "rejected" }),
    { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false },
  );
});
