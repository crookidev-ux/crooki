import { DOUBLE_CHARGE_NOTE, AMOUNT_MISMATCH_NOTE } from "./payments.confirm.ts";

// Lógica pura de la lista de pedidos del admin (sin React) para poder probarla.

export type AdminPayKey = "paid" | "awaiting" | "rejected" | "qr";

type OrderLike = {
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
};

/** Pedido de pago en línea que aún no está pagado: no hay nada que preparar. */
export function isUnpaidBold(o: OrderLike): boolean {
  return o.payment_method === "bold" && o.payment_status !== "paid";
}

/** Clave de la etiqueta de pago. Pedidos antiguos (sin método) se tratan como QR / WhatsApp. */
export function payLabelKey(o: OrderLike): AdminPayKey {
  if (o.payment_method === "bold") {
    if (o.payment_status === "paid") return "paid";
    if (o.payment_status === "rejected") return "rejected";
    return "awaiting";
  }
  return "qr";
}

/** Cuenta como «pendiente» (por preparar) solo si está pendiente y no es un pago en línea sin pagar. */
export function countsAsPending(o: OrderLike): boolean {
  return o.status === "pending" && !isUnpaidBold(o);
}

/** 0 = pedidos normales, 1 = pago en línea sin pagar (van al final). */
export function sortRank(o: OrderLike): number {
  return isUnpaidBold(o) ? 1 : 0;
}

/** Orden estable: conserva el orden recibido (más recientes primero) y hunde los sin pagar. */
export function sortOrdersForAdmin<T extends OrderLike>(orders: T[]): T[] {
  return orders
    .map((o, i) => ({ o, i }))
    .sort((a, b) => sortRank(a.o) - sortRank(b.o) || a.i - b.i)
    .map((x) => x.o);
}

const KNOWN_WARNINGS = [DOUBLE_CHARGE_NOTE, AMOUNT_MISMATCH_NOTE];

/** Líneas de las notas que son alertas del sistema (coincidencia exacta; el texto del cliente no cuenta) para mostrarlas destacadas. */
export function warningLines(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => KNOWN_WARNINGS.includes(l));
}

// ---------------------------------------------------------------------------
// Pedidos del admin v2: pestañas, transiciones de estado y ayudas de formato.
// Las consultas a la base (src/lib/admin-orders.server.ts) aplican los mismos
// filtros que `matchesTab`; si cambias uno, cambia el otro y sus pruebas.

export type OrderStatusValue = "pending" | "confirmed" | "delivered" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const PAY_LABEL: Record<AdminPayKey, string> = {
  paid: "Pagado",
  awaiting: "Sin pagar · no preparar",
  rejected: "Pago rechazado",
  qr: "QR / WhatsApp",
};

export const FULFILLMENT_LABEL: Record<string, string> = {
  delivery: "Domicilio",
  pickup: "Recoger en el local",
  dine_in: "Comer en el local",
};

export const ORDER_TABS = [
  { id: "preparar", label: "Por preparar" },
  { id: "hoy", label: "Hoy" },
  { id: "programados", label: "Programados" },
  { id: "sin-pagar", label: "Sin pagar" },
  { id: "entregados", label: "Entregados" },
  { id: "todos", label: "Todos" },
] as const;

export type OrderTab = (typeof ORDER_TABS)[number]["id"];

export function parseOrderTab(v: unknown): OrderTab {
  return ORDER_TABS.some((t) => t.id === v) ? (v as OrderTab) : "preparar";
}

type TabOrder = OrderLike & {
  created_at: string;
  scheduled_for?: string | null;
};

const BOGOTA_OFFSET_MS = 5 * 3_600_000; // Colombia: UTC-5 all year, no DST.

/** Start (inclusive) and end (exclusive) of «today» in Cartagena, as instants. */
export function bogotaDay(now: Date = new Date()): { start: Date; end: Date } {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + 86_400_000) };
}

/** Pendiente o confirmado: todavía hay algo que hacer con él. */
export function isOpenOrder(o: OrderLike): boolean {
  return o.status === "pending" || o.status === "confirmed";
}

/** Se puede preparar: no es un pago en línea sin pagar (QR y pedidos antiguos sí). */
export function canPrepare(o: OrderLike): boolean {
  return !isUnpaidBold(o);
}

