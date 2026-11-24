import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agoLabel,
  bogotaDay,
  canTransition,
  cleanSearch,
  countsAsPending,
  idPrefixRange,
  isUnpaidBold,
  matchesTab,
  nextStatuses,
  orderTimeLabel,
  parseOrderTab,
  phoneDigits,
  scheduleLabel,
  shortOrderId,
  payLabelKey,
  sortOrdersForAdmin,
  warningLines,
} from "./admin-orders.ts";
import { DOUBLE_CHARGE_NOTE } from "./payments.confirm.ts";

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

test("warningLines ignores customer-typed lookalikes", () => {
  assert.deepEqual(warningLines("⚠ sin cebolla"), []);
  assert.deepEqual(warningLines(`⚠ foo
${DOUBLE_CHARGE_NOTE}`), [DOUBLE_CHARGE_NOTE]);
});

// 2026-11-24 15:00 in Cartagena (UTC-5) = 20:00 UTC.
const NOW = new Date("2026-11-24T20:00:00Z");
const order = (over: Partial<{ status: string; payment_method: string | null; payment_status: string | null; created_at: string; scheduled_for: string | null }>) => ({
  status: "pending",
  payment_method: "qr",
  payment_status: "unpaid",
  created_at: "2026-11-24T19:00:00Z",
  scheduled_for: null,
  ...over,
});

test("bogotaDay starts at local midnight, also right after it", () => {
  assert.equal(bogotaDay(NOW).start.toISOString(), "2026-11-24T05:00:00.000Z");
  assert.equal(bogotaDay(NOW).end.toISOString(), "2026-11-25T05:00:00.000Z");
  // 00:30 local on the 25th is already the next day.
  assert.equal(bogotaDay(new Date("2026-11-25T05:30:00Z")).start.toISOString(), "2026-11-25T05:00:00.000Z");
  // 23:30 local on the 24th is still the 24th even though UTC says the 25th.
  assert.equal(bogotaDay(new Date("2026-11-25T04:30:00Z")).start.toISOString(), "2026-11-24T05:00:00.000Z");
});

test("Por preparar: today's open orders that can be prepared", () => {
  assert.equal(matchesTab(order({}), "preparar", NOW), true);
  assert.equal(matchesTab(order({ status: "confirmed" }), "preparar", NOW), true);
  assert.equal(matchesTab(order({ status: "delivered" }), "preparar", NOW), false);
  assert.equal(matchesTab(order({ status: "cancelled" }), "preparar", NOW), false);
  // Bold without payment: nothing to prepare yet.
  assert.equal(matchesTab(order({ payment_method: "bold", payment_status: "awaiting_payment" }), "preparar", NOW), false);
  assert.equal(matchesTab(order({ payment_method: "bold", payment_status: "paid" }), "preparar", NOW), true);
  // Yesterday's leftovers (statuses were never marked before v2) stay out...
  assert.equal(matchesTab(order({ created_at: "2026-11-23T20:00:00Z" }), "preparar", NOW), false);
  // ...unless scheduled for today or later.
  assert.equal(matchesTab(order({ created_at: "2026-11-23T03:00:00Z", scheduled_for: "2026-11-24T16:00:00Z" }), "preparar", NOW), true);
});

test("Hoy, Programados, Sin pagar, Entregados, Todos", () => {
  const yesterday = "2026-11-23T20:00:00Z";
  assert.equal(matchesTab(order({ created_at: yesterday }), "hoy", NOW), false);
  assert.equal(matchesTab(order({ created_at: yesterday, scheduled_for: "2026-11-24T16:00:00Z" }), "hoy", NOW), true);
  assert.equal(matchesTab(order({ created_at: yesterday, scheduled_for: "2026-11-25T16:00:00Z" }), "hoy", NOW), false);
  assert.equal(matchesTab(order({ status: "cancelled" }), "hoy", NOW), true);

  assert.equal(matchesTab(order({ scheduled_for: "2026-11-25T16:00:00Z" }), "programados", NOW), true);
  assert.equal(matchesTab(order({ scheduled_for: "2026-11-23T16:00:00Z" }), "programados", NOW), false);
  assert.equal(matchesTab(order({ scheduled_for: "2026-11-25T16:00:00Z", status: "delivered" }), "programados", NOW), false);
  assert.equal(matchesTab(order({}), "programados", NOW), false);

  assert.equal(matchesTab(order({ payment_method: "bold", payment_status: "rejected" }), "sin-pagar", NOW), true);
  assert.equal(matchesTab(order({ payment_method: "bold", payment_status: "awaiting_payment", status: "cancelled" }), "sin-pagar", NOW), false);
  assert.equal(matchesTab(order({}), "sin-pagar", NOW), false);

  assert.equal(matchesTab(order({ status: "delivered", created_at: yesterday }), "entregados", NOW), true);
  assert.equal(matchesTab(order({ status: "cancelled", created_at: "2020-01-01T00:00:00Z" }), "todos", NOW), true);
});

