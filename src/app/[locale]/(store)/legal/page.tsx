import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Crumbs from "@/components/layout/Crumbs";
import { legalDocs } from "@/content/legal";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: tm("legal_description"),
    alternates: alternatesFor("/legal", locale),
  };
}

export default async function LegalIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const lang = locale === "en" ? "en" : "es";

  return (
    <div>
      <div className="relative overflow-hidden py-20 px-4 text-center text-white" style={{ backgroundColor: "#8b0031" }}>
        <Crumbs className="opacity-70" />
        <h1 className="relative text-5xl md:text-6xl font-black mb-4">{t("title")}</h1>
        <p className="relative text-white/80 text-lg">{t("subtitle")}</p>
      </div>

      <div className="py-16 px-4 bg-white">
        <ul className="max-w-3xl mx-auto space-y-4">
          {legalDocs.map((doc) => (
            <li key={doc.slug}>
              <Link
                href={`/legal/${doc.slug}`}
                className="block rounded-xl border border-gray-200 p-6 font-bold text-gray-900 hover:border-[#8b0031] hover:text-[#8b0031] transition-colors"
              >
                {doc[lang].title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
