"use client";

// Barrio picker: a WAI-ARIA combobox (editable input + listbox). Shows up to 8
// matches with their delivery fee, or «Valor por confirmar» for barrios that
// are agreed over WhatsApp. "Fuera de Cartagena" is only offered when allowed
// (merch-only carts) and then always sits at the end of the list.
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Search } from "lucide-react";
import {
  getZone,
  OUTSIDE_CITY_ZONE_ID,
  searchZones,
  type DeliveryZone,
} from "@/lib/delivery-zones";

const MAX_RESULTS = 8;

interface Props {
  value: string | null;
  onChange: (zoneId: string | null) => void;
  allowOutsideCity: boolean;
  /** Error message to show (and announce) under the field. */
  error?: string;
}

export default function ZoneCombobox({ value, onChange, allowOutsideCity, error }: Props) {
  const t = useTranslations("checkout");
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;

  const zoneName = (z: DeliveryZone) =>
    z.id === OUTSIDE_CITY_ZONE_ID ? t("outside_city_option") : z.name;

  const selected = value ? getZone(value) : undefined;
  const [query, setQuery] = useState(selected ? zoneName(selected) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const results = useMemo(() => {
    const found = searchZones(query, MAX_RESULTS + 1).filter((z) => z.id !== OUTSIDE_CITY_ZONE_ID);
    if (!allowOutsideCity) return found.slice(0, MAX_RESULTS);
    const outside = getZone(OUTSIDE_CITY_ZONE_ID)!;
    return [...found.slice(0, MAX_RESULTS - 1), outside];
  }, [query, allowOutsideCity]);

  // With no text typed there is nothing to match, except the outside option.
  const showList = open && (query.trim().length > 0 || allowOutsideCity);
  const activeOption = showList && active >= 0 ? results[active] : undefined;

  const fee = (z: DeliveryZone) =>
    z.fee != null ? `$${z.fee.toLocaleString("es-CO")}` : t("zone_fee_tbd");

  const choose = (z: DeliveryZone) => {
    setQuery(zoneName(z));
    setOpen(false);
    setActive(-1);
    onChange(z.id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        setActive((i) => (results.length === 0 ? -1 : (i + 1) % results.length));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        setActive((i) =>
          results.length === 0 ? -1 : i <= 0 ? results.length - 1 : i - 1,
        );
        break;
      case "Enter":
        if (showList && activeOption) {
          e.preventDefault();
          choose(activeOption);
        } else if (showList) {
          // Never submit the order from inside the barrio search.
          e.preventDefault();
        }
        break;
      case "Escape":
        if (showList) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const describedBy = [selected ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-semibold mb-1.5 text-gray-700">
        {t("zone")} *
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("zone_placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b0031] focus:border-transparent transition-all ${
            error ? "border-red-400" : "border-gray-200"
          }`}
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label={t("zone")}
        hidden={!showList}
        className="absolute z-20 mt-1 w-full max-h-80 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
      >
        {results.map((z, i) => {
          const isActive = i === active;
          const isSelected = z.id === value;
          return (
            <li
              key={z.id}
              id={`${listId}-${z.id}`}
              role="option"
              aria-selected={isSelected}
              // Keep focus in the input so the click is not lost to blur.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(z)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                isActive ? "bg-[#fdf8f0]" : ""
              } ${z.id === OUTSIDE_CITY_ZONE_ID && i > 0 ? "border-t border-gray-100" : ""}`}
            >
              <span className="min-w-0">
                <span className={`block leading-snug ${isSelected ? "font-bold" : "font-medium"} text-gray-800`}>
                  {zoneName(z)}
                </span>
                {z.id !== OUTSIDE_CITY_ZONE_ID && (
                  <span className="block truncate text-xs text-gray-400">{z.sector}</span>
                )}
              </span>
              <span
                className={`shrink-0 text-xs ${z.fee != null ? "font-semibold text-gray-700" : "text-gray-500 italic"}`}
              >
                {fee(z)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="sr-only" aria-live="polite">
        {showList && results.length === 0 ? t("zone_no_results") : ""}
      </p>
      {showList && results.length === 0 && (
        <div
          aria-hidden="true"
          className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg"
        >
          {t("zone_no_results")}
        </div>
      )}

      {selected && (
        <p id={hintId} className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
          <MapPin aria-hidden="true" className="w-3.5 h-3.5" style={{ color: "#8b0031" }} />
          {t("delivery_fee")}: <span className="font-semibold">{fee(selected)}</span>
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-red-500 text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
