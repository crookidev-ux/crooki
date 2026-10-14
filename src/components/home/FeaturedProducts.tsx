"use client";

import { useTranslations } from "next-intl";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/store/cart";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface Props {
  products: Product[];
  locale: string;
}

export default function FeaturedProducts({ products, locale }: Props) {
  const t = useTranslations("featured");
  const tMenu = useTranslations("menu");
  const { addItem } = useCartStore();

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: "#8b0031" }}>
            {t("title")}
          </h2>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">{t("subtitle")}</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const name = locale === "en" ? product.name_en : product.name_es;
            const description = locale === "en" ? product.description_en : product.description_es;
            const imageUrl =
              product.product_images?.[0]?.url ||
              `/images/${product.id.toLowerCase().replace(/\s+/g, "-")}.jpg`;

            return (
              <div
                key={product.id}
                className="group rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image */}
                <div className="relative h-64 overflow-hidden bg-gray-100">
                  <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {!product.available && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-sm bg-black/60 px-4 py-2 rounded-full">
                        {tMenu("sold_out")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="font-bold text-xl mb-2">{name}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-4">
                    {description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xl" style={{ color: "#8b0031" }}>
                      ${product.price.toLocaleString("es-CO")}
                    </span>
                    {product.available ? (
                      <button
                        onClick={() => addItem(product)}
                        className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-full transition-all hover:opacity-90 hover:scale-105"
                        style={{ backgroundColor: "#8b0031" }}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        {tMenu("add_to_cart")}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm font-medium">
                        {tMenu("sold_out")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* View all CTA */}
        <div className="text-center mt-12">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 border-2 font-bold text-lg px-8 py-4 rounded-full transition-all hover:bg-[#8b0031] hover:text-white"
            style={{ borderColor: "#8b0031", color: "#8b0031" }}
          >
            Ver menú completo →
          </Link>
        </div>
      </div>
    </section>
  );
}
