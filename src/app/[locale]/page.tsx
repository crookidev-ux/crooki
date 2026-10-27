import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
import Hero from "@/components/home/Hero";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import AboutSection from "@/components/home/AboutSection";
import type { Product } from "@/lib/types";
import { mockProducts } from "@/lib/mock-products";
import { parseActiveSeason, type SeasonId } from "@/lib/seasons";
import { getActiveSeason } from "@/lib/seasons.data";

async function getProducts(): Promise<Product[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your_")) {
    return mockProducts.slice(0, 6);
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    // Featured products skip categories the admin hid from the customer pages.
    const { data: cats } = await supabase
      .from("categories")
      .select("slug, visible");
    const visibleSlugs = ((cats as { slug: string; visible?: boolean }[] | null) ?? [])
      .filter((c) => c.visible !== false)
      .map((c) => c.slug);
    let query = supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("available", true);
    if (visibleSlugs.length > 0) query = query.in("category", visibleSlugs);
    const { data } = await query.order("display_order").limit(6);
    return data || mockProducts.slice(0, 6);
  } catch {
    return mockProducts.slice(0, 6);
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { absolute: t("home_title") },
    description: t("site_description"),
    alternates: alternatesFor("/", locale),
  };
}

// In development only, ?temporada=<id> (or ?temporada=ninguna) previews a
// season without touching the real setting.
function previewSeason(value: string | undefined): SeasonId | null | undefined {
  if (process.env.NODE_ENV === "production" || value === undefined) return undefined;
  return value === "ninguna" ? null : parseActiveSeason(value);
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ temporada?: string }>;
}) {
  const { locale } = await params;
  const { temporada } = await searchParams;
  const [products, activeSeason] = await Promise.all([getProducts(), getActiveSeason()]);
  const preview = previewSeason(temporada);
  const season = preview === undefined ? activeSeason : preview;

  return (
    <>
      <Hero locale={locale} season={season} />
      <FeaturedProducts products={products} locale={locale} />
      <AboutSection locale={locale} />
    </>
  );
}
