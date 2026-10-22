"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Minus, Plus, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { boxUnitPrice } from "@/lib/pricing";
import type { BoxSelection, GiftCardChoice, Product } from "@/lib/types";

interface Props {
  box: Product;
  productsById: Map<string, Product>;
  locale: string;
  onClose: () => void;
}

export default function BoxConfigurator({ box, productsById, locale, onClose }: Props) {
  const addBox = useCartStore((s) => s.addBox);

  const targetCount = Math.max(2, box.box_cookie_count ?? 2);

  const cookieRows = useMemo(
    () =>
      [...(box.box_cookies ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((r) => ({ row: r, product: productsById.get(r.cookie_id) }))
        .filter((x) => !!x.product),
    [box.box_cookies, productsById],
  );

  const [qtyByCookie, setQtyByCookie] = useState<Record<string, number>>({});
  const [giftCard, setGiftCard] = useState<GiftCardChoice>("none");
  const [submitting, setSubmitting] = useState(false);

  const totalCookies = useMemo(
    () => cookieRows.reduce((sum, { row }) => sum + (qtyByCookie[row.cookie_id] ?? 0), 0),
    [cookieRows, qtyByCookie],
  );

  const giftCardCost =
    giftCard === "card"
      ? box.gift_card_price ?? 0
      : giftCard === "card_and_cake"
        ? box.gift_card_cake_price ?? 0
        : 0;

  const unitPrice = boxUnitPrice(
    box.price,
    cookieRows.map(({ row }) => ({
      quantity: qtyByCookie[row.cookie_id] ?? 0,
      extraPrice: row.extra_price,
    })),
    giftCard,
    box.gift_card_price ?? null,
    box.gift_card_cake_price ?? null,
  );

  const remaining = targetCount - totalCookies;
  const overSelected = totalCookies > targetCount;
  const canAdd = totalCookies === targetCount;

  const setQty = (cookieId: string, delta: number) =>
    setQtyByCookie((cur) => {
      const currentQty = cur[cookieId] ?? 0;
      // Compute the live total from `cur` (not the outer closure) so back-to-
      // back clicks within one tick can't over-select past the target.
      const totalNow = Object.values(cur).reduce((s, v) => s + v, 0);
      if (delta > 0 && totalNow >= targetCount) return cur;
      const next = Math.max(0, currentQty + delta);
      return { ...cur, [cookieId]: next };
    });

  const handleAdd = () => {
    if (!canAdd) return;
    setSubmitting(true);

    const selection: BoxSelection = {
      cookies: cookieRows
        .filter(({ row }) => (qtyByCookie[row.cookie_id] ?? 0) > 0)
        .map(({ row, product }) => ({
          cookieId: row.cookie_id,
          cookieName: locale === "en" ? product!.name_en : product!.name_es,
          quantity: qtyByCookie[row.cookie_id]!,
          extraPrice: row.extra_price,
        })),
      giftCard,
      giftCardPrice: giftCardCost,
    };

    addBox(box, selection, unitPrice);
    setSubmitting(false);
    onClose();
  };

  const T = (es: string, en: string) => (locale === "en" ? en : es);

  // See ComboConfigurator: the product card has a hover transform that traps
  // fixed-position descendants. Portal to body to escape it (the modal only
  // mounts after a click, so it never renders during SSR).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const showGiftCard = (box.gift_card_price ?? null) !== null;
  const showGiftCardCake = (box.gift_card_cake_price ?? null) !== null;
  const showAddons = showGiftCard || showGiftCardCake;

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white w-full max-w-xl max-h-[90vh] rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div className="min-w-0">
            <h2 className="text-2xl font-black truncate" style={{ color: "#8b0031" }}>
              {locale === "en" ? box.name_en : box.name_es}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {T(
                `Elige ${targetCount} galleta${targetCount === 1 ? "" : "s"}`,
                `Pick ${targetCount} cookie${targetCount === 1 ? "" : "s"}`,
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-full hover:bg-gray-100 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Cookie picker */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">
                1. {T("Galletas", "Cookies")}
              </h3>
              <span
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{
                  backgroundColor: canAdd ? "#16a34a" : overSelected ? "#dc2626" : "#f3f4f6",
                  color: canAdd || overSelected ? "#ffffff" : "#374151",
                }}
              >
                {totalCookies} / {targetCount}
              </span>
            </div>

            {cookieRows.length === 0 ? (
              <div className="text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 p-4 text-center">
                {T(
                  "Esta caja no tiene galletas configuradas todavía.",
                  "This box has no cookies configured yet.",
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cookieRows.map(({ row, product }) => {
                  const qty = qtyByCookie[row.cookie_id] ?? 0;
                  const name = locale === "en" ? product!.name_en : product!.name_es;
                  const plusDisabled = remaining <= 0;
                  return (
                    <div
                      key={row.cookie_id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {row.extra_price > 0 && (
                          <p className="text-xs" style={{ color: "#8b0031" }}>
                            +${row.extra_price.toLocaleString("es-CO")}{" "}
                            {T("por galleta", "per cookie")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQty(row.cookie_id, -1)}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(row.cookie_id, +1)}
                          disabled={plusDisabled}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!canAdd && cookieRows.length > 0 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                {overSelected
                  ? T("Te pasaste del límite.", "Over the limit.")
                  : T(
                      `Faltan ${remaining} para llegar a ${targetCount}.`,
                      `${remaining} more to reach ${targetCount}.`,
                    )}
              </p>
            )}
          </section>

          {/* Add-ons */}
          {showAddons && (
            <section>
              <h3 className="font-bold text-base mb-3">
                2. {T("Extras", "Add-ons")}{" "}
                <span className="text-xs font-normal text-gray-400 ml-2">
                  {T("(opcional)", "(optional)")}
                </span>
              </h3>
              <div className="flex flex-col gap-2">
                <label
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors"
                  style={{
                    borderColor: giftCard === "none" ? "#8b0031" : "#e5e7eb",
                    backgroundColor: giftCard === "none" ? "rgba(139,0,49,0.04)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="gift-card"
                    checked={giftCard === "none"}
                    onChange={() => setGiftCard("none")}
                    className="w-4 h-4"
                    style={{ accentColor: "#8b0031" }}
                  />
                  <span className="flex-1 text-sm font-medium">
                    {T("Sin gift card", "No gift card")}
                  </span>
                </label>
                {showGiftCard && (
                  <label
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors"
                    style={{
                      borderColor: giftCard === "card" ? "#8b0031" : "#e5e7eb",
                      backgroundColor: giftCard === "card" ? "rgba(139,0,49,0.04)" : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="gift-card"
                      checked={giftCard === "card"}
                      onChange={() => setGiftCard("card")}
                      className="w-4 h-4"
                      style={{ accentColor: "#8b0031" }}
                    />
                    <span className="flex-1 text-sm font-medium">
                      {T("Con gift card", "With gift card")}
                    </span>
                    <span className="text-xs font-bold" style={{ color: "#8b0031" }}>
                      +${(box.gift_card_price ?? 0).toLocaleString("es-CO")}
                    </span>
                  </label>
                )}
                {showGiftCardCake && (
                  <label
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors"
                    style={{
                      borderColor: giftCard === "card_and_cake" ? "#8b0031" : "#e5e7eb",
                      backgroundColor:
                        giftCard === "card_and_cake" ? "rgba(139,0,49,0.04)" : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="gift-card"
                      checked={giftCard === "card_and_cake"}
                      onChange={() => setGiftCard("card_and_cake")}
                      className="w-4 h-4"
                      style={{ accentColor: "#8b0031" }}
                    />
                    <span className="flex-1 text-sm font-medium">
                      {T("Con gift card + Vela", "With gift card + candle")}
                    </span>
                    <span className="text-xs font-bold" style={{ color: "#8b0031" }}>
                      +${(box.gift_card_cake_price ?? 0).toLocaleString("es-CO")}
                    </span>
                  </label>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-600">{T("Total", "Total")}</span>
            <span className="text-2xl font-black" style={{ color: "#8b0031" }}>
              ${unitPrice.toLocaleString("es-CO")}
            </span>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd || submitting}
            className="w-full text-white font-bold py-4 rounded-full transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: "#8b0031" }}
          >
            {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
            {T("Agregar al carrito", "Add to cart")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
