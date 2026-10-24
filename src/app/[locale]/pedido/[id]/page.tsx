import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Link, getPathname } from "@/i18n/navigation";
import {
  CheckCircle2,
  Package,
  ArrowLeft,
  MessageCircle,
  Clock,
  RefreshCw,
  CircleAlert,
  Download,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { buildWhatsAppOrderUrl, customerNotes } from "@/lib/whatsapp";
import { fetchBoldStatus } from "@/lib/bold-status";
import { AMOUNT_MISMATCH_NOTE, ConcurrentUpdateError, confirmAttempt } from "@/lib/payments";
import { hasSystemNote } from "@/lib/payments.confirm";
import { retryBlockReason } from "@/lib/payments.config";
import { isBoldConfigured } from "@/lib/bold";
import { deliveryFeeSettled } from "@/lib/delivery-zones";
import type { Order, OrderItem, PaymentAttempt } from "@/lib/types";
import OrderPaymentActions from "@/components/order/OrderPaymentActions";

// Checkout and order pages are private: keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };
// Payment state must always come fresh from the database: awaiting
// `searchParams` makes this page render per request (never cached).

const BRAND = "#8b0031";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRow = Order & { order_items: OrderItem[] };
type AttemptRow = Pick<PaymentAttempt, "bold_order_id" | "status" | "bold_payment_id" | "created_at">;
type View = "paid" | "confirming" | "review" | "failed" | "qr";

// Service-role client (cookie-less): the orders table is RLS-locked, but the
// customer who just placed an anonymous order needs to see their own page.
// Their order id (a UUID, unguessable) is the bearer token for this page.
async function loadOrder(supabase: SupabaseClient, id: string): Promise<OrderRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error(`[pedido] load order ${id}`, error);
  return (data as OrderRow | null) ?? null;
}

