import { after } from "next/server";
import {
  Banknote,
  CalendarClock,
  ChefHat,
  ChevronRight,
  Clock,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import {
  agoLabel,
  bogotaDay,
  FULFILLMENT_LABEL,
  payLabelKey,
  scheduleLabel,
  shortOrderId,
  warningLines,
} from "@/lib/admin-orders";
import {
  countTabs,
  listOrders,
  listPaymentAlerts,
  type AdminOrderRow,
} from "@/lib/admin-orders.server";
import { isBoldConfigured } from "@/lib/bold";
import { reconcileRecentBoldOrders } from "@/lib/payments.reconcile";
import { isSaleActive } from "@/lib/promo";
import { SEASON_NAMES_ES, parseActiveSeason } from "@/lib/seasons";
import { createServiceClient } from "@/lib/supabase/service";
import SeasonIcon from "@/components/seasons/SeasonIcon";
import { RecheckPaymentsButton } from "@/components/admin/OrderActions";
import { EmptyState, FulfillmentIcon, PageHeader, PayBadge, money } from "@/components/admin/ui";

type CatalogRow = {
  id: string;
  available: boolean;
  price: number;
  sale_price: number | null;
  sale_ends_at: string | null;
  category: string;
  product_images: { id: string }[];
};

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

export default async function AdminHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const now = new Date();

  // A lost Bold webhook must not hide a paid order. Re-checking with Bold can
  // take seconds, so it runs after the page is sent; «Actualizar» runs it and
  // waits (this also sends the late shop email).
  if (isBoldConfigured()) after(() => reconcileRecentBoldOrders(createServiceClient()));

  const [counts, queue, today, alerts, products, categories, settings] = await Promise.all([
    countTabs(supabase, now),
    listOrders(supabase, { tab: "preparar", pageSize: 6, now }),
    listOrders(supabase, { tab: "hoy", pageSize: 200, now }),
    listPaymentAlerts(supabase, now),
    supabase.from("products").select("id, available, price, sale_price, sale_ends_at, category, product_images(id)"),
    supabase.from("categories").select("slug, kind"),
    supabase.from("site_settings").select("active_season").eq("id", 1).maybeSingle(),
  ]);

  const { start } = bogotaDay(now);
  const createdToday = today.rows.filter((o) => Date.parse(o.created_at) >= start.getTime());
  const paidToday = createdToday.filter((o) => o.payment_status === "paid" && o.status !== "cancelled");
  const paidTotal = paidToday.reduce((s, o) => s + Number(o.total), 0);
  const byFulfillment = (f: string) => createdToday.filter((o) => o.fulfillment === f).length;

  const alertOrders = alerts.filter((o) => warningLines(o.notes).length > 0);

  const catalog = (products.data as CatalogRow[] | null) ?? [];
  const navidadSlugs = new Set(
    ((categories.data as { slug: string; kind: string }[] | null) ?? []).filter((c) => c.kind === "navidad").map((c) => c.slug),
  );
  const catalogStats = [
    { label: "Productos agotados", badge: "Agotado", tone: "", n: catalog.filter((p) => !p.available).length, href: "/admin/productos?f=agotados" },
    { label: "Ofertas activas", badge: "Oferta", tone: "wine", n: catalog.filter((p) => isSaleActive(p, now)).length, href: "/admin/productos?f=oferta" },
    { label: "Productos sin foto", badge: "Sin foto", tone: "bad", n: catalog.filter((p) => !p.product_images?.length).length, href: "/admin/productos?f=sin-foto" },
    { label: "Productos de Navidad", badge: "Navidad", tone: "info", n: catalog.filter((p) => navidadSlugs.has(p.category)).length, href: "/admin/productos?kind=navidad" },
  ];
  const season = parseActiveSeason(settings.data?.active_season);
  const loadError = queue.error || today.error || products.error;

  return (
    <div className="adm-page">
      <PageHeader
        crumbs={[{ label: dateFmt.format(now).replace(/^./, (c) => c.toUpperCase()) }]}
        title="Resumen de hoy"
        description="Esto es lo que pasa hoy en Crooki."
        actions={
          <>
            <RecheckPaymentsButton />
            <Link href="/admin/pedidos" className="adm-btn adm-btn-primary">
              <ReceiptText aria-hidden="true" className="h-[18px] w-[18px]" />
              Ver pedidos
            </Link>
          </>
        }
      />

      {alertOrders.length > 0 && (
        <div className="adm-alert" role="alert">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>
            <b>
              {alertOrders.length === 1
                ? "1 pedido con un aviso de pago"
                : `${alertOrders.length} pedidos con un aviso de pago`}
            </b>
            Pedido {shortOrderId(alertOrders[0].id)} de {alertOrders[0].customer_name}:{" "}
            {warningLines(alertOrders[0].notes)
              .map((w) => w.replace(/^⚠\s*/, "").replace(/:\s*revisar en Bold$/i, "").toLowerCase())
              .join(" y ")}
            . Revísalo en Bold antes de preparar.
          </div>
          <Link href={`/admin/pedidos?tab=todos&pedido=${alertOrders[0].id}`} className="adm-btn adm-btn-sm adm-btn-danger">
            Revisar
          </Link>
        </div>
      )}

      {loadError && (
        <div className="adm-alert warn" role="alert">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>
            <b>Parte del resumen no cargó.</b>
            Recarga la página. Si sigue igual, revisa tu conexión o la sesión.
          </div>
        </div>
      )}

      <div className="adm-metrics">
        <div className="adm-card adm-metric hl">
          <div className="adm-metric-l">
            <ChefHat aria-hidden="true" />
            Por preparar
          </div>
          <div className="adm-metric-v">{counts.preparar ?? "–"}</div>
          <div className="adm-metric-s">
            {counts.programados ? `${counts.programados} programado${counts.programados === 1 ? "" : "s"}` : "Ninguno programado"}
          </div>
        </div>
        <div className="adm-card adm-metric">
          <div className="adm-metric-l">
            <Banknote aria-hidden="true" />
            Ventas pagadas hoy
          </div>
          <div className="adm-metric-v">{money(paidTotal)}</div>
          <div className="adm-metric-s">
            {paidToday.length} pagado{paidToday.length === 1 ? "" : "s"} con Bold · QR no se cuenta
          </div>
        </div>
        <div className="adm-card adm-metric">
          <div className="adm-metric-l">
            <ReceiptText aria-hidden="true" />
            Pedidos hoy
          </div>
          <div className="adm-metric-v">{createdToday.length}</div>
          <div className="adm-metric-s">
            {byFulfillment("delivery")} domicilio · {byFulfillment("pickup")} recoger · {byFulfillment("dine_in")} local
          </div>
        </div>
        <div className="adm-card adm-metric">
          <div className="adm-metric-l">
            <Clock aria-hidden="true" />
            Sin pagar
          </div>
          <div className="adm-metric-v">{counts["sin-pagar"] ?? "–"}</div>
          <div className="adm-metric-s">No preparar hasta que pague</div>
        </div>
      </div>

      <div className="adm-grid-2">
        <section className="adm-card" aria-labelledby="queue-title">
          <div className="adm-card-h">
            <h2 id="queue-title">Por preparar ahora</h2>
            <Link className="adm-more" href="/admin/pedidos">
              Ver todos
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          {queue.rows.length === 0 ? (
            <EmptyState icon={ChefHat}>
              {queue.error ? "No se pudo cargar la lista." : "Nada por preparar. Cuando entre un pedido, aparece aquí."}
            </EmptyState>
          ) : (
            <ul className="adm-queue">
              {queue.rows.map((o) => (
                <QueueItem key={o.id} order={o} now={now} />
              ))}
            </ul>
          )}
        </section>

        <div className="adm-stack">
          <section className="adm-card" aria-labelledby="catalog-title">
            <div className="adm-card-h">
              <h2 id="catalog-title">Catálogo</h2>
              <Link className="adm-more" href="/admin/productos">
                Productos
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <div className="adm-card-b py-2">
              <ul className="adm-mini">
                {catalogStats.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href}>
                      <span className={`adm-badge ${s.tone}`}>{s.badge}</span>
                      {s.label}
                      <span className="n">{products.error ? "–" : s.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className="adm-card" aria-label="Temporada">
            <div className="adm-card-b flex items-center gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[color:var(--adm-wine)] text-[color:var(--adm-gold)]">
                {season ? <SeasonIcon season={season} className="h-6 w-6" /> : <CalendarClock aria-hidden="true" className="h-6 w-6" />}
              </span>
              <div className="min-w-0">
                <div className="adm-sub">Temporada en la página de inicio</div>
                <b>{season ? SEASON_NAMES_ES[season] : "Ninguna"}</b>
              </div>
              <Link href="/admin/temporadas" className="adm-btn adm-btn-sm ml-auto">
                Cambiar
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function QueueItem({ order: o, now }: { order: AdminOrderRow; now: Date }) {
  const place = FULFILLMENT_LABEL[o.fulfillment ?? ""] ?? "Entrega sin dato";
  const ago = agoLabel(o.created_at, now);
  return (
    <li>
      <Link href={`/admin/pedidos?pedido=${o.id}`}>
        <FulfillmentIcon order={o} />
        <div className="min-w-0">
          <div className="adm-who truncate">{o.customer_name}</div>
          <div className="adm-meta">
            <span>
              {place}
              {o.fulfillment === "delivery" && o.delivery_zone ? ` · ${o.delivery_zone}` : ""}
            </span>
            {o.scheduled_for ? (
              <span className="adm-badge info">Programado · {scheduleLabel(o.scheduled_for, now)}</span>
            ) : (
              ago && <span>{ago}</span>
            )}
          </div>
        </div>
        <div className="adm-right">
          <span className="adm-money">{money(o.total)}</span>
          <PayBadge pay={payLabelKey(o)} />
        </div>
      </Link>
    </li>
  );
}
