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

export type CustomerEmailKind = "received" | "paid";

export type CustomerOrderEmailInput = { id: string; customer_name: string; total: Money };

// Same as SITE_URL in @/lib/seo (not imported: node:test cannot resolve the alias).
const ORDER_PAGE_BASE = "https://www.crookibakebar.com/pedido/";

/**
 * Pure: the customer's email with the link back to their order page. Orders
 * do not store the checkout language, so it is bilingual (Spanish first).
 * «received» = QR order placed; «paid» = Bold payment confirmed.
 */
export function buildCustomerOrderEmail(
  order: CustomerOrderEmailInput,
  kind: CustomerEmailKind,
): { subject: string; text: string } {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const url = `${ORDER_PAGE_BASE}${order.id}`;
  const name = order.customer_name.trim().split(/\s+/)[0] || "";
  const total = money(order.total);

  const es =
    kind === "paid"
      ? [`¡Hola${name ? ` ${name}` : ""}! Recibimos tu pago de ${total} para el pedido #${shortId}.`, "Si aún no lo hiciste, envíanos el comprobante por WhatsApp para empezar a prepararlo."]
      : [
          `¡Hola${name ? ` ${name}` : ""}! Recibimos tu pedido #${shortId} por ${total}.`,
          "Si aún no lo has hecho, paga con el QR y envíanos el comprobante por WhatsApp.",
        ];
  const en =
    kind === "paid"
      ? [`Hi${name ? ` ${name}` : ""}! We received your ${total} payment for order #${shortId}.`, "If you haven't yet, send us the receipt on WhatsApp so we can start preparing it."]
      : [
          `Hi${name ? ` ${name}` : ""}! We received your order #${shortId} for ${total}.`,
          "If you haven't yet, pay with the QR code and send us the receipt on WhatsApp.",
        ];

  return {
    subject:
      kind === "paid"
        ? `Pago recibido · Pedido #${shortId} — Crooki`
        : `Pedido recibido #${shortId} — Crooki`,
    text: [
      ...es,
      "",
      `Mira el estado de tu pedido aquí: ${url}`,
      `También puedes buscarlo en «Mi pedido» con el número #${shortId} y tu teléfono.`,
      "",
      "—",
      "",
      ...en,
      "",
      `Check your order status here: ${url}`,
      `You can also find it in “My order” with number #${shortId} and your phone.`,
      "",
      "Crooki Bake Bar · Calle 36 # 5-70, Centro Histórico, Cartagena · WhatsApp +57 302 719 0084",
    ].join("\n"),
  };
}

/** Emails the customer the link to their order. Does nothing without RESEND_API_KEY or an email; never throws. */
export async function sendCustomerOrderEmail(
  order: CustomerOrderEmailInput & { customer_email: string | null },
  kind: CustomerEmailKind,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = order.customer_email?.trim();
  if (!apiKey || !to) return;

  try {
    const { subject, text } = buildCustomerOrderEmail(order, kind);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.ORDER_NOTIFY_FROM || DEFAULT_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[notify] customer email HTTP ${res.status} for order ${order.id}: ${await res.text().catch(() => "")}`);
    }
  } catch (e) {
    console.error(`[notify] customer email failed for order ${order.id}`, e);
  }
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
