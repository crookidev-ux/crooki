import { createAdminClient } from "@/lib/supabase/server";
import { BOLD_MIN_AMOUNT, isBoldConfigured } from "@/lib/bold";
import { createAttempt, OrderNotPayableError } from "@/lib/payments";
import { retryBlockReason } from "@/lib/payments.config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const error = (status: number, message: string) =>
  Response.json({ error: message }, { status });

type OrderRow = {
  id: string;
  total: number | string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_method: string;
  payment_status: string;
  status: string;
};

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
  const { orderId, locale: rawLocale } = body as Record<string, unknown>;
  if (typeof orderId !== "string" || !UUID.test(orderId)) return error(400, "orderId is invalid");
  if (rawLocale !== undefined && rawLocale !== "es" && rawLocale !== "en") {
    return error(400, "locale is invalid");
  }
  const locale: "es" | "en" = rawLocale === "en" ? "en" : "es";

  if (!isBoldConfigured()) return error(503, "Online payment is not available right now");

  try {
    const supabase = await createAdminClient();
    const { data, error: dbError } = await supabase
      .from("orders")
      .select("id, total, customer_name, customer_email, customer_phone, payment_method, payment_status, status")
      .eq("id", orderId)
      .maybeSingle();
    if (dbError) {
      console.error("[checkout/retry] load order failed", dbError);
      return error(500, "Could not start the payment");
    }
    const order = data as OrderRow | null;
    if (!order) return error(404, "Order not found");
    if (retryBlockReason(order)) return error(409, "This order cannot be paid online");

    const total = Math.round(Number(order.total));
    if (!Number.isFinite(total) || total < BOLD_MIN_AMOUNT) {
      return error(400, `Online payment requires a total of at least ${BOLD_MIN_AMOUNT} COP`);
    }

    const bold = await createAttempt(
      supabase,
      {
        id: order.id,
        total,
        locale,
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
        },
      },
      new URL(request.url).origin,
    );
    return Response.json({ bold });
  } catch (e) {
    // Paid / cancelled / delivered between the read above and the guarded update.
    if (e instanceof OrderNotPayableError) return error(409, "This order cannot be paid online");
    console.error("[checkout/retry] unexpected error", e);
    return error(500, "Could not start the payment");
  }
}
