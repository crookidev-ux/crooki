import { test } from "node:test";
import assert from "node:assert/strict";
import { isMissingTable } from "./missing-table.ts";

test("isMissingTable: only the 'table does not exist' codes", () => {
  // Shape observed from production on 2026-11-26 before the migration.
  assert.equal(isMissingTable({ code: "PGRST205" }), true);
  assert.equal(isMissingTable({ code: "42P01" }), true);
  for (const e of [null, undefined, {}, { code: "PGRST301" }, { code: "42501" }, { code: "57014" }]) {
    assert.equal(isMissingTable(e), false);
  }
});
