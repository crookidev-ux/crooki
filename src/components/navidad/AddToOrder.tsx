"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bike, Check, Clock, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useStoreHours } from "@/components/order/useStoreHours";
import { MAX_LINE_QTY } from "@/lib/cart-limits";
import { optionUnitPrice } from "@/lib/pricing";
import { NEARBY_MAX_KM, type DeliveryRule } from "@/lib/delivery-zones";
import type { Product, ProductOption } from "@/lib/types";

const WHATSAPP_URL = "https://wa.me/573027190084";
const cop = (n: number) => `$${n.toLocaleString("es-CO")}`;

/**
 * Option picker (when the product has options), quantity picker and
 * «Agregar al pedido», with the wholesale note and the delivery and
 * opening-hours notes. Prices shown here are a preview: the checkout
 * re-prices every line on the server (src/lib/checkout/price-cart.ts).
 */
export default function AddToOrder({
  product,
  deliveryRule,
}: {
  product: Product;
  deliveryRule: DeliveryRule;
}) {
  const t = useTranslations("navidad");
  const tMenu = useTranslations("menu");
  const tHours = useTranslations("hours");
  const en = useLocale() === "en";
  const addItem = useCartStore((s) => s.addItem);
  const addOption = useCartStore((s) => s.addOption);
  const hours = useStoreHours();
  const options = product.product_options ?? [];
  const [optionId, setOptionId] = useState(options[0]?.id);
  const option: ProductOption | undefined = options.find((o) => o.id === optionId) ?? options[0];
  const minQty = option?.min_qty ?? 1;
  const [qty, setQty] = useState(minQty);
  const [added, setAdded] = useState(false);

  const note = "flex items-start gap-2.5 text-sm text-gray-700";
  const icon = "mt-0.5 h-4 w-4 shrink-0 text-[#8b0031]";
  const label = (o: ProductOption) => (en && o.label_en) || o.label_es;
  const name = (en && product.name_en) || product.name_es;
  const wholesaleNote = (en && product.note_en) || product.note_es;

  if (!product.available) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="mb-1 text-lg font-black text-gray-800">{t("sold_out")}</p>
        <p className="mb-4 text-sm text-gray-600">{t("sold_out_text")}</p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border-2 border-[#8b0031] px-5 font-bold text-[#8b0031] transition-colors hover:bg-[#8b0031] hover:text-white"
        >
          WhatsApp
        </a>
      </div>
    );
  }

  if (!option && !(product.price > 0)) {
    return (
      <div className="rounded-2xl bg-gray-50 px-5 py-4 text-center font-semibold text-gray-500">
        {t("ask_in_store")}
      </div>
    );
  }

  const pickOption = (o: ProductOption) => {
    setOptionId(o.id);
    setQty(o.min_qty);
  };

  const handleAdd = () => {
    if (option) {
      const { id, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price } = option;
      addOption(product, { id, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price }, qty);
    } else {
      addItem(product, qty);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const unit = option ? optionUnitPrice(option, qty) : null;
  const hasBulk = option?.bulk_min_qty != null && option.bulk_price != null;
  const bulkReached = hasBulk && qty >= option.bulk_min_qty!;

  const stepper =
    "flex h-11 w-11 items-center justify-center rounded-full text-[#8b0031] transition-colors hover:bg-[#8b0031]/10 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[#8b0031]";

  return (
    <div className="flex flex-col gap-5">
      {options.length > 1 && (
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-gray-900">{t("option_legend")}</legend>
          <div className="grid gap-2.5">
            {options.map((o) => {
              const checked = o.id === option?.id;
              return (
                <label
                  key={o.id}
                  className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#8b0031] ${
                    checked ? "border-[#8b0031] bg-[#8b0031]/5" : "border-[#f3c78b]/70 bg-white hover:border-[#8b0031]/40"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`option-${product.id}`}
                      value={o.id}
                      checked={checked}
                      onChange={() => pickOption(o)}
                      className="h-4 w-4 shrink-0 accent-[#8b0031]"
                    />
                    <span className="text-sm font-semibold leading-snug text-gray-900">{label(o)}</span>
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-[#8b0031]">{cop(o.price)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {option && unit !== null && (
        <div className="rounded-2xl bg-[#fdf8f0] px-4 py-3">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-2xl font-black text-[#8b0031] tabular-nums">{t("unit_price", { price: cop(unit) })}</span>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">{t("line_total", { total: cop(unit * qty) })}</span>
          </p>
          {option.min_qty > 1 && <p className="mt-1 text-sm font-semibold text-gray-800">{t("min_qty", { min: option.min_qty })}</p>}
          {hasBulk && (
            <p className={`mt-1 text-sm ${bulkReached ? "font-bold text-green-700" : "text-gray-700"}`} aria-live="polite">
              {bulkReached
                ? t("bulk_reached", { price: cop(option.bulk_price!) })
                : t("bulk_hint", { qty: option.bulk_min_qty!, price: cop(option.bulk_price!) })}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div role="group" aria-label={t("quantity")} className="flex items-center justify-between gap-1 rounded-full border-2 border-[#8b0031]/20 bg-white p-1 sm:justify-start">
          <button type="button" className={stepper} onClick={() => setQty((q) => Math.max(minQty, q - 1))} disabled={qty <= minQty} aria-label={t("decrease")}>
            <Minus aria-hidden="true" className="h-5 w-5" />
          </button>
          <output aria-live="polite" aria-label={t("quantity")} className="min-w-10 text-center text-lg font-black tabular-nums">
            {qty}
          </output>
          <button type="button" className={stepper} onClick={() => setQty((q) => Math.min(MAX_LINE_QTY, q + 1))} disabled={qty >= MAX_LINE_QTY} aria-label={t("increase")}>
            <Plus aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-[#8b0031]/25 transition-all hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
          style={{ backgroundColor: added ? "#16a34a" : "#8b0031" }}
        >
          {added ? <Check aria-hidden="true" className="h-5 w-5" /> : <ShoppingBag aria-hidden="true" className="h-5 w-5" />}
          {added ? t("added") : t("add")}
        </button>
      </div>
      {qty >= MAX_LINE_QTY && <p className="-mt-2 text-xs text-gray-500">{t("max_qty", { max: MAX_LINE_QTY })}</p>}
      <span className="sr-only" aria-live="polite">{added ? t("added") : ""}</span>

      {wholesaleNote && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#f3c78b] bg-[#fdf8f0] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-gray-800">{wholesaleNote}</p>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent(t("note_whatsapp", { name }))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#8b0031] px-4 text-sm font-bold text-[#8b0031] transition-colors hover:bg-[#8b0031] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            {t("note_cta")}
          </a>
        </div>
      )}

      <ul className="flex flex-col gap-2.5 border-t border-[#f3c78b]/70 pt-5">
        <li className={note}>
          {deliveryRule === "none" ? <ShoppingBag aria-hidden="true" className={icon} /> : <Bike aria-hidden="true" className={icon} />}
          {deliveryRule === "nearby"
            ? tMenu("delivery_nearby", { km: NEARBY_MAX_KM })
            : deliveryRule === "none"
              ? tMenu("delivery_none")
              : t("delivery_any")}
        </li>
        {hours && !hours.open && (
          <li className={note}>
            <Clock aria-hidden="true" className={icon} />
            <span>
              {tHours(hours.opensToday ? "closed_today" : "closed_tomorrow")} {tHours("closed_cta")}.
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
