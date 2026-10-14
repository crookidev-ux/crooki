import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { mockMerch } from "@/lib/mock-products";
import MerchGrid from "@/components/menu/MerchGrid";
import type { CategoryRow, Product } from "@/lib/types";
import Crumbs from "@/components/layout/Crumbs";

async function loadMerch(): Promise<Product[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your_")) {
    return mockMerch;
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: merchCats } = await supabase
      .from("categories")
      .select("slug, visible")
      .eq("kind", "merch");
    const slugs = ((merchCats as { slug: string; visible?: boolean }[] | null) ?? [])
      .filter((c) => c.visible !== false)
      .map((c) => c.slug);
    if (slugs.length === 0) return mockMerch;
    const { data: products } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .in("category", slugs)
      .order("display_order");
    return ((products as Product[] | null) ?? []).length > 0
      ? (products as Product[])
      : mockMerch;
  } catch {
    return mockMerch;
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
    title: t("merch_title"),
    description: t("merch_description"),
    alternates: alternatesFor("/merch", locale),
  };
}

export default async function MerchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "merch" });
  const products = await loadMerch();

  return (
    <div>
      <div className="relative overflow-hidden py-20 px-4 text-center text-white" style={{ backgroundColor: "#8b0031" }}>
        <Crumbs className="opacity-70" />
        <h1 className="relative text-5xl md:text-6xl font-black mb-4">{t("title")}</h1>
        <p className="relative text-white/80 text-lg">{t("subtitle")}</p>
      </div>

      {/* Brand story: lifestyle photo + selling copy, before the products */}
      <section className="py-16 md:py-24 px-4" style={{ backgroundColor: "#fdf8f0" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <Image
            src="/merch2.jpeg"
            alt={t("story_image_alt")}
            width={1024}
            height={993}
            sizes="(min-width: 768px) 560px, 100vw"
            className="w-full h-auto rounded-3xl shadow-xl"
            priority
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8b0031] mb-4">
              {t("story_eyebrow")}
            </p>
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 leading-tight mb-6">
              {t.rich("story_title", {
                logo: () => (
                  <Image
                    src="/crooki-wordmark-red.png"
                    alt="Crooki"
                    width={913}
                    height={224}
                    className="inline-block h-[0.8em] w-auto align-baseline"
                  />
                ),
              })}
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-4">{t("story_p1")}</p>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">{t("story_p2")}</p>
            <ul className="space-y-3 mb-8">
              {(["story_b1", "story_b2", "story_b3", "story_b4"] as const).map((key) => (
                <li key={key} className="flex items-start gap-3 text-gray-800 font-semibold">
                  <span className="mt-1 text-[#8b0031]" aria-hidden="true">●</span>
                  {t(key)}
                </li>
              ))}
            </ul>
            <a
              href="#coleccion"
              className="inline-block text-white font-bold px-8 py-4 rounded-full transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#8b0031" }}
            >
              {t("story_cta")} ↓
            </a>
          </div>
        </div>
      </section>

      <div id="coleccion" className="scroll-mt-16 py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <MerchGrid products={products} locale={locale} />
        </div>
      </div>
    </div>
  );
}
