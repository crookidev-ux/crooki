import "server-only";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; skipped?: "not_configured" | "unreachable" }
  | { ok: false; codes: string[] };

/**
 * Checks a Cloudflare Turnstile token on the server. A missing or invalid
 * token is rejected. Two cases let the request through on purpose: no secret
 * configured (local dev) and Cloudflare not answering, so an outage on their
 * side never stops the shop from taking orders. Both are logged.
 */
export async function verifyTurnstile(
  token: string | null,
  ip: string | null,
  secret: string | undefined = process.env.TURNSTILE_SECRET_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!secret) return { ok: true, skipped: "not_configured" };
  if (!token || token.length > 2048) return { ok: false, codes: ["missing-input-response"] };

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);
  try {
    const res = await fetchImpl(SITEVERIFY, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true };
    return { ok: false, codes: data["error-codes"] ?? [] };
  } catch (e) {
    console.error("[turnstile] siteverify unreachable, letting the request through", e);
    return { ok: true, skipped: "unreachable" };
  }
}
