import { getTranslations } from "next-intl/server";
import { Check, Gift } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Crumbs from "@/components/layout/Crumbs";
import SeasonIcon from "@/components/seasons/SeasonIcon";
import BusinessVisual from "@/components/business/BusinessVisual";
import type { SeasonId } from "@/lib/seasons";

// Scroll-driven entrance; only when the visitor allows motion; browsers without animation-timeline show it static.
const css = `
@keyframes biz-rise{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
  @supports (animation-timeline:view()){
    .biz-rise{animation:biz-rise linear both;animation-timeline:view();animation-range:entry 0% cover 28%}
  }
}`;


export default async function BusinessSection({
  locale,
  season,
}: {
  locale: string;
  season: SeasonId | null;
}) {
  const t = await getTranslations({ locale, namespace: "business" });
  const christmas = season === "navidad";
  const benefits = ["home_b1", "home_b2", "home_b3"] as const;

  return (
    <section className="relative overflow-hidden text-white" style={{ backgroundColor: "#8b0031" }}>
      <style href="business-section" precedence="default">{css}</style>
      <Crumbs className="opacity-70" />

      <div className="biz-rise relative max-w-6xl mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 text-sm font-semibold mb-6 border border-white/25 text-[#f3c78b]">
            {christmas ? (
              <SeasonIcon season="navidad" className="w-4 h-4" />
            ) : (
              <Gift className="w-4 h-4" aria-hidden="true" />
            )}
            {t(christmas ? "home_eyebrow_navidad" : "home_eyebrow")}
          </p>

          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.08] mb-5 text-balance">
            {t("home_title")}
          </h2>
          <p className="text-lg text-white/85 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-7">
            {t("home_subtitle")}
          </p>

          <ul className="inline-flex flex-col gap-3 text-left mb-9">
            {benefits.map((key) => (
              <li key={key} className="flex items-center gap-3 font-medium">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f3c78b]">
                  <Check className="h-4 w-4 text-[#8b0031]" strokeWidth={3} aria-hidden="true" />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>

          <div>
            <Link
              href="/empresas"
              className="flex sm:inline-flex w-full sm:w-auto items-center justify-center bg-[#f3c78b] text-[#8b0031] font-bold text-lg px-8 py-4 rounded-full shadow-lg transition-all hover:bg-[#f7d6a8] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {t("home_cta")} →
            </Link>
          </div>
        </div>

        <BusinessVisual alt={t("home_image_alt")} />
      </div>
    </section>
  );
}
