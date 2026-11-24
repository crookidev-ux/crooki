import { after } from "next/server";
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle, Phone, ReceiptText, Search, TriangleAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import {
  agoLabel,
  cleanSearch,
  FULFILLMENT_LABEL,
  isUnpaidBold,
  nextStatuses,
  ORDER_TABS,
  orderTimeLabel,
  parseOrderTab,
  payLabelKey,
  phoneDigits,
  scheduleLabel,
  shortOrderId,
  sortOrdersForAdmin,
  warningLines,
  type OrderTab,
} from "@/lib/admin-orders";
import {
  countTabs,
  getOrderDetail,
  listOrders,
  ORDERS_PAGE_SIZE,
  type AdminOrderDetail,
  type AdminOrderRow,
} from "@/lib/admin-orders.server";
import { isBoldConfigured } from "@/lib/bold";
import { reconcileRecentBoldOrders } from "@/lib/payments.reconcile";
import { createServiceClient } from "@/lib/supabase/service";
import { customerNotes } from "@/lib/whatsapp";
import { OrderStatusButtons, RecheckPaymentsButton } from "@/components/admin/OrderActions";
import { EmptyState, PageHeader, PayBadge, StatusBadge, money } from "@/components/admin/ui";

type Search = { tab?: string; q?: string; page?: string; pedido?: string };

