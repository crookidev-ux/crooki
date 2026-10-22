import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AMOUNT_MISMATCH_NOTE,
  decideConfirmation,
  DOUBLE_CHARGE_NOTE,
  hasSystemNote,
  withNote,
} from "./payments.confirm.ts";

const created = { status: "created", amount: 39400 };

test("approved, same amount, order not paid → attempt approved, order paid, notify", () => {
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "awaiting_payment" }, { kind: "approved", amount: 39400 }),
    { attempt: "approved", order: "paid", notify: true, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("approved, different amount → nothing changes", () => {
  const unchanged = { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false };
  // A different amount is flagged for review (note on the order) but never marks paid.
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "awaiting_payment" }, { kind: "approved", amount: 39399 }),
    { ...unchanged, amountMismatch: true },
  );
  // A missing amount is never trusted either; it is only logged (no amount to compare).
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "awaiting_payment" }, { kind: "approved" }),
    unchanged,
  );
});

test("approved, order already paid by another attempt → double charge, no notify", () => {
  assert.deepEqual(
    decideConfirmation(created, { payment_status: "paid" }, { kind: "approved", amount: 39400 }),
    { attempt: "approved", order: "unchanged", notify: false, doubleCharge: true, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("approved, this attempt already approved + order paid → no writes, but re-check double charge in the DB", () => {
  // Idempotent replay: no status write, no email. The caller still counts approved
  // attempts, so a double charge whose note write failed (or that was paid by
  // another attempt in the meantime) gets flagged on Bold's retry.
  assert.deepEqual(
    decideConfirmation(
      { status: "approved", amount: 39400 },
      { payment_status: "paid" },
      { kind: "approved", amount: 39400 },
    ),
    { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false, checkDoubleCharge: true, amountMismatch: false },
  );
});

test("an amount mismatch on an already-approved attempt still never touches the order", () => {
  const d = decideConfirmation(
    { status: "approved", amount: 39400 },
    { payment_status: "awaiting_payment" },
    { kind: "approved", amount: 1000 },
  );
  assert.equal(d.order, "unchanged");
  assert.equal(d.notify, false);
  assert.equal(d.amountMismatch, true);
});

test("approved, attempt approved but order write was lost → order paid on retry", () => {
  // Recovery after a partial failure (attempt written, order write threw → 500 → Bold retries).
  assert.deepEqual(
    decideConfirmation(
      { status: "approved", amount: 39400 },
      { payment_status: "awaiting_payment" },
      { kind: "approved", amount: 39400 },
    ),
    { attempt: "unchanged", order: "paid", notify: true, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("approved after an earlier rejection of the same attempt → paid", () => {
  assert.deepEqual(
    decideConfirmation(
      { status: "rejected", amount: 39400 },
      { payment_status: "rejected" },
      { kind: "approved", amount: 39400 },
    ),
    { attempt: "approved", order: "paid", notify: true, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false },
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
    { attempt: "rejected", order: "rejected", notify: false, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("rejected never downgrades an approved attempt", () => {
  assert.deepEqual(
    decideConfirmation({ status: "approved", amount: 39400 }, { payment_status: "paid" }, { kind: "rejected" }),
    { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("rejected twice → second time nothing changes", () => {
  assert.deepEqual(
    decideConfirmation({ status: "rejected", amount: 39400 }, { payment_status: "rejected" }, { kind: "rejected" }),
    { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("withNote appends once, on its own line", () => {
  assert.equal(withNote("", DOUBLE_CHARGE_NOTE), DOUBLE_CHARGE_NOTE);
  assert.equal(withNote(null, AMOUNT_MISMATCH_NOTE), AMOUNT_MISMATCH_NOTE);
  assert.equal(withNote("Sin nueces", DOUBLE_CHARGE_NOTE), `Sin nueces\n${DOUBLE_CHARGE_NOTE}`);
  assert.equal(withNote(`Sin nueces\n${DOUBLE_CHARGE_NOTE}`, DOUBLE_CHARGE_NOTE), null);
  assert.equal(
    withNote(`x\n${DOUBLE_CHARGE_NOTE}`, AMOUNT_MISMATCH_NOTE),
    `x\n${DOUBLE_CHARGE_NOTE}\n${AMOUNT_MISMATCH_NOTE}`,
  );
});

test("hasSystemNote matches whole lines only", () => {
  assert.equal(hasSystemNote(null, AMOUNT_MISMATCH_NOTE), false);
  assert.equal(hasSystemNote("", AMOUNT_MISMATCH_NOTE), false);
  assert.equal(hasSystemNote(AMOUNT_MISMATCH_NOTE, AMOUNT_MISMATCH_NOTE), true);
  assert.equal(hasSystemNote(`Sin nueces\r\n  ${AMOUNT_MISMATCH_NOTE}  `, AMOUNT_MISMATCH_NOTE), true);
  assert.equal(hasSystemNote(`Sin nueces ${AMOUNT_MISMATCH_NOTE}`, AMOUNT_MISMATCH_NOTE), false);
  assert.equal(hasSystemNote(DOUBLE_CHARGE_NOTE, AMOUNT_MISMATCH_NOTE), false);
});

test("withNote still writes the warning when the text only appears inside a longer line", () => {
  const typed = `Cliente: ${DOUBLE_CHARGE_NOTE}`;
  assert.equal(withNote(typed, DOUBLE_CHARGE_NOTE), `${typed}\n${DOUBLE_CHARGE_NOTE}`);
});

const qrOrder = { payment_status: "unpaid", payment_method: "qr" };

test("late approval on a rejected attempt of a QR order → attempt approved, flagged, order not paid", () => {
  assert.deepEqual(
    decideConfirmation({ status: "rejected", amount: 39400 }, qrOrder, { kind: "approved", amount: 39400 }),
    { attempt: "approved", order: "unchanged", notify: false, doubleCharge: true, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("approval on a still-created attempt of a QR order is flagged too, and a replay keeps flagging", () => {
  assert.deepEqual(
    decideConfirmation(created, qrOrder, { kind: "approved", amount: 39400 }),
    { attempt: "approved", order: "unchanged", notify: false, doubleCharge: true, checkDoubleCharge: false, amountMismatch: false },
  );
  assert.deepEqual(
    decideConfirmation({ status: "approved", amount: 39400 }, qrOrder, { kind: "approved", amount: 39400 }),
    { attempt: "unchanged", order: "unchanged", notify: false, doubleCharge: true, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("QR order: a different amount is still an amount mismatch", () => {
  const d = decideConfirmation({ status: "rejected", amount: 39400 }, qrOrder, { kind: "approved", amount: 1000 });
  assert.equal(d.amountMismatch, true);
  assert.equal(d.order, "unchanged");
  assert.equal(d.attempt, "unchanged");
});

test("QR order: a rejection only closes the attempt, never the order", () => {
  assert.deepEqual(
    decideConfirmation(created, qrOrder, { kind: "rejected" }),
    { attempt: "rejected", order: "unchanged", notify: false, doubleCharge: false, checkDoubleCharge: false, amountMismatch: false },
  );
});

test("a Bold order (payment_method given) keeps the normal rules", () => {
  assert.equal(
    decideConfirmation(created, { payment_status: "awaiting_payment", payment_method: "bold" }, { kind: "approved", amount: 39400 }).order,
    "paid",
  );
});