/**
 * Qué pedidos muestra cada pestaña.
 * - preparar: abiertos, que se pueden preparar, hechos hoy o programados de hoy
 *   en adelante. Los pendientes de días anteriores no entran: antes del admin
 *   v2 nadie marcaba los estados, así que casi todo lo viejo sigue «Pendiente».
 * - hoy: hechos hoy, o programados para hoy.
 * - programados: abiertos y programados de hoy en adelante.
 * - sin-pagar: pago en línea sin pagar, ni cancelado ni entregado.
 */
export function matchesTab(o: TabOrder, tab: OrderTab, now: Date = new Date()): boolean {
  const { start, end } = bogotaDay(now);
  const created = Date.parse(o.created_at);
  const sched = o.scheduled_for ? Date.parse(o.scheduled_for) : null;
  switch (tab) {
    case "preparar":
      return isOpenOrder(o) && canPrepare(o) && (created >= start.getTime() || (sched !== null && sched >= start.getTime()));
    case "hoy":
      return created >= start.getTime() || (sched !== null && sched >= start.getTime() && sched < end.getTime());
    case "programados":
      return isOpenOrder(o) && sched !== null && sched >= start.getTime();
    case "sin-pagar":
      return isUnpaidBold(o) && isOpenOrder(o);
    case "entregados":
      return o.status === "delivered";
    case "todos":
      return true;
  }
}

/**
 * Estados a los que el admin puede pasar un pedido.
 * - Entregado y Cancelado son finales.
 * - Confirmar o entregar exige que se pueda preparar: un pago con Bold sin
 *   pagar no se confirma ni se entrega (QR / WhatsApp sí: se cobra por fuera).
 * - Cancelar siempre se puede mientras esté abierto (si ya pagó con Bold, el
 *   reembolso se hace en Bold; la pantalla lo advierte).
 */
export function nextStatuses(o: OrderLike): OrderStatusValue[] {
  if (!isOpenOrder(o)) return [];
  const out: OrderStatusValue[] = [];
  if (canPrepare(o)) {
    if (o.status === "pending") out.push("confirmed");
    out.push("delivered");
  }
  out.push("cancelled");
  return out;
}

export function canTransition(o: OrderLike, next: string): next is OrderStatusValue {
  return (nextStatuses(o) as string[]).includes(next);
}

/** Número para wa.me / tel: (solo dígitos). Un celular colombiano de 10 dígitos lleva el 57. */
export function phoneDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 7) return null;
  return d.length === 10 && d.startsWith("3") ? `57${d}` : d;
}

/** Texto de búsqueda seguro para un filtro `or()` de PostgREST (sin comas, paréntesis ni comodines). */
export function cleanSearch(q: unknown): string {
  return typeof q === "string" ? q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "";
}

/** «A1F3C9E2»: los 8 primeros caracteres del id, como en los correos. */
export function shortOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Rango de ids (uuid) que empiezan por esos 8 caracteres hexadecimales, o null. */
export function idPrefixRange(q: string): { from: string; to: string } | null {
  if (!/^[0-9a-f]{8}$/i.test(q)) return null;
  const p = q.toLowerCase();
  return { from: `${p}-0000-0000-0000-000000000000`, to: `${p}-ffff-ffff-ffff-ffffffffffff` };
}

const timeFmt = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const dayFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });

/** «2:42 p. m.» si es de hoy; «23 nov · 2:42 p. m.» si no. */
export function orderTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = timeFmt.format(d);
  return d >= bogotaDay(now).start ? time : `${dayFmt.format(d)} · ${time}`;
}

/** When a scheduled order is due: «hoy 11:00 a. m.», «mañana 11:00 a. m.» or «26 nov 11:00 a. m.». */
export function scheduleLabel(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  const { start, end } = bogotaDay(now);
  const time = timeFmt.format(new Date(t));
  if (t >= start.getTime() && t < end.getTime()) return `hoy ${time}`;
  if (t >= end.getTime() && t < end.getTime() + 86_400_000) return `mañana ${time}`;
  return `${dayFmt.format(new Date(t))} ${time}`;
}

/** «hace 18 min» / «hace 2 h» para pedidos de las últimas 12 horas; null si no. */
export function agoLabel(iso: string, now: Date = new Date()): string | null {
  const min = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (min < 0 || min >= 12 * 60) return null;
  if (min < 1) return "ahora";
  return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h`;
}
