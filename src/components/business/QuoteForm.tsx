"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildBusinessQuoteUrl } from "@/lib/whatsapp";
import { BUSINESS_PRODUCTS } from "@/lib/business-catalog";
import { STORE_TIME_ZONE } from "@/lib/store-hours";

// The WhatsApp message is always in Spanish (the shop reads it), so the
// options carry their Spanish label besides the translated one shown.
const OCCASIONS = [
  { key: "occ_yearend", es: "Regalo de fin de año" },
  { key: "occ_event", es: "Evento" },
  { key: "occ_meeting", es: "Reunión" },
  { key: "occ_other", es: "Otra" },
] as const;
const UNSURE = "unsure";
const UNSURE_ES = "Aún no sé";

type Field = "company" | "contact" | "occasion" | "product" | "quantity" | "date";
const FIELD_ORDER: Field[] = ["company", "contact", "occasion", "product", "quantity", "date"];

const fieldClass = "h-12 rounded-xl border-gray-300 bg-[#fdfbf8] px-4 text-base md:text-base focus-visible:border-[#8b0031] focus-visible:ring-[#8b0031]/20";
const selectClass =
  "h-12 w-full rounded-xl border border-gray-300 bg-[#fdfbf8] px-4 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

/** YYYY-MM-DD in Colombia, whatever the visitor's own clock zone. */
const todayInColombia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(new Date());

export default function QuoteForm() {
  const t = useTranslations("business");
  const [values, setValues] = useState({
    company: "",
    contact: "",
    occasion: "",
    product: "",
    quantity: "",
    date: "",
    city: "",
    budget: "",
    comments: "",
  });
  const [logo, setLogo] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [url, setUrl] = useState<string | null>(null);
  const today = todayInColombia();

  const set = (field: keyof typeof values) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (field in errors) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function validate(): Partial<Record<Field, string>> {
    const found: Partial<Record<Field, string>> = {};
    for (const f of ["company", "contact", "occasion", "product"] as const) {
      if (!values[f].trim()) found[f] = t("err_required");
    }
    const qty = Number(values.quantity);
    if (!values.quantity.trim()) found.quantity = t("err_required");
    else if (!Number.isInteger(qty) || qty < 1) found.quantity = t("err_quantity");
    if (!values.date) found.date = t("err_required");
    else if (values.date < today) found.date = t("err_date");
    return found;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      setUrl(null);
      document.getElementById(`quote-${first}`)?.focus();
      return;
    }
    const occasion = OCCASIONS.find((o) => o.key === values.occasion);
    const product = BUSINESS_PRODUCTS.find((p) => p.id === values.product);
    const next = buildBusinessQuoteUrl({
      company: values.company,
      contact: values.contact,
      occasion: occasion?.es ?? values.occasion,
      product: product?.name ?? UNSURE_ES,
      quantity: Number(values.quantity),
      date: values.date,
      city: values.city,
      budget: values.budget,
      logo,
      comments: values.comments,
    });
    setUrl(next);
    window.open(next, "_blank", "noopener");
  }

  const errorProps = (f: Field) =>
    errors[f]
      ? { "aria-invalid": true as const, "aria-describedby": `quote-${f}-error` }
      : {};
  const errorText = (f: Field) =>
    errors[f] ? (
      <p id={`quote-${f}-error`} role="alert" className="text-red-600 text-sm mt-1">
        {errors[f]}
      </p>
    ) : null;
  const label = (f: string, text: string, required = false) => (
    <Label htmlFor={`quote-${f}`} className="mb-2 font-semibold text-gray-900">
      {text}
      {required && " *"}
    </Label>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <div>
        {label("company", t("f_company"), true)}
        <Input
          id="quote-company"
          autoComplete="organization"
          value={values.company}
          onChange={(e) => set("company")(e.target.value)}
          className={fieldClass}
          {...errorProps("company")}
        />
        {errorText("company")}
      </div>
      <div>
        {label("contact", t("f_contact"), true)}
        <Input
          id="quote-contact"
          autoComplete="name"
          value={values.contact}
          onChange={(e) => set("contact")(e.target.value)}
          className={fieldClass}
          {...errorProps("contact")}
        />
        {errorText("contact")}
      </div>
      <div>
        {label("occasion", t("f_occasion"), true)}
        <select
          id="quote-occasion"
          value={values.occasion}
          onChange={(e) => set("occasion")(e.target.value)}
          className={selectClass}
          {...errorProps("occasion")}
        >
          <option value="" disabled>{t("f_choose")}</option>
          {OCCASIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {t(o.key)}
            </option>
          ))}
        </select>
        {errorText("occasion")}
      </div>
      <div>
        {label("product", t("f_product"), true)}
        <select
          id="quote-product"
          value={values.product}
          onChange={(e) => set("product")(e.target.value)}
          className={selectClass}
          {...errorProps("product")}
        >
          <option value="" disabled>{t("f_choose")}</option>
          {BUSINESS_PRODUCTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={UNSURE}>{t("f_product_unsure")}</option>
        </select>
        {errorText("product")}
      </div>
      <div>
        {label("quantity", t("f_quantity"), true)}
        <Input
          id="quote-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={values.quantity}
          onChange={(e) => set("quantity")(e.target.value)}
          className={fieldClass}
          {...errorProps("quantity")}
        />
        {errorText("quantity")}
      </div>
      <div>
        {label("date", t("f_date"), true)}
        <Input
          id="quote-date"
          type="date"
          min={today}
          value={values.date}
          onChange={(e) => set("date")(e.target.value)}
          className={fieldClass}
          {...errorProps("date")}
        />
        {errorText("date")}
      </div>
      <div>
        {label("city", t("f_city"))}
        <Input
          id="quote-city"
          autoComplete="address-level2"
          value={values.city}
          onChange={(e) => set("city")(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        {label("budget", t("f_budget"))}
        <Input
          id="quote-budget"
          inputMode="numeric"
          value={values.budget}
          onChange={(e) => set("budget")(e.target.value)}
          className={fieldClass}
        />
      </div>
      <label className="sm:col-span-2 flex items-start gap-3 text-gray-800 cursor-pointer">
        <input
          type="checkbox"
          checked={logo}
          onChange={(e) => setLogo(e.target.checked)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-[#8b0031]"
        />
        <span>{t("f_logo")}</span>
      </label>
      <div className="sm:col-span-2">
        {label("comments", t("f_comments"))}
        <Textarea
          id="quote-comments"
          rows={4}
          maxLength={500}
          value={values.comments}
          onChange={(e) => set("comments")(e.target.value)}
          className="rounded-xl border-gray-300 bg-[#fdfbf8] px-4 text-base md:text-base focus-visible:border-[#8b0031] focus-visible:ring-[#8b0031]/20"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 text-white text-lg font-bold px-8 py-4 rounded-full shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
          style={{ backgroundColor: "#8b0031" }}
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
          {t("submit")}
        </button>
        <div aria-live="polite">
          {url && (
            <p className="mt-4 text-gray-800">
              {t("opening")}{" "}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-[#8b0031]"
              >
                {t("fallback")}
              </a>
            </p>
          )}
        </div>
        <p className="mt-4 text-sm text-gray-600">
          {t.rich("privacy", {
            link: (chunks) => (
              <Link href="/legal/politica-de-datos" className="underline font-semibold text-[#8b0031]">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </form>
  );
}
