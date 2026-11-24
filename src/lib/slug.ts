// URL slugs for categories and Christmas product pages. The database enforces
// the same format on products.slug (migration 20261124010000_navidad_products).

export const MAX_SLUG_LENGTH = 80;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Caja Navideña x6!" → "caja-navidena-x6". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/** Lowercase letters, digits and single hyphens, 1–80 characters. */
export function isValidSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_RE.test(value);
}
