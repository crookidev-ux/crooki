"use client";

import { useTranslations } from "next-intl";
import type { BoxSelection, CategoryRow, Product } from "@/lib/types";
import { CATEGORY_ORDER } from "@/lib/types";
import { useCartStore } from "@/store/cart";
import { Plus, Check, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ComboConfigurator from "./ComboConfigurator";
import BoxConfigurator from "./BoxConfigurator";
import HeladoConfigurator from "./HeladoConfigurator";

interface Props {
  products: Product[];
  categories: CategoryRow[];
  locale: string;
}

function ProductCard({
  product,
  locale,
  productsById,
}: {
  product: Product;
  locale: string;
  productsById: Map<string, Product>;
}) {
  const t = useTranslations("menu");
  const { addItem, addBox } = useCartStore();
  const [added, setAdded] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  const isCombo = product.category === "combos";
  const isBox = product.category === "cajas";
  // Helados only become configurable once the admin whitelists salsas for them.
  const isHelado =
    product.category === "helados" && (product.combo_salsas?.length ?? 0) > 0;

  // A caja with exactly one eligible cookie and no gift-card add-ons has
  // nothing to customize: the customer just gets `box_cookie_count` units of
  // that cookie, so the card shows "+ Agregar" instead of "Personalizar".
  const boxRows = isBox ? product.box_cookies ?? [] : [];
  const singleBoxCookie =
    isBox &&
    boxRows.length === 1 &&
    product.gift_card_price == null &&
    product.gift_card_cake_price == null
      ? productsById.get(boxRows[0].cookie_id)
      : undefined;

  const isConfigurable = isCombo || isHelado || (isBox && !singleBoxCookie);

  const name = locale === "en" ? product.name_en : product.name_es;
  const description = locale === "en" ? product.description_en : product.description_es;
  const imageUrl =
    product.product_images?.[0]?.url ||
    `/images/${product.id.toLowerCase().replace(/\s+/g, "-")}.jpg`;

  const handleAdd = () => {
    if (singleBoxCookie) {
      const count = Math.max(2, product.box_cookie_count ?? 2);
      const selection: BoxSelection = {
        cookies: [
          {
            cookieId: boxRows[0].cookie_id,
            cookieName:
              locale === "en" ? singleBoxCookie.name_en : singleBoxCookie.name_es,
            quantity: count,
            extraPrice: boxRows[0].extra_price,
          },
        ],
        giftCard: "none",
        giftCardPrice: 0,
      };
      addBox(product, selection, product.price + count * boxRows[0].extra_price);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
      return;
    }
    if (isConfigurable) {
      setConfiguring(true);
      return;
    }
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const hasPrice = product.price > 0;

  return (
    <div className="group rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
      <div className="relative h-72 overflow-hidden bg-gray-50">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
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
        {!product.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-bold text-base bg-black/60 px-5 py-2 rounded-full">
              {t("sold_out")}
            </span>
          </div>
        )}
      </div>

      <div className="p-6">
        <h3 className="font-black text-2xl mb-2 leading-tight">{name}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-5 line-clamp-3">{description}</p>
        {product.available && hasPrice ? (
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-full transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: added ? "#16a34a" : "#8b0031" }}
          >
            {added ? (
              <>
                <Check className="w-5 h-5" />
                {locale === "en" ? "Added!" : "¡Agregado!"}
              </>
            ) : isConfigurable ? (
              <>
                <Settings2 className="w-5 h-5" />
                {locale === "en" ? "Configure" : "Personalizar"}
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                {t("add_to_cart")}
              </>
            )}
          </button>
        ) : !hasPrice ? (
          <div className="w-full py-3.5 rounded-full bg-gray-50 text-gray-400 font-semibold text-center text-sm">
            {locale === "en" ? "Ask in store" : "Consultar en tienda"}
          </div>
        ) : (
          <button
            disabled
            className="w-full py-3.5 rounded-full bg-gray-100 text-gray-400 font-semibold cursor-not-allowed"
          >
            {t("sold_out")}
          </button>
        )}
      </div>

      {configuring && isCombo && (
        <ComboConfigurator
          combo={product}
          productsById={productsById}
          locale={locale}
          onClose={() => setConfiguring(false)}
        />
      )}
      {configuring && isBox && (
        <BoxConfigurator
          box={product}
          productsById={productsById}
          locale={locale}
          onClose={() => setConfiguring(false)}
        />
      )}
      {configuring && isHelado && (
        <HeladoConfigurator
          helado={product}
          productsById={productsById}
          locale={locale}
          onClose={() => setConfiguring(false)}
        />
      )}
    </div>
  );
}

