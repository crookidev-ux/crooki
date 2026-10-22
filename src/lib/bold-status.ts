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
  const amount = b.amount;
  if (typeof amount === "object" && amount !== null) {
    const total = (amount as Record<string, unknown>).total;
    if (typeof total === "number" && Number.isFinite(total)) result.total = total;
  }
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
