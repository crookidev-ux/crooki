// Pure decision for a Bold payment event. `confirmAttempt` (payments.ts) is the
// only caller that writes; it applies exactly what this returns, so every rule
// about when an order becomes paid lives here and is unit-tested.

export type ConfirmationEvent = { kind: "approved" | "rejected"; amount?: number };

export type ConfirmationDecision = {
  attempt: "approved" | "rejected" | "unchanged";
  order: "paid" | "rejected" | "unchanged";
  notify: boolean;
  doubleCharge: boolean;
};

const NOTHING: ConfirmationDecision = {
  attempt: "unchanged",
  order: "unchanged",
  notify: false,
  doubleCharge: false,
};

/**
 * - approved + amount equal to the attempt + order not paid → attempt approved, order paid, notify.
 * - approved + amount missing or different → nothing (logged by the caller).
 * - approved + order already paid by another attempt → attempt approved, possible double charge.
 * - approved + this attempt already approved → nothing, unless the order write was lost
 *   (order not paid yet): then the order is paid now, so a retry repairs a partial failure.
 * - rejected never touches a paid order nor an approved attempt.
 */
export function decideConfirmation(
  attempt: { status: string; amount: number },
  order: { payment_status: string },
  event: ConfirmationEvent,
): ConfirmationDecision {
  const orderPaid = order.payment_status === "paid";

  if (event.kind === "approved") {
    if (event.amount === undefined || event.amount !== attempt.amount) return NOTHING;
    if (attempt.status === "approved") {
      return orderPaid ? NOTHING : { ...NOTHING, order: "paid", notify: true };
    }
    if (orderPaid) return { ...NOTHING, attempt: "approved", doubleCharge: true };
    return { attempt: "approved", order: "paid", notify: true, doubleCharge: false };
  }

  if (attempt.status === "approved") return NOTHING;
  return {
    ...NOTHING,
    attempt: attempt.status === "rejected" ? "unchanged" : "rejected",
    order: orderPaid || order.payment_status === "rejected" ? "unchanged" : "rejected",
  };
}
