import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
import Hero from "@/components/home/Hero";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import AboutSection from "@/components/home/AboutSection";
import type { Product } from "@/lib/types";
import { mockProducts } from "@/lib/mock-products";

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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const products = await getProducts();

  return (
    <>
      <Hero locale={locale} />
      <FeaturedProducts products={products} locale={locale} />
      <AboutSection locale={locale} />
    </>
  );
}
