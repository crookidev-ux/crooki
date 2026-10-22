"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Minus, Plus, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { heladoUnitPrice } from "@/lib/pricing";
import type { HeladoSelection, Product } from "@/lib/types";

interface Props {
  helado: Product;
  productsById: Map<string, Product>;
  locale: string;
  onClose: () => void;
}

export default function HeladoConfigurator({ helado, productsById, locale, onClose }: Props) {
  const addHelado = useCartStore((s) => s.addHelado);
  const addItem = useCartStore((s) => s.addItem);

  // >0 means salsas are included in the price up to that count; 0 means extra/paid
  const maxSalsas = helado.included_salsas_count ?? 0;
  const isIncludedMode = maxSalsas > 0;

  const salsaRows = useMemo(
    () =>
      [...(helado.combo_salsas ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((r) => ({
          row: r,
          product: productsById.get(r.salsa_id),
        }))
        .filter((x) => !!x.product),
    [helado.combo_salsas, productsById],
  );

  const [salsaQty, setSalsaQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const totalSalsas = useMemo(
    () => Object.values(salsaQty).reduce((s, v) => s + v, 0),
    [salsaQty],
  );

  const unitPrice = heladoUnitPrice(
    helado.price,
    salsaRows.map(({ row }) => ({
      quantity: salsaQty[row.salsa_id] ?? 0,
      extraPrice: row.extra_price,
    })),
  );

  const setQty = (salsaId: string, delta: number) =>
    setSalsaQty((cur) => {
      const currentQty = cur[salsaId] ?? 0;
      if (delta > 0 && isIncludedMode) {
        const totalNow = Object.values(cur).reduce((s, v) => s + v, 0);
        if (totalNow >= maxSalsas) return cur;
      }
      const next = Math.max(0, currentQty + delta);
      return { ...cur, [salsaId]: next };
    });

  const handleAdd = () => {
    setSubmitting(true);

    const selection: HeladoSelection = {
      salsas: salsaRows
        .filter(({ row }) => (salsaQty[row.salsa_id] ?? 0) > 0)
        .map(({ row, product }) => ({
          salsaId: row.salsa_id,
          salsaName: locale === "en" ? product!.name_en : product!.name_es,
          quantity: salsaQty[row.salsa_id]!,
          extraPrice: row.extra_price,
        })),
    };

    if (selection.salsas.length === 0) {
      addItem(helado);
    } else {
      addHelado(helado, selection, unitPrice);
    }
    setSubmitting(false);
    onClose();
  };

  const T = (es: string, en: string) => (locale === "en" ? en : es);

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
              {locale === "en" ? helado.name_en : helado.name_es}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {T("Personaliza tu helado", "Customize your ice cream")}
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
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">
                {isIncludedMode
                  ? T(
                      `Salsa${maxSalsas > 1 ? "s" : ""} incluida${maxSalsas > 1 ? "s" : ""}`,
                      `Included sauce${maxSalsas > 1 ? "s" : ""}`,
                    )
                  : T("Salsas adicionales", "Extra sauces")}
                {" "}
                <span className="text-xs font-normal text-gray-400 ml-1">
                  {isIncludedMode
                    ? T(`(elige hasta ${maxSalsas})`, `(pick up to ${maxSalsas})`)
                    : T("(opcional, con costo extra)", "(optional, extra cost)")}
                </span>
              </h3>
              {isIncludedMode && (
                <span
                  className="text-sm font-bold px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: totalSalsas === maxSalsas ? "#16a34a" : "#f3f4f6",
                    color: totalSalsas === maxSalsas ? "#ffffff" : "#374151",
                  }}
                >
                  {totalSalsas} / {maxSalsas}
                </span>
              )}
            </div>

            {salsaRows.length === 0 ? (
              <div className="text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 p-4 text-center">
                {T("Sin salsas disponibles.", "No sauces available.")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {salsaRows.map(({ row, product }) => {
                  const qty = salsaQty[row.salsa_id] ?? 0;
                  const name = locale === "en" ? product!.name_en : product!.name_es;
                  const plusDisabled = isIncludedMode && totalSalsas >= maxSalsas;
                  return (
                    <div
                      key={row.salsa_id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {row.extra_price > 0 && (
                          <p className="text-xs" style={{ color: "#8b0031" }}>
                            +${row.extra_price.toLocaleString("es-CO")}{" "}
                            {T("por salsa", "per sauce")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQty(row.salsa_id, -1)}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(row.salsa_id, +1)}
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
          </section>
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
            disabled={submitting}
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
