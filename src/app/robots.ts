import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/en/admin", "/es/admin", "/pedido", "/en/pedido", "/es/pedido"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
