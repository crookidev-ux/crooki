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

const brownie = { ...caja, id: "brownie", sale_price: null, price: 10000 } satisfies Product;
const unidad = { id: "unidad", label_es: "Unidad", label_en: "Each", price: 10000, min_qty: 1, bulk_min_qty: 12, bulk_price: 8900 };
const empaque = { id: "empaque", label_es: "Con empaque", label_en: "Packed", price: 10000, min_qty: 12, bulk_min_qty: null, bulk_price: null };

test("addOption: one line per product+option, starting at the minimum", () => {
  const { addOption } = useCartStore.getState();
  addOption(brownie, empaque, 1);
  addOption(brownie, unidad, 2);
  const [a, b] = useCartStore.getState().items;
  assert.equal(a.lineId, "brownie#opt#empaque");
  assert.equal(a.quantity, 12, "never below min_qty");
  assert.equal(b.lineId, "brownie#opt#unidad");
  assert.equal(b.quantity, 2);
  addOption(brownie, unidad, 3);
  assert.equal(useCartStore.getState().items.length, 2, "same option merges");
  assert.equal(useCartStore.getState().items[1].quantity, 5);
});

test("option lines: bulk price from 12, minimum kept, total follows the step", () => {
  const { addOption, updateQuantity } = useCartStore.getState();
  addOption(brownie, unidad, 11);
  assert.equal(useCartStore.getState().total(), 110000);
  updateQuantity("brownie#opt#unidad", 12);
  assert.equal(useCartStore.getState().items[0].unitPrice, 8900);
  assert.equal(useCartStore.getState().total(), 12 * 8900);
  addOption(brownie, empaque, 12);
  updateQuantity("brownie#opt#empaque", 11);
  assert.equal(useCartStore.getState().items[1].quantity, 12, "stays at the minimum");
  updateQuantity("brownie#opt#empaque", 0);
  assert.equal(useCartStore.getState().items.length, 1, "0 still removes the line");
});

test("a saved cart without options (old format) keeps its plain price", () => {
  useCartStore.setState({ items: [{ product: caja, quantity: 2, lineId: "caja-navidad", unitPrice: 35000 }] });
  assert.equal(useCartStore.getState().total(), 70000);
});
