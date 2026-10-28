import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Package, ShoppingBag, Plus, Tag, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { isBoldConfigured } from "@/lib/bold";
import { reconcileRecentBoldOrders } from "@/lib/payments.reconcile";
import { createServiceClient } from "@/lib/supabase/service";
import type { CategoryRow, Product } from "@/lib/types";
import {
  countsAsPending,
  isUnpaidBold,
  payLabelKey,
  sortOrdersForAdmin,
  warningLines,
} from "@/lib/admin-orders";

type ProductRow = Product & { product_images: { id: string; url: string }[] };
type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  created_at: string;
  fulfillment: string | null;
  delivery_zone: string | null;
  delivery_fee: number | null;
  payment_method: string | null;
  payment_status: string | null;
  paid_at: string | null;
  notes: string | null;
};

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { locale } = await params;
  const { kind: kindParam } = await searchParams;
  const kind = kindParam === "merch" ? "merch" : "menu";

  const t = await getTranslations({ locale, namespace: "admin" });
  const { supabase } = await requireAdmin(locale);

  // A lost Bold webhook must not hide a paid order: re-check recent unpaid
  // ones with Bold before listing (this also sends the late shop email).
  if (isBoldConfigured()) await reconcileRecentBoldOrders(createServiceClient());

  const [{ data: categories }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from("categories").select("*").order("kind").order("display_order"),
    supabase
      .from("products")
      .select("*, product_images(*)")
      .order("display_order"),
    supabase
      .from("orders")
      .select(
        "id, customer_name, customer_phone, total, status, created_at, fulfillment, delivery_zone, delivery_fee, payment_method, payment_status, paid_at, notes",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const allCategories = (categories as CategoryRow[]) ?? [];
  const cats = allCategories.filter((c) => c.kind === kind);
  const allProducts = (products as ProductRow[]) ?? [];
  const productsOfKind = allProducts.filter((p) =>
    cats.some((c) => c.slug === p.category),
  );

  const byCategory = new Map<string, ProductRow[]>();
  for (const c of cats) byCategory.set(c.slug, []);
  for (const p of productsOfKind) {
    if (byCategory.has(p.category)) byCategory.get(p.category)!.push(p);
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  const statusLabels: Record<string, string> = {
    pending: t("order_pending"),
    confirmed: t("order_confirmed"),
    delivered: t("order_delivered"),
    cancelled: t("order_cancelled"),
  };

  const ordersList = sortOrdersForAdmin((orders as OrderRow[]) ?? []);
  const payLabels = {
    paid: t("pay_paid"),
    awaiting: t("pay_awaiting"),
    rejected: t("pay_rejected"),
    qr: t("pay_qr"),
  };
  const payColors = {
    paid: "bg-green-100 text-green-800",
    awaiting: "bg-gray-200 text-gray-600",
    rejected: "bg-red-100 text-red-800",
    qr: "bg-amber-100 text-amber-800",
  };
  const fulfillmentLabels: Record<string, string> = {
    delivery: t("fulfillment_delivery"),
    pickup: t("fulfillment_pickup"),
    dine_in: t("fulfillment_dine_in"),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black" style={{ color: "#8b0031" }}>
          {t("dashboard")}
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/categorias`}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-full border transition-colors hover:bg-gray-50"
            style={{ borderColor: "#8b0031", color: "#8b0031" }}
          >
            <Tag className="w-4 h-4" />
            Categorías
          </Link>
          <Link
            href={`/${locale}/admin/productos/nuevo?kind=${kind}`}
            className="flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-full transition-opacity hover:opacity-90 text-sm"
            style={{ backgroundColor: "#8b0031" }}
          >
            <Plus className="w-4 h-4" />
            {t("new_product")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <Package className="w-8 h-8 mx-auto mb-2" style={{ color: "#8b0031" }} />
          <div className="text-3xl font-black">{allProducts.length}</div>
          <div className="text-gray-500 text-sm">{t("products")}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <Tag className="w-8 h-8 mx-auto mb-2" style={{ color: "#8b0031" }} />
          <div className="text-3xl font-black">{allCategories.length}</div>
          <div className="text-gray-500 text-sm">Categorías</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <ShoppingBag className="w-8 h-8 mx-auto mb-2" style={{ color: "#8b0031" }} />
          <div className="text-3xl font-black">{ordersList.length}</div>
          <div className="text-gray-500 text-sm">{t("orders")}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl font-black text-yellow-600">
            {ordersList.filter(countsAsPending).length}
          </div>
          <div className="text-gray-500 text-sm">{t("order_pending")}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(["menu", "merch"] as const).map((k) => {
          const count = allProducts.filter((p) =>
            allCategories.some((c) => c.slug === p.category && c.kind === k),
          ).length;
          return (
            <Link
              key={k}
              href={`/${locale}/admin?kind=${k}`}
              className="px-5 py-2 rounded-full text-sm font-semibold border transition-colors"
              style={{
                backgroundColor: kind === k ? "#8b0031" : "transparent",
                color: kind === k ? "#ffffff" : "#8b0031",
                borderColor: kind === k ? "#8b0031" : "#e5e7eb",
              }}
            >
              {k === "menu" ? "Menú" : "Merch"} · {count}
            </Link>
          );
        })}
      </div>

      <div className="space-y-8 mb-12">
        {cats.map((c) => {
          const list = byCategory.get(c.slug) ?? [];
          return (
            <section key={c.slug}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">
                  {c.label_es}{" "}
                  <span className="text-gray-400 text-sm font-normal">({list.length})</span>
                </h2>
                <Link
                  href={`/${locale}/admin/productos/nuevo?kind=${kind}&category=${c.slug}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: "#8b0031", color: "#8b0031" }}
                >
                  + Agregar
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {list.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">Sin productos en esta categoría</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {list.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                          {p.product_images?.[0]?.url ? (
                            <Image
                              src={p.product_images[0].url}
                              alt={p.name_es}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              {kind === "merch" ? "👕" : "🍪"}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{p.name_es}</p>
                          <p className="text-gray-500 text-sm">
                            ${p.price.toLocaleString("es-CO")} ·{" "}
                            {p.available ? "Disponible" : "Agotado"}
                          </p>
                        </div>
                        <Link
                          href={`/${locale}/admin/productos/${p.id}/editar`}
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
            </section>
          );
        })}
      </div>

      <div id="orders">
        <h2 className="text-xl font-bold mb-4">{t("orders")}</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {ordersList.length === 0 ? (
            <div className="p-8 text-center text-gray-400">{t("no_orders")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-6 py-3 font-semibold text-gray-600">ID</th>
                    <th className="px-6 py-3 font-semibold text-gray-600">Cliente</th>
                    <th className="px-6 py-3 font-semibold text-gray-600">Total</th>
                    <th className="px-6 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="px-6 py-3 font-semibold text-gray-600 hidden sm:table-cell">{t("col_payment")}</th>
                    <th className="px-6 py-3 font-semibold text-gray-600">{t("col_delivery")}</th>
                    <th className="px-6 py-3 font-semibold text-gray-600">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ordersList.map((order) => {
                    const payKey = payLabelKey(order);
                    const dimmed = isUnpaidBold(order);
                    const warnings = warningLines(order.notes);
                    return (
                    <tr
                      key={order.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        countsAsPending(order) ? "bg-yellow-50/60" : ""
                      }`}
                    >
                      <td className={`px-6 py-4 font-mono text-xs text-gray-500 ${dimmed ? "opacity-50" : ""}`}>
                        {order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        <div className={dimmed ? "opacity-50" : ""}>
                          <div className="font-medium">{order.customer_name}</div>
                          <div className="text-gray-400 text-xs">{order.customer_phone}</div>
                          <span
                            className={`sm:hidden mt-1 inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${payColors[payKey]}`}
                          >
                            {payLabels[payKey]}
                          </span>
                        </div>
                        {warnings.map((w) => (
                          <div
                            key={w}
                            className="mt-1 flex items-start gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-800"
                          >
                            <TriangleAlert className="w-3.5 h-3.5 mt-px shrink-0" />
                            {w}
                          </div>
                        ))}
                      </td>
                      <td className={`px-6 py-4 font-bold ${dimmed ? "opacity-50" : ""}`}>
                        ${order.total.toLocaleString("es-CO")}
                      </td>
                      <td className={`px-6 py-4 ${dimmed ? "opacity-50" : ""}`}>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            statusColors[order.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {statusLabels[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className={`px-6 py-4 hidden sm:table-cell ${dimmed ? "opacity-50" : ""}`}>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${payColors[payKey]}`}
                        >
                          {payLabels[payKey]}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-xs text-gray-600 ${dimmed ? "opacity-50" : ""}`}>
                        <div className="font-medium">
                          {fulfillmentLabels[order.fulfillment ?? ""] ?? "-"}
                        </div>
                        {order.fulfillment === "delivery" && (
                          <div className="text-gray-400">
                            {order.delivery_zone ?? ""}
                            {order.delivery_fee
                              ? ` · ${t("delivery_fee")} $${order.delivery_fee.toLocaleString("es-CO")}`
                              : ""}
                          </div>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-gray-500 ${dimmed ? "opacity-50" : ""}`}>
                        {new Date(order.created_at).toLocaleDateString("es-CO")}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
