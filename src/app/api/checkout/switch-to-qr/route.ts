// «Pagar por QR (WhatsApp)» on the order page after a failed online payment:
// moves the order to payment_method 'qr' so the admin no longer shows it as an
// unpaid Bold order («Sin pagar · no preparar»), and returns the WhatsApp link
// the customer sends to the shop. Only open, unpaid Bold orders where Bold
// took no money can switch (the same rule as a payment retry).
import { createServiceClient } from "@/lib/supabase/service";
import { fetchBoldStatus } from "@/lib/bold-status";
import { ConcurrentUpdateError, confirmAttempt } from "@/lib/payments";
import { qrSwitchBlockReason, qrSwitchBoldAction } from "@/lib/payments.config";
import { buildWhatsAppOrderUrl } from "@/lib/whatsapp";
import type { Order, OrderItem } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const error = (status: number, message: string) =>
  Response.json({ error: message }, { status });

type OrderRow = Order & { order_items: OrderItem[] };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return error(400, "body must be an object");
  }
  const { orderId } = body as Record<string, unknown>;
  if (typeof orderId !== "string" || !UUID.test(orderId)) return error(400, "orderId is invalid");

  try {
    const supabase = createServiceClient();
    const { data, error: dbError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    if (dbError) {
      console.error("[checkout/switch-to-qr] load order failed", dbError);
      return error(500, "Could not switch the payment method");
    }
    const order = data as OrderRow | null;
    if (!order) return error(404, "Order not found");

    const approved = await supabase
      .from("payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id)
      .eq("status", "approved");
    if (approved.error) {
      console.error("[checkout/switch-to-qr] load attempts failed", approved.error);
      return error(500, "Could not switch the payment method");
    }
    if (qrSwitchBlockReason(order, (approved.count ?? 0) > 0)) {
      return error(409, "This order cannot switch to QR payment");
    }

    // The latest attempt may still be open in Bold (late webhook): ask Bold
    // first, so a payment that went through is never hidden behind a switch.
    const latest = await supabase
      .from("payment_attempts")
      .select("bold_order_id, status")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) {
      console.error("[checkout/switch-to-qr] load latest attempt failed", latest.error);
      return error(500, "Could not switch the payment method");
    }
    const attempt = latest.data as { bold_order_id: string; status: string } | null;
    if (attempt?.status === "created") {
      const status = await fetchBoldStatus(attempt.bold_order_id);
      const action = qrSwitchBoldAction(status?.status);
      if (action === "confirm_approved") {
        await confirmAttempt(supabase, attempt.bold_order_id, {
          kind: "approved",
          amount: status?.total,
          paymentId: status?.transactionId,
        });
        return error(409, "This order was already paid online");
      }
      if (action === "in_progress") return error(409, "An online payment is still in progress");
      if (action === "confirm_rejected") {
        await confirmAttempt(supabase, attempt.bold_order_id, { kind: "rejected" });
      }
    }

    // Guarded write: a webhook may mark it paid between the read and here.
    const updated = await supabase
      .from("orders")
      .update({ payment_method: "qr", payment_status: "unpaid" })
      .eq("id", order.id)
      .eq("payment_method", "bold")
      .neq("payment_status", "paid")
      .not("status", "in", "(cancelled,delivered)")
      .select("id");
    if (updated.error) {
      console.error("[checkout/switch-to-qr] update failed", updated.error);
      return error(500, "Could not switch the payment method");
    }
    if (!updated.data || updated.data.length === 0) {
      return error(409, "This order cannot switch to QR payment");
    }

    // Close the attempts still open in Bold: a late approval on one of them
    // then lands on a rejected attempt of a QR order, which confirmAttempt
    // flags for review instead of marking the order paid.
    const closed = await supabase
      .from("payment_attempts")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("order_id", order.id)
      .eq("status", "created");
    if (closed.error) {
      // Not fatal: the order is already QR, and approvals on QR orders are flagged anyway.
      console.error("[checkout/switch-to-qr] close open attempts failed", closed.error);
    }

    const whatsappUrl = buildWhatsAppOrderUrl({
      ...order,
      payment_status: "unpaid",
      total: Number(order.total),
      delivery_fee: Number(order.delivery_fee) || 0,
      bold_payment_id: null,
      payment_review: false,
    });
    return Response.json({ whatsappUrl });
  } catch (e) {
    // The attempt changed while we confirmed it (e.g. a webhook): let the page refresh.
    if (e instanceof ConcurrentUpdateError) return error(409, "The payment changed; reload the order");
    console.error("[checkout/switch-to-qr] unexpected error", e);
    return error(500, "Could not switch the payment method");
  }
}
