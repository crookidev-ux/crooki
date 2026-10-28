import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SITE_URL, localizedUrl } from "@/lib/seo";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import { Toaster } from "@/components/ui/sonner";
import CartDrawer from "@/components/order/CartDrawer";
import CartHydrator from "@/components/order/CartHydrator";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: t("site_title"), template: "%s | Crooki Bake Bar" },
    description: t("site_description"),
    openGraph: {
      type: "website",
      siteName: "Crooki Bake Bar",
      locale: locale === "en" ? "en_US" : "es_CO",
      // Declared here because this openGraph object replaces the root one,
      // which would otherwise carry app/opengraph-image.jpg.
      images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: t("og_alt") }],
    },
    twitter: { card: "summary_large_image", images: ["/opengraph-image.jpg"] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const messages = await getMessages();

  // Local business data for Google (Maps, local search results).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: "Crooki Bake Bar",
    url: `${SITE_URL}${localizedUrl("/", locale)}`,
    image: `${SITE_URL}/crooki-wordmark-red.png`,
    telephone: "+573027190084",
    email: "holacrooki@gmail.com",
    priceRange: "$$",
    servesCuisine: ["Cookies", "Desserts"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calle 36 # 5-70, Centro Histórico",
      addressLocality: "Cartagena de Indias",
      addressRegion: "Bolívar",
      addressCountry: "CO",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "11:00",
      closes: "21:00",
    },
    hasMap: "https://maps.app.goo.gl/SKck7m5eoNfa3SBb6",
    sameAs: [
      "https://www.instagram.com/crookibakebar",
      "https://www.tiktok.com/@crookibakebar",
    ],
  };

  return (
    <NextIntlClientProvider messages={messages}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Header locale={locale} />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartHydrator />
      <CartDrawer />
      <WhatsAppButton />
      <Toaster position="bottom-center" />
    </NextIntlClientProvider>
  );
}
