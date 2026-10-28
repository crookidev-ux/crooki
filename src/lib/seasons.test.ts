import { test } from "node:test";
import assert from "node:assert/strict";
import { SEASON_IDS, SEASON_NAMES_ES, parseActiveSeason, seasonSaved } from "./seasons.ts";

test("there are seven seasons, each with a Spanish name", () => {
  assert.equal(SEASON_IDS.length, 7);
  for (const id of SEASON_IDS) assert.ok(SEASON_NAMES_ES[id]);
});

test("parseActiveSeason keeps known ids", () => {
  assert.equal(parseActiveSeason("halloween"), "halloween");
  assert.equal(parseActiveSeason("amor-amistad"), "amor-amistad");
});

test("parseActiveSeason rejects anything else", () => {
  assert.equal(parseActiveSeason("pascua"), null);
  assert.equal(parseActiveSeason(null), null);
  assert.equal(parseActiveSeason(undefined), null);
  assert.equal(parseActiveSeason(3), null);
  assert.equal(parseActiveSeason(""), null);
});

test("seasonSaved needs no error and an updated row", () => {
  assert.equal(seasonSaved(null, [{ id: 1 }]), true);
  assert.equal(seasonSaved(null, []), false); // row missing or blocked by RLS
  assert.equal(seasonSaved(null, null), false);
  assert.equal(seasonSaved({ message: "x" }, [{ id: 1 }]), false);
});
