// Server-only order queries for the admin (v2). The filters mirror
// `matchesTab` in admin-orders.ts, which is the tested definition of each tab.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bogotaDay, cleanSearch, idPrefixRange, type OrderTab } from "./admin-orders";

export const ORDER_COLUMNS =
  "id, customer_name, customer_phone, total, status, created_at, fulfillment, delivery_zone, delivery_fee, payment_method, payment_status, paid_at, notes, scheduled_for";

export type AdminOrderRow = {
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
  scheduled_for: string | null;
};

export type AdminOrderDetail = AdminOrderRow & {
  customer_email: string | null;
  customer_address: string | null;
  recipient_phone: string | null;
  order_items: { id: string; quantity: number; unit_price: number; product_name: string }[];
};

export const ORDERS_PAGE_SIZE = 20;

// The PostgREST builder methods used below; each returns the same builder.
type Filters<T> = {
  in(column: string, values: string[]): T;
  or(filters: string): T;
  gte(column: string, value: string): T;
  eq(column: string, value: string): T;
  neq(column: string, value: string): T;
  order(column: string, options: { ascending: boolean }): T;
};

const OPEN = ["pending", "confirmed"];
// «Can be prepared»: not an online payment still unpaid.
const PAYABLE = "payment_method.neq.bold,payment_status.eq.paid";

function applyTab<Q extends Filters<Q>>(q: Q, tab: OrderTab, now: Date): Q {
  const { start, end } = bogotaDay(now);
  const s = start.toISOString();
  const e = end.toISOString();
  switch (tab) {
    case "preparar":
      return q.in("status", OPEN).or(PAYABLE).or(`created_at.gte.${s},scheduled_for.gte.${s}`);
    case "hoy":
      return q.or(`created_at.gte.${s},and(scheduled_for.gte.${s},scheduled_for.lt.${e})`);
    case "programados":
      return q.in("status", OPEN).gte("scheduled_for", s);
    case "sin-pagar":
      return q.in("status", OPEN).eq("payment_method", "bold").neq("payment_status", "paid");
    case "entregados":
      return q.eq("status", "delivered");
    case "todos":
      return q;
  }
}

function applyOrder<Q extends Filters<Q>>(q: Q, tab: OrderTab): Q {
  // The prep queue is first come, first served; scheduled ones by their time.
  if (tab === "preparar") return q.order("created_at", { ascending: true });
  if (tab === "programados") return q.order("scheduled_for", { ascending: true });
  return q.order("created_at", { ascending: false });
}

/** One page of a tab. A search looks across every order (name, phone or the 8-character number). */
export async function listOrders(
  supabase: SupabaseClient,
  opts: { tab: OrderTab; q?: string; page?: number; pageSize?: number; now?: Date },
): Promise<{ rows: AdminOrderRow[]; total: number; error: string | null }> {
  const now = opts.now ?? new Date();
  const size = opts.pageSize ?? ORDERS_PAGE_SIZE;
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const search = cleanSearch(opts.q);
  let q = supabase.from("orders").select(ORDER_COLUMNS, { count: "exact" });
  if (search) {
    const range = idPrefixRange(search);
    q = range
      ? q.gte("id", range.from).lte("id", range.to)
      : q.or(`customer_name.ilike.*${search}*,customer_phone.ilike.*${search}*`);
    q = q.order("created_at", { ascending: false });
  } else {
    q = applyOrder(applyTab(q, opts.tab, now), opts.tab);
  }
  const { data, error, count } = await q.range((page - 1) * size, page * size - 1);
  if (error) {
    console.error("[admin-orders] list", opts.tab, error);
    return { rows: [], total: 0, error: error.message };
  }
  return { rows: (data as AdminOrderRow[] | null) ?? [], total: count ?? 0, error: null };
}

export type TabCounts = Record<"preparar" | "hoy" | "programados" | "sin-pagar", number | null>;

/** How many orders a tab has; null when the count failed (the badge is then hidden, never a wrong 0). */
export async function countTab(supabase: SupabaseClient, tab: OrderTab, now: Date = new Date()): Promise<number | null> {
  const head = supabase.from("orders").select("id", { count: "exact", head: true });
  const { count, error }: { count: number | null; error: { message: string } | null } = await applyTab(head, tab, now);
  if (error) {
    console.error("[admin-orders] count", tab, error);
    return null;
  }
  return count ?? 0;
}

export async function countTabs(supabase: SupabaseClient, now: Date = new Date()): Promise<TabCounts> {
  const [preparar, hoy, programados, sinPagar] = await Promise.all([
    countTab(supabase, "preparar", now),
    countTab(supabase, "hoy", now),
    countTab(supabase, "programados", now),
    countTab(supabase, "sin-pagar", now),
  ]);
  return { preparar, hoy, programados, "sin-pagar": sinPagar };
}

export async function getOrderDetail(supabase: SupabaseClient, id: string): Promise<AdminOrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from("orders")
    .select(`${ORDER_COLUMNS}, customer_email, customer_address, recipient_phone, order_items(id, quantity, unit_price, product_name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[admin-orders] detail", id, error);
  return (data as AdminOrderDetail | null) ?? null;
}

/** Recent orders carrying a Bold alert (double charge / amount mismatch) in their notes. */
export async function listPaymentAlerts(supabase: SupabaseClient, now: Date = new Date()): Promise<AdminOrderRow[]> {
  const since = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .gte("created_at", since)
    .or("notes.ilike.*cobro doble*,notes.ilike.*Monto distinto*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) console.error("[admin-orders] alerts", error);
  return (data as AdminOrderRow[] | null) ?? [];
}
