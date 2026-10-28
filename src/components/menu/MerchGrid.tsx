"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/store/cart";
import type { Product } from "@/lib/types";

interface Props {
  products: Product[];
  locale: string;
}

function MerchCard({ product, locale }: { product: Product; locale: string }) {
  const t = useTranslations("menu");
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const name = locale === "en" ? product.name_en : product.name_es;
  const description = locale === "en" ? product.description_en : product.description_es;
  const imageUrl =
    product.product_images?.[0]?.url ||
    `/images/${product.id.toLowerCase().replace(/\s+/g, "-")}.jpg`;
  const hasPrice = product.price > 0;

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {hasPrice && (
          <div
            className="absolute top-4 right-4 text-white font-black text-sm px-3 py-1.5 rounded-full shadow-lg"
            style={{ backgroundColor: "#8b0031" }}
          >
            ${product.price.toLocaleString("es-CO")}
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-black text-2xl mb-2 leading-tight">{name}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-5">{description}</p>
        {hasPrice ? (
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-full transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: added ? "#16a34a" : "#8b0031" }}
          >
            {added ? (
              <>
                <Check className="w-5 h-5" />
                {locale === "en" ? "Added!" : "¡Agregado!"}
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                {t("add_to_cart")}
              </>
            )}
          </button>
        ) : (
          <div className="w-full py-3.5 rounded-full bg-gray-50 text-gray-400 font-semibold text-center text-sm">
            {locale === "en" ? "Ask in store" : "Consultar en tienda"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MerchGrid({ products, locale }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {products.map((p) => (
        <MerchCard key={p.id} product={p} locale={locale} />
      ))}
    </div>
  );
}
