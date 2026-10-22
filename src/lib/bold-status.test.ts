import { test } from "node:test";
import assert from "node:assert/strict";
import { mapBoldStatus } from "./bold-status.ts";

test("maps the real payment-voucher body (Bold test mode, 2026-10-22)", () => {
  const body = JSON.parse(
    '{"link_id": "BTN_LWU5KG6Y39", "total": 16500, "subtotal": 16500, "description": "Pedido Crooki #C424D582", "reference_id": "CRK-C424D582-MVJRLMZR-OVRW", "payment_status": "APPROVED", "transaction_id": "T_0Z74ORDR3Y", "payer_email": "sanbox@bold.co", "transaction_date": "2026-10-22 11:44:19-05:00", "payment_method": "CREDIT_CARD", "transaction_long_date": null}',
  );
  assert.deepEqual(mapBoldStatus(body), { status: "APPROVED", total: 16500, transactionId: "T_0Z74ORDR3Y" });
});

test("falls back to amount.total when there is no top-level total", () => {
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
    mapBoldStatus({ payment_status: "APPROVED", transaction_id: 7, total: "16500", amount: { total: "39400" } }),
    { status: "APPROVED" },
  );
});
