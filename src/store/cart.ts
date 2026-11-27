import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BoxSelection,
  CartItem,
  ComboSelection,
  HeladoSelection,
  Product,
} from "@/lib/types";
// Relative .ts imports so `npm test` (plain Node) can load this store.
import { effectivePrice } from "../lib/promo.ts";
import { MAX_LINE_QTY } from "../lib/cart-limits.ts";
import { optionUnitPrice } from "../lib/pricing.ts";

type CartOption = NonNullable<CartItem["option"]>;

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  // False until the saved cart is read from localStorage (see CartHydrator).
  hydrated: boolean;
  /** Adds `quantity` units (default 1); a line never exceeds MAX_LINE_QTY. */
  addItem: (product: Product, quantity?: number) => void;
  addCombo: (product: Product, selection: ComboSelection, unitPrice: number) => void;
  addBox: (product: Product, selection: BoxSelection, unitPrice: number) => void;
  addHelado: (product: Product, selection: HeladoSelection, unitPrice: number) => void;
  /** Adds `quantity` units of one option; the line stays within min_qty..MAX_LINE_QTY. */
  addOption: (product: Product, option: CartOption, quantity: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  total: () => number;
  itemCount: () => number;
}

function comboSelectionKey(s: ComboSelection): string {
  const extras = [...s.additionalSalsas]
    .sort((a, b) => a.salsaId.localeCompare(b.salsaId))
    .map((x) => `${x.salsaId}:${x.quantity}`)
    .join(",");
  return `${s.cookieId}|${s.includedSalsaId ?? ""}|${extras}`;
}

function heladoSelectionKey(s: HeladoSelection): string {
  return [...s.salsas]
    .sort((a, b) => a.salsaId.localeCompare(b.salsaId))
    .map((x) => `${x.salsaId}:${x.quantity}`)
    .join(",");
}

function boxSelectionKey(s: BoxSelection): string {
  const cookies = [...s.cookies]
    .sort((a, b) => a.cookieId.localeCompare(b.cookieId))
    .map((c) => `${c.cookieId}:${c.quantity}`)
    .join(",");
  return `${cookies}|${s.giftCard}`;
}

function lineUnitPrice(item: CartItem): number {
  if (item.option) return optionUnitPrice(item.option, item.quantity);
  return item.unitPrice ?? effectivePrice(item.product);
}

const clampOptionQty = (option: CartOption, quantity: number) =>
  Math.min(MAX_LINE_QTY, Math.max(option.min_qty, Math.floor(quantity) || option.min_qty));

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hydrated: false,

      addItem: (product: Product, quantity = 1) => {
        const { items } = get();
        const lineId = product.id;
        const add = Math.max(1, Math.floor(quantity) || 1);
        const existing = items.find((i) => i.lineId === lineId);
        if (existing) {
          set({
            items: items.map((i) =>
              i.lineId === lineId
                ? { ...i, quantity: Math.min(MAX_LINE_QTY, i.quantity + add) }
                : i,
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                product,
                quantity: Math.min(MAX_LINE_QTY, add),
                lineId,
                unitPrice: effectivePrice(product),
              },
            ],
          });
        }
        set({ isOpen: true });
      },

      addCombo: (product: Product, selection: ComboSelection, unitPrice: number) => {
        const { items } = get();
        const lineId = `${product.id}#${comboSelectionKey(selection)}`;
        const existing = items.find((i) => i.lineId === lineId);
        if (existing) {
          set({
            items: items.map((i) =>
              i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          });
        } else {
          set({
            items: [
              ...items,
              { product, quantity: 1, lineId, combo: selection, unitPrice },
            ],
          });
        }
        set({ isOpen: true });
      },

      addBox: (product: Product, selection: BoxSelection, unitPrice: number) => {
        const { items } = get();
        const lineId = `${product.id}#box#${boxSelectionKey(selection)}`;
        const existing = items.find((i) => i.lineId === lineId);
        if (existing) {
          set({
            items: items.map((i) =>
              i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          });
        } else {
          set({
            items: [
              ...items,
              { product, quantity: 1, lineId, box: selection, unitPrice },
            ],
          });
        }
        set({ isOpen: true });
      },

      addHelado: (product: Product, selection: HeladoSelection, unitPrice: number) => {
        const { items } = get();
        const lineId = `${product.id}#helado#${heladoSelectionKey(selection)}`;
        const existing = items.find((i) => i.lineId === lineId);
        if (existing) {
          set({
            items: items.map((i) =>
              i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          });
        } else {
          set({
            items: [
              ...items,
              { product, quantity: 1, lineId, helado: selection, unitPrice },
            ],
          });
        }
        set({ isOpen: true });
      },

      addOption: (product: Product, option: CartOption, quantity: number) => {
        const { items } = get();
        const lineId = `${product.id}#opt#${option.id}`;
        const existing = items.find((i) => i.lineId === lineId);
        const qty = clampOptionQty(option, (existing?.quantity ?? 0) + quantity);
        const line: CartItem = {
          product,
          quantity: qty,
          lineId,
          option,
          unitPrice: optionUnitPrice(option, qty),
        };
        set({
          items: existing ? items.map((i) => (i.lineId === lineId ? line : i)) : [...items, line],
          isOpen: true,
        });
      },

      removeItem: (lineId: string) => {
        set({ items: get().items.filter((i) => i.lineId !== lineId) });
      },

      updateQuantity: (lineId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(lineId);
          return;
        }
        set({
          items: get().items.map((i) => {
            if (i.lineId !== lineId) return i;
            // An option line never goes below its minimum (the trash button removes it).
            if (i.option) {
              const qty = clampOptionQty(i.option, quantity);
              return { ...i, quantity: qty, unitPrice: optionUnitPrice(i.option, qty) };
            }
            return { ...i, quantity: Math.min(MAX_LINE_QTY, quantity) };
          }),
        });
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      total: () =>
        get().items.reduce((sum, i) => sum + lineUnitPrice(i) * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "crooki-cart",
      // The server renders an empty cart, so the saved one is loaded only after
      // hydration (CartHydrator); reading it earlier broke hydration (React #418)
      // for every visitor with items in the cart.
      skipHydration: true,
      partialize: (s) => ({ items: s.items, isOpen: s.isOpen }),
      onRehydrateStorage: () => () => useCartStore.setState({ hydrated: true }),
      // Bump the persist version so previously stored carts (which lacked
      // `lineId`) are discarded rather than crashing the store.
      version: 2,
      migrate: () => {
        // Old shape: { items: [{ product, quantity }] }. Drop everything and
        // start fresh — re-adding products is trivial.
        return { items: [], isOpen: false } as Pick<CartStore, "items" | "isOpen">;
      },
    },
  ),
);