test("status transitions: final states, unpaid Bold cannot be confirmed or delivered", () => {
  assert.deepEqual(nextStatuses(o("pending", "qr", "unpaid")), ["confirmed", "delivered", "cancelled"]);
  assert.deepEqual(nextStatuses(o("confirmed", "bold", "paid")), ["delivered", "cancelled"]);
  assert.deepEqual(nextStatuses(o("pending", null, null)), ["confirmed", "delivered", "cancelled"]);
  assert.deepEqual(nextStatuses(o("pending", "bold", "awaiting_payment")), ["cancelled"]);
  assert.deepEqual(nextStatuses(o("pending", "bold", "rejected")), ["cancelled"]);
  assert.deepEqual(nextStatuses(o("delivered", "bold", "paid")), []);
  assert.deepEqual(nextStatuses(o("cancelled", "qr", "unpaid")), []);
  assert.equal(canTransition(o("pending", "bold", "awaiting_payment"), "delivered"), false);
  assert.equal(canTransition(o("pending", "bold", "paid"), "confirmed"), true);
  assert.equal(canTransition(o("confirmed", "qr", "unpaid"), "pending"), false);
  assert.equal(canTransition(o("pending", "qr", "unpaid"), "anything"), false);
});

test("parseOrderTab, phoneDigits, cleanSearch, idPrefixRange", () => {
  assert.equal(parseOrderTab("hoy"), "hoy");
  assert.equal(parseOrderTab("x"), "preparar");
  assert.equal(parseOrderTab(undefined), "preparar");
  assert.equal(phoneDigits("300 123 4567"), "573001234567");
  assert.equal(phoneDigits("+57 300-123-4567"), "573001234567");
  assert.equal(phoneDigits("+1 (305) 555-0100"), "13055550100");
  assert.equal(phoneDigits("123"), null);
  assert.equal(phoneDigits(null), null);
  assert.equal(cleanSearch("  Laura, (x)*%  "), "Laura x");
  assert.equal(cleanSearch(42), "");
  assert.equal(cleanSearch("a".repeat(80)).length, 60);
  assert.deepEqual(idPrefixRange("A1F3C9E2"), {
    from: "a1f3c9e2-0000-0000-0000-000000000000",
    to: "a1f3c9e2-ffff-ffff-ffff-ffffffffffff",
  });
  assert.equal(idPrefixRange("Laura"), null);
  assert.equal(shortOrderId("a1f3c9e2-1111-2222-3333-444444444444"), "A1F3C9E2");
});

test("time labels in Cartagena time", () => {
  assert.equal(agoLabel("2026-11-24T19:42:00Z", NOW), "hace 18 min");
  assert.equal(agoLabel("2026-11-24T17:00:00Z", NOW), "hace 3 h");
  assert.equal(agoLabel("2026-11-23T17:00:00Z", NOW), null);
  assert.match(orderTimeLabel("2026-11-24T19:42:00Z", NOW), /^2:42/);
  assert.match(orderTimeLabel("2026-11-23T19:42:00Z", NOW), /^23 .*· 2:42/);
  assert.match(scheduleLabel("2026-11-24T16:00:00Z", NOW), /^hoy 11:00/);
  assert.match(scheduleLabel("2026-11-25T16:00:00Z", NOW), /^mañana 11:00/);
  assert.match(scheduleLabel("2026-11-27T16:00:00Z", NOW), /^27 .* 11:00/);
});

test("warningLines extracts alert lines only", () => {
  assert.deepEqual(warningLines(null), []);
  assert.deepEqual(
    warningLines("sin cebolla\n⚠ Monto distinto: revisar en Bold"),
    ["⚠ Monto distinto: revisar en Bold"],
  );
});
