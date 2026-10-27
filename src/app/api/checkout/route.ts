import { createServiceClient } from "@/lib/supabase/service";
import { BOLD_MIN_AMOUNT, isBoldConfigured, type BoldClientConfig } from "@/lib/bold";
import { parseCheckoutInput } from "@/lib/checkout/schema";
import { loadCatalog } from "@/lib/checkout/catalog";
import { priceCart } from "@/lib/checkout/price-cart";
import {
  buildOrderItems,
  buildOrderPayload,
  buildWhatsAppOrder,
} from "@/lib/checkout/order-payload";
import { createAttempt, OrderNotPayableError } from "@/lib/payments";
import { buildWhatsAppOrderUrl } from "@/lib/whatsapp";
import { sendCustomerOrderEmail } from "@/lib/notify";
import { after } from "next/server";

type CheckoutResponse = {
  orderId: string;
  total: number;
  whatsappUrl?: string;
  bold?: BoldClientConfig;
};

const error = (status: number, message: string, unavailable?: string[]) =>
  Response.json(unavailable ? { error: message, unavailable } : { error: message }, { status });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "Invalid JSON body");
  }

  const parsed = parseCheckoutInput(body);
  if (!parsed.ok) return error(400, parsed.error);
  const input = parsed.value;

  if (input.paymentMethod === "bold" && !isBoldConfigured()) {
    return error(503, "Online payment is not available right now");
  }

  try {
    const supabase = createServiceClient();
    const catalog = await loadCatalog(
      supabase,
      input.items.map((i) => i.productId),
    );
    const priced = priceCart(input, catalog);
    if (!priced.ok) return error(priced.status, priced.error, priced.unavailable);

    if (input.paymentMethod === "bold" && priced.total < BOLD_MIN_AMOUNT) {
      return error(400, `Online payment requires a total of at least ${BOLD_MIN_AMOUNT} COP`);
    }

    const payload = buildOrderPayload(input, priced);
    const { data: orderId, error: rpcError } = await supabase.rpc("create_order_v2", {
      p_order: payload,
      p_items: buildOrderItems(priced.lines),
    });
    if (rpcError || typeof orderId !== "string") {
      console.error("[checkout] create_order_v2 failed", rpcError ?? { orderId });
      return error(500, "Could not create the order");
    }

    const response: CheckoutResponse = { orderId, total: priced.total };
    if (input.paymentMethod === "qr") {
      response.whatsappUrl = buildWhatsAppOrderUrl(
        buildWhatsAppOrder(orderId, payload, priced.lines),
      );
      // After the response, so the customer is not kept waiting; never throws.
      after(() =>
        sendCustomerOrderEmail(
          { id: orderId, customer_name: payload.customer_name, customer_email: payload.customer_email, total: priced.total },
          "received",
        ),
      );
    } else {
      // The order exists from here on: on failure return its id so the client
      // calls /api/checkout/retry instead of submitting a duplicate order.
      try {
        response.bold = await createAttempt(
          supabase,
          { id: orderId, total: priced.total, locale: input.locale, customer: input.customer },
          new URL(request.url).origin,
        );
      } catch (e) {
        if (e instanceof OrderNotPayableError) {
          return Response.json({ error: "This order cannot be paid online", orderId }, { status: 409 });
        }
        console.error("[checkout] createAttempt failed", e);
        return Response.json({ error: "Could not start the payment", orderId }, { status: 500 });
      }
    }
    return Response.json(response);
  } catch (e) {
    console.error("[checkout] unexpected error", e);
    return error(500, "Could not create the order");
  }
}
