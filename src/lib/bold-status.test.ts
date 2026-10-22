import { test } from "node:test";
import assert from "node:assert/strict";
import { mapBoldStatus } from "./bold-status.ts";

test("maps an approved voucher", () => {
  assert.deepEqual(
    mapBoldStatus({
      payment_status: "APPROVED",
      transaction_id: "TX-123",
      amount: { total: 39400, currency: "COP" },
    }),
    { status: "APPROVED", total: 39400, transactionId: "TX-123" },
  );
});

test("keeps only known statuses", () => {
  for (const s of ["REJECTED", "FAILED", "VOIDED", "PROCESSING", "PENDING", "NO_TRANSACTION_FOUND"]) {
    assert.equal(mapBoldStatus({ payment_status: s })?.status, s);
  }
  assert.equal(mapBoldStatus({ payment_status: "SOMETHING_ELSE" }), null);
  assert.equal(mapBoldStatus({}), null);
  assert.equal(mapBoldStatus(null), null);
  assert.equal(mapBoldStatus("APPROVED"), null);
});

test("drops a non-numeric total and a non-string transaction id", () => {
  assert.deepEqual(
    mapBoldStatus({ payment_status: "APPROVED", transaction_id: 7, amount: { total: "39400" } }),
    { status: "APPROVED" },
  );
});
