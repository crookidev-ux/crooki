"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bike, Check, Clock, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useStoreHours } from "@/components/order/useStoreHours";
import { MAX_LINE_QTY } from "@/lib/cart-limits";
import { NEARBY_MAX_KM, type DeliveryRule } from "@/lib/delivery-zones";
import type { Product } from "@/lib/types";

const WHATSAPP_URL = "https://wa.me/573027190084";

/** Quantity picker + «Agregar al pedido», with the delivery and opening-hours notes. */
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
  const addItem = useCartStore((s) => s.addItem);
  const hours = useStoreHours();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const note = "flex items-start gap-2.5 text-sm text-gray-700";
  const icon = "mt-0.5 h-4 w-4 shrink-0 text-[#8b0031]";

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

  if (!(product.price > 0)) {
    return (
      <div className="rounded-2xl bg-gray-50 px-5 py-4 text-center font-semibold text-gray-500">
        {t("ask_in_store")}
      </div>
    );
  }

  const handleAdd = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const stepper =
    "flex h-11 w-11 items-center justify-center rounded-full text-[#8b0031] transition-colors hover:bg-[#8b0031]/10 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[#8b0031]";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div role="group" aria-label={t("quantity")} className="flex items-center justify-between gap-1 rounded-full border-2 border-[#8b0031]/20 bg-white p-1 sm:justify-start">
          <button type="button" className={stepper} onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label={t("decrease")}>
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
