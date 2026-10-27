// «Mi pedido»: order number + checkout phone → the order id, so the customer
// can open /pedido/{id} again. Both must match; any miss answers the same 404
// so the endpoint does not reveal which part was wrong.
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeOrderCode, orderIdRange, phonesMatch } from "@/lib/order-lookup";

// Best-effort brake on guessing (per warm instance): a few tries per minute per IP.
const WINDOW_MS = 60_000;
const MAX_TRIES = 8;
const tries = new Map<string, { count: number; since: number }>();

function tooMany(ip: string, now: number): boolean {
  const entry = tries.get(ip);
  if (!entry || now - entry.since > WINDOW_MS) {
    tries.set(ip, { count: 1, since: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_TRIES;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip, Date.now())) return Response.json({ error: "Too many tries" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { code?: unknown; phone?: unknown } | null;
  const code = typeof body?.code === "string" ? normalizeOrderCode(body.code) : null;
  const phone = typeof body?.phone === "string" ? body.phone : "";
  if (!code || !phone) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { from, to } = orderIdRange(code);
  const { data, error } = await createServiceClient()
    .from("orders")
    .select("id, customer_phone, recipient_phone")
    .gte("id", from)
    .lte("id", to)
    .limit(5);
  if (error) {
    console.error("[order-lookup] query failed", error);
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }

  const rows = (data as { id: string; customer_phone: string; recipient_phone: string | null }[] | null) ?? [];
  const match = rows.find(
    (o) => phonesMatch(o.customer_phone, phone) || (o.recipient_phone !== null && phonesMatch(o.recipient_phone, phone)),
  );
  if (!match) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ id: match.id });
}
