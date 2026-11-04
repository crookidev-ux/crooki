-- Retire the legacy public checkout RPC `create_public_order`.
--
-- Why: it was created in 20260517100000_create_public_order_rpc.sql as a
-- SECURITY DEFINER function executable by `anon`. It trusts the `p_total`
-- and `unit_price` values sent by the browser, so anyone with the public
-- anon key could insert orders with arbitrary prices straight into the
-- real `orders` table, bypassing RLS and the server-side price checks.
-- Checkout moved to `create_order_v2` (20261021000000_bold_payments.sql),
-- which only the service role can execute. Nothing in `src/` calls the old
-- function anymore (verified with grep on 2026-11-04).
--
-- The REVOKE runs first so the permission is gone even if the DROP were to
-- fail for an unexpected dependency.

REVOKE ALL ON FUNCTION public.create_public_order(text, text, text, text, text, numeric, jsonb)
  FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.create_public_order(text, text, text, text, text, numeric, jsonb);
