import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import CategoryVisibilityToggle from "@/components/admin/CategoryVisibilityToggle";
import type { CategoryRow } from "@/lib/types";

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("kind")
    .order("display_order");

  const rows = (categories as CategoryRow[]) ?? [];
  const menu = rows.filter((c) => c.kind === "menu");
  const merch = rows.filter((c) => c.kind === "merch");
  const navidad = rows.filter((c) => c.kind === "navidad");

  const { data: products } = await supabase
    .from("products")
    .select("category");

  const counts = new Map<string, number>();
  for (const p of (products as { category: string }[] | null) ?? []) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }

  function renderGroup(title: string, list: CategoryRow[]) {
    return (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {list.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Sin categorías</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {list.map((c) => (
                <div
                  key={c.slug}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{c.label_es}</p>
                    <p className="text-gray-500 text-sm">
                      <span className="font-mono">{c.slug}</span> · {c.label_en} · orden {c.display_order} ·{" "}
                      {counts.get(c.slug) ?? 0} producto{(counts.get(c.slug) ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <CategoryVisibilityToggle
                    slug={c.slug}
                    initialVisible={c.visible !== false}
                  />
                  <Link
                    href={`/${locale}/admin/categorias/${c.slug}/editar`}
                    className="text-sm font-semibold px-4 py-1.5 border rounded-full hover:bg-gray-100 transition-colors"
                    style={{ borderColor: "#8b0031", color: "#8b0031" }}
                  >
                    Editar
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black" style={{ color: "#8b0031" }}>
          Categorías
        </h1>
        <Link
          href={`/${locale}/admin/categorias/nueva`}
          className="flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-full transition-opacity hover:opacity-90 text-sm"
          style={{ backgroundColor: "#8b0031" }}
        >
          <Plus className="w-4 h-4" />
          Nueva categoría
        </Link>
      </div>

      {renderGroup("Menú", menu)}
      {renderGroup("Merch", merch)}
      {renderGroup("Navidad", navidad)}
    </div>
  );
}
