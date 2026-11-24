// Photo rules shared by the admin form. The database trigger
// (migration 20261124010000_navidad_products) rejects a 6th row per product.

export const MAX_PRODUCT_IMAGES = 5;

/** How many of `picked` fit next to the `current` photos, and how many are dropped. */
export function fitPhotos<T>(current: number, picked: T[]): { accepted: T[]; dropped: number } {
  const room = Math.max(0, MAX_PRODUCT_IMAGES - current);
  return { accepted: picked.slice(0, room), dropped: Math.max(0, picked.length - room) };
}

/** Copy of `list` with the item at `from` moved to `to` (out-of-range = unchanged). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
