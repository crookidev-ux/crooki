// Pure helpers for «Mi pedido»: the customer finds their order with the order
// number shown on the order page (first 8 hex chars of the id) and the phone
// they gave at checkout. Unit-tested with node:test.

/** "#A7D9 7215" → "a7d97215"; null when it is not 8 hex characters. */
export function normalizeOrderCode(input: string): string | null {
  const code = input.replace(/[\s#-]/g, "").toLowerCase();
  return /^[0-9a-f]{8}$/.test(code) ? code : null;
}

/** Digits only, without the Colombian country code (57) when present. */
export function phoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("57") ? digits.slice(2) : digits;
}

/** Same phone when both have at least 7 digits and the last 10 match. */
export function phonesMatch(a: string, b: string): boolean {
  const x = phoneDigits(a);
  const y = phoneDigits(b);
  if (x.length < 7 || y.length < 7) return false;
  return x.slice(-10) === y.slice(-10);
}

/** Inclusive uuid range of every id that starts with `code` (uuid order = hex order). */
export function orderIdRange(code: string): { from: string; to: string } {
  return {
    from: `${code}-0000-0000-0000-000000000000`,
    to: `${code}-ffff-ffff-ffff-ffffffffffff`,
  };
}
