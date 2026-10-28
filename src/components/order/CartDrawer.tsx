"use client";

import Image from "next/image";
import { useCartStore } from "@/store/cart";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { X, ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";

export default function CartDrawer() {
  const t = useTranslations("cart");
  const params = useParams();
  const locale = (params.locale as string) || "es";
  const { items, isOpen, closeCart, removeItem, updateQuantity, total } = useCartStore();

  const totalAmount = total();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" style={{ color: "#8b0031" }} />
            <h2 className="font-bold text-lg">{t("title")}</h2>
          </div>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-200" />
              <div>
                <p className="font-semibold text-gray-700">{t("empty")}</p>
                <p className="text-sm text-gray-500 mt-1">{t("empty_desc")}</p>
              </div>
              <Link
                href="/menu"
                onClick={closeCart}
                className="mt-2 text-white font-semibold px-6 py-3 rounded-full transition-opacity hover:opacity-90 text-sm"
                style={{ backgroundColor: "#8b0031" }}
              >
                {t("go_to_menu")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => {
                const { product, quantity, lineId, combo, box, helado, unitPrice } = item;
                const name = locale === "en" ? product.name_en : product.name_es;
                const imageUrl =
                  product.product_images?.[0]?.url ||
                  `/images/${product.id}.jpg`;
                const linePrice = unitPrice ?? product.price;

                return (
                  <div
                    key={lineId}
                    className="flex gap-3 items-start pb-4 border-b border-gray-100 last:border-0"
                  >
                    {/* Image */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      <Image src={imageUrl} alt={name} fill sizes="80px" className="object-cover" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">
                        {name}
                      </p>

                      {combo && (
                        <ul className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                          <li>· {combo.cookieName}</li>
                          {combo.includedSalsaName && (
                            <li>· {locale === "en" ? "Sauce" : "Salsa"}: {combo.includedSalsaName}</li>
                          )}
                          {combo.additionalSalsas.map((a) => (
                            <li key={a.salsaId}>
                              · +{a.quantity}× {a.salsaName}
                            </li>
                          ))}
                        </ul>
                      )}

                      {helado && (
                        <ul className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                          {helado.salsas.map((s) => (
                            <li key={s.salsaId}>
                              · +{s.quantity}× {s.salsaName}
                            </li>
                          ))}
                        </ul>
                      )}

                      {box && (
                        <ul className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                          {box.cookies.map((c) => (
                            <li key={c.cookieId}>
                              · {c.quantity}× {c.cookieName}
                            </li>
                          ))}
                          {box.giftCard !== "none" && (
                            <li>
                              ·{" "}
                              {box.giftCard === "card"
                                ? locale === "en"
                                  ? "Gift card"
                                  : "Gift card"
                                : locale === "en"
                                  ? "Gift card + candle"
                                  : "Gift card + vela"}
                            </li>
                          )}
                        </ul>
                      )}

                      <p className="text-sm font-bold mt-1" style={{ color: "#8b0031" }}>
                        ${linePrice.toLocaleString("es-CO")}
                      </p>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(lineId, quantity - 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(lineId, quantity + 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(lineId)}
                      className="p-1 hover:text-red-600 transition-colors text-gray-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - only show when items exist */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-gray-700">{t("subtotal")}</span>
              <span className="font-bold text-lg">${totalAmount.toLocaleString("es-CO")}</span>
            </div>
            <Link
              href="/pedido"
              onClick={closeCart}
              className="block w-full text-center text-white font-bold py-4 rounded-full transition-opacity hover:opacity-90 text-base"
              style={{ backgroundColor: "#8b0031" }}
            >
              {t("checkout")}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
