import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import ProductGrid from "@/components/menu/ProductGrid";
import type { CategoryRow, Product } from "@/lib/types";
import { mockProducts } from "@/lib/mock-products";
import Crumbs from "@/components/layout/Crumbs";

async function loadCatalog(): Promise<{ categories: CategoryRow[]; products: Product[] }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your_")) {
    return { categories: [], products: mockProducts };
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const [{ data: categories }, { data: products }] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("kind", "menu")
        .order("display_order"),
      supabase
        .from("products")
        .select(
          "*, product_images(*), combo_cookies!combo_cookies_combo_id_fkey(*), combo_salsas!combo_salsas_combo_id_fkey(*), box_cookies!box_cookies_box_id_fkey(*)",
        )
        .order("display_order"),
    ]);
    return {
      // Admin-hidden categories are excluded from the public menu; their
      // products drop out with them (the grid only renders listed categories).
      categories: ((categories as CategoryRow[]) ?? []).filter(
        (c) => c.visible !== false,
      ),
      products: (products as Product[]) ?? mockProducts,
    };
  } catch {
    return { categories: [], products: mockProducts };
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
    title: t("menu_title"),
    description: t("menu_description"),
    alternates: alternatesFor("/menu", locale),
  };
}

export default async function MenuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "menu" });
  const { categories, products } = await loadCatalog();

  return (
    <div>
      <div className="relative overflow-hidden py-20 px-4 text-center text-white" style={{ backgroundColor: "#8b0031" }}>
        <Crumbs className="opacity-70" />
        <h1 className="relative text-5xl md:text-6xl font-black mb-4">{t("title")}</h1>
        <p className="relative text-white/80 text-lg">{t("subtitle")}</p>
      </div>

      <div className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <ProductGrid products={products} categories={categories} locale={locale} />
        </div>
      </div>
    </div>
  );
}
