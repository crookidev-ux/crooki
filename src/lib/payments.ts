// Server-only: creates Bold payment attempts. Uses BOLD_SECRET_KEY, so import
// it only from Route Handlers / Server Components, never from "use client".
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBoldConfigured, newBoldOrderId, type BoldClientConfig } from "@/lib/bold";
import { buildBoldClientConfig } from "@/lib/payments.config";

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

  const insert = await supabase
    .from("payment_attempts")
    .insert({ order_id: order.id, bold_order_id: boldOrderId, amount });
  if (insert.error) throw new Error(`createAttempt: insert attempt: ${insert.error.message}`);

  const update = await supabase
    .from("orders")
    .update({ payment_status: "awaiting_payment" })
    .eq("id", order.id)
    .neq("payment_status", "paid");
  if (update.error) throw new Error(`createAttempt: update order: ${update.error.message}`);

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