function CategorySection({
  slug,
  products,
  locale,
  title,
  emptyLabel,
  productsById,
}: {
  slug: string;
  products: Product[];
  locale: string;
  title: string;
  emptyLabel: string;
  productsById: Map<string, Product>;
}) {
  return (
    <section id={`cat-${slug}`} className="scroll-mt-36">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="font-black text-3xl md:text-4xl" style={{ color: "#8b0031" }}>
          {title}
        </h2>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      {products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          <p className="text-lg font-semibold">{emptyLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              productsById={productsById}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function useActiveCategory(slugs: string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = slugs
      .map((s) => document.getElementById(`cat-${s}`))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace(/^cat-/, ""));
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [slugs]);

  return active;
}

export default function ProductGrid({ products, categories, locale }: Props) {
  const t = useTranslations("menu");
  const tFallback = useTranslations("categories");
  const navRef = useRef<HTMLDivElement>(null);

  // If DB categories are provided, use them (skipping admin-hidden ones).
  // Otherwise fall back to the legacy hardcoded list (keeps the mock-data/dev
  // path working).
  const displayCategories = useMemo(() => {
    if (categories.length > 0)
      return categories
        .filter((c) => c.visible !== false)
        .sort((a, b) => a.display_order - b.display_order);
    return CATEGORY_ORDER.map((slug, i) => ({
      slug,
      label_es: tFallback(slug),
      label_en: tFallback(slug),
      kind: "menu" as const,
      display_order: i,
    }));
  }, [categories, tFallback]);

  const slugs = useMemo(() => displayCategories.map((c) => c.slug), [displayCategories]);
  const active = useActiveCategory(slugs);

  useEffect(() => {
    if (!active || !navRef.current) return;
    const el = navRef.current.querySelector<HTMLAnchorElement>(`a[data-cat="${active}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const byCategory = new Map<string, Product[]>();
  for (const c of displayCategories) byCategory.set(c.slug, []);
  for (const p of products) {
    if (byCategory.has(p.category)) byCategory.get(p.category)!.push(p);
  }

  const productsById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  return (
    <div className="space-y-20">
      <nav className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div
          ref={navRef}
          className="flex gap-2 overflow-x-auto no-scrollbar justify-start md:justify-center max-w-6xl mx-auto"
        >
          {displayCategories.map((c) => {
            const isActive = active === c.slug;
            const label = locale === "en" ? c.label_en : c.label_es;
            return (
              <a
                key={c.slug}
                href={`#cat-${c.slug}`}
                data-cat={c.slug}
                className="px-4 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors"
                style={{
                  borderColor: isActive ? "#8b0031" : "#e5e7eb",
                  backgroundColor: isActive ? "#8b0031" : "transparent",
                  color: isActive ? "#ffffff" : "#8b0031",
                }}
              >
                {label}
              </a>
            );
          })}
        </div>
      </nav>

      {displayCategories.map((c) => (
        <CategorySection
          key={c.slug}
          slug={c.slug}
          products={(byCategory.get(c.slug) ?? []).sort(
            (a, b) => a.display_order - b.display_order,
          )}
          locale={locale}
          title={locale === "en" ? c.label_en : c.label_es}
          emptyLabel={t("coming_soon")}
          productsById={productsById}
        />
      ))}
    </div>
  );
}
