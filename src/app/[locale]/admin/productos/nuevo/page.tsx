import { requireAdmin } from "@/lib/admin-auth";
import ProductFormClient from "@/components/admin/ProductFormClient";
import { parseKind, type CategoryRow } from "@/lib/types";

export default async function NewProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string; category?: string }>;
}) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const { kind, category } = await searchParams;

  const [{ data: categories }, { data: galletas }, { data: salsas }] = await Promise.all([
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
  ]);

  return (
    <ProductFormClient
      locale={locale}
      mode="create"
      categories={(categories as CategoryRow[]) ?? []}
      initialKind={parseKind(kind)}
      initialCategory={category}
      allGalletas={galletas ?? []}
      allSalsas={salsas ?? []}
    />
  );
}
