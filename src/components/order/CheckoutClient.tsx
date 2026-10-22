"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/store/cart";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ShoppingBag, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buildWhatsAppOrderUrl } from "@/lib/whatsapp";
import { lineDisplayName } from "@/lib/pricing";

interface FormData {
  name: string;
  email: string;
  phone: string;
  recipient_phone: string;
  address: string;
  notes: string;
}

interface Props {
  locale: string;
}

export default function CheckoutClient({ locale }: Props) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const { items, total, clearCart } = useCartStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    recipient_phone: "",
    address: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [policyError, setPolicyError] = useState(false);

  const totalAmount = total();

  const validate = () => {
    const newErrors: Partial<FormData> = {};
    if (!form.name.trim()) newErrors.name = t("required");
    if (!form.email.trim()) newErrors.email = t("required");
    if (!form.phone.trim()) newErrors.phone = t("required");
    if (!form.recipient_phone.trim()) newErrors.recipient_phone = t("required");
    if (!form.address.trim()) newErrors.address = t("required");
    setErrors(newErrors);
    setPolicyError(!acceptedPolicy);
    return Object.keys(newErrors).length === 0 && acceptedPolicy;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    // Open a placeholder window synchronously inside the user-gesture so
    // browsers don't block the WhatsApp pop-up after the awaited RPC.
    const waWindow = typeof window !== "undefined" ? window.open("", "_blank") : null;

    try {
      const supabase = createClient();

      const rpcItems = items.map((item) => {
        const baseName = locale === "en" ? item.product.name_en : item.product.name_es;
        const productName = lineDisplayName(baseName, {
          combo: item.combo,
          box: item.box,
          helado: item.helado,
        });
        return {
          product_id: item.product.id,
          product_name: productName,
          quantity: item.quantity,
          unit_price: item.unitPrice ?? item.product.price,
        };
      });

      const { data: orderId, error: rpcError } = await supabase.rpc("create_public_order", {
        p_customer_name: form.name,
        p_customer_email: form.email,
        p_customer_phone: form.phone,
        p_customer_address: form.address,
        p_notes: form.notes,
        p_total: totalAmount,
        p_items: rpcItems,
      });

      if (rpcError) throw rpcError;
      if (!orderId) throw new Error("Order creation returned no id");

      const whatsappUrl = buildWhatsAppOrderUrl({
        id: orderId,
        customer_name: form.name,
        customer_address: form.address,
        recipient_phone: form.recipient_phone,
        notes: form.notes,
        total: totalAmount,
        order_items: rpcItems,
      });

      if (waWindow && !waWindow.closed) {
        waWindow.location.href = whatsappUrl;
      } else {
        // Popup was blocked or never opened — fall back to same-tab navigation
        // so the message still reaches WhatsApp without an extra tap.
        window.location.href = whatsappUrl;
      }

      clearCart();
      router.push(`/pedido/${orderId}`);
    } catch (err) {
      console.error(err);
      if (waWindow && !waWindow.closed) waWindow.close();
      toast.error("Hubo un error al procesar tu pedido. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
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
          style={{ backgroundColor: "#8b0031" }}
        >
          {tCart("go_to_menu")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al menú
        </Link>

        <h1 className="text-4xl font-black mb-2" style={{ color: "#8b0031" }}>
          {t("title")}
        </h1>
        <p className="text-gray-500 mb-10">{t("subtitle")}</p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form - 3 cols */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-3 flex flex-col gap-5"
          >
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("name")} *
              </label>
              <input
                type="text"
                placeholder={t("name_placeholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ focusRingColor: "#8b0031" } as React.CSSProperties}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("email")} *
              </label>
              <input
                type="email"
                placeholder={t("email_placeholder")}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("phone")} *
              </label>
              <input
                type="tel"
                placeholder={t("phone_placeholder")}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Recipient phone */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("recipient_phone")} *
              </label>
              <input
                type="tel"
                placeholder={t("recipient_phone_placeholder")}
                value={form.recipient_phone}
                onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              />
              {errors.recipient_phone && (
                <p className="text-red-500 text-xs mt-1">{errors.recipient_phone}</p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("address")} *
              </label>
              <input
                type="text"
                placeholder={t("address_placeholder")}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              />
              {errors.address && (
                <p className="text-red-500 text-xs mt-1">{errors.address}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("notes")}
              </label>
              <textarea
                placeholder={t("notes_placeholder")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none"
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
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[#8b0031]"
                />
                <span>
                  {t("privacy_accept")}{" "}
                  <Link
                    href="/legal/politica-de-datos"
                    target="_blank"
                    className="underline font-semibold"
                    style={{ color: "#8b0031" }}
                  >
                    {t("privacy_link")}
                  </Link>
                  {" *"}
                </span>
              </label>
              {policyError && (
                <p className="text-red-500 text-xs mt-1">{t("privacy_required")}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 text-white font-bold py-4 rounded-full text-lg transition-all hover:opacity-90 disabled:opacity-60 mt-2"
              style={{ backgroundColor: "#8b0031" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </button>
          </form>

          {/* Order Summary - 2 cols */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-24">
              <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" style={{ color: "#8b0031" }} />
                {t("order_summary")}
              </h2>

              <div className="flex flex-col gap-3 mb-5">
                {items.map((item) => {
                  const { product, quantity, lineId, combo, box, helado, unitPrice } = item;
                  const name = locale === "en" ? product.name_en : product.name_es;
                  const linePrice = unitPrice ?? product.price;
                  return (
                    <div
                      key={lineId}
                      className="flex justify-between items-start gap-2 text-sm"
                    >
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
                            {helado.salsas
                              .map((s) => `${s.quantity}× ${s.salsaName}`)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold flex-shrink-0">
                        ${(linePrice * quantity).toLocaleString("es-CO")}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-700">{t("total")}</span>
                  <span
                    className="font-black text-2xl"
                    style={{ color: "#8b0031" }}
                  >
                    ${totalAmount.toLocaleString("es-CO")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
