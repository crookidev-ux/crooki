// Server-only fallback: asks Bold for the status of one payment attempt when
// the webhook has not arrived yet. Bold says the voucher can take up to ten
// minutes to become available. Uses BOLD_IDENTITY_KEY (never "use client").

export type BoldPaymentStatus =
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "VOIDED"
  | "PROCESSING"
  | "PENDING"
  | "NO_TRANSACTION_FOUND";

export type BoldStatusResult = { status: BoldPaymentStatus; total?: number; transactionId?: string };

const STATUSES: ReadonlySet<string> = new Set<BoldPaymentStatus>([
  "APPROVED",
  "REJECTED",
  "FAILED",
  "VOIDED",
  "PROCESSING",
  "PENDING",
  "NO_TRANSACTION_FOUND",
]);

/** Pure mapping of the `payment-voucher` JSON; null when it is not a known status. */
export function mapBoldStatus(body: unknown): BoldStatusResult | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const status = b.payment_status;
  if (typeof status !== "string" || !STATUSES.has(status)) return null;

  const result: BoldStatusResult = { status: status as BoldPaymentStatus };
  // The voucher carries the amount as a top-level `total` (seen live in test
  // mode); `amount.total` (the webhook's shape) is kept as a fallback.
  const isMoney = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const nested =
    typeof b.amount === "object" && b.amount !== null ? (b.amount as Record<string, unknown>).total : undefined;
  if (isMoney(b.total)) result.total = b.total;
  else if (isMoney(nested)) result.total = nested;
  if (typeof b.transaction_id === "string" && b.transaction_id) result.transactionId = b.transaction_id;
  return result;
}

/** `GET /v2/payment-voucher/{id}`; null on any error (network, timeout, non-2xx, bad JSON). */
export async function fetchBoldStatus(boldOrderId: string): Promise<BoldStatusResult | null> {
  const key = process.env.BOLD_IDENTITY_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://payments.api.bold.co/v2/payment-voucher/${encodeURIComponent(boldOrderId)}`,
      {
        headers: { Authorization: `x-api-key ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      console.error(`[bold-status] ${boldOrderId}: HTTP ${res.status}`);
      return null;
    }
    const mapped = mapBoldStatus(await res.json());
    if (!mapped) console.error(`[bold-status] ${boldOrderId}: unrecognised response`);
    return mapped;
  } catch (e) {
    console.error(`[bold-status] ${boldOrderId}: request failed`, e);
    return null;
  }
}
