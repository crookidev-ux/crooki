import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import type { CategoryRow, Product } from "@/lib/types";

// Public reads for the Christmas catalog (/navidad, /navidad/[slug], the
// Header/Footer link and the sitemap). Every loader fails closed: with no
// database, no navidad category or no slug column yet (migration
// 20261124010000 not applied) it returns nothing, and the pages 404.

function hasDatabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("your_");
}

async function client() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

const byOrder = (a: { display_order: number }, b: { display_order: number }) =>
  a.display_order - b.display_order;

/** Photos in the admin's order (the first one is the cover). */
function withSortedImages(p: Product): Product {
  return { ...p, product_images: [...(p.product_images ?? [])].sort(byOrder) };
}

/** Visible categories of kind "navidad", in display order. Cached per request. */
export const loadNavidadCategories = cache(async (): Promise<CategoryRow[]> => {
  if (!hasDatabase()) return [];
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("kind", "navidad")
      .order("display_order");
    if (error) throw error;
    return ((data as CategoryRow[] | null) ?? []).filter((c) => c.visible !== false);
  } catch (err) {
    unstable_rethrow(err); // let Next.js see cookies()/dynamic usage
    console.error("loadNavidadCategories", err);
    return [];
  }
});

/** Products of the visible navidad categories (with a slug), with their category. */
export const loadNavidadProducts = cache(async (): Promise<Product[]> => {
  const categories = await loadNavidadCategories();
  if (categories.length === 0) return [];
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .in("category", categories.map((c) => c.slug))
      .not("slug", "is", null)
      .order("display_order");
    if (error) throw error;
    return ((data as Product[] | null) ?? []).map(withSortedImages);
  } catch (err) {
    unstable_rethrow(err); // let Next.js see cookies()/dynamic usage
    console.error("loadNavidadProducts", err);
    return [];
  }
});

/** One product page, or null (unknown slug, hidden category, not navidad). */
export const loadNavidadProduct = cache(
  async (slug: string): Promise<{ product: Product; category: CategoryRow } | null> => {
    const categories = await loadNavidadCategories();
    if (categories.length === 0) return null;
    try {
      const supabase = await client();
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("slug", slug)
        .in("category", categories.map((c) => c.slug))
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const product = withSortedImages(data as Product);
      const category = categories.find((c) => c.slug === product.category)!;
      return { product, category };
    } catch (err) {
      unstable_rethrow(err);
      console.error("loadNavidadProduct", err);
      return null;
    }
  },
);
