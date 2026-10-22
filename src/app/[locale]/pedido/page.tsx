import type { Metadata } from "next";
import CheckoutClient from "@/components/order/CheckoutClient";
import { isBoldConfigured } from "@/lib/bold";

// Checkout and order pages are private: keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const FALLBACK_MERCH_SLUGS = ["merch"];

// Category slugs whose products are merchandise (delivery-only). UI hint only:
// /api/checkout enforces the same rule from the database.
async function loadMerchCategorySlugs(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("your_") || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return FALLBACK_MERCH_SLUGS;
  }
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { data, error } = await createServiceClient()
      .from("categories")
      .select("slug")
      .eq("kind", "merch");
    if (error || !data) return FALLBACK_MERCH_SLUGS;
    const slugs = (data as { slug: string }[]).map((c) => c.slug);
    return slugs.length > 0 ? slugs : FALLBACK_MERCH_SLUGS;
  } catch {
    return FALLBACK_MERCH_SLUGS;
  }
}

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const merchCategorySlugs = await loadMerchCategorySlugs();

  return (
    <CheckoutClient
      locale={locale}
      boldEnabled={isBoldConfigured()}
      merchCategorySlugs={merchCategorySlugs}
    />
  );
}
