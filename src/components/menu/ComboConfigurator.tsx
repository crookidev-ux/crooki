"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { comboUnitPrice } from "@/lib/pricing";
import type { ComboSelection, Product } from "@/lib/types";

interface Props {
  combo: Product;
  // Lookup of all products keyed by id, used to resolve cookie/salsa names + base prices
  // for the rows referenced by `combo.combo_cookies` / `combo.combo_salsas`.
  productsById: Map<string, Product>;
  locale: string;
  onClose: () => void;
}

export default function ComboConfigurator({ combo, productsById, locale, onClose }: Props) {
  const addCombo = useCartStore((s) => s.addCombo);

  const cookieRows = useMemo(
    () =>
      [...(combo.combo_cookies ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((r) => ({
          row: r,
          product: productsById.get(r.cookie_id),
        }))
        .filter((x) => !!x.product),
    [combo.combo_cookies, productsById],
  );

  const salsaRows = useMemo(
    () =>
      [...(combo.combo_salsas ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((r) => ({
          row: r,
          product: productsById.get(r.salsa_id),
        }))
        .filter((x) => !!x.product),
    [combo.combo_salsas, productsById],
  );

  const [cookieId, setCookieId] = useState<string>(cookieRows[0]?.row.cookie_id ?? "");
  const [includedSalsaId, setIncludedSalsaId] = useState<string>(
    combo.includes_salsa ? salsaRows[0]?.row.salsa_id ?? "" : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const cookieExtra = useMemo(() => {
    const r = cookieRows.find((x) => x.row.cookie_id === cookieId);
    return r?.row.extra_price ?? 0;
  }, [cookieRows, cookieId]);

  const unitPrice = comboUnitPrice(combo.price, cookieExtra);

  const canAdd = !!cookieId && (!combo.includes_salsa || !!includedSalsaId);

  const handleAdd = () => {
    if (!canAdd) return;
    setSubmitting(true);

    const cookieProduct = productsById.get(cookieId)!;
    const includedSalsaProduct = includedSalsaId
      ? productsById.get(includedSalsaId)
      : undefined;

    const selection: ComboSelection = {
      cookieId,
      cookieName: locale === "en" ? cookieProduct.name_en : cookieProduct.name_es,
      cookieExtra,
      includedSalsaId: includedSalsaProduct?.id,
      includedSalsaName: includedSalsaProduct
        ? locale === "en"
          ? includedSalsaProduct.name_en
          : includedSalsaProduct.name_es
        : undefined,
      // Extra paid salsas were removed from the combo flow; the field stays
      // for cart/checkout type compatibility.
      additionalSalsas: [],
    };

    addCombo(combo, selection, unitPrice);
    setSubmitting(false);
    onClose();
  };

  const T = (es: string, en: string) => (locale === "en" ? en : es);

  // The product card has a `hover:-translate-y-2` transform, which creates a
  // containing block for `position: fixed` descendants. Without a portal the
  // modal would render relative to the card — appearing as a tiny box and
  // jumping to viewport coordinates when hover ends. Portal to <body> escapes
  // the transform context (safe here: the modal only mounts after a click, so
  // it never renders during SSR). Lock body scroll while the modal is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={(e) => {
        // Only close on direct backdrop clicks — prevents stray bubbled clicks
        // (e.g. from the trigger button rendered behind in DOM order) from
        // immediately dismissing the modal.
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
              {locale === "en" ? combo.name_en : combo.name_es}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {T("Personaliza tu combo", "Customize your combo")}
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
            <h3 className="font-bold text-base mb-3">
              1. {T("Elige tu galleta", "Choose your cookie")}
            </h3>
            {cookieRows.length === 0 ? (
              <div className="text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 p-4 text-center">
                {T(
                  "Este combo no tiene galletas configuradas todavía.",
                  "This combo has no cookies configured yet.",
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cookieRows.map(({ row, product }) => {
                  const selected = row.cookie_id === cookieId;
                  const name = locale === "en" ? product!.name_en : product!.name_es;
                  return (
                    <label
                      key={row.cookie_id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors"
                      style={{
                        borderColor: selected ? "#8b0031" : "#e5e7eb",
                        backgroundColor: selected ? "rgba(139,0,49,0.04)" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name="cookie"
                        checked={selected}
                        onChange={() => setCookieId(row.cookie_id)}
                        className="w-4 h-4"
                        style={{ accentColor: "#8b0031" }}
                      />
                      <span className="flex-1 text-sm font-medium">{name}</span>
                      {row.extra_price > 0 && (
                        <span className="text-xs font-bold" style={{ color: "#8b0031" }}>
                          +${row.extra_price.toLocaleString("es-CO")}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* Included salsa */}
          {combo.includes_salsa && (
            <section>
              <h3 className="font-bold text-base mb-3">
                2. {T("Salsa incluida", "Included sauce")}{" "}
                <span className="text-xs font-normal text-gray-400 ml-2">
                  {T("(elige una, sin costo)", "(pick one, free)")}
                </span>
              </h3>
              {salsaRows.length === 0 ? (
                <div className="text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 p-4 text-center">
                  {T(
                    "Sin salsas configuradas para este combo.",
                    "No sauces configured for this combo.",
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {salsaRows.map(({ row, product }) => {
                    const selected = row.salsa_id === includedSalsaId;
                    const name = locale === "en" ? product!.name_en : product!.name_es;
                    return (
                      <label
                        key={row.salsa_id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors"
                        style={{
                          borderColor: selected ? "#8b0031" : "#e5e7eb",
                          backgroundColor: selected ? "rgba(139,0,49,0.04)" : "transparent",
                        }}
                      >
                        <input
                          type="radio"
                          name="included-salsa"
                          checked={selected}
                          onChange={() => setIncludedSalsaId(row.salsa_id)}
                          className="w-4 h-4"
                          style={{ accentColor: "#8b0031" }}
                        />
                        <span className="flex-1 text-sm font-medium">{name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-600">
              {T("Total", "Total")}
            </span>
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
