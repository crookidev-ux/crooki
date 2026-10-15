import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Cookie, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Crumbs from "@/components/layout/Crumbs";

export default async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "hero" });

  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ backgroundColor: "#8b0031" }}
    >
      <Crumbs className="opacity-70" />

      <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-16 md:py-20 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold mb-6 border border-white/25">
            <Cookie className="w-4 h-4 text-[#f3c78b]" aria-hidden="true" />
            {t("badge")}
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            {t("title")}
          </h1>

          <p className="text-lg md:text-xl text-white/85 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
            {t("subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link
              href="/menu"
              className="inline-flex items-center justify-center bg-white font-bold text-lg px-8 py-4 rounded-full shadow-lg transition-all hover:bg-red-50 hover:scale-105"
              style={{ color: "#8b0031" }}
            >
              {t("cta_order")} →
            </Link>
            <Link
              href="/menu"
              className="inline-flex items-center justify-center border-2 border-white/80 text-white font-bold text-lg px-8 py-4 rounded-full transition-all hover:bg-white/10"
            >
              {t("cta_menu")}
            </Link>
          </div>

          <p className="mt-8 inline-flex items-center gap-2 text-sm text-white/75">
            <MapPin className="w-4 h-4 text-[#f3c78b]" aria-hidden="true" />
            {t("location")}
          </p>
        </div>

        {/* Photo */}
        <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
          <div className="absolute -inset-3 rounded-[2.5rem] bg-white/10 rotate-3" aria-hidden="true" />
          <Image
            src="/images/hero-cookies.webp"
            alt={t("image_alt")}
            width={900}
            height={1350}
            priority
            sizes="(min-width: 1024px) 448px, (min-width: 640px) 384px, 90vw"
            className="relative w-full h-auto max-h-[70vh] object-cover rounded-[2rem] shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
}