function href(s: { tab?: OrderTab; q?: string; page?: number; pedido?: string }) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  else if (s.tab && s.tab !== "preparar") p.set("tab", s.tab);
  if (s.page && s.page > 1) p.set("page", String(s.page));
  if (s.pedido) p.set("pedido", s.pedido);
  const qs = p.toString();
  return `/admin/pedidos${qs ? `?${qs}` : ""}`;
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(locale);
  const now = new Date();
  const tab = parseOrderTab(sp.tab);
  const q = cleanSearch(sp.q);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  // Same as the home page: re-check Bold after the response, never before it.
  if (isBoldConfigured()) after(() => reconcileRecentBoldOrders(createServiceClient()));

  const [counts, list, detail] = await Promise.all([
    countTabs(supabase, now),
    listOrders(supabase, { tab, q, page, now }),
    sp.pedido ? getOrderDetail(supabase, sp.pedido) : Promise.resolve(null),
  ]);
  const rows = tab === "preparar" && !q ? list.rows : sortOrdersForAdmin(list.rows);
  const from = list.total === 0 ? 0 : (page - 1) * ORDERS_PAGE_SIZE + 1;
  const to = Math.min(page * ORDERS_PAGE_SIZE, list.total);
  const base = { tab, q };

  return (
    <div className="adm-page">
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/admin" }, { label: "Pedidos" }]}
        title="Pedidos"
        description="Los pedidos pagados en línea que aún no se pagan aparecen al final y atenuados: no se preparan."
        actions={<RecheckPaymentsButton />}
      />

      <nav className="adm-tabs" aria-label="Filtrar pedidos">
        {ORDER_TABS.map((t) => {
          const c = t.id in counts ? counts[t.id as keyof typeof counts] : null;
          return (
            <Link key={t.id} href={href({ tab: t.id })} aria-current={!q && t.id === tab ? "page" : undefined}>
              {t.label}
              {c !== null && <span className="c">{c}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="adm-split">
        <div className="adm-split-in">
          <section className="adm-card min-w-0 overflow-hidden" aria-label="Lista de pedidos">
            <form className="adm-toolbar" action="/admin/pedidos" role="search">
              <label className="adm-search" htmlFor="buscar">
                <Search aria-hidden="true" className="h-[18px] w-[18px]" />
                <span className="sr-only">Buscar pedido</span>
                <input
                  id="buscar"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Nombre, teléfono o número (8 caracteres)"
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </label>
              <button type="submit" className="adm-btn">
                Buscar
              </button>
              {q && (
                <Link href={href({ tab })} className="adm-btn adm-btn-ghost">
                  Quitar búsqueda
                </Link>
              )}
            </form>

            {q && (
              <p className="adm-sub px-4 pt-3" aria-live="polite">
                {list.total} resultado{list.total === 1 ? "" : "s"} para «{q}» en todos los pedidos.
              </p>
            )}

            {list.error ? (
              <div className="adm-alert warn m-4" role="alert">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                <div>
                  <b>No se pudieron cargar los pedidos.</b>
                  Recarga la página. Detalle: {list.error}
                </div>
              </div>
            ) : rows.length === 0 ? (
              <EmptyState icon={ReceiptText}>
                {q ? "Ningún pedido coincide con la búsqueda." : EMPTY[tab]}
              </EmptyState>
            ) : (
              <div className="adm-rows">
                <div className="adm-rows-head orders" aria-hidden="true">
                  <span>Pedido</span>
                  <span>Cliente</span>
                  <span>Entrega</span>
                  <span>Pago y estado</span>
                  <span className="text-right">Total</span>
                </div>
                <ul>
                  {rows.map((o) => (
                    <li key={o.id}>
                      <OrderRow order={o} now={now} selected={o.id === sp.pedido} href={href({ ...base, page, pedido: o.id })} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {list.total > 0 && (
              <div className="adm-tfoot">
                <span>
                  Mostrando {from}–{to} de {list.total}
                </span>
                <div className="adm-pager">
                  {page > 1 && (
                    <Link className="adm-btn adm-btn-sm" href={href({ ...base, page: page - 1 })}>
                      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                      Anterior
                    </Link>
                  )}
                  {to < list.total && (
                    <Link className="adm-btn adm-btn-sm" href={href({ ...base, page: page + 1 })}>
                      Siguiente
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </section>

          {sp.pedido && (
            <OrderDetail order={detail} now={now} closeHref={href({ ...base, page })} />
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY: Record<OrderTab, string> = {
  preparar: "Nada por preparar. Cuando entre un pedido pagado o por QR, aparece aquí.",
  hoy: "Todavía no hay pedidos hoy. Cuando entre uno, aparece aquí.",
  programados: "No hay pedidos programados.",
  "sin-pagar": "No hay pagos en línea pendientes.",
  entregados: "Todavía no hay pedidos marcados como entregados.",
  todos: "Todavía no hay pedidos.",
};

function OrderRow({ order: o, now, selected, href }: { order: AdminOrderRow; now: Date; selected: boolean; href: string }) {
  const warnings = warningLines(o.notes);
  const place = FULFILLMENT_LABEL[o.fulfillment ?? ""] ?? "-";
  const time = orderTimeLabel(o.created_at, now);
  const ago = agoLabel(o.created_at, now);
  return (
    <Link href={href} className={`adm-row order${isUnpaidBold(o) ? " dim" : ""}`} aria-current={selected ? "true" : undefined}>
      <div className="c-wide c-dim">
        <div className="adm-id">{shortOrderId(o.id)}</div>
        <div className="adm-sub">{time}</div>
      </div>
      <div className="c-dim min-w-0">
        <b className="block truncate">{o.customer_name}</b>
        <div className="adm-sub c-wide">{o.customer_phone}</div>
        <div className="adm-sub c-narrow">
          {place} · {ago ?? time}
        </div>
        {warnings.map((w) => (
          <div key={w} className="adm-warn-line">
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {w.replace(/^⚠\s*/, "")}
          </div>
        ))}
      </div>
      <div className="c-wide c-dim min-w-0">
        {place}
        {o.fulfillment === "delivery" && (
          <div className="adm-sub">
            {o.delivery_zone ?? ""}
            {o.delivery_fee ? ` · ${money(o.delivery_fee)}` : ""}
          </div>
        )}
      </div>
      <div className="c-full flex flex-wrap items-center gap-1.5">
        <PayBadge pay={payLabelKey(o)} />
        <StatusBadge status={o.status} />
        {o.scheduled_for && <span className="adm-badge info">Programado · {scheduleLabel(o.scheduled_for, now)}</span>}
      </div>
      <div className="c-total c-end c-dim adm-money">{money(o.total)}</div>
    </Link>
  );
}

const STEP: Record<string, number> = { pending: 1, confirmed: 2, delivered: 3 };

function OrderDetail({ order: o, now, closeHref }: { order: AdminOrderDetail | null; now: Date; closeHref: string }) {
  const close = (
    <Link href={closeHref} className="adm-btn adm-btn-ghost adm-btn-sm adm-detail-close">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Volver a la lista
    </Link>
  );
  if (!o) {
    return (
      <aside className="adm-card adm-detail" aria-label="Detalle del pedido">
        <div className="adm-card-b">
          {close}
          <p className="mt-2">No encontramos ese pedido. Puede que el enlace esté incompleto.</p>
        </div>
      </aside>
    );
  }
  const digits = phoneDigits(o.customer_phone);
  const recipient = o.recipient_phone && o.recipient_phone !== o.customer_phone ? o.recipient_phone : null;
  const note = customerNotes(o.notes);
  const warnings = warningLines(o.notes);
  const items = o.order_items ?? [];
  const pay = payLabelKey(o);
  const allowed = nextStatuses(o);
  const step = STEP[o.status] ?? 0;
  return (
    <aside className="adm-card adm-detail" aria-labelledby="detalle-titulo">
      <div className="adm-card-h">
        <div className="min-w-0">
          {close}
          <div className="adm-id">
            {shortOrderId(o.id)} · {orderTimeLabel(o.created_at, now)}
          </div>
          <h2 id="detalle-titulo" className="truncate">
            {o.customer_name}
          </h2>
        </div>
        <span className="ml-auto">
          <PayBadge pay={pay} />
        </span>
      </div>

      {warnings.length > 0 && (
        <div className="adm-card-b">
          {warnings.map((w) => (
            <div key={w} className="adm-warn-line text-sm">
              <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
              {w.replace(/^⚠\s*/, "")}
            </div>
          ))}
        </div>
      )}

      <div className="adm-card-b">
        <div className="adm-lbl mb-1.5">Productos</div>
        {items.length === 0 ? (
          <p className="adm-sub">Este pedido no tiene productos guardados.</p>
        ) : (
          <ul className="adm-items">
            {items.map((it) => (
              <li key={it.id}>
                <span className="q">{it.quantity}×</span>
                <span className="min-w-0">{it.product_name}</span>
                <span className="p">{money(Number(it.unit_price) * it.quantity)}</span>
              </li>
            ))}
            {o.fulfillment === "delivery" && (
              <li className="sep">
                <span className="adm-sub">Domicilio{o.delivery_zone ? ` · ${o.delivery_zone}` : ""}</span>
                <span className="p">{money(o.delivery_fee)}</span>
              </li>
            )}
            <li className={o.fulfillment === "delivery" ? "" : "sep"}>
              <b>Total</b>
              <span className="p adm-money">{money(o.total)}</span>
            </li>
          </ul>
        )}
      </div>

      <div className="adm-card-b">
        <dl className="adm-kv">
          <dt>Entrega</dt>
          <dd>{FULFILLMENT_LABEL[o.fulfillment ?? ""] ?? "-"}</dd>
          {o.scheduled_for && (
            <>
              <dt>Programado</dt>
              <dd>{scheduleLabel(o.scheduled_for, now)}</dd>
            </>
          )}
          {o.customer_address && (
            <>
              <dt>Dirección</dt>
              <dd>{o.customer_address}</dd>
            </>
          )}
          <dt>Teléfono</dt>
          <dd>{o.customer_phone}</dd>
          {recipient && (
            <>
              <dt>Recibe</dt>
              <dd>{recipient}</dd>
            </>
          )}
          {o.customer_email && (
            <>
              <dt>Correo</dt>
              <dd>{o.customer_email}</dd>
            </>
          )}
          {note && (
            <>
              <dt>Nota</dt>
              <dd>{note}</dd>
            </>
          )}
        </dl>
        {digits && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="adm-btn flex-1" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" className="h-[18px] w-[18px]" />
              WhatsApp
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
            <a className="adm-btn flex-1" href={`tel:+${digits}`}>
              <Phone aria-hidden="true" className="h-[18px] w-[18px]" />
              Llamar
            </a>
          </div>
        )}
      </div>

      <div className="adm-card-b">
        <div className="adm-lbl flex items-center gap-2">
          Estado <StatusBadge status={o.status} />
        </div>
        {step > 0 && (
          <div className="adm-steps" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= step ? "on" : ""} />
            ))}
          </div>
        )}
        {isUnpaidBold(o) && o.status !== "cancelled" && (
          <p className="adm-help mt-3">
            Bold aún no confirma este pago: no se prepara. Si el cliente dice que pagó, toca «Actualizar» arriba.
          </p>
        )}
        {allowed.length > 0 ? (
          <div className="mt-3.5">
            <OrderStatusButtons orderId={o.id} allowed={allowed} paidOnline={o.payment_status === "paid" && o.payment_method === "bold"} />
          </div>
        ) : (
          <p className="adm-help mt-3">Este pedido ya está cerrado.</p>
        )}
      </div>
    </aside>
  );
}
