// Server-only: creates Bold payment attempts. Uses BOLD_SECRET_KEY, so import
// it only from Route Handlers / Server Components, never from "use client".
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBoldConfigured, newBoldOrderId, type BoldClientConfig } from "@/lib/bold";
import { buildBoldClientConfig } from "@/lib/payments.config";
import {
  AMOUNT_MISMATCH_NOTE,
  decideConfirmation,
  DOUBLE_CHARGE_NOTE,
  withNote,
} from "@/lib/payments.confirm";
import { sendPaidOrderEmail } from "@/lib/notify";
import { after } from "next/server";
import type { Order, OrderItem } from "@/lib/types";

/** The order is already paid, cancelled or delivered (or gone): no payment may be opened. Routes map it to 409. */
export class OrderNotPayableError extends Error {
  constructor(orderId: string) {
    super(`createAttempt: order ${orderId} cannot be paid`);
    this.name = "OrderNotPayableError";
  }
}

export type AttemptOrder = {
  id: string;
  total: number;
  locale: "es" | "en";
  customer: { name: string; email: string; phone: string };
};

/**
 * Inserts a `payment_attempts` row, marks the order `awaiting_payment` and
 * returns the signed config for Bold's checkout. `siteUrl` falls back to
 * NEXT_PUBLIC_SITE_URL; callers pass the request origin when it is missing.
 */
export async function createAttempt(
  supabase: SupabaseClient,
  order: AttemptOrder,
  siteUrl?: string,
): Promise<BoldClientConfig> {
  if (!isBoldConfigured()) throw new Error("createAttempt: Bold is not configured");
  const base = process.env.NEXT_PUBLIC_SITE_URL || siteUrl;
  if (!base) throw new Error("createAttempt: no site URL");

  const amount = Math.round(order.total);
  const boldOrderId = newBoldOrderId(order.id);

  // Mark the order first, guarded so a paid / cancelled / delivered order is
  // never touched; only when a row matched is an attempt recorded and signed.
  const update = await supabase
    .from("orders")
    .update({ payment_status: "awaiting_payment" })
    .eq("id", order.id)
    .neq("payment_status", "paid")
    .not("status", "in", "(cancelled,delivered)")
    .select("id");
  if (update.error) throw new Error(`createAttempt: update order: ${update.error.message}`);
  if (!update.data || update.data.length === 0) throw new OrderNotPayableError(order.id);

  const insert = await supabase
    .from("payment_attempts")
    .insert({ order_id: order.id, bold_order_id: boldOrderId, amount });
  if (insert.error) throw new Error(`createAttempt: insert attempt: ${insert.error.message}`);

  return buildBoldClientConfig({
    orderId: order.id,
    boldOrderId,
    amount,
    locale: order.locale,
    customer: order.customer,
    siteUrl: base,
    identityKey: process.env.BOLD_IDENTITY_KEY!,
    secretKey: process.env.BOLD_SECRET_KEY!,
  });
}

export { AMOUNT_MISMATCH_NOTE, DOUBLE_CHARGE_NOTE };

export type ConfirmEvent = { kind: "approved" | "rejected"; amount?: number; paymentId?: string };

/**
 * Appends `note` to `orders.notes` once. Compare-and-swap on the notes read, so
 * a concurrent edit is never overwritten; a few retries cover a lost race.
 * Throws on DB errors so the webhook answers 500 and Bold retries the flag.
 */
async function appendOrderNote(supabase: SupabaseClient, orderId: string, note: string): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const read = await supabase.from("orders").select("notes").eq("id", orderId).maybeSingle();
    if (read.error) throw new Error(`appendOrderNote ${orderId}: read: ${read.error.message}`);
    if (!read.data) return;
    const current = (read.data as { notes: string | null }).notes;
    const next = withNote(current, note);
    if (next === null) return;
    const base = supabase.from("orders").update({ notes: next }).eq("id", orderId);
    const upd = await (current === null ? base.is("notes", null) : base.eq("notes", current)).select("id");
    if (upd.error) throw new Error(`appendOrderNote ${orderId}: update: ${upd.error.message}`);
    if (upd.data && upd.data.length > 0) return;
  }
  throw new Error(`appendOrderNote ${orderId}: notes kept changing`);
}

