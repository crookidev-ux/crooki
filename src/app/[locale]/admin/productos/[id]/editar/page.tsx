import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import ProductFormClient from "@/components/admin/ProductFormClient";
import { isMissingTable } from "@/lib/missing-table";
import type { CategoryRow, Product, ProductOption } from "@/lib/types";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { supabase } = await requireAdmin(locale);

  const [
    { data: product },
    { data: categories },
    { data: galletas },
    { data: salsas },
    options,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "*, product_images(*), combo_cookies!combo_cookies_combo_id_fkey(*), combo_salsas!combo_salsas_combo_id_fkey(*), box_cookies!box_cookies_box_id_fkey(*)",
      )
      .eq("id", id)
      .single(),
    supabase.from("categories").select("*").order("kind").order("display_order"),
    supabase
      .from("products")
      .select("id, name_es, name_en, price")
      .eq("category", "galletas")
      .order("display_order"),
    supabase
      .from("products")
      .select("id, name_es, name_en, price")
      .eq("category", "salsas")
      .order("display_order"),
    // Separate query: before migration 20261126000000 the table is missing and
    // the form just hides the options section.
    supabase.from("product_options").select("*").eq("product_id", id).order("display_order"),
  ]);

  if (!product) notFound();
  if (options.error && !isMissingTable(options.error)) throw options.error;
  const optionsSupported = !options.error;

  return (
    <ProductFormClient
      locale={locale}
      mode="edit"
      product={{ ...(product as Product), product_options: (options.data as ProductOption[] | null) ?? [] }}
      optionsSupported={optionsSupported}
      categories={(categories as CategoryRow[]) ?? []}
      allGalletas={galletas ?? []}
      allSalsas={salsas ?? []}
    />
  );
}
