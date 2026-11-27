// Structured data for a Christmas product page (Google rich results).
import { effectivePrice, isSaleActive, isoToBogotaLocal } from "./promo.ts";
import type { Product } from "./types.ts";

export function navidadJsonLd(
  p: Product,
  { name, description, pageUrl, catalogUrl, homeUrl, labels }: {
    name: string;
    description: string;
    /** Absolute URLs. */
    pageUrl: string;
    catalogUrl: string;
    homeUrl: string;
    labels: { home: string; catalog: string };
  },
  now: Date = new Date(),
) {
  const onSale = isSaleActive(p, now);
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url: pageUrl,
    priceCurrency: "COP",
    price: effectivePrice(p, now),
    availability: p.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: "Crooki Bake Bar" },
  };
  const options = p.product_options ?? [];
  if (options.length > 0) {
    // Options set the price (sales do not apply to them).
    const prices = options.map((o) => o.price);
    delete offer.price;
    if (options.length === 1) offer.price = prices[0];
    else Object.assign(offer, { "@type": "AggregateOffer", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: options.length });
  } else if (onSale && p.sale_ends_at) {
    // Last day of the sale in Colombia time (the admin types it in Bogotá time).
    offer.priceValidUntil = isoToBogotaLocal(p.sale_ends_at).slice(0, 10);
  }

  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description,
      image: p.product_images.map((i) => i.url),
      sku: p.id,
      brand: { "@type": "Brand", name: "Crooki" },
      offers: offer,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: labels.home, item: homeUrl },
        { "@type": "ListItem", position: 2, name: labels.catalog, item: catalogUrl },
        { "@type": "ListItem", position: 3, name, item: pageUrl },
      ],
    },
  ];
}
