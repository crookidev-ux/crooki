import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Gift } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { alternatesFor } from "@/lib/seo";
import { loadNavidadCategories, loadNavidadProducts } from "@/lib/navidad";
import Crumbs from "@/components/layout/Crumbs";
import NavidadCard from "@/components/navidad/NavidadCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("navidad_title"),
    description: t("navidad_description"),
    alternates: alternatesFor("/navidad", locale),
  };
}

export default async function NavidadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [categories, products] = await Promise.all([loadNavidadCategories(), loadNavidadProducts()]);
  // No visible Christmas category: the page doesn't exist (the nav link is hidden too).
  if (categories.length === 0) notFound();
  const t = await getTranslations({ locale, namespace: "navidad" });

  // One heading per category only when there are several.
  const groups = categories
    .map((c) => ({ category: c, items: products.filter((p) => p.category === c.slug) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="relative overflow-hidden px-4 py-20 text-center text-white" style={{ backgroundColor: "#8b0031" }}>
        <Crumbs className="opacity-70" />
        <p className="relative mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#f3c78b]">{t("eyebrow")}</p>
        <h1 className="relative mb-4 text-5xl font-black md:text-6xl">{t("title")}</h1>
        <p className="relative mx-auto max-w-xl text-lg text-white/80">{t("subtitle")}</p>
      </div>

      <div className="px-4 py-16" style={{ backgroundColor: "#fdf8f0" }}>
        <div className="mx-auto max-w-6xl">
          {groups.length === 0 ? (
            <div className="mx-auto max-w-lg rounded-3xl border border-[#f3c78b] bg-white p-10 text-center shadow-sm">
              <Gift aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-[#8b0031]" />
              <h2 className="mb-2 text-2xl font-black text-gray-900">{t("empty_title")}</h2>
              <p className="mb-6 text-gray-600">{t("empty_text")}</p>
              <Link
                href="/menu"
                className="inline-flex min-h-11 items-center rounded-full px-6 font-bold text-white"
                style={{ backgroundColor: "#8b0031" }}
              >
                {t("empty_cta")}
              </Link>
            </div>
          ) : (
            groups.map(({ category, items }) => (
              <section key={category.slug} className="mb-16 last:mb-0" aria-labelledby={groups.length > 1 ? `cat-${category.slug}` : undefined}>
                {groups.length > 1 && (
                  <h2 id={`cat-${category.slug}`} className="mb-8 text-3xl font-black text-[#8b0031] md:text-4xl">
                    {locale === "en" ? category.label_en || category.label_es : category.label_es}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <NavidadCard key={p.id} product={p} locale={locale} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
