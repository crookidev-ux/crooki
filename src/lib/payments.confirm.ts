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
 * - order no longer paid online (the customer switched it to QR): an approval
 *   is recorded on the attempt but never marks the order paid; it is flagged
 *   for review (`doubleCharge` note), since the customer may have paid by QR
 *   too. A rejection only updates the attempt.
 */
export function decideConfirmation(
  attempt: { status: string; amount: number },
  order: { payment_status: string; payment_method?: string },
  event: ConfirmationEvent,
): ConfirmationDecision {
  const orderPaid = order.payment_status === "paid";
  const switchedOffline = order.payment_method !== undefined && order.payment_method !== "bold";

  if (event.kind === "approved") {
    if (event.amount === undefined) return NOTHING;
    if (event.amount !== attempt.amount) return { ...NOTHING, amountMismatch: true };
    if (switchedOffline) {
      return {
        ...NOTHING,
        attempt: attempt.status === "approved" ? "unchanged" : "approved",
        doubleCharge: true,
      };
    }
    if (attempt.status === "approved") {
      return orderPaid
        ? { ...NOTHING, checkDoubleCharge: true }
        : { ...NOTHING, order: "paid", notify: true };
    }
    if (orderPaid) return { ...NOTHING, attempt: "approved", doubleCharge: true };
    return { ...NOTHING, attempt: "approved", order: "paid", notify: true };
  }

  if (attempt.status === "approved") return NOTHING;
  if (switchedOffline) {
    return { ...NOTHING, attempt: attempt.status === "rejected" ? "unchanged" : "rejected" };
  }
  return {
    ...NOTHING,
    attempt: attempt.status === "rejected" ? "unchanged" : "rejected",
    order: orderPaid || order.payment_status === "rejected" ? "unchanged" : "rejected",
  };
}

/**
 * After the guarded paid write (Bold orders only, not already paid) matched no
 * row, given the order as re-read: it was switched off online payment (QR)
 * meanwhile → flag it for review; still a Bold order (someone else paid it) →
 * count approved attempts for a double charge; gone → nothing.
 */
export function afterLostPaidWrite(
  order: { payment_method: string } | null,
): "flag_switched" | "check_double_charge" | "none" {
  if (!order) return "none";
  return order.payment_method === "bold" ? "check_double_charge" : "flag_switched";
}

export const DOUBLE_CHARGE_NOTE = "⚠ Posible cobro doble: revisar en Bold";
export const AMOUNT_MISMATCH_NOTE = "⚠ Monto distinto: revisar en Bold";

/**
 * Whether `notes` carries the system `note` as a line of its own (exact match
 * after trim). A mention inside a longer line, e.g. typed by a customer, does not count.
 */
export function hasSystemNote(notes: string | null | undefined, note: string): boolean {
  if (!notes) return false;
  return notes.split("\n").some((line) => line.trim() === note);
}

/** `notes` with `note` appended on its own line, or null when it is already there. */
export function withNote(notes: string | null, note: string): string | null {
  const current = notes ?? "";
  if (hasSystemNote(current, note)) return null;
  return current ? `${current}\n${note}` : note;
}
