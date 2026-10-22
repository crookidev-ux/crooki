// Server-only: emails the shop when an order is paid (spec §7.6 b). Uses
// RESEND_API_KEY, so import it only from server code. Without RESEND_API_KEY or
// ORDER_NOTIFY_EMAIL it does nothing; it never throws.
import type { Fulfillment, Order, OrderItem } from "@/lib/types";

const DEFAULT_FROM = "Crooki <noreply@crookibakebar.com>";

const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  delivery: "Domicilio",
  pickup: "Recoger en tienda",
  dine_in: "Consumir en el local",
};

// Supabase returns `numeric` columns as strings, so money fields accept both.
type Money = number | string;

export type PaidOrderEmailInput = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  notes: string | null;
  total: Money;
  fulfillment: Fulfillment;
  delivery_zone: string | null;
  delivery_fee: Money;
  recipient_phone: string | null;
  order_items: Array<{ product_name: string; quantity: number; unit_price: Money }>;
};

const money = (value: Money) => `$${Math.round(Number(value) || 0).toLocaleString("es-CO")}`;

export function parseRecipients(list: string): string[] {
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pure: subject and plain-text body of the paid-order email (in Spanish, for the shop staff). */
export function buildPaidOrderEmail(
  order: PaidOrderEmailInput,
  boldPaymentId?: string,
): { subject: string; text: string } {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const fulfillment = FULFILLMENT_LABEL[order.fulfillment] ?? order.fulfillment;
  const isDelivery = order.fulfillment === "delivery";

  const items = order.order_items.map(
    (i) => `  - ${i.product_name} x${i.quantity} — ${money(Number(i.unit_price) * i.quantity)}`,
  );

  const lines: Array<string | null> = [
    `Pedido #${shortId} pagado con Bold.`,
    "",
    `Entrega: ${fulfillment}`,
    isDelivery && order.delivery_zone ? `Barrio: ${order.delivery_zone}` : null,
    isDelivery && order.customer_address ? `Dirección: ${order.customer_address}` : null,
    "",
    `Cliente: ${order.customer_name}`,
    `Teléfono del cliente: ${order.customer_phone}`,
    order.recipient_phone ? `Teléfono de quien recibe: ${order.recipient_phone}` : null,
    order.customer_email ? `Correo: ${order.customer_email}` : null,
    "",
    "Productos:",
    ...items,
    "",
    isDelivery ? `Domicilio: ${money(order.delivery_fee)}` : null,
    `Total pagado: ${money(order.total)}`,
    `Ref. Bold: ${boldPaymentId || "(sin referencia)"}`,
    order.notes ? `\nNotas: ${order.notes}` : null,
  ];

  return {
    subject: `Pedido pagado #${shortId} — ${money(order.total)}`,
    text: lines.filter((l) => l !== null).join("\n"),
  };
}

export async function sendPaidOrderEmail(
  order: Order & { order_items: OrderItem[] },
  boldPaymentId?: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = parseRecipients(process.env.ORDER_NOTIFY_EMAIL ?? "");
  if (!apiKey || to.length === 0) return;

  try {
    const { subject, text } = buildPaidOrderEmail(order, boldPaymentId);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.ORDER_NOTIFY_FROM || DEFAULT_FROM, to, subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[notify] Resend HTTP ${res.status} for order ${order.id}: ${await res.text().catch(() => "")}`);
    }
  } catch (e) {
    console.error(`[notify] paid-order email failed for order ${order.id}`, e);
  }
}
