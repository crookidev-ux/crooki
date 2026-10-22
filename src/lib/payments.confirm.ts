// Pure decision for a Bold payment event. `confirmAttempt` (payments.ts) is the
// only caller that writes; it applies exactly what this returns, so every rule
// about when an order becomes paid lives here and is unit-tested.

export type ConfirmationEvent = { kind: "approved" | "rejected"; amount?: number };

export type ConfirmationDecision = {
  attempt: "approved" | "rejected" | "unchanged";
  order: "paid" | "rejected" | "unchanged";
  notify: boolean;
  /** Known from the state read: this approval lands on an order another attempt already paid. */
  doubleCharge: boolean;
  /**
   * Replay of an approval on an already-paid order: the caller counts the
   * approved attempts in the DB and flags when there is more than one. (The
   * caller also does this whenever its paid-write flips no row.)
   */
  checkDoubleCharge: boolean;
  /** Bold reported a different amount: flag the order for review, never mark it paid. */
  amountMismatch: boolean;
};

const NOTHING: ConfirmationDecision = {
  attempt: "unchanged",
  order: "unchanged",
  notify: false,
  doubleCharge: false,
  checkDoubleCharge: false,
  amountMismatch: false,
};

/**
 * - approved + amount missing → nothing (only logged); amount different → nothing but `amountMismatch`.
 * - approved + order already paid by another attempt → attempt approved, `doubleCharge`.
 * - approved + this attempt already approved → no writes; if the order is paid, `checkDoubleCharge`;
 *   if it is not (the order write was lost), the order is paid now, so a retry repairs a partial failure.
 * - approved otherwise → attempt approved, order paid, notify.
 * - rejected never touches a paid order nor an approved attempt.
 */
export function decideConfirmation(
  attempt: { status: string; amount: number },
  order: { payment_status: string },
  event: ConfirmationEvent,
): ConfirmationDecision {
  const orderPaid = order.payment_status === "paid";

  if (event.kind === "approved") {
    if (event.amount === undefined) return NOTHING;
    if (event.amount !== attempt.amount) return { ...NOTHING, amountMismatch: true };
    if (attempt.status === "approved") {
      return orderPaid
        ? { ...NOTHING, checkDoubleCharge: true }
        : { ...NOTHING, order: "paid", notify: true };
    }
    if (orderPaid) return { ...NOTHING, attempt: "approved", doubleCharge: true };
    return { ...NOTHING, attempt: "approved", order: "paid", notify: true };
  }

  if (attempt.status === "approved") return NOTHING;
  return {
    ...NOTHING,
    attempt: attempt.status === "rejected" ? "unchanged" : "rejected",
    order: orderPaid || order.payment_status === "rejected" ? "unchanged" : "rejected",
  };
}

export const DOUBLE_CHARGE_NOTE = "⚠ Posible cobro doble: revisar en Bold";
export const AMOUNT_MISMATCH_NOTE = "⚠ Monto distinto: revisar en Bold";

/** `notes` with `note` appended on its own line, or null when it is already there. */
export function withNote(notes: string | null, note: string): string | null {
  const current = notes ?? "";
  if (current.includes(note)) return null;
  return current ? `${current}\n${note}` : note;
}
