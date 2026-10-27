// Server-only fallback for a late or lost Bold webhook: asks Bold about the
// latest attempt of one order and confirms it through confirmAttempt (the only
// writer of «paid»). Used by the order page and by the admin dashboard, so a
// paid order shows up and the shop email goes out even without the webhook.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBoldStatus } from "@/lib/bold-status";
import { ConcurrentUpdateError, confirmAttempt } from "@/lib/payments";

/**
 * - `changed`: Bold gave a final answer (approved / rejected) and it was applied.
 * - `pending`: Bold says the payment is still in progress, or another writer
 *   changed the attempt meanwhile; never offer a second charge.
 * - `unchanged`: nothing to do, Bold did not answer, or it found no payment.
 */
export type ReconcileResult = "changed" | "pending" | "unchanged";

/** Must run inside a request scope: confirmAttempt schedules the email with `after()`. */
export async function reconcileBoldOrder(supabase: SupabaseClient, orderId: string): Promise<ReconcileResult> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("bold_order_id, status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[reconcile] load attempt for order ${orderId}`, error);
    return "unchanged";
  }
  const latest = data as { bold_order_id: string; status: string } | null;
  // Only an attempt still `created` can change; final ones need no Bold call.
  if (!latest || latest.status !== "created") return "unchanged";

  try {
    const status = await fetchBoldStatus(latest.bold_order_id);
    if (status?.status === "APPROVED") {
      // Bold's reported amount, so the amount check in confirmAttempt is meaningful.
      await confirmAttempt(supabase, latest.bold_order_id, {
        kind: "approved",
        amount: status.total,
        paymentId: status.transactionId,
      });
      return "changed";
    }
    if (status?.status === "REJECTED" || status?.status === "FAILED") {
      await confirmAttempt(supabase, latest.bold_order_id, { kind: "rejected" });
      return "changed";
    }
    if (status?.status === "PENDING" || status?.status === "PROCESSING") return "pending";
    return "unchanged";
  } catch (e) {
    if (e instanceof ConcurrentUpdateError) return "pending";
    console.error(`[reconcile] payment status fallback failed for order ${orderId}`, e);
    return "unchanged";
  }
}

/** Orders younger than this are re-checked with Bold when the admin opens the dashboard. */
export const ADMIN_RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Cap per dashboard load: each check is one Bold request (5 s timeout, run in parallel). */
export const ADMIN_RECONCILE_LIMIT = 10;

/** Re-checks recent unpaid Bold orders; returns how many changed. Never throws. */
export async function reconcileRecentBoldOrders(supabase: SupabaseClient, now: number = Date.now()): Promise<number> {
  const since = new Date(now - ADMIN_RECONCILE_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_method", "bold")
    .eq("payment_status", "awaiting_payment")
    .not("status", "in", "(cancelled,delivered)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(ADMIN_RECONCILE_LIMIT);
  if (error) {
    console.error("[reconcile] list recent unpaid Bold orders", error);
    return 0;
  }
  const ids = ((data as { id: string }[] | null) ?? []).map((o) => o.id);
  const results = await Promise.all(ids.map((id) => reconcileBoldOrder(supabase, id)));
  return results.filter((r) => r === "changed").length;
}
