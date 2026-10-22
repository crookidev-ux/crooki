-- Online payments (Bold) + fulfillment data.
--
-- Purely additive: new columns with defaults, one new table and one new RPC.
-- Nothing existing is dropped or altered, and `create_public_order` is left
-- untouched, so this migration can be applied BEFORE the new code ships
-- without breaking today's checkout. Old orders become fulfillment='delivery',
-- payment_method='qr', payment_status='unpaid' through the column defaults.
--
-- `customer_address` stays TEXT NOT NULL (see 20260331000000_initial.sql);
-- non-delivery orders store an empty string there.
--
-- Payment writes are done only by the server with the service role. Supabase
-- default privileges grant EXECUTE/ALL to anon and authenticated on new
-- objects, so both the function and the table explicitly REVOKE from them.

-- ── 1. New columns on orders ──────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment text NOT NULL DEFAULT 'delivery'
    CHECK (fulfillment IN ('delivery', 'pickup', 'dine_in')),
  ADD COLUMN IF NOT EXISTS delivery_zone text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'qr'
    CHECK (payment_method IN ('bold', 'qr')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'awaiting_payment', 'paid', 'rejected')),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- ── 2. payment_attempts ───────────────────────────────────────────────────
-- One row per Bold checkout opened (first try or "try again"), so a late
-- approval of an old attempt still marks the order as paid.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  bold_order_id   text NOT NULL UNIQUE,
  amount          integer NOT NULL,
  status          text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'approved', 'rejected')),
  bold_payment_id text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id ON payment_attempts(order_id);

-- RLS on with NO policies: anon/authenticated get nothing; the service role
-- bypasses RLS.
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

-- Defense in depth: drop the default grants Supabase gives anon/authenticated.
REVOKE ALL ON TABLE public.payment_attempts FROM anon, authenticated;

-- ── 3. create_order_v2 ────────────────────────────────────────────────────
-- Server-only order creation (service role). Atomic: order row + items in a
-- single transaction.
--
-- `p_order` keys: customer_name, customer_email, customer_phone,
--   customer_address, notes, total, fulfillment, delivery_zone, delivery_fee,
--   recipient_phone, payment_method, payment_status
-- `p_items` shape: same as create_public_order
--   [ { "product_id": "uuid"|null, "product_name": "text",
--       "quantity": int, "unit_price": numeric }, ... ]
--
-- Invalid fulfillment / payment_method values are rejected by the table CHECKs.
-- payment_status may only be 'unpaid' or 'awaiting_payment' here; 'paid' and
-- 'rejected' are set exclusively by the webhook / confirmation code.

CREATE OR REPLACE FUNCTION public.create_order_v2(
  p_order jsonb,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_order_id uuid;
  item_count   int;
  v_total      numeric;
  v_fee        numeric;
BEGIN
  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'order must be a JSON object';
  END IF;

  IF length(btrim(coalesce(p_order->>'customer_name', '')))  = 0 THEN RAISE EXCEPTION 'customer_name required'; END IF;
  IF length(btrim(coalesce(p_order->>'customer_email', ''))) = 0 THEN RAISE EXCEPTION 'customer_email required'; END IF;
  IF length(btrim(coalesce(p_order->>'customer_phone', ''))) = 0 THEN RAISE EXCEPTION 'customer_phone required'; END IF;

  v_total := (p_order->>'total')::numeric;
  IF v_total IS NULL OR v_total < 0 THEN RAISE EXCEPTION 'invalid total'; END IF;

  v_fee := coalesce((p_order->>'delivery_fee')::numeric, 0);
  IF v_fee < 0 THEN RAISE EXCEPTION 'invalid delivery_fee'; END IF;

  IF coalesce(nullif(p_order->>'payment_status', ''), 'unpaid') NOT IN ('unpaid', 'awaiting_payment') THEN
    RAISE EXCEPTION 'invalid payment_status';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array';
  END IF;

  item_count := jsonb_array_length(p_items);
  IF item_count = 0 THEN RAISE EXCEPTION 'items cannot be empty'; END IF;
  IF item_count > 100 THEN RAISE EXCEPTION 'items list too long (max 100)'; END IF;

  INSERT INTO orders (
    customer_name, customer_email, customer_phone, customer_address,
    notes, total, status,
    fulfillment, delivery_zone, delivery_fee, recipient_phone,
    payment_method, payment_status
  )
  VALUES (
    p_order->>'customer_name',
    p_order->>'customer_email',
    p_order->>'customer_phone',
    coalesce(p_order->>'customer_address', ''),
    coalesce(p_order->>'notes', ''),
    v_total,
    'pending',
    coalesce(nullif(p_order->>'fulfillment', ''), 'delivery'),
    nullif(p_order->>'delivery_zone', ''),
    v_fee,
    nullif(p_order->>'recipient_phone', ''),
    coalesce(nullif(p_order->>'payment_method', ''), 'qr'),
    coalesce(nullif(p_order->>'payment_status', ''), 'unpaid')
  )
  RETURNING id INTO new_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price, product_name)
  SELECT
    new_order_id,
    NULLIF(item->>'product_id', '')::uuid,
    GREATEST(1, COALESCE((item->>'quantity')::int, 1)),
    GREATEST(0, COALESCE((item->>'unit_price')::numeric, 0)),
    LEFT(COALESCE(item->>'product_name', ''), 500)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN new_order_id;
END;
$$;

-- Server only: never callable by anon / authenticated. Supabase's default
-- privileges grant them EXECUTE directly, so revoke from them by name too.
REVOKE ALL ON FUNCTION public.create_order_v2(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_v2(jsonb, jsonb) TO service_role;

COMMENT ON FUNCTION public.create_order_v2(jsonb, jsonb) IS
  'Server-side checkout entry point (service role only). Inserts a pending order with fulfillment/payment fields plus its items atomically.';
