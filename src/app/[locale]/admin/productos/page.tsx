import Image from "next/image";
import { CirclePlus, Cookie, ExternalLink, PackageSearch, Search, Shirt, Tags, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { filterProducts, groupByCategory, parseProductFilter, PRODUCT_FILTERS, matchesProductFilter } from "@/lib/admin-products";
import { effectivePrice, isSaleActive, visibleTag } from "@/lib/promo";
import { CATEGORY_KINDS, KIND_LABEL_ES, parseKind, type CategoryRow, type Product } from "@/lib/types";
import ProductAvailableToggle from "@/components/admin/ProductAvailableToggle";
import { EmptyState, PageHeader, money } from "@/components/admin/ui";

type ProductRow = Product & { product_images: { id: string; url: string; display_order: number }[] };

const endFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string; q?: string; f?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(locale);
  const kind = parseKind(sp.kind);
  const f = parseProductFilter(sp.f);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const tPromo = await getTranslations({ locale: "es", namespace: "promo" });
  const now = new Date();

  const [{ data: categories, error: catError }, { data: products, error: prodError }] = await Promise.all([
    supabase.from("categories").select("*").order("kind").order("display_order"),
    supabase.from("products").select("*, product_images(id, url, display_order)").order("display_order"),
  ]);
  const allCats = (categories as CategoryRow[] | null) ?? [];
  const allProducts = (products as ProductRow[] | null) ?? [];
  const cats = allCats.filter((c) => c.kind === kind);
  const ofKind = allProducts.filter((p) => cats.some((c) => c.slug === p.category));
  const shown = filterProducts(ofKind, { q, f }, now);
  const groups = groupByCategory(cats, shown, !q && !f);
  const kindCount = (k: string) =>
    allProducts.filter((p) => allCats.some((c) => c.slug === p.category && c.kind === k)).length;
  const Placeholder = kind === "merch" ? Shirt : Cookie;

  return (
    <div className="adm-page">
      <PageHeader
        crumbs={[{ label: "Catálogo" }, { label: kind === "navidad" ? "Navidad" : "Productos" }]}
        title={kind === "navidad" ? "Productos de Navidad" : "Productos"}
        description={`${ofKind.length} producto${ofKind.length === 1 ? "" : "s"} en ${cats.length} categoría${cats.length === 1 ? "" : "s"}.`}
        actions={
          <>
            <Link href="/admin/categorias" className="adm-btn adm-hide-m">
              <Tags aria-hidden="true" className="h-[18px] w-[18px]" />
              Categorías
            </Link>
            <Link href={`/admin/productos/nuevo?kind=${kind}`} className="adm-btn adm-btn-primary">
              <CirclePlus aria-hidden="true" className="h-[18px] w-[18px]" />
              Nuevo producto
            </Link>
          </>
        }
      />

      <nav className="adm-seg mb-4" aria-label="Tipo de catálogo">
        {CATEGORY_KINDS.map((k) => (
          <Link key={k} href={`/admin/productos?kind=${k}`} aria-current={k === kind ? "page" : undefined}>
            {KIND_LABEL_ES[k]} <span className="adm-sub">{kindCount(k)}</span>
          </Link>
        ))}
      </nav>

      {(catError || prodError) && (
        <div className="adm-alert warn" role="alert">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>
            <b>No se pudo cargar el catálogo.</b>
            Recarga la página. Detalle: {(catError ?? prodError)?.message}
          </div>
        </div>
      )}

      <section className="adm-card overflow-hidden" aria-label="Lista de productos">
        <form className="adm-toolbar" action="/admin/productos" role="search">
          <input type="hidden" name="kind" value={kind} />
          <label className="adm-search" htmlFor="buscar-producto">
            <Search aria-hidden="true" className="h-[18px] w-[18px]" />
            <span className="sr-only">Buscar producto</span>
            <input id="buscar-producto" name="q" type="search" defaultValue={q} placeholder="Buscar producto" autoComplete="off" />
          </label>
          {PRODUCT_FILTERS.map((pf) => {
            const on = f === pf.id;
            const n = ofKind.filter((p) => matchesProductFilter(p, pf.id, now)).length;
            return (
              <button key={pf.id} type="submit" name="f" value={on ? "" : pf.id} className="adm-chip" aria-pressed={on}>
                {pf.label} · {n}
              </button>
            );
          })}
          {(q || f) && (
            <Link href={`/admin/productos?kind=${kind}`} className="adm-btn adm-btn-ghost adm-btn-sm">
              Quitar filtros
            </Link>
          )}
        </form>

        {groups.length === 0 ? (
          <EmptyState icon={PackageSearch}>
            {cats.length === 0 ? (
              <>
                No hay categorías de {KIND_LABEL_ES[kind]}.{" "}
                <Link href="/admin/categorias/nueva" className="font-semibold text-[color:var(--adm-wine)] underline">
                  Crea una
                </Link>
              </>
            ) : (
              "Ningún producto coincide con la búsqueda o el filtro."
            )}
          </EmptyState>
        ) : (
          <div className="adm-rows">
            <div className="adm-rows-head products" aria-hidden="true">
              <span>Producto</span>
              <span>Precio</span>
              <span>Etiquetas</span>
              <span>Disponible</span>
              <span />
            </div>
            {groups.map(({ category: c, products: list }) => (
              <div key={c.slug} role="group" aria-labelledby={`cat-${c.slug}`}>
                <div className="adm-cat-h">
                  <h2 id={`cat-${c.slug}`} className="text-[15px] font-semibold">
                    {c.label_es}
                  </h2>
                  <span className="n">
                    {list.length} producto{list.length === 1 ? "" : "s"}
                  </span>
                  {c.visible === false && <span className="adm-badge">Oculta en la tienda</span>}
                  <Link
                    href={`/admin/productos/nuevo?kind=${kind}&category=${c.slug}`}
                    className="adm-btn adm-btn-sm"
                    aria-label={`Agregar producto a ${c.label_es}`}
                  >
                    <CirclePlus aria-hidden="true" className="h-4 w-4" />
                    Agregar
                  </Link>
                </div>
                {list.length === 0 ? (
                  <p className="adm-sub px-4 py-3">Sin productos en esta categoría.</p>
                ) : (
                  <ul>
                    {list.map((p) => {
                      const cover = [...(p.product_images ?? [])].sort((a, b) => a.display_order - b.display_order)[0];
                      const onSale = isSaleActive(p, now);
                      const tag = visibleTag(p, now);
                      return (
                        <li key={p.id} className={`adm-row product${p.available ? "" : " dim"}`}>
                          <div className="adm-pname c-dim">
                            {cover ? (
                              <Image src={cover.url} alt="" width={44} height={44} className="adm-thumb" />
                            ) : (
                              <span className="adm-thumb" aria-hidden="true">
                                <Placeholder className="h-5 w-5" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <Link href={`/admin/productos/${p.id}/editar`} className="block truncate">
                                {p.name_es}
                              </Link>
                              <div className="adm-sub truncate">{p.name_en || "Falta el nombre en inglés"}</div>
                            </div>
                          </div>
                          <div className="c-end c-dim">
                            {onSale && <span className="adm-strike">{money(p.price)}</span>}
                            <span className="adm-money">{money(effectivePrice(p, now))}</span>
                          </div>
                          <div className="c-full flex flex-wrap gap-1.5">
                            {onSale && (
                              <span className="adm-badge wine">
                                Oferta{p.sale_ends_at ? ` · hasta ${endFmt.format(new Date(p.sale_ends_at))}` : ""}
                              </span>
                            )}
                            {tag && tag !== "oferta" && <span className="adm-badge gold">{tPromo(`tags.${tag}`)}</span>}
                            {!p.available && <span className="adm-badge">Agotado</span>}
                            {!cover && <span className="adm-badge bad">Sin foto</span>}
                            {!p.name_en && <span className="adm-badge warn">Falta inglés</span>}
                          </div>
                          <div className="c-switch">
                            <ProductAvailableToggle id={p.id} name={p.name_es} initialAvailable={p.available} />
                          </div>
                          <div className="c-end c-edit flex items-center gap-1">
                            {kind === "navidad" && p.slug && (
                              <a
                                href={`/navidad/${p.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="adm-icon-btn"
                                aria-label={`Ver la página de ${p.name_es} (se abre en otra pestaña)`}
                              >
                                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                              </a>
                            )}
                            <Link href={`/admin/productos/${p.id}/editar`} className="adm-btn adm-btn-sm" aria-label={`Editar ${p.name_es}`}>
                              Editar
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
