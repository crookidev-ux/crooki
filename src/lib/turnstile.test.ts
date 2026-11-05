import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstile } from "./turnstile.ts";

const reply = (body: unknown) =>
  (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

test("no secret configured: let through (local dev)", async () => {
  assert.deepEqual(await verifyTurnstile(null, null, undefined), { ok: true, skipped: "not_configured" });
});

test("missing token is rejected without calling Cloudflare", async () => {
  let called = false;
  const spy = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
  const r = await verifyTurnstile(null, "1.2.3.4", "s", spy);
  assert.equal(r.ok, false);
  assert.equal(called, false);
});

test("valid token passes", async () => {
  assert.deepEqual(await verifyTurnstile("tok", "1.2.3.4", "s", reply({ success: true })), { ok: true });
});

test("invalid or reused token is rejected with Cloudflare's codes", async () => {
  const r = await verifyTurnstile("tok", null, "s", reply({ success: false, "error-codes": ["timeout-or-duplicate"] }));
  assert.deepEqual(r, { ok: false, codes: ["timeout-or-duplicate"] });
});

test("Cloudflare unreachable: let through so the shop keeps selling", async () => {
  const down = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
  const orig = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await verifyTurnstile("tok", null, "s", down), { ok: true, skipped: "unreachable" });
  } finally {
    console.error = orig;
  }
});
