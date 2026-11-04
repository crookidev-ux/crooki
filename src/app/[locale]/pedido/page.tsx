import type { Metadata } from "next";
import CheckoutClient from "@/components/order/CheckoutClient";
import { isBoldConfigured } from "@/lib/bold";
import { parseDeliveryRule, type DeliveryRule } from "@/lib/delivery-zones";

// Checkout and order pages are private: keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type CheckoutCategories = {
  merchSlugs: string[];
  deliveryRules: Record<string, DeliveryRule>;
};

const FALLBACK: CheckoutCategories = { merchSlugs: ["merch"], deliveryRules: {} };

// Which categories are merchandise (delivery-only) and each category's delivery
// rule. UI hints only: /api/checkout enforces the same rules from the database.
async function loadCheckoutCategories(): Promise<CheckoutCategories> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("your_") || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return FALLBACK;
  }
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { data, error } = await createServiceClient()
      .from("categories")
      .select("slug, kind, delivery_rule");
    if (error || !data) return FALLBACK;
    const rows = data as { slug: string; kind: string; delivery_rule?: string | null }[];
    const merchSlugs = rows.filter((c) => c.kind === "merch").map((c) => c.slug);
    return {
      merchSlugs: merchSlugs.length > 0 ? merchSlugs : FALLBACK.merchSlugs,
      deliveryRules: Object.fromEntries(rows.map((c) => [c.slug, parseDeliveryRule(c.delivery_rule)])),
    };
  } catch {
    return FALLBACK;
  }
}

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { merchSlugs, deliveryRules } = await loadCheckoutCategories();

  return (
    <CheckoutClient
      locale={locale}
      boldEnabled={isBoldConfigured()}
      merchCategorySlugs={merchSlugs}
      categoryDeliveryRules={deliveryRules}
    />
  );
}
