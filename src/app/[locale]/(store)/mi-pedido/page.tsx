import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MessageCircle, PackageSearch } from "lucide-react";
import OrderLookupForm from "@/components/order/OrderLookupForm";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";

const BRAND = "#8b0031";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lookup" });
  // A lookup form for one's own order: nothing to rank in search results.
  return { title: t("title"), robots: { index: false, follow: true } };
}

export default async function MyOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lookup" });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#8b003115" }}
        >
          <PackageSearch aria-hidden="true" className="w-11 h-11" style={{ color: BRAND }} />
        </div>
        <h1 className="font-heading text-4xl font-black mb-3" style={{ color: BRAND }}>
          {t("title")}
        </h1>
        <p className="text-gray-600 mb-8">{t("subtitle")}</p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <OrderLookupForm />
        </div>

        <p className="text-sm text-gray-600 mb-3">{t("help")}</p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("whatsapp_text"))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-full border-2 transition-colors hover:bg-[#25D366]/10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
          style={{ borderColor: "#25D366", color: "#128C7E" }}
        >
          <MessageCircle aria-hidden="true" className="w-4 h-4" />
          {t("whatsapp")}
        </a>
      </div>
    </div>
  );
}
