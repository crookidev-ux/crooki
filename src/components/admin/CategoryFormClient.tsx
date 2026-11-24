"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_KINDS, KIND_LABEL_ES, type CategoryKind, type CategoryRow } from "@/lib/types";
import { NEARBY_MAX_KM, type DeliveryRule } from "@/lib/delivery-zones";
import { slugify } from "@/lib/slug";
import { PageHeader } from "./ui";
import { ConfirmButton, Switch } from "./controls";

interface Props {
  locale: string;
  mode: "create" | "edit";
  category?: CategoryRow;
  /** Products in this category (edit only), for the delete warning. */
  productCount?: number;
}

export default function CategoryFormClient({ mode, category, productCount = 0 }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    slug: category?.slug ?? "",
    label_es: category?.label_es ?? "",
    label_en: category?.label_en ?? "",
    kind: (category?.kind ?? "menu") as CategoryKind,
    display_order: category?.display_order?.toString() ?? "0",
    visible: category?.visible ?? true,
    delivery_rule: (category?.delivery_rule ?? "any") as DeliveryRule,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label_es.trim()) {
      toast.error("El nombre en español es obligatorio.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const row = {
      slug: form.slug || slugify(form.label_es),
      label_es: form.label_es,
      label_en: form.label_en || form.label_es,
      kind: form.kind,
      display_order: parseInt(form.display_order) || 0,
      visible: form.visible,
      delivery_rule: form.delivery_rule,
    };

    const { data, error } =
      mode === "create"
        ? await supabase.from("categories").insert(row).select("slug")
        : await supabase.from("categories").update(row).eq("slug", category!.slug).select("slug");

    if (error || !data?.length) {
      toast.error(error ? `Error: ${error.message}` : "No se guardó: revisa tu sesión.");
    } else {
      toast.success(mode === "create" ? "Categoría creada" : "Categoría actualizada");
      router.push(`/admin/categorias`);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!category) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("categories").delete().eq("slug", category.slug).select("slug");
    if (error || !data?.length) {
      toast.error(error ? `Error: ${error.message}` : "No se eliminó: revisa tu sesión.");
    } else {
      toast.success("Categoría eliminada");
      router.push(`/admin/categorias`);
    }
    setLoading(false);
  };

  const saveButton = (
    <button type="submit" form="category-form" disabled={loading} className="adm-btn adm-btn-primary">
      {loading ? <Loader2 aria-hidden="true" className="h-[18px] w-[18px] animate-spin" /> : <Check aria-hidden="true" className="h-[18px] w-[18px]" />}
      {loading ? "Guardando…" : "Guardar"}
    </button>
  );

  return (
    <div className="adm-page has-savebar">
      <PageHeader
        crumbs={[{ label: "Categorías", href: "/admin/categorias" }, { label: mode === "create" ? "Nueva" : "Editar" }]}
        title={mode === "create" ? "Nueva categoría" : category?.label_es ?? "Editar categoría"}
        actions={
          mode === "edit" && category ? (
            <ConfirmButton
              disabled={loading}
              title="¿Eliminar esta categoría?"
              body={
                productCount > 0 ? (
                  <>
                    «{category.label_es}» tiene {productCount} producto{productCount === 1 ? "" : "s"}. Quedarán sin
                    categoría y no se mostrarán en la tienda. Si solo quieres esconderla, usa «Visible en la web».
                  </>
                ) : (
                  <>«{category.label_es}» no tiene productos. Se borra para siempre.</>
                )
              }
              confirmLabel="Sí, eliminar"
              onConfirm={handleDelete}
            >
              <Trash2 aria-hidden="true" className="h-[18px] w-[18px]" />
              Eliminar
            </ConfirmButton>
          ) : undefined
        }
      />

      <form id="category-form" onSubmit={handleSubmit} className="adm-card adm-cq max-w-3xl">
        <div className="adm-card-b">
          <div className="adm-field">
            <span className="adm-lbl" id="cat-kind-label">
              Tipo {mode === "edit" && <span className="adm-sub">(no se puede cambiar)</span>}
            </span>
            <div className="adm-seg" role="group" aria-labelledby="cat-kind-label">
              {CATEGORY_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={form.kind === k}
                  onClick={() => setForm({ ...form, kind: k })}
                  disabled={mode === "edit"}
                >
                  {KIND_LABEL_ES[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="adm-row2">
            <div className="adm-field">
              <label htmlFor="cat-label-es">Nombre en español *</label>
              <input
                id="cat-label-es"
                type="text"
                value={form.label_es}
                onChange={(e) => setForm({ ...form, label_es: e.target.value })}
                required
                placeholder="Galletas"
                className="adm-input"
              />
            </div>
            <div className="adm-field">
              <label htmlFor="cat-label-en">Nombre en inglés</label>
              <input
                id="cat-label-en"
                type="text"
                value={form.label_en}
                onChange={(e) => setForm({ ...form, label_en: e.target.value })}
                placeholder="Cookies"
                className="adm-input"
                aria-describedby="cat-label-en-help"
              />
              <span id="cat-label-en-help" className="adm-help">
                Vacío = se usa el nombre en español.
              </span>
            </div>
          </div>

          <div className="adm-row2">
            <div className="adm-field">
              <label htmlFor="cat-slug">Identificador (slug)</label>
              <input
                id="cat-slug"
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                disabled={mode === "edit"}
                placeholder="galletas"
                className="adm-input font-mono"
                aria-describedby="cat-slug-help"
              />
              <span id="cat-slug-help" className="adm-help">
                {mode === "edit"
                  ? "No se puede cambiar: los productos lo usan."
                  : "Se genera desde el nombre si está vacío. Solo minúsculas, números y guiones."}
              </span>
            </div>
            <div className="adm-field">
              <label htmlFor="cat-order">Posición</label>
              <input
                id="cat-order"
                type="number"
                inputMode="numeric"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                min="0"
                className="adm-input"
                aria-describedby="cat-order-help"
              />
              <span id="cat-order-help" className="adm-help">
                Los números más bajos van primero.
              </span>
            </div>
          </div>

          <div className="adm-field">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.visible}
                onChange={(v) => setForm({ ...form, visible: v })}
                labelledBy="cat-visible-label"
                describedBy="cat-visible-help"
              />
              <b id="cat-visible-label">{form.visible ? "Visible en la web" : "Oculta en la web"}</b>
            </div>
            <span id="cat-visible-help" className="adm-help">
              Las categorías ocultas no aparecen en el menú, en merch ni en Navidad, pero siguen siendo editables aquí.
              Una categoría de Navidad visible muestra el enlace «Navidad» en el menú del sitio.
            </span>
          </div>

          <div className="adm-field">
            <label htmlFor="category-delivery-rule">Domicilio</label>
            <select
              id="category-delivery-rule"
              value={form.delivery_rule}
              onChange={(e) => setForm({ ...form, delivery_rule: e.target.value as DeliveryRule })}
              className="adm-input"
              aria-describedby="cat-rule-help"
            >
              <option value="any">Sin límite de distancia</option>
              <option value="nearby">Solo hasta {NEARBY_MAX_KM} km</option>
              <option value="none">Sin domicilio (solo recoger o comer en el local)</option>
            </select>
            <span id="cat-rule-help" className="adm-help">
              Un pedido sigue la regla más estricta entre sus productos.
            </span>
          </div>

          <div className="adm-side-actions mt-2 justify-end">
            <Link href="/admin/categorias" className="adm-btn">
              Cancelar
            </Link>
            {saveButton}
          </div>
        </div>
      </form>

      <div className="adm-savebar">
        <Link href="/admin/categorias" className="adm-btn">
          Cancelar
        </Link>
        {saveButton}
      </div>
    </div>
  );
}
