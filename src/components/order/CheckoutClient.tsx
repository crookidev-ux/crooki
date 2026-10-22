"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/store/cart";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { ShoppingBag, ArrowLeft, Loader2, CreditCard, QrCode, Info } from "lucide-react";
import {
  allowedFulfillments,
  getZone,
  onlinePaymentAllowed,
  OUTSIDE_CITY_ZONE_ID,
  zoneAllowed,
  type Fulfillment,
} from "@/lib/delivery-zones";
import type { BoldClientConfig } from "@/lib/bold";
import type { CheckoutInput, CheckoutItemInput } from "@/lib/checkout/schema";
import type { CartItem } from "@/lib/types";
import FulfillmentPicker from "./FulfillmentPicker";
import ZoneCombobox from "./ZoneCombobox";
import { useBoldCheckout } from "./useBoldCheckout";

// Mirrors BOLD_MIN_AMOUNT in src/lib/bold.ts, which can't be imported here
// (it pulls in node:crypto). The server enforces the real limit.
const BOLD_MIN_AMOUNT = 1000;

const BRAND = "#8b0031";

interface FormData {
  name: string;
  email: string;
  phone: string;
  recipient_phone: string;
  address: string;
  city: string;
  notes: string;
}

type FieldKey = keyof FormData | "zone";
type Errors = Partial<Record<FieldKey, string>>;

type CheckoutOk = { orderId: string; total: number; whatsappUrl?: string; bold?: BoldClientConfig };
type CheckoutErr = { error?: string; unavailable?: string[]; orderId?: string };

type PreparedPayment = { key: string; orderId: string; total: number; bold: BoldClientConfig };

interface Props {
  locale: string;
  boldEnabled: boolean;
  merchCategorySlugs: string[];
}

const money = (n: number) => `$${n.toLocaleString("es-CO")}`;

function toItemInput(item: CartItem): CheckoutItemInput {
  const base: CheckoutItemInput = { productId: item.product.id, quantity: item.quantity };
  if (item.combo) {
    return {
      ...base,
      combo: {
        cookieId: item.combo.cookieId,
        ...(item.combo.includedSalsaId ? { includedSalsaId: item.combo.includedSalsaId } : {}),
      },
    };
  }
  if (item.box) {
    return {
      ...base,
      box: {
        cookies: item.box.cookies.map((c) => ({ cookieId: c.cookieId, quantity: c.quantity })),
        giftCard: item.box.giftCard,
      },
    };
  }
  if (item.helado) {
    return {
      ...base,
      helado: { salsas: item.helado.salsas.map((s) => ({ salsaId: s.salsaId, quantity: s.quantity })) },
    };
  }
  return base;
}

const inputClass = (invalid: boolean) =>
  `w-full border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8b0031] focus:border-transparent transition-all ${
    invalid ? "border-red-400" : "border-gray-200"
  }`;

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

