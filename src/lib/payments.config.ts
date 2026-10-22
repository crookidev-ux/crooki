// Pure builder for the config the browser hands to Bold's checkout button.
// The secret key is only used to compute the integrity signature; it is never
// part of the returned object.
import { integritySignature } from "./bold.ts";
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

export function orderDescription(orderId: string): string {
  return `Pedido Crooki #${orderId.slice(0, 8).toUpperCase()}`;
}

export function redirectionUrl(siteUrl: string, locale: "es" | "en", orderId: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${locale === "en" ? "/en" : ""}/pedido/${orderId}`;
}

export function buildBoldClientConfig(input: BoldConfigInput): BoldClientConfig {
  return {
    orderId: input.boldOrderId,
    amount: String(input.amount),
    currency: "COP",
    apiKey: input.identityKey,
    integritySignature: integritySignature(input.boldOrderId, input.amount, "COP", input.secretKey),
    description: orderDescription(input.orderId),
    redirectionUrl: redirectionUrl(input.siteUrl, input.locale, input.orderId),
    customerData: JSON.stringify({
      email: input.customer.email,
      fullName: input.customer.name,
      phone: input.customer.phone,
      dialCode: "+57",
    }),
  };
}
