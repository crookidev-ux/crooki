"use client";

// "¿Cómo recibes tu pedido?" — native radio buttons styled as cards, so the
// browser gives us the radiogroup semantics and arrow-key navigation for free.
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Bike, ShoppingBag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { Fulfillment } from "@/lib/delivery-zones";

const ICONS: Record<Fulfillment, LucideIcon> = {
  delivery: Bike,
  pickup: ShoppingBag,
  dine_in: UtensilsCrossed,
};

const LABEL_KEYS = {
  delivery: "fulfillment_delivery",
  pickup: "fulfillment_pickup",
  dine_in: "fulfillment_dine_in",
} as const;

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

interface Props {
  value: Fulfillment;
  onChange: (value: Fulfillment) => void;
  options: Fulfillment[];
  /** Extra hint under the title (e.g. why only delivery is offered). */
  note?: string;
}

export default function FulfillmentPicker({ value, onChange, options, note }: Props) {
  const t = useTranslations("checkout");
  const name = useId();
  const noteId = `${name}-note`;

  return (
    <fieldset aria-describedby={note ? noteId : undefined}>
      <legend className="font-heading text-xl font-semibold mb-1" style={{ color: "#8b0031" }}>
        {t("fulfillment_title")}
      </legend>
      {note && (
        <p id={noteId} className="text-sm text-gray-500 mb-3">
          {note}
        </p>
      )}
      <div className={`grid gap-3 ${note ? "" : "mt-3"} ${GRID_COLS[options.length] ?? "grid-cols-3"}`}>
        {options.map((option) => {
          const Icon = ICONS[option];
          const checked = value === option;
          return (
            <label
              key={option}
              className={`relative flex cursor-pointer rounded-2xl border-2 px-2 py-4 text-center transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[#8b0031] has-[input:focus-visible]:ring-offset-2 ${
                options.length === 1
                  ? "flex-row items-center justify-center gap-3"
                  : "flex-col items-center gap-2"
              } ${checked ? "border-[#8b0031] bg-[#fdf8f0]" : "border-gray-200 bg-white hover:border-gray-300"}`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <Icon
                aria-hidden="true"
                className="w-7 h-7 shrink-0"
                style={{ color: checked ? "#8b0031" : "#9ca3af" }}
              />
              <span
                className={`text-sm leading-tight ${checked ? "font-bold" : "font-medium text-gray-700"}`}
                style={checked ? { color: "#8b0031" } : undefined}
              >
                {t(LABEL_KEYS[option])}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
