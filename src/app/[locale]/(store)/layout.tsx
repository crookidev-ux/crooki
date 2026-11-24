import { hasVisibleNavidad } from "@/lib/navidad";
import { SITE_URL, localizedUrl } from "@/lib/seo";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import ClosedNotice from "@/components/layout/ClosedNotice";
import CartDrawer from "@/components/order/CartDrawer";
import CartHydrator from "@/components/order/CartHydrator";

// Shop chrome (header, footer, cart, WhatsApp button). The admin lives outside
// this route group so it gets its own shell (src/components/admin/AdminShell.tsx).
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const showNavidad = await hasVisibleNavidad();

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Header locale={locale} showNavidad={showNavidad} />
      <ClosedNotice />
      <main className="flex-1">{children}</main>
      <Footer showNavidad={showNavidad} />
      <CartHydrator />
      <CartDrawer />
      <WhatsAppButton />
    </>
  );
}
