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
