import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useCartStore } from "./cart.ts";
import type { Product } from "../lib/types.ts";

const caja = {
  id: "caja-navidad",
  name_es: "Caja Navideña",
  name_en: "Christmas Box",
  description_es: "",
  description_en: "",
  price: 40000,
  sale_price: 35000,
  category: "navidad",
  available: true,
  display_order: 0,
  created_at: "2026-11-24T00:00:00Z",
  product_images: [],
} satisfies Product;

beforeEach(() => useCartStore.setState({ items: [], isOpen: false }));

test("addItem without a quantity still adds one unit", () => {
  useCartStore.getState().addItem(caja);
  const [line] = useCartStore.getState().items;
  assert.equal(line.quantity, 1);
  assert.equal(line.unitPrice, 35000, "uses the active sale price");
  assert.equal(useCartStore.getState().isOpen, true);
});

test("addItem adds the chosen units and merges into the same line", () => {
  const { addItem } = useCartStore.getState();
  addItem(caja, 3);
  addItem(caja, 2);
  const { items, itemCount, total } = useCartStore.getState();
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 5);
  assert.equal(itemCount(), 5);
  assert.equal(total(), 5 * 35000);
});

test("a line never exceeds the checkout limit of 50 units", () => {
  const { addItem } = useCartStore.getState();
  addItem(caja, 40);
  addItem(caja, 40);
  assert.equal(useCartStore.getState().items[0].quantity, 50);
  useCartStore.getState().updateQuantity("caja-navidad", 99);
  assert.equal(useCartStore.getState().items[0].quantity, 50);
});

test("invalid quantities fall back to one unit", () => {
  const { addItem } = useCartStore.getState();
  addItem(caja, 0);
  addItem(caja, Number.NaN);
  addItem(caja, -4);
  assert.equal(useCartStore.getState().items[0].quantity, 3);
});
