import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BoxSelection,
  CartItem,
  ComboSelection,
  HeladoSelection,
  Product,
} from "@/lib/types";

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  // False until the saved cart is read from localStorage (see CartHydrator).
  hydrated: boolean;
  addItem: (product: Product) => void;
  addCombo: (product: Product, selection: ComboSelection, unitPrice: number) => void;
  addBox: (product: Product, selection: BoxSelection, unitPrice: number) => void;
  addHelado: (product: Product, selection: HeladoSelection, unitPrice: number) => void;
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
  return item.unitPrice ?? item.product.price;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hydrated: false,

      addItem: (product: Product) => {
        const { items } = get();
        const lineId = product.id;
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
              { product, quantity: 1, lineId, unitPrice: product.price },
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

      removeItem: (lineId: string) => {
        set({ items: get().items.filter((i) => i.lineId !== lineId) });
      },

      updateQuantity: (lineId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(lineId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.lineId === lineId ? { ...i, quantity } : i,
          ),
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
