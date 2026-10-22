// Pure builders for the checkout route: turn the validated input plus the
// server-computed prices into the `create_order_v2` payload and the WhatsApp
// order. No I/O here, so it is unit-tested with node:test.
import { OUTSIDE_CITY_ZONE_ID } from "../delivery-zones.ts";
import type { CheckoutInput } from "@/lib/checkout/schema";
import type { PricedLine } from "@/lib/checkout/price-cart";
import type { DeliveryZone, Fulfillment } from "@/lib/delivery-zones";
import type { WhatsAppOrder } from "@/lib/whatsapp";

export type PricedCart = {
  lines: PricedLine[];
  deliveryFee: number;
  total: number;
  zone?: DeliveryZone;
};

export type OrderPayload = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  notes: string;
  total: number;
  fulfillment: Fulfillment;
  delivery_zone: string | null;
  delivery_fee: number;
  recipient_phone: string | null;
  payment_method: "bold" | "qr";
  payment_status: "unpaid";
};

/** Delivery address as stored: "" when not delivered, "{city} · {address}" outside the city. */
export function orderAddress(input: CheckoutInput): string {
  if (input.fulfillment !== "delivery" || !input.delivery) return "";
  const { zoneId, address, city } = input.delivery;
  if (zoneId === OUTSIDE_CITY_ZONE_ID && city) return `${city} · ${address}`;
  return address;
}

export function buildOrderPayload(input: CheckoutInput, priced: PricedCart): OrderPayload {
  const isDelivery = input.fulfillment === "delivery";
  return {
    customer_name: input.customer.name,
    customer_email: input.customer.email,
    customer_phone: input.customer.phone,
    customer_address: orderAddress(input),
    notes: input.notes,
    total: priced.total,
    fulfillment: input.fulfillment,
    delivery_zone: isDelivery && priced.zone ? priced.zone.name : null,
    delivery_fee: priced.deliveryFee,
    recipient_phone: isDelivery && input.delivery ? input.delivery.recipientPhone : null,
    payment_method: input.paymentMethod,
    // Always created unpaid; createAttempt moves Bold orders to awaiting_payment.
    payment_status: "unpaid",
  };
}

export function buildOrderItems(lines: PricedLine[]): PricedLine[] {
  return lines.map((l) => ({
    product_id: l.product_id,
    product_name: l.product_name,
    quantity: l.quantity,
    unit_price: l.unit_price,
  }));
}

/** Order shape for the current `buildWhatsAppOrderUrl` (Task 9 widens it). */
export function buildWhatsAppOrder(
  orderId: string,
  payload: OrderPayload,
  lines: PricedLine[],
): WhatsAppOrder {
  return {
    id: orderId,
    customer_name: payload.customer_name,
    customer_address: payload.customer_address,
    recipient_phone: payload.recipient_phone ?? payload.customer_phone,
    notes: payload.notes || null,
    total: payload.total,
    order_items: lines.map((l) => ({
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
    })),
  };
}