async function loadAttempts(supabase: SupabaseClient, orderId: string): Promise<AttemptRow[]> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("bold_order_id, status, bold_payment_id, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error) console.error(`[pedido] load attempts ${orderId}`, error);
  return (data as AttemptRow[] | null) ?? [];
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, id } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  if (!UUID.test(id)) notFound();

  const supabase = createServiceClient();
  let order = await loadOrder(supabase, id);
  if (!order) notFound();

  let attempts: AttemptRow[] = [];
  // Bold reported the payment as still in progress: never offer a second charge.
  let boldPending = false;

  if (order.payment_method === "bold") {
    attempts = await loadAttempts(supabase, order.id);
    const latest = attempts[0];
    // Fallback for a late webhook: ask Bold about the latest attempt. Any
    // failure here is logged and the page shows what the database says.
    // Only an attempt still `created` can change; final ones need no Bold call.
    if (order.payment_status !== "paid" && latest?.status === "created") {
      try {
        const status = await fetchBoldStatus(latest.bold_order_id);
        if (status?.status === "APPROVED") {
          // Bold's reported amount, so the amount check in confirmAttempt is meaningful.
          await confirmAttempt(supabase, latest.bold_order_id, {
            kind: "approved",
            amount: status.total,
            paymentId: status.transactionId,
          });
        } else if (status?.status === "REJECTED" || status?.status === "FAILED") {
          await confirmAttempt(supabase, latest.bold_order_id, { kind: "rejected" });
        } else if (status?.status === "PENDING" || status?.status === "PROCESSING") {
          boldPending = true;
        }
        if (status?.status === "APPROVED" || status?.status === "REJECTED" || status?.status === "FAILED") {
          order = (await loadOrder(supabase, id)) ?? order;
          attempts = await loadAttempts(supabase, order.id);
        }
      } catch (e) {
        if (e instanceof ConcurrentUpdateError) {
          // Another writer changed the attempt meanwhile: show the fresh state,
          // and «confirming» rather than offering a new charge.
          boldPending = true;
          order = (await loadOrder(supabase, id)) ?? order;
          attempts = await loadAttempts(supabase, order.id);
        } else {
          console.error(`[pedido] payment status fallback failed for order ${id}`, e);
        }
      }
    }
  }

  const txStatus = first(query["bold-tx-status"])?.toLowerCase();
  const isPaid = order.payment_method === "bold" && order.payment_status === "paid";
  // An approved attempt that did not mark the order paid (e.g. Bold charged a
  // different amount, flagged with a note): money was taken, so never offer another charge.
  const needsReview =
    !isPaid &&
    (attempts.some((a) => a.status === "approved") ||
      hasSystemNote(order.notes, AMOUNT_MISMATCH_NOTE));
  const view: View =
    order.payment_method !== "bold"
      ? "qr"
      : isPaid
        ? "paid"
        : needsReview
          ? "review"
          : txStatus === "approved" || txStatus === "pending" || boldPending
            ? "confirming"
            : "failed";

  const paymentId = isPaid
    ? (attempts.find((a) => a.status === "approved" && a.bold_payment_id)?.bold_payment_id ?? null)
    : null;

  // QR order with a final total: the page shows the shop's QR and WhatsApp is
  // for sending the receipt. A «Consultar» delivery agrees the fee first.
  const qrPay = view === "qr" && deliveryFeeSettled(order);

  const whatsappUrl = buildWhatsAppOrderUrl({
    ...order,
    total: Number(order.total),
    delivery_fee: Number(order.delivery_fee) || 0,
    bold_payment_id: paymentId,
    payment_review: view === "review",
    qr_receipt: qrPay,
  });

  const total = Number(order.total);
  const fee = Number(order.delivery_fee) || 0;
  const notes = customerNotes(order.notes);
  const isDelivery = order.fulfillment === "delivery";
  const fulfillmentLabel = t(`fulfillment_${order.fulfillment ?? "delivery"}`);
  // Plain <a> (full page load) so the reload surely refetches from the server.
  const reloadHref = `${getPathname({ href: `/pedido/${order.id}`, locale })}?${new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, first(v) ?? ""]])),
  ).toString()}`;
  const canRetry =
    isBoldConfigured() &&
    retryBlockReason(order, {
      hasApprovedAttempt: attempts.some((a) => a.status === "approved"),
      amountMismatch: hasSystemNote(order.notes, AMOUNT_MISMATCH_NOTE),
    }) === null;

  const header = {
    paid: { Icon: CheckCircle2, title: t("paid_title"), body: t("paid_body") },
    confirming: { Icon: Clock, title: t("confirming_title"), body: t("confirming_body") },
    review: { Icon: Clock, title: t("review_title"), body: t("review_body") },
    failed: { Icon: CircleAlert, title: t("failed_title"), body: t("failed_body") },
    qr: { Icon: CheckCircle2, title: t("title"), body: qrPay ? t("qr_subtitle") : t("subtitle") },
  }[view];
  const HeaderIcon = header.Icon;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="max-w-lg w-full text-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ backgroundColor: "#8b003115" }}
        >
          <HeaderIcon aria-hidden="true" className="w-14 h-14" style={{ color: BRAND }} />
        </div>

        <h1 className="font-heading text-4xl font-black mb-3" style={{ color: BRAND }}>
          {header.title}
        </h1>
        <p className="text-gray-600 text-lg mb-2">{header.body}</p>
        <p className="text-gray-500 text-sm mb-8">
          {t("order_number")}:{" "}
          <span className="font-mono font-bold text-gray-700">
            {order.id.slice(0, 8).toUpperCase()}
          </span>
          {paymentId && (
            <>
              <br />
              {t("payment_ref")}:{" "}
              <span className="font-mono font-bold text-gray-700 break-all">{paymentId}</span>
            </>
          )}
        </p>

        {/* Paid: sending the receipt is how the shop learns about the order. */}
        {view === "paid" && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 text-white font-bold py-4 px-6 rounded-full transition-opacity hover:opacity-90 text-lg mb-6 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
            {t("send_receipt")}
          </a>
        )}

        {view === "confirming" && (
          <a
            href={reloadHref}
            className="flex items-center justify-center gap-2 text-white font-bold py-4 rounded-full transition-opacity hover:opacity-90 text-lg mb-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
            style={{ backgroundColor: BRAND }}
          >
            <RefreshCw aria-hidden="true" className="w-5 h-5" />
            {t("reload")}
          </a>
        )}

        {view === "review" && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 text-white font-bold py-4 px-6 rounded-full transition-opacity hover:opacity-90 text-lg mb-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
            {t("contact_whatsapp")}
          </a>
        )}

        {view === "failed" && (
          <div className="mb-6">
            <OrderPaymentActions
              orderId={order.id}
              locale={locale === "en" ? "en" : "es"}
              canRetry={canRetry}
            />
          </div>
        )}

        {qrPay && (
          <>
            <section
              aria-labelledby="qr-pay-title"
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left mb-4"
            >
              <h2 id="qr-pay-title" className="font-heading text-xl font-bold mb-1" style={{ color: BRAND }}>
                {t("qr_pay_title")}
              </h2>
              <p className="text-sm text-gray-600">
                {t("qr_amount_label")}{" "}
                <span className="font-black text-2xl whitespace-nowrap" style={{ color: BRAND }}>
                  ${total.toLocaleString("es-CO")}
                </span>
              </p>
              {/* Served as-is (already a small webp) so the QR's modules stay sharp. */}
              <Image
                src="/pagos/qr-bold-breb.webp"
                alt={t("qr_image_alt")}
                width={720}
                height={742}
                unoptimized
                className="w-full max-w-xs h-auto mx-auto my-4"
              />
              <a
                href="/pagos/qr-bold-breb.png"
                download="QR-Crooki.png"
                className="flex items-center justify-center gap-2 font-semibold py-3 rounded-full border-2 transition-colors hover:bg-[#8b0031]/5 text-sm mb-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
                style={{ borderColor: BRAND, color: BRAND }}
              >
                <Download aria-hidden="true" className="w-4 h-4" />
                {t("qr_save")}
              </a>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                <li>{t("qr_step_scan")}</li>
                <li>{t("qr_step_amount", { amount: `$${total.toLocaleString("es-CO")}` })}</li>
                <li>{t("qr_step_receipt")}</li>
              </ol>
            </section>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 text-white font-bold py-4 px-6 rounded-full transition-opacity hover:opacity-90 text-lg mb-6 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
              {t("qr_send_receipt")}
            </a>
          </>
        )}

        {/* Resumen del pedido */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Package aria-hidden="true" className="w-5 h-5" style={{ color: BRAND }} />
            <h2 className="font-heading font-bold">{t("summary")}</h2>
          </div>
          <div className="space-y-2 mb-4">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-600">
                  {item.product_name}{" "}
                  <span className="text-gray-500">x{item.quantity}</span>
                </span>
                <span className="font-semibold whitespace-nowrap">
                  ${(Number(item.unit_price) * item.quantity).toLocaleString("es-CO")}
                </span>
              </div>
            ))}
            {fee > 0 && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-600">{t("delivery_fee")}</span>
                <span className="font-semibold whitespace-nowrap">
                  ${fee.toLocaleString("es-CO")}
                </span>
              </div>
            )}
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="font-bold">{t("total")}</span>
            <span className="font-black text-xl" style={{ color: BRAND }}>
              ${total.toLocaleString("es-CO")}
            </span>
          </div>
          <dl className="mt-4 pt-4 border-t text-sm text-gray-600 space-y-1">
            <div>
              <dt className="inline font-semibold">{t("customer")}:</dt>{" "}
              <dd className="inline">{order.customer_name}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">{t("fulfillment")}:</dt>{" "}
              <dd className="inline">
                {fulfillmentLabel}
                {isDelivery && order.delivery_zone ? ` · ${order.delivery_zone}` : ""}
              </dd>
            </div>
            {isDelivery && order.customer_address && (
              <div>
                <dt className="inline font-semibold">{t("address")}:</dt>{" "}
                <dd className="inline">{order.customer_address}</dd>
              </div>
            )}
            {isDelivery && order.recipient_phone && (
              <div>
                <dt className="inline font-semibold">{t("recipient_phone")}:</dt>{" "}
                <dd className="inline">{order.recipient_phone}</dd>
              </div>
            )}
            {notes && (
              <div>
                <dt className="inline font-semibold">{t("notes")}:</dt>{" "}
                <dd className="inline whitespace-pre-line">{notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {view === "qr" && !qrPay && (
          <>
            <div
              className="rounded-2xl p-4 mb-6 text-sm text-left"
              style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}
            >
              <p className="font-semibold text-green-800 mb-1">{t("whatsapp_auto_sent_title")}</p>
              <p className="text-green-700">{t("whatsapp_auto_sent_body")}</p>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 text-white font-bold py-4 rounded-full transition-opacity hover:opacity-90 text-lg mb-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle aria-hidden="true" className="w-5 h-5" />
              {t("whatsapp_resend")}
            </a>
          </>
        )}

        <Link
          href="/"
          className="flex items-center justify-center gap-2 font-semibold py-4 rounded-full border transition-colors hover:bg-gray-100 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
          style={{ borderColor: BRAND, color: BRAND }}
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          {t("back_home")}
        </Link>
      </div>
    </div>
  );
}