async function countApprovedAttempts(supabase: SupabaseClient, orderId: string): Promise<number> {
  const res = await supabase
    .from("payment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("status", "approved");
  if (res.error) throw new Error(`countApprovedAttempts ${orderId}: ${res.error.message}`);
  return res.count ?? 0;
}

/**
 * The ONLY code path that marks an order as paid (webhook and order-page
 * fallback both call it). Applies `decideConfirmation`; safe to repeat for the
 * same event. Every status write is conditional on the state that was read,
 * so two racing deliveries cannot both win: the paid-order email goes out only
 * from the call whose update actually flipped the order to paid. A double
 * charge is derived from the DB (more than one approved attempt), so it is
 * flagged even under races and re-flagged on retry if the note write failed.
 * Throws on DB errors so the webhook answers 500 and Bold retries. An unknown
 * `boldOrderId` is logged and ignored.
 *
 * Must run inside a request scope (Route Handler / Server Component), because
 * the email is scheduled with next/server `after()`.
 */
export async function confirmAttempt(
  supabase: SupabaseClient,
  boldOrderId: string,
  event: ConfirmEvent,
): Promise<void> {
  const tag = `[confirmAttempt] ${boldOrderId}`;

  const attemptRes = await supabase
    .from("payment_attempts")
    .select("id, order_id, amount, status, bold_payment_id")
    .eq("bold_order_id", boldOrderId)
    .maybeSingle();
  if (attemptRes.error) throw new Error(`${tag}: load attempt: ${attemptRes.error.message}`);
  const attempt = attemptRes.data as
    | { id: string; order_id: string; amount: number | string; status: string; bold_payment_id: string | null }
    | null;
  if (!attempt) {
    console.warn(`${tag}: no payment attempt with this reference (${event.kind}); ignored`);
    return;
  }

  const orderRes = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("id", attempt.order_id)
    .maybeSingle();
  if (orderRes.error) throw new Error(`${tag}: load order: ${orderRes.error.message}`);
  const order = orderRes.data as { id: string; payment_status: string } | null;
  if (!order) {
    console.error(`${tag}: order ${attempt.order_id} not found; ignored`);
    return;
  }

  const amount = Number(attempt.amount);
  const decision = decideConfirmation({ status: attempt.status, amount }, order, event);
  const now = new Date().toISOString();

  if (event.kind === "approved" && event.amount === undefined) {
    console.error(`${tag}: approval without an amount; order not marked paid`);
  }
  if (decision.amountMismatch) {
    console.error(`${tag}: amount mismatch (Bold ${event.amount}, attempt ${amount}); order not marked paid`);
    await appendOrderNote(supabase, order.id, AMOUNT_MISMATCH_NOTE);
  }

  if (decision.attempt !== "unchanged") {
    const patch: Record<string, string> = { status: decision.attempt, updated_at: now };
    if (event.paymentId) patch.bold_payment_id = event.paymentId;
    const upd = await supabase
      .from("payment_attempts")
      .update(patch)
      .eq("id", attempt.id)
      .eq("status", attempt.status)
      .select("id");
    if (upd.error) throw new Error(`${tag}: update attempt: ${upd.error.message}`);
    if (!upd.data || upd.data.length === 0) {
      // Another delivery of this same event changed the attempt first; it owns the rest
      // (if it fails, Bold retries and the replay re-checks everything from the DB).
      console.warn(`${tag}: attempt changed concurrently; skipped`);
      return;
    }
  }

  let checkDouble = decision.checkDoubleCharge;

  if (decision.order === "paid") {
    const upd = await supabase
      .from("orders")
      .update({ payment_status: "paid", paid_at: now })
      .eq("id", order.id)
      .neq("payment_status", "paid")
      .select("id");
    if (upd.error) throw new Error(`${tag}: mark order paid: ${upd.error.message}`);
    const flipped = Boolean(upd.data && upd.data.length > 0);
    if (flipped && decision.notify) {
      const paymentId = event.paymentId ?? attempt.bold_payment_id ?? undefined;
      // after() needs a request scope (see the doc comment above). It runs once
      // the response is sent, so the webhook answers Bold quickly; never throws.
      after(() => notifyPaid(supabase, order.id, paymentId));
    }
    // Someone else paid the order between our read and our write: maybe another attempt.
    if (!flipped) checkDouble = true;
  } else if (decision.order === "rejected") {
    const upd = await supabase
      .from("orders")
      .update({ payment_status: "rejected" })
      .eq("id", order.id)
      .neq("payment_status", "paid");
    if (upd.error) throw new Error(`${tag}: mark order rejected: ${upd.error.message}`);
  }

  let doubleCharge = decision.doubleCharge;
  if (!doubleCharge && checkDouble) {
    doubleCharge = (await countApprovedAttempts(supabase, order.id)) > 1;
  }
  if (doubleCharge) {
    console.error(
      `${tag}: POSSIBLE DOUBLE CHARGE — order ${order.id} has more than one approved payment; Bold payment ${event.paymentId ?? "?"}`,
    );
    await appendOrderNote(supabase, order.id, DOUBLE_CHARGE_NOTE);
  }
}

async function notifyPaid(supabase: SupabaseClient, orderId: string, paymentId?: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !data) {
      console.error(`[notify] could not load order ${orderId} for the email`, error);
      return;
    }
    await sendPaidOrderEmail(data as Order & { order_items: OrderItem[] }, paymentId);
  } catch (e) {
    console.error(`[notify] paid-order email failed for order ${orderId}`, e);
  }
}
