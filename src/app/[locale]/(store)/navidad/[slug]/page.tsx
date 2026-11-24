import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SITE_URL, alternatesFor, localizedUrl } from "@/lib/seo";
import { isValidSlug } from "@/lib/slug";
import { loadNavidadProduct, loadNavidadProducts } from "@/lib/navidad";
import { navidadJsonLd } from "@/lib/navidad-seo";
import { parseDeliveryRule } from "@/lib/delivery-zones";
import { visibleTag } from "@/lib/promo";
import type { Product } from "@/lib/types";
import PromoRibbon from "@/components/ui/PromoRibbon";
import PriceTag from "@/components/ui/PriceTag";
import ProductGallery from "@/components/navidad/ProductGallery";
import AddToOrder from "@/components/navidad/AddToOrder";
import NavidadCard from "@/components/navidad/NavidadCard";

type Params = Promise<{ locale: string; slug: string }>;

async function load(slug: string) {
  // Malformed slugs never reach the database.
  return isValidSlug(slug) ? loadNavidadProduct(slug) : null;
}

function texts(p: Product, locale: string) {
  const en = locale === "en";
  return {
    name: (en && p.name_en) || p.name_es,
    description: (en && p.description_en) || p.description_es || "",
  };
}

/** First ~155 characters on one line, cut at a word. */
function summary(text: string, fallback: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return fallback;
  if (flat.length <= 155) return flat;
  return `${flat.slice(0, 152).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = await load(slug);
  if (!found) return {};
  const { name, description } = texts(found.product, locale);
  const tMeta = await getTranslations({ locale, namespace: "meta" });
  const desc = summary(description, tMeta("navidad_description"));
  const path = `/navidad/${slug}`;
  const cover = found.product.product_images[0]?.url;
  const images = cover ? [{ url: cover, alt: name }] : [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: tMeta("og_alt") }];
  return {
    title: name,
    description: desc,
    alternates: alternatesFor(path, locale),
    // Replaces the layout's openGraph entirely, so every field is set here.
    openGraph: {
      type: "website",
      siteName: "Crooki Bake Bar",
      locale: locale === "en" ? "en_US" : "es_CO",
      url: localizedUrl(path, locale),
      title: name,
      description: desc,
      images,
    },
    twitter: { card: "summary_large_image", title: name, description: desc, images: images.map((i) => i.url) },
  };
}

export default async function NavidadProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { product, category } = found;
  const t = await getTranslations({ locale, namespace: "navidad" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const { name, description } = texts(product, locale);
  const tag = visibleTag(product);
  const others = (await loadNavidadProducts()).filter((p) => p.id !== product.id).slice(0, 3);

  const jsonLd = navidadJsonLd(product, {
    name,
    description: summary(description, name),
    pageUrl: `${SITE_URL}${localizedUrl(`/navidad/${slug}`, locale)}`,
    catalogUrl: `${SITE_URL}${localizedUrl("/navidad", locale)}`,
    homeUrl: `${SITE_URL}${localizedUrl("/", locale)}`,
    labels: { home: t("home"), catalog: tNav("navidad") },
  });

  return (
    <div style={{ backgroundColor: "#fdf8f0" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:pb-24 md:pt-10">
        <nav aria-label={t("breadcrumb")} className="mb-6 text-sm">
          <ol className="flex flex-wrap items-center gap-1.5 text-gray-500">
            <li><Link href="/" className="hover:text-[#8b0031]">{t("home")}</Link></li>
            <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li><Link href="/navidad" className="hover:text-[#8b0031]">{tNav("navidad")}</Link></li>
            <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li aria-current="page" className="font-semibold text-gray-800 line-clamp-1">{name}</li>
          </ol>
        </nav>

        <div className="grid items-start gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="md:sticky md:top-24">
            <ProductGallery images={product.product_images} name={name} overlay={tag ? <PromoRibbon tag={tag} /> : null} />
          </div>

          <div className="rounded-3xl border border-[#f3c78b]/70 bg-white p-6 shadow-sm md:p-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#8b0031]">
              {locale === "en" ? category.label_en || category.label_es : category.label_es}
            </p>
            <h1 className="mb-4 text-4xl font-black leading-tight text-gray-900 md:text-5xl">{name}</h1>
            {product.price > 0 && (
              <div className="mb-6">
                <PriceTag product={product} className="text-3xl!" />
              </div>
            )}

            <AddToOrder product={product} deliveryRule={parseDeliveryRule(category.delivery_rule)} />

            {description && (
              <section className="mt-8 border-t border-[#f3c78b]/70 pt-6">
                <h2 className="mb-3 text-lg font-black text-gray-900">{t("description")}</h2>
                <p className="whitespace-pre-line leading-relaxed text-gray-700">{description}</p>
              </section>
            )}

            <Link
              href="/navidad"
              className="mt-8 inline-flex min-h-11 items-center gap-2 font-bold text-[#8b0031] hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t("back")}
            </Link>
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-20" aria-labelledby="more-gifts">
            <h2 id="more-gifts" className="mb-8 text-3xl font-black text-[#8b0031]">{t("more")}</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((p) => (
                <NavidadCard key={p.id} product={p} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
