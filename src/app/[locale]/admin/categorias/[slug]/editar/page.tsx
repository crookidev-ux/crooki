import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import CategoryFormClient from "@/components/admin/CategoryFormClient";
import type { CategoryRow } from "@/lib/types";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { supabase } = await requireAdmin(locale);

  const [{ data: category }, { count }] = await Promise.all([
    supabase.from("categories").select("*").eq("slug", slug).single(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("category", slug),
  ]);

  if (!category) notFound();

  return (
    <CategoryFormClient
      locale={locale}
      mode="edit"
      category={category as CategoryRow}
      productCount={count ?? 0}
    />
  );
}