function TextField({ id, label, value, onChange, error, required, type = "text", placeholder, autoComplete, inputMode }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-1.5 text-gray-700">
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass(Boolean(error))}
      />
      {error && (
        <p id={errorId} role="alert" className="text-red-500 text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col gap-4">
      {title && (
        <h2 className="text-xl font-semibold" style={{ color: BRAND }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export default function CheckoutClient({ locale, boldEnabled, merchCategorySlugs }: Props) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const { items, total, clearCart } = useCartStore();
  const router = useRouter();
  const bold = useBoldCheckout(boldEnabled);
  const formRef = useRef<HTMLFormElement>(null);
  // Synchronous double-tap guard (render state lags behind fast taps).
  const inFlight = useRef(false);

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    recipient_phone: "",
    address: "",
    city: "",
    notes: "",
  });
  const [fulfillmentChoice, setFulfillmentChoice] = useState<Fulfillment>("delivery");
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [pending, setPending] = useState<"bold" | "qr" | null>(null);
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  // Set once an order exists and the cart was emptied, so the page shows a
  // "go to your order" panel instead of the empty-cart screen.
  const [startedOrderId, setStartedOrderId] = useState<string | null>(null);

  const set = (key: keyof FormData) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Cart composition (UI hint only; /api/checkout enforces the same rules).
  const merchSlugs = useMemo(() => new Set(merchCategorySlugs), [merchCategorySlugs]);
  const hasMerch = items.some((i) => merchSlugs.has(i.product.category));
  const hasFood = items.some((i) => !merchSlugs.has(i.product.category));
  const options = allowedFulfillments({ hasMerch });
  const fulfillment = options.includes(fulfillmentChoice) ? fulfillmentChoice : options[0];
  const isDelivery = fulfillment === "delivery";
  const zoneId = isDelivery && zoneChoice && zoneAllowed(zoneChoice, { hasFood }) ? zoneChoice : null;
  const zone = zoneId ? getZone(zoneId) : undefined;
  const isOutsideCity = zoneId === OUTSIDE_CITY_ZONE_ID;

  const subtotal = total();
  const deliveryFee = zone?.fee ?? 0;
  const totalPreview = subtotal + deliveryFee;

  const buildBody = (paymentMethod: "bold" | "qr"): CheckoutInput => {
    const body: CheckoutInput = {
      locale: locale === "en" ? "en" : "es",
      customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      fulfillment,
      notes: form.notes.trim(),
      paymentMethod,
      acceptedPolicy: true,
      items: items.map(toItemInput),
    };
    if (isDelivery && zoneId) {
      body.delivery = {
        zoneId,
        address: form.address.trim(),
        recipientPhone: form.recipient_phone.trim(),
        ...(isOutsideCity ? { city: form.city.trim() } : {}),
      };
    }
    return body;
  };

  // A server-priced payment is reused only while nothing in the request changed.
  const boldKey = JSON.stringify(buildBody("bold"));
  const activePrepared = prepared && prepared.key === boldKey ? prepared : null;
  const displayTotal = activePrepared ? activePrepared.total : totalPreview;
  // Keep the visible arithmetic consistent: subtotal + domicilio = total.
  const displaySubtotal = activePrepared ? activePrepared.total - deliveryFee : subtotal;

  // «Pagar» is hidden for barrios whose fee is agreed over WhatsApp. With no
  // barrio picked yet it stays visible; validation asks for the barrio.
  const zoneBlocksOnline = isDelivery && zone !== undefined && !onlinePaymentAllowed(zone, fulfillment);
  const showPay = boldEnabled && !zoneBlocksOnline && !bold.failed && displayTotal >= BOLD_MIN_AMOUNT;
  const showPayUnavailable = boldEnabled && !zoneBlocksOnline && bold.failed;
  const busy = pending !== null;

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = t("required");
    if (!form.email.trim()) e.email = t("required");
    else if (!/^[^\s@]+@[^\s@]+$/.test(form.email.trim())) e.email = t("email_invalid");
    if (!form.phone.trim()) e.phone = t("required");
    if (isDelivery) {
      if (!zoneId) e.zone = t("required");
      if (isOutsideCity && !form.city.trim()) e.city = t("required");
      if (!form.address.trim()) e.address = t("required");
      if (!form.recipient_phone.trim()) e.recipient_phone = t("required");
    }
    setErrors(e);
    setPolicyError(!acceptedPolicy);
    const ok = Object.keys(e).length === 0 && acceptedPolicy;
    if (!ok) {
      // Move focus to the first problem so it is seen and announced.
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
    }
    return ok;
  };

  const unavailableNames = (ids: string[]): string => {
    const names = new Map<string, string>();
    for (const i of items) {
      names.set(i.product.id, locale === "en" ? i.product.name_en : i.product.name_es);
      if (i.combo) {
        names.set(i.combo.cookieId, i.combo.cookieName);
        if (i.combo.includedSalsaId && i.combo.includedSalsaName) {
          names.set(i.combo.includedSalsaId, i.combo.includedSalsaName);
        }
      }
      i.box?.cookies.forEach((c) => names.set(c.cookieId, c.cookieName));
      i.helado?.salsas.forEach((s) => names.set(s.salsaId, s.salsaName));
    }
    return [...new Set(ids.map((id) => names.get(id)).filter(Boolean))].join(", ");
  };

  const handleFailure = (status: number, data: CheckoutErr) => {
    if (data.orderId) {
      // The order was created but the payment couldn't start: its page lets
      // the customer retry without placing a second order.
      clearCart();
      setStartedOrderId(data.orderId);
      toast.error(t("error_generic"));
      router.push(`/pedido/${data.orderId}`);
      return;
    }
    if (status === 409 && data.unavailable?.length) {
      const names = unavailableNames(data.unavailable);
      toast.error(names ? t("unavailable", { names }) : t("error_generic"));
      return;
    }
    if (status === 503) {
      toast.error(t("pay_unavailable"));
      return;
    }
    toast.error(t("error_generic"));
  };

  const postCheckout = async (body: string) => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as CheckoutOk & CheckoutErr;
    return { res, data };
  };

  const openPayment = (p: PreparedPayment) => {
    clearCart();
    setStartedOrderId(p.orderId);
    try {
      bold.open(p.bold);
    } catch (err) {
      console.error(err);
      router.push(`/pedido/${p.orderId}`);
    }
  };

  const payOnline = async () => {
    if (inFlight.current || busy || !validate()) return;
    if (!bold.ready) return;
    if (activePrepared) {
      openPayment(activePrepared);
      return;
    }
    const key = boldKey;
    inFlight.current = true;
    setPending("bold");
    try {
      const { res, data } = await postCheckout(key);
      if (!res.ok || !data.bold || !data.orderId) {
        handleFailure(res.status, data);
        return;
      }
      const payment = { key, orderId: data.orderId, total: data.total, bold: data.bold };
      if (data.total !== totalPreview) {
        // Show the server's total first; Bold opens on the next tap.
        setPrepared(payment);
        toast.warning(t("price_changed"));
        return;
      }
      openPayment(payment);
    } catch (err) {
      console.error(err);
      toast.error(t("error_generic"));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const payByQr = async () => {
    if (inFlight.current || busy || !validate()) return;
    inFlight.current = true;
    // Open a placeholder window synchronously inside the user gesture so the
    // browser doesn't block the WhatsApp pop-up after the awaited request.
    const waWindow = window.open("", "_blank");
    setPending("qr");
    try {
      const { res, data } = await postCheckout(JSON.stringify(buildBody("qr")));
      if (!res.ok || !data.whatsappUrl || !data.orderId) {
        if (waWindow && !waWindow.closed) waWindow.close();
        handleFailure(res.status, data);
        return;
      }
      if (waWindow && !waWindow.closed) {
        waWindow.location.href = data.whatsappUrl;
      } else {
        // Pop-up blocked: same-tab navigation so the message still reaches WhatsApp.
        window.location.href = data.whatsappUrl;
      }
      clearCart();
      setStartedOrderId(data.orderId);
      router.push(`/pedido/${data.orderId}`);
    } catch (err) {
      console.error(err);
      if (waWindow && !waWindow.closed) waWindow.close();
      toast.error(t("error_generic"));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Enter in a field submits with the first (primary) button.
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const method = submitter?.dataset.method ?? (showPay ? "bold" : "qr");
    if (method === "bold") void payOnline();
    else void payByQr();
  };

  if (items.length === 0) {
    if (startedOrderId) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
          <Loader2 aria-hidden="true" className="w-10 h-10 animate-spin" style={{ color: BRAND }} />
          <p className="text-lg font-semibold text-gray-700" role="status">
            {t("payment_opening")}
          </p>
          <Link
            href={`/pedido/${startedOrderId}`}
            className="text-white font-bold px-8 py-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
            style={{ backgroundColor: BRAND }}
          >
            {t("view_order")}
          </Link>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <ShoppingBag className="w-20 h-20 text-gray-200" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">{tCart("empty")}</h2>
          <p className="text-gray-500">{tCart("empty_desc")}</p>
        </div>
        <Link
          href="/menu"
          className="text-white font-bold px-8 py-3 rounded-full"
          style={{ backgroundColor: BRAND }}
        >
          {tCart("go_to_menu")}
        </Link>
      </div>
    );
  }

  const formId = "checkout-form";
  const qrIsPrimary = !showPay;

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 sm:mb-8 transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          {t("back_to_menu")}
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black mb-2" style={{ color: BRAND }}>
          {t("title")}
        </h1>
        <p className="text-gray-500 mb-8 sm:mb-10">{t("subtitle")}</p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          <form
            id={formId}
            ref={formRef}
            onSubmit={handleSubmit}
            noValidate
            className="lg:col-span-3 flex flex-col gap-5"
          >
            <Section>
              <FulfillmentPicker
                value={fulfillment}
                onChange={setFulfillmentChoice}
                options={options}
                note={hasMerch ? t("merch_delivery_only") : undefined}
              />
            </Section>

            <Section title={t("your_details")}>
              <TextField
                id="checkout-name"
                label={t("name")}
                required
                placeholder={t("name_placeholder")}
                autoComplete="name"
                value={form.name}
                onChange={set("name")}
                error={errors.name}
              />
              <TextField
                id="checkout-email"
                label={t("email")}
                required
                type="email"
                placeholder={t("email_placeholder")}
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                error={errors.email}
              />
              <TextField
                id="checkout-phone"
                label={t("phone")}
                required
                type="tel"
                inputMode="tel"
                placeholder={t("phone_placeholder")}
                autoComplete="tel"
                value={form.phone}
                onChange={set("phone")}
                error={errors.phone}
              />
            </Section>

            {isDelivery && (
              <Section title={t("fulfillment_delivery")}>
                <ZoneCombobox
                  value={zoneId}
                  onChange={(id) => {
                    setZoneChoice(id);
                    if (id) setErrors((e) => ({ ...e, zone: undefined }));
                  }}
                  allowOutsideCity={!hasFood}
                  error={errors.zone}
                />
                {isOutsideCity && (
                  <TextField
                    id="checkout-city"
                    label={t("outside_city_city")}
                    required
                    placeholder={t("city_placeholder")}
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={set("city")}
                    error={errors.city}
                  />
                )}
                <TextField
                  id="checkout-address"
                  label={t("address")}
                  required
                  placeholder={t("address_placeholder")}
                  autoComplete="street-address"
                  value={form.address}
                  onChange={set("address")}
                  error={errors.address}
                />
                <TextField
                  id="checkout-recipient-phone"
                  label={t("recipient_phone")}
                  required
                  type="tel"
                  inputMode="tel"
                  placeholder={t("recipient_phone_placeholder")}
                  autoComplete="tel"
                  value={form.recipient_phone}
                  onChange={set("recipient_phone")}
                  error={errors.recipient_phone}
                />
              </Section>
            )}

            <Section>
              <div>
                <label htmlFor="checkout-notes" className="block text-sm font-semibold mb-1.5 text-gray-700">
                  {t("notes")}
                </label>
                <textarea
                  id="checkout-notes"
                  placeholder={t("notes_placeholder")}
                  value={form.notes}
                  onChange={(e) => set("notes")(e.target.value)}
                  rows={3}
                  className={`${inputClass(false)} resize-none`}
                />
              </div>

              {/* Data policy consent (Ley 1581 de 2012) */}
              <div>
                <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPolicy}
                    onChange={(e) => {
                      setAcceptedPolicy(e.target.checked);
                      if (e.target.checked) setPolicyError(false);
                    }}
                    aria-invalid={policyError ? true : undefined}
                    aria-describedby={policyError ? "checkout-policy-error" : undefined}
                    className="mt-0.5 w-5 h-5 sm:w-4 sm:h-4 shrink-0 accent-[#8b0031]"
                  />
                  <span>
                    {t("privacy_accept")}{" "}
                    <Link
                      href="/legal/politica-de-datos"
                      target="_blank"
                      className="underline font-semibold"
                      style={{ color: BRAND }}
                    >
                      {t("privacy_link")}
                    </Link>
                    {" *"}
                  </span>
                </label>
                {policyError && (
                  <p id="checkout-policy-error" role="alert" className="text-red-500 text-xs mt-1">
                    {t("privacy_required")}
                  </p>
                )}
              </div>
            </Section>
          </form>

          {/* Summary + payment buttons: after the form on phones, beside it on desktop. */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 lg:sticky lg:top-24">
              <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
                <ShoppingBag aria-hidden="true" className="w-5 h-5" style={{ color: BRAND }} />
                {t("order_summary")}
              </h2>

              <div className="flex flex-col gap-3 mb-5">
                {items.map((item) => {
                  const { product, quantity, lineId, combo, box, helado, unitPrice } = item;
                  const name = locale === "en" ? product.name_en : product.name_es;
                  const linePrice = unitPrice ?? product.price;
                  return (
                    <div key={lineId} className="flex justify-between items-start gap-2 text-sm">
                      <div className="text-gray-700 leading-tight min-w-0">
                        <div>
                          {name} <span className="text-gray-400">x{quantity}</span>
                        </div>
                        {combo && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {combo.cookieName}
                            {combo.includedSalsaName && ` · ${combo.includedSalsaName}`}
                            {combo.additionalSalsas.length > 0 &&
                              ` · ` +
                                combo.additionalSalsas
                                  .map((a) => `${a.quantity}× ${a.salsaName}`)
                                  .join(", ")}
                          </div>
                        )}
                        {box && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {box.cookies.map((c) => `${c.quantity}× ${c.cookieName}`).join(", ")}
                            {box.giftCard === "card" && " · Gift card"}
                            {box.giftCard === "card_and_cake" && " · Gift card + vela"}
                          </div>
                        )}
                        {helado && helado.salsas.length > 0 && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {helado.salsas.map((s) => `${s.quantity}× ${s.salsaName}`).join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold flex-shrink-0">{money(linePrice * quantity)}</span>
                    </div>
                  );
                })}
              </div>

              <dl className="border-t pt-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between items-center text-gray-600">
                  <dt>{t("subtotal")}</dt>
                  <dd>{money(displaySubtotal)}</dd>
                </div>
                {isDelivery && zone && (
                  <div className="flex justify-between items-center text-gray-600 gap-3">
                    <dt>{t("delivery_fee")}</dt>
                    <dd className={zone.fee == null ? "italic text-right" : undefined}>
                      {zone.fee != null ? money(zone.fee) : t("zone_fee_tbd")}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <dt className="font-bold text-gray-700 text-base">{t("total")}</dt>
                  <dd className="font-black text-2xl" style={{ color: BRAND }} aria-live="polite">
                    {money(displayTotal)}
                  </dd>
                </div>
              </dl>

              {activePrepared && (
                <p
                  role="status"
                  className="mt-3 flex items-start gap-2 rounded-xl bg-[#fdf8f0] px-4 py-3 text-sm text-gray-700"
                >
                  <Info aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: BRAND }} />
                  {t("price_changed")}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {zoneBlocksOnline && boldEnabled && (
                  <p className="flex items-start gap-2 rounded-xl bg-[#fdf8f0] px-4 py-3 text-sm text-gray-700">
                    <Info aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: BRAND }} />
                    {t("pay_qr_only_note")}
                  </p>
                )}
                {showPayUnavailable && (
                  <p role="status" className="flex items-start gap-2 rounded-xl bg-[#fdf8f0] px-4 py-3 text-sm text-gray-700">
                    <Info aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: BRAND }} />
                    {t("pay_unavailable")}
                  </p>
                )}

                {showPay && (
                  <button
                    type="submit"
                    form={formId}
                    data-method="bold"
                    disabled={busy || !bold.ready}
                    aria-busy={pending === "bold" || !bold.ready ? true : undefined}
                    className="w-full flex items-center justify-center gap-3 text-white font-bold py-4 rounded-full text-lg transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
                    style={{ backgroundColor: BRAND }}
                  >
                    {pending === "bold" || !bold.ready ? (
                      <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                    ) : (
                      <CreditCard aria-hidden="true" className="w-5 h-5" />
                    )}
                    {pending === "bold" ? t("submitting") : t("pay", { amount: money(displayTotal) })}
                  </button>
                )}

                <button
                  type="submit"
                  form={formId}
                  data-method="qr"
                  disabled={busy}
                  aria-busy={pending === "qr" ? true : undefined}
                  className={`w-full flex items-center justify-center gap-3 font-bold rounded-full transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031] ${
                    qrIsPrimary
                      ? "text-white py-4 text-lg hover:opacity-90"
                      : "border-2 py-3.5 text-base bg-white hover:bg-[#fdf8f0]"
                  }`}
                  style={
                    qrIsPrimary
                      ? { backgroundColor: BRAND }
                      : { borderColor: BRAND, color: BRAND }
                  }
                >
                  {pending === "qr" ? (
                    <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                  ) : (
                    <QrCode aria-hidden="true" className="w-5 h-5" />
                  )}
                  {pending === "qr" ? t("submitting") : t("pay_qr")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
