"use client";

// «Mi pedido»: the customer types the order number and their phone; the server
// answers with the order id and we open the order page (state, payment, receipt).
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Search } from "lucide-react";

const BRAND = "#8b0031";

export default function OrderLookupForm() {
  const t = useTranslations("lookup");
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") ?? "");
    const phone = String(form.get("phone") ?? "");
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/order-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      if (res.ok && data.id) {
        router.push(`/pedido/${data.id}`);
        return;
      }
      setError(
        res.status === 400
          ? t("error_invalid")
          : res.status === 404
            ? t("error_not_found")
            : res.status === 429
              ? t("error_too_many")
              : t("error_generic"),
      );
    } catch (err) {
      console.error(err);
      setError(t("error_generic"));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const input =
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#8b0031] focus:border-transparent";

  return (
    <form onSubmit={submit} className="space-y-4 text-left" noValidate>
      <div>
        <label htmlFor="lookup-code" className="block text-sm font-semibold mb-1">
          {t("code_label")}
        </label>
        <input
          id="lookup-code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          placeholder="1A2B3C4D"
          aria-describedby="lookup-code-hint"
          className={`${input} font-mono uppercase`}
        />
        <p id="lookup-code-hint" className="text-xs text-gray-500 mt-1">
          {t("code_hint")}
        </p>
      </div>
      <div>
        <label htmlFor="lookup-phone" className="block text-sm font-semibold mb-1">
          {t("phone_label")}
        </label>
        <input
          id="lookup-phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="300 123 4567"
          className={input}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
        style={{ backgroundColor: BRAND }}
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
        ) : (
          <Search aria-hidden="true" className="w-5 h-5" />
        )}
        {pending ? t("searching") : t("submit")}
      </button>
    </form>
  );
}
