"use client";

// «Intentar de nuevo» on the order page: asks the server for a fresh payment
// attempt (new bold_order_id) and reopens Bold's checkout with it. The
// secondary «Pagar por QR (WhatsApp)» first switches the order to QR payment
// on the server (so the admin does not show it as an unpaid Bold order), then
// sends the order to the shop over WhatsApp.
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, QrCode } from "lucide-react";
import type { BoldClientConfig } from "@/lib/bold";
import { useBoldCheckout } from "./useBoldCheckout";

const BRAND = "#8b0031";

type Props = {
  orderId: string;
  locale: "es" | "en";
  /** Online payment configured and the order can still be paid. */
  canRetry: boolean;
};

export default function OrderPaymentActions({ orderId, locale, canRetry }: Props) {
  const t = useTranslations("confirmation");
  const router = useRouter();
  const bold = useBoldCheckout(canRetry);
  // Synchronous double-tap guard (render state lags behind fast taps).
  const inFlight = useRef(false);
  const [pending, setPending] = useState<"retry" | "qr" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    if (inFlight.current || !bold.ready) return;
    inFlight.current = true;
    setPending("retry");
    setError(null);
    try {
      const res = await fetch("/api/checkout/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { bold?: BoldClientConfig };
      if (res.ok && data.bold) {
        bold.open(data.bold);
        return;
      }
      if (res.status === 409) {
        // It may have just been paid (or closed): show the current state.
        router.refresh();
        return;
      }
      setError(res.status === 503 ? t("pay_unavailable") : t("retry_error"));
    } catch (err) {
      console.error(err);
      setError(t("retry_error"));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const payByQr = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending("qr");
    setError(null);
    // Opened synchronously inside the tap so pop-up blockers allow it; it is
    // pointed at WhatsApp once the server has switched the order.
    const win = window.open("", "_blank");
    try {
      const res = await fetch("/api/checkout/switch-to-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = (await res.json().catch(() => ({}))) as { whatsappUrl?: string };
      if (res.ok && data.whatsappUrl) {
        if (win) {
          win.opener = null;
          win.location.href = data.whatsappUrl;
        } else {
          window.location.href = data.whatsappUrl;
        }
        router.refresh();
        return;
      }
      win?.close();
      if (res.status === 409) {
        // Paid, closed or under review meanwhile: show the current state.
        router.refresh();
        return;
      }
      setError(t("qr_switch_error"));
    } catch (err) {
      console.error(err);
      win?.close();
      setError(t("qr_switch_error"));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const unavailable = canRetry && bold.failed;

  return (
    <div className="flex flex-col gap-3">
      {canRetry && (
        <button
          type="button"
          onClick={retry}
          disabled={pending !== null || !bold.ready}
          aria-busy={pending === "retry"}
          className="flex items-center justify-center gap-3 text-white font-bold py-4 rounded-full transition-opacity hover:opacity-90 text-lg disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
          style={{ backgroundColor: BRAND }}
        >
          {pending === "retry" || (!bold.ready && !bold.failed) ? (
            <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
          ) : (
            <CreditCard aria-hidden="true" className="w-5 h-5" />
          )}
          {pending === "retry" ? t("retrying") : t("retry")}
        </button>
      )}
      {(error || unavailable) && (
        <p role="alert" className="text-sm text-center" style={{ color: BRAND }}>
          {error ?? t("pay_unavailable")}
        </p>
      )}
      <button
        type="button"
        onClick={payByQr}
        disabled={pending !== null}
        aria-busy={pending === "qr"}
        className="flex items-center justify-center gap-2 font-semibold py-4 rounded-full border-2 transition-colors hover:bg-[#8b0031]/5 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
        style={{ borderColor: BRAND, color: BRAND }}
      >
        {pending === "qr" ? (
          <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
        ) : (
          <QrCode aria-hidden="true" className="w-5 h-5" />
        )}
        {t("pay_qr")}
      </button>
    </div>
  );
}
