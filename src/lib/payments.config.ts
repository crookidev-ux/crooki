// Pure builder for the config the browser hands to Bold's checkout button.
// The secret key is only used to compute the integrity signature; it is never
// part of the returned object.
import { integritySignature } from "./bold.ts";
import { AMOUNT_MISMATCH_NOTE } from "./payments.confirm.ts";
import type { BoldClientConfig } from "@/lib/bold";

export type BoldConfigInput = {
  orderId: string;
  boldOrderId: string;
  amount: number;
  locale: "es" | "en";
  customer: { name: string; email: string; phone: string };
  siteUrl: string;
  identityKey: string;
  secretKey: string;
};

/**
 * Why an order cannot get a new online payment attempt, or null when it can:
 * only Bold orders that are not paid and not cancelled/delivered. `review`:
 * Bold already took money for it (an approved attempt, or an approval with a
 * different amount flagged in the notes), so another charge could double it.
 */
export function retryBlockReason(
  order: { payment_method: string; payment_status: string; status: string },
  payments: { hasApprovedAttempt?: boolean; amountMismatch?: boolean } = {},
): "not_bold" | "paid" | "closed" | "review" | null {
  if (order.payment_method !== "bold") return "not_bold";
  if (order.payment_status === "paid") return "paid";
  if (order.status === "cancelled" || order.status === "delivered") return "closed";
  if (payments.hasApprovedAttempt || payments.amountMismatch) return "review";
  return null;
}

/**
 * Why an order cannot be switched to «Pagar por QR», or null when it can:
 * exactly the orders that could get a new online attempt (an unpaid Bold
 * order, still open, with no money taken by Bold), so a switch never hides a
 * payment the shop must review.
 */
export function qrSwitchBlockReason(
  order: { payment_method: string; payment_status: string; status: string; notes: string | null },
  hasApprovedAttempt: boolean,
): ReturnType<typeof retryBlockReason> {
  return retryBlockReason(order, {
    hasApprovedAttempt,
    amountMismatch: (order.notes ?? "").includes(AMOUNT_MISMATCH_NOTE),
  });
}

/**
 * Phone for Bold's customerData: digits only, without the Colombian country
 * code when what remains is a 10-digit number (`dialCode` carries the +57).
 */
export function boldCustomerPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("57") ? digits.slice(2) : digits;
}

export function orderDescription(orderId: string): string {
  return `Pedido Crooki #${orderId.slice(0, 8).toUpperCase()}`;
}

export function redirectionUrl(siteUrl: string, locale: "es" | "en", orderId: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${locale === "en" ? "/en" : ""}/pedido/${orderId}`;
}

export function buildBoldClientConfig(input: BoldConfigInput): BoldClientConfig {
  const config: BoldClientConfig = {
    orderId: input.boldOrderId,
    amount: String(input.amount),
    currency: "COP",
    apiKey: input.identityKey,
    integritySignature: integritySignature(input.boldOrderId, input.amount, "COP", input.secretKey),
    description: orderDescription(input.orderId),
    customerData: JSON.stringify({
      email: input.customer.email,
      fullName: input.customer.name,
      phone: boldCustomerPhone(input.customer.phone),
      dialCode: "+57",
    }),
  };
  // Bold rejects non-https redirection URLs (error BTN-001, e.g. localhost),
  // so the key is omitted entirely unless the site is served over https.
  if (input.siteUrl.startsWith("https://")) {
    config.redirectionUrl = redirectionUrl(input.siteUrl, input.locale, input.orderId);
  }
  return config;
}
