import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CheckoutClient from "@/components/order/CheckoutClient";

// Checkout and order pages are private: keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <CheckoutClient locale={locale} />;
}
