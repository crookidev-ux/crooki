-- Orders placed while the shop is closed (9 p.m. – 11 a.m., Cartagena) are
-- scheduled for the next opening. The checkout route computes the instant on
-- the server; NULL means "prepare as soon as possible" (shop open).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

COMMENT ON COLUMN public.orders.scheduled_for IS
  'Next opening (11 a.m. Cartagena) for orders placed while the shop was closed; NULL when placed during opening hours.';

-- create_order_v2: same as 20261021000000_bold_payments.sql plus `scheduled_for`.
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
    payment_method, payment_status, scheduled_for
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
    coalesce(nullif(p_order->>'payment_status', ''), 'unpaid'),
    nullif(p_order->>'scheduled_for', '')::timestamptz
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
