import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCheckoutInput, stripSystemNotes } from "./schema.ts";
import { AMOUNT_MISMATCH_NOTE, DOUBLE_CHARGE_NOTE } from "../payments.confirm.ts";

const body = (notes: unknown) => ({
  locale: "es",
  customer: { name: "Ana", email: "ana@example.com", phone: "3001234567" },
  fulfillment: "pickup",
  notes,
  paymentMethod: "bold",
  acceptedPolicy: true,
  items: [{ productId: "galleta", quantity: 1 }],
});

test("stripSystemNotes drops lines that exactly match a payment warning", () => {
  assert.equal(stripSystemNotes(`Sin nueces\n${AMOUNT_MISMATCH_NOTE}`), "Sin nueces");
  assert.equal(stripSystemNotes(`  ${DOUBLE_CHARGE_NOTE}  \nTimbre 2`), "Timbre 2");
  assert.equal(stripSystemNotes(`${DOUBLE_CHARGE_NOTE}\r\n${AMOUNT_MISMATCH_NOTE}`), "");
  assert.equal(stripSystemNotes("Sin nueces\nTimbre 2"), "Sin nueces\nTimbre 2");
});

test("stripSystemNotes keeps lines that only mention a warning", () => {
  const note = `Cliente dice: ${AMOUNT_MISMATCH_NOTE}`;
  assert.equal(stripSystemNotes(note), note);
});

test("parseCheckoutInput removes injected system warnings from the notes", () => {
  const r = parseCheckoutInput(body(`Sin nueces\n${AMOUNT_MISMATCH_NOTE}\n${DOUBLE_CHARGE_NOTE}`));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.notes, "Sin nueces");
});

test("parseCheckoutInput keeps ordinary notes and allows none", () => {
  const r = parseCheckoutInput(body("Sin nueces"));
  assert.equal(r.ok && r.value.notes, "Sin nueces");
  const empty = parseCheckoutInput(body(undefined));
  assert.equal(empty.ok && empty.value.notes, "");
});

test("scheduleAccepted is kept only when it is exactly true", () => {
  const yes = parseCheckoutInput({ ...body(""), scheduleAccepted: true });
  assert.equal(yes.ok && yes.value.scheduleAccepted, true);
  for (const v of [undefined, false, "true", 1]) {
    const r = parseCheckoutInput({ ...body(""), scheduleAccepted: v });
    assert.equal(r.ok && r.value.scheduleAccepted, undefined);
  }
});

const withItem = (item: Record<string, unknown>) => ({ ...body(""), items: [item] });

test("optionId is kept as a trimmed string; empty or null means no option", () => {
  const r = parseCheckoutInput(withItem({ productId: "chocobomba", optionId: " opt-1 ", quantity: 12 }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.items, [{ productId: "chocobomba", optionId: "opt-1", quantity: 12 }]);
  for (const optionId of ["", null, undefined]) {
    const plain = parseCheckoutInput(withItem({ productId: "galleta", optionId, quantity: 1 }));
    assert.equal(plain.ok, true);
    if (plain.ok) assert.equal("optionId" in plain.value.items[0], false);
  }
});

test("optionId must be a short string and cannot be combined with combo/box/helado", () => {
  for (const item of [
    { productId: "x", optionId: 5, quantity: 1 },
    { productId: "x", optionId: { id: "a" }, quantity: 1 },
    { productId: "x", optionId: "a".repeat(201), quantity: 1 },
    { productId: "x", optionId: "a", quantity: 1, combo: { cookieId: "c" } },
    { productId: "x", optionId: "a", quantity: 1, helado: { salsas: [] } },
    { productId: "x", optionId: "a", quantity: 1, box: { cookies: [], giftCard: "none" } },
  ]) {
    assert.equal(parseCheckoutInput(withItem(item)).ok, false, JSON.stringify(item).slice(0, 80));
  }
});
