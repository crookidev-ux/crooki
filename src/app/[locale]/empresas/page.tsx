import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Download, ChevronDown } from "lucide-react";
import { alternatesFor } from "@/lib/seo";
import { BUSINESS_CATALOG_PDF, BUSINESS_PRODUCTS } from "@/lib/business-catalog";
import Crumbs from "@/components/layout/Crumbs";
import QuoteForm from "@/components/business/QuoteForm";
import BusinessVisual from "@/components/business/BusinessVisual";
import Tilt from "@/components/business/Tilt";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("business_title"),
    description: t("business_description"),
    alternates: alternatesFor("/empresas", locale),
  };
}

const STEPS = ["step1", "step2", "step3"] as const;
const FAQS = [1, 2, 3, 4] as const;

export default async function EmpresasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "business" });
  const featured = BUSINESS_PRODUCTS.filter((p) => p.featured && p.image);

  return (
    <div>
      <div className="relative overflow-hidden text-white" style={{ backgroundColor: "#8b0031" }}>
        <Crumbs className="opacity-70" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl md:text-6xl font-black leading-[1.05] mb-5 text-balance">{t("title")}</h1>
            <p className="text-white/85 text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">{t("subtitle")}</p>
            <a
              href={BUSINESS_CATALOG_PDF}
              download
              className="inline-flex items-center gap-2 font-bold px-8 py-4 rounded-full transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ backgroundColor: "#f3c78b", color: "#8b0031" }}
            >
              <Download className="w-5 h-5" aria-hidden="true" />
              {t("download")}
            </a>
          </div>
          <BusinessVisual alt={t("home_image_alt")} priority />
        </div>
      </div>

      <section className="py-16 md:py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 text-center mb-10">{t("featured_title")}</h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
            {featured.map((p) => (
              <li key={p.id}>
                <Tilt className="h-full rounded-3xl">
                <div className="h-full overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-black/5">
                  <Image
                    src={p.image!}
                    alt={p.name}
                    width={1000}
                    height={1000}
                    sizes="(min-width: 768px) 360px, 50vw"
                    className="w-full h-auto aspect-square object-cover"
                  />
                  <div className="p-4 md:p-5">
                    <h3 className="font-black text-gray-900 text-lg md:text-xl">{p.name}</h3>
                    <p className="font-bold text-[#8b0031]">{p.price}</p>
                  </div>
                </div>
                </Tilt>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quote: steps on a wine panel + the form on a white card, as one block */}
      <section id="cotizar" className="scroll-mt-16 py-16 md:py-24 px-4" style={{ backgroundColor: "#fdf8f0" }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-black/5">
          <div className="relative overflow-hidden lg:col-span-2 p-8 md:p-12 text-white" style={{ backgroundColor: "#8b0031" }}>
            <Crumbs className="opacity-40" />
            <Image
              src="/images/empresas/galletas-stack.webp"
              alt=""
              width={656}
              height={721}
              sizes="260px"
              className="hidden lg:block absolute -bottom-6 -right-8 w-64 h-auto rotate-6 drop-shadow-2xl"
            />
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f3c78b] mb-3">{t("steps_title")}</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-10 text-balance">{t("form_title")}</h2>
              <ol className="grid gap-7">
                {STEPS.map((key, i) => (
                  <li key={key} className="flex items-start gap-4">
                    <span
                      className="flex shrink-0 items-center justify-center w-11 h-11 rounded-full bg-[#f3c78b] text-[#8b0031] text-lg font-black"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <p className="pt-2 text-lg font-semibold text-white/95">{t(key)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="lg:col-span-3 p-6 sm:p-8 md:p-12">
            <QuoteForm />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 text-center mb-10">{t("faq_title")}</h2>
          <div className="divide-y divide-black/10 border-y border-black/10">
            {FAQS.map((n) => (
              <details key={n} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-bold text-gray-900 [&::-webkit-details-marker]:hidden">
                  {t(`faq${n}_q`)}
                  <ChevronDown className="w-5 h-5 shrink-0 text-[#8b0031] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="pb-5 text-gray-700 leading-relaxed">{t(`faq${n}_a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
