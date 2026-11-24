import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight, ImageOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import PromoRibbon from "@/components/ui/PromoRibbon";
import PriceTag from "@/components/ui/PriceTag";
import { visibleTag } from "@/lib/promo";
import type { Product } from "@/lib/types";

/** Catalog card: the whole card links to the product page. */
export default function NavidadCard({ product, locale }: { product: Product; locale: string }) {
  const t = useTranslations("navidad");
  const tMenu = useTranslations("menu");
  const name = locale === "en" ? product.name_en || product.name_es : product.name_es;
  const description = locale === "en" ? product.description_en || product.description_es : product.description_es;
  const cover = product.product_images?.[0]?.url;
  const tag = visibleTag(product);

  return (
    <Link
      href={`/navidad/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-[#f3c78b]/60 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b0031]"
    >
      <div className="relative aspect-square overflow-hidden bg-[#fdf8f0]">
        {cover ? (
          <Image
            src={cover}
            alt={name}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <ImageOff aria-hidden="true" className="absolute inset-0 m-auto h-10 w-10 text-[#8b0031]/30" />
        )}
        {tag && <PromoRibbon tag={tag} />}
        {product.price > 0 && <PriceTag product={product} variant="chip" className="absolute right-4 top-4" />}
        {!product.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="rounded-full bg-black/60 px-5 py-2 font-bold text-white">{tMenu("sold_out")}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="mb-2 text-2xl font-black leading-tight text-gray-900">{name}</h3>
        <p className="mb-5 line-clamp-2 text-sm leading-relaxed text-gray-500">{description}</p>
        <span className="mt-auto inline-flex items-center gap-2 font-bold text-[#8b0031]">
          {t("view_product")}
          <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
