import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const BOLD_MIN_AMOUNT = 1000;

export type BoldClientConfig = {
  orderId: string;
  amount: string;
  currency: "COP";
  apiKey: string;
  integritySignature: string;
  description: string;
  redirectionUrl: string;
  customerData: string;
};

export function integritySignature(
  boldOrderId: string,
  amount: number,
  currency: "COP",
  secret: string,
): string {
  return createHash("sha256")
    .update(`${boldOrderId}${amount}${currency}${secret}`)
    .digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const encoded = Buffer.from(rawBody, "utf8").toString("base64");
  const expected = createHmac("sha256", secret).update(encoded).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** "CRK-{first 8 of order id}-{time base36}-{4 random base36}"; the random part keeps two attempts in the same millisecond unique. */
export function newBoldOrderId(orderId: string, now: number = Date.now()): string {
  const rand = randomInt(0, 36 ** 4).toString(36).padStart(4, "0").toUpperCase();
  return `CRK-${orderId.slice(0, 8).toUpperCase()}-${now.toString(36).toUpperCase()}-${rand}`;
}

export function isBoldConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.BOLD_IDENTITY_KEY) && Boolean(env.BOLD_SECRET_KEY);
}
