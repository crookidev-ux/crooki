// «Pagar por QR (WhatsApp)» on the order page after a failed online payment:
// moves the order to payment_method 'qr' so the admin no longer shows it as an
// unpaid Bold order («Sin pagar · no preparar»), and returns the WhatsApp link
// the customer sends to the shop. Only open, unpaid Bold orders where Bold
// took no money can switch (the same rule as a payment retry).
import { createServiceClient } from "@/lib/supabase/service";
import { qrSwitchBlockReason } from "@/lib/payments.config";
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
    console.error("[checkout/switch-to-qr] unexpected error", e);
    return error(500, "Could not switch the payment method");
  }
}
