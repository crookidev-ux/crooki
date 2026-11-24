import { CirclePlus, Tags, TriangleAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import CategoryVisibilityToggle from "@/components/admin/CategoryVisibilityToggle";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { CATEGORY_KINDS, KIND_LABEL_ES, type CategoryRow } from "@/lib/types";

const RULE_LABEL: Record<string, string> = {
  any: "Domicilio sin límite",
  nearby: "Domicilio cercano",
  none: "Sin domicilio",
};

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);

  const [{ data: categories, error }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("kind").order("display_order"),
    supabase.from("products").select("category"),
  ]);

  const rows = (categories as CategoryRow[]) ?? [];
  const counts = new Map<string, number>();
  for (const p of (products as { category: string }[] | null) ?? []) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }

  return (
    <div className="adm-page">
      <PageHeader
        crumbs={[{ label: "Catálogo" }, { label: "Categorías" }]}
        title="Categorías"
        description="Ordenan el menú, merch y Navidad. Una categoría oculta no se ve en la tienda, pero sigue editable aquí."
        actions={
          <Link href="/admin/categorias/nueva" className="adm-btn adm-btn-primary">
            <CirclePlus aria-hidden="true" className="h-[18px] w-[18px]" />
            Nueva categoría
          </Link>
        }
      />

      {error && (
        <div className="adm-alert warn" role="alert">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>
            <b>No se pudieron cargar las categorías.</b>
            {error.message}
          </div>
        </div>
      )}

      <div className="adm-stack">
        {CATEGORY_KINDS.map((kind) => {
          const list = rows.filter((c) => c.kind === kind);
          return (
            <section key={kind} className="adm-card overflow-hidden" aria-labelledby={`kind-${kind}`}>
              <div className="adm-card-h">
                <h2 id={`kind-${kind}`}>{KIND_LABEL_ES[kind]}</h2>
                <span className="adm-sub">
                  {list.length} categoría{list.length === 1 ? "" : "s"}
                </span>
              </div>
              {list.length === 0 ? (
                <EmptyState icon={Tags}>Sin categorías de {KIND_LABEL_ES[kind]}.</EmptyState>
              ) : (
                <ul>
                  {list.map((c) => {
                    const n = counts.get(c.slug) ?? 0;
                    return (
                      <li key={c.slug} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[color:var(--adm-line-2)] px-5 py-3 last:border-b-0">
                        <div className="min-w-0 flex-1 basis-56">
                          <Link href={`/admin/categorias/${c.slug}/editar`} className="font-semibold hover:text-[color:var(--adm-wine)] hover:underline">
                            {c.label_es}
                          </Link>
                          <p className="adm-sub">
                            {c.label_en || "Falta el nombre en inglés"} · posición {c.display_order} · {n} producto{n === 1 ? "" : "s"}
                            {c.delivery_rule ? ` · ${RULE_LABEL[c.delivery_rule] ?? c.delivery_rule}` : ""}
                          </p>
                        </div>
                        <CategoryVisibilityToggle slug={c.slug} label={c.label_es} initialVisible={c.visible !== false} />
                        <Link href={`/admin/categorias/${c.slug}/editar`} className="adm-btn adm-btn-sm" aria-label={`Editar ${c.label_es}`}>
                          Editar
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
