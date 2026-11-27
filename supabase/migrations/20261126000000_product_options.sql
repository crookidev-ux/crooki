-- Product options («Caja x2», «Sin empaque»…) with a minimum quantity and an
-- optional bulk price step (docs/superpowers/specs/2026-11-26-opciones-y-precios-por-volumen.md).
--
-- When a product has options the checkout (src/lib/checkout/price-cart.ts)
-- charges ONLY from this table: option price, min_qty and bulk step, never
-- products.price or sale_price. products.price is kept as the cheapest option
-- ("Desde") for display, JSON-LD and the «price 0 = Consultar» rule.
--
-- Run this BEFORE deploying the code; load the data
-- (supabase/data/20261126_navidad_opciones_datos.sql) only AFTER the deploy.

CREATE TABLE IF NOT EXISTS public.product_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label_es      text NOT NULL CHECK (length(btrim(label_es)) BETWEEN 1 AND 120),
  label_en      text NOT NULL DEFAULT '' CHECK (length(label_en) <= 120),
  price         integer NOT NULL CHECK (price > 0),
  min_qty       integer NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  bulk_min_qty  integer NULL,
  bulk_price    integer NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- The bulk step is all or nothing, starts above the minimum and lowers the price.
  CONSTRAINT product_options_bulk_check CHECK (
    (bulk_min_qty IS NULL AND bulk_price IS NULL)
    OR (bulk_min_qty > min_qty AND bulk_price > 0 AND bulk_price < price)
  )
);

CREATE INDEX IF NOT EXISTS idx_product_options_product
  ON public.product_options(product_id, display_order);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_options public read" ON public.product_options;
CREATE POLICY "product_options public read" ON public.product_options
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_options admin write" ON public.product_options;
CREATE POLICY "product_options admin write" ON public.product_options
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Wholesale note shown under the option picker (the UI adds the WhatsApp button).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS note_es text NULL CHECK (note_es IS NULL OR length(note_es) <= 300),
  ADD COLUMN IF NOT EXISTS note_en text NULL CHECK (note_en IS NULL OR length(note_en) <= 300);

-- Check (run separately):
--   select policyname, cmd, roles from pg_policies where tablename = 'product_options';
--   -- as anon, an insert into product_options must fail (RLS).
--
-- Rollback:
--   DROP TABLE IF EXISTS public.product_options;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS note_es, DROP COLUMN IF EXISTS note_en;
