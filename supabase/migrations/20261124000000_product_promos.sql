-- Promotions per product (Black Friday, Navidad...), edited in the admin form.
--   sale_price   = price charged while the sale is active; `price` stays the
--                  normal price and is shown struck through
--   sale_ends_at = optional end; after it everything returns to `price`
--   promo_tag    = ribbon on the photo; the six values are fixed in code
--                  (src/lib/promo.ts). black_friday/oferta only show while the
--                  sale is active.
-- The checkout (src/lib/checkout/*) decides the charged price on the server.
-- The existing products policies (public read, admin write) cover the new
-- columns; no policy change is needed.
-- Run this BEFORE deploying the code that writes the columns (admin form).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_tag TEXT
    CHECK (promo_tag IS NULL OR promo_tag IN (
      'black_friday', 'oferta', 'navidad', 'nuevo', 'mas_vendido', 'edicion_limitada'
    ));

-- The admin writes straight to the table, so the database enforces the rule
-- the form checks: a sale price is whole pesos, at least 1 and below the normal price.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sale_price_check;
ALTER TABLE products ADD CONSTRAINT products_sale_price_check
  CHECK (sale_price IS NULL OR (sale_price >= 1 AND sale_price = round(sale_price) AND sale_price < price));

-- Rollback:
-- ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sale_price_check;
-- ALTER TABLE products DROP COLUMN IF EXISTS promo_tag,
--   DROP COLUMN IF EXISTS sale_ends_at, DROP COLUMN IF EXISTS sale_price;
