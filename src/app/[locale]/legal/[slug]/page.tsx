import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Crumbs from "@/components/layout/Crumbs";
import { routing } from "@/i18n/routing";
import { getLegalDoc, legalDocs } from "@/content/legal";
import LegalMarkdown from "@/components/legal/LegalMarkdown";
import { alternatesFor } from "@/lib/seo";
import BonusRain from "@/components/legal/BonusRain";

// Club Crooki digital card (same link as the QR in /public/reward.png).
const CLUB_SIGNUP_URL = "https://take.cards/jFMFg";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    legalDocs.map((doc) => ({ locale, slug: doc.slug })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return {};
  const tm = await getTranslations({ locale, namespace: "meta" });
  return {
    title: doc[locale === "en" ? "en" : "es"].title,
    description: tm("legal_description"),
    alternates: alternatesFor(`/legal/${slug}`, locale),
  };
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();
  const t = await getTranslations({ locale, namespace: "legal" });
  const content = doc[locale === "en" ? "en" : "es"];

  return (
    <div>
      {slug === "terminos-club-crooki" && <BonusRain />}
      <div className="relative overflow-hidden py-20 px-4 text-center text-white" style={{ backgroundColor: "#8b0031" }}>
        <Crumbs className="opacity-70" />
        <h1 className="relative text-3xl md:text-5xl font-black max-w-3xl mx-auto">{content.title}</h1>
      </div>

      <div className="py-12 px-4 bg-white">
        <article className="max-w-3xl mx-auto">
          <Link href="/legal" className="inline-block mb-8 text-sm font-bold text-[#8b0031] hover:underline">
            ← {t("back")}
          </Link>
          {locale === "en" && (
            <p className="mb-8 rounded-lg bg-gray-100 p-4 text-sm text-gray-600">
              {t("translation_note")}
            </p>
          )}
          {slug === "terminos-club-crooki" && (
            <div className="mb-10 flex flex-col items-center gap-4">
              <Image
                src="/reward.png"
                alt={t("club_image_alt")}
                width={1122}
                height={1402}
                sizes="(min-width: 768px) 448px, 100vw"
                className="w-full max-w-md rounded-2xl shadow-lg"
                priority
              />
              <a
                href={CLUB_SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-8 py-3 font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#8b0031" }}
              >
                {t("club_cta")}
              </a>
            </div>
          )}
          <LegalMarkdown source={content.body} />
        </article>
      </div>
    </div>
  );
}
