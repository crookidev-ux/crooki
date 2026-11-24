import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";

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

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
      <Toaster position="bottom-center" />
    </NextIntlClientProvider>
  );
}
