// Pure builder for the WhatsApp order message (unit-tested with node:test).
// Today the shop learns about orders from this message, so it carries the
// whole order: products, delivery, fee, total and, once paid, the Bold ref.
import { AMOUNT_MISMATCH_NOTE, DOUBLE_CHARGE_NOTE } from "./payments.confirm.ts";
import type { Fulfillment } from "@/lib/delivery-zones";
import type { PaymentStatus } from "@/lib/types";

export const WHATSAPP_NUMBER = "573027190084";

export interface WhatsAppOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface WhatsAppOrder {
  id: string;
  customer_name: string;
  customer_address: string;
  recipient_phone: string | null;
  notes: string | null;
  total: number;
  fulfillment: Fulfillment;
  delivery_zone: string | null;
  delivery_fee: number;
  payment_status: PaymentStatus;
  bold_payment_id?: string | null;
  /** Bold took money but the order is not marked paid: the shop must check it. */
  payment_review?: boolean;
  order_items: WhatsAppOrderItem[];
}

const INTERNAL_NOTES = [AMOUNT_MISMATCH_NOTE, DOUBLE_CHARGE_NOTE];

/**
 * Notes as the customer wrote them: drops the payment warnings the server
 * appends for the admin (they are for the shop's panel, not the customer).
 * Returns null when nothing is left.
 */
export function customerNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const kept = notes
    .split("\n")
    .filter((line) => !INTERNAL_NOTES.includes(line.trim()))
    .join("\n")
    .trim();
  return kept || null;
}

const money = (n: number) => `$${Number(n).toLocaleString("es-CO")}`;

/** `*Entrega:*` value, in Spanish because the shop reads the message. */
export function fulfillmentLine(fulfillment: Fulfillment, zone: string | null): string {
  if (fulfillment === "pickup") return "Recoger en el local";
  if (fulfillment === "dine_in") return "Comer en el local";
  return zone ? `Domicilio · ${zone}` : "Domicilio";
}

export function buildWhatsAppMessage(order: WhatsAppOrder): string {
  const orderId = order.id.slice(0, 8).toUpperCase();
  const isDelivery = order.fulfillment === "delivery";
  const fee = Number(order.delivery_fee) || 0;
  const notes = customerNotes(order.notes);

  const itemLines = order.order_items
    .map(
      (item) =>
        `  • ${item.product_name} x${item.quantity} — ${money(item.unit_price * item.quantity)}`
    )
    .join("\n");

  const paidLine =
    order.payment_status === "paid"
      ? order.bold_payment_id
        ? `✅ *Pagado en línea* · ref ${order.bold_payment_id}`
        : `✅ *Pagado en línea*`
      : null;

  return [
    `🍪 *Nuevo pedido Crooki*`,
    ``,
    `*Pedido #${orderId}*`,
    ``,
    `*Productos:*`,
    itemLines,
    ``,
    fee > 0
      ? `*Domicilio:* ${money(fee)}`
      : isDelivery && order.delivery_zone
        ? // «Consultar» zones (e.g. outside the city): the fee is agreed over WhatsApp.
          `*Domicilio:* por confirmar`
        : null,
    `*Total: ${money(order.total)}*`,
    paidLine,
    order.payment_status !== "paid" && order.payment_review ? `⚠ *Pago por revisar*` : null,
    ``,
    `*Entrega:* ${fulfillmentLine(order.fulfillment, order.delivery_zone)}`,
    `*Cliente:* ${order.customer_name}`,
    isDelivery && order.customer_address ? `*Dirección:* ${order.customer_address}` : null,
    isDelivery && order.recipient_phone ? `*Tel. destinatario:* ${order.recipient_phone}` : null,
    notes ? `*Notas:* ${notes}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildWhatsAppOrderUrl(order: WhatsAppOrder): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`;
}
