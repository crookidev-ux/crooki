import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidSlug, slugify, MAX_SLUG_LENGTH } from "./slug.ts";
import { fitPhotos, moveItem, MAX_PRODUCT_IMAGES } from "./product-photos.ts";

test("slugify strips accents, symbols and edge hyphens", () => {
  assert.equal(slugify("Caja Navideña x6!"), "caja-navidena-x6");
  assert.equal(slugify("  --Galleta  de  Jengibre--  "), "galleta-de-jengibre");
  assert.equal(slugify("¡¡¡"), "");
});

test("slugify output is always a valid slug (or empty)", () => {
  for (const s of ["Árbol de Navidad 🎄", "a".repeat(200), "x- -y", "Crooki's Box #1"]) {
    const out = slugify(s);
    assert.ok(out === "" || isValidSlug(out), `${s} → ${out}`);
    assert.ok(out.length <= MAX_SLUG_LENGTH);
  }
  // Cutting at 80 must not leave a trailing hyphen.
  assert.equal(slugify(`${"a".repeat(79)} b`), "a".repeat(79));
});

test("isValidSlug rejects what the database CHECK rejects", () => {
  assert.ok(isValidSlug("caja-navidena"));
  assert.ok(isValidSlug("x6"));
  for (const bad of ["", "-caja", "caja-", "caja--x", "Caja", "caja navidena", "cañas", "a/b", "a".repeat(81)]) {
    assert.equal(isValidSlug(bad), false, bad);
  }
});

test("fitPhotos keeps at most 5 photos per product", () => {
  assert.equal(MAX_PRODUCT_IMAGES, 5);
  assert.deepEqual(fitPhotos(0, [1, 2, 3]), { accepted: [1, 2, 3], dropped: 0 });
  assert.deepEqual(fitPhotos(3, [1, 2, 3]), { accepted: [1, 2], dropped: 1 });
  assert.deepEqual(fitPhotos(5, [1]), { accepted: [], dropped: 1 });
  // Legacy products with more than 5 never get a negative room.
  assert.deepEqual(fitPhotos(7, [1, 2]), { accepted: [], dropped: 2 });
});

test("moveItem reorders without mutating and ignores out-of-range moves", () => {
  const list = ["a", "b", "c"];
  assert.deepEqual(moveItem(list, 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveItem(list, 0, 1), ["b", "a", "c"]);
  assert.deepEqual(list, ["a", "b", "c"]);
  assert.equal(moveItem(list, 0, -1), list);
  assert.equal(moveItem(list, 2, 3), list);
});
