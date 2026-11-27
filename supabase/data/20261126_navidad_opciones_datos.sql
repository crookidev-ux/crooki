-- DATA (not a migration): options, names, EN texts and wholesale notes of the
-- 5 Christmas products. Run in the Supabase SQL Editor ONLY AFTER:
--   1. migrations/20261126000000_product_options.sql was applied, and
--   2. the code that reads product_options is live in production.
-- Running it earlier would let the old site sell these products at the
-- cheapest option price with no minimum. Safe to re-run (it replaces options).

BEGIN;

DELETE FROM public.product_options
WHERE product_id IN (SELECT id FROM public.products
  WHERE slug IN ('chocobomba','cinnamon-roll','mini-cookies-rellenas','chocobombas','christmas-brownie'));

INSERT INTO public.product_options
  (product_id, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price, display_order)
SELECT p.id, v.label_es, v.label_en, v.price, v.min_qty, v.bulk_min_qty, v.bulk_price, v.ord
FROM (VALUES
  ('chocobomba', 'Rellena decorada con empaque e instrucciones', 'Filled and decorated, with packaging and instructions', 10000, 12, NULL::int, NULL::int, 0),
  ('chocobomba', 'Sin empaque ni instrucciones', 'No packaging or instructions', 8700, 12, NULL, NULL, 1),
  ('cinnamon-roll', 'Caja x1', 'Box of 1', 15000, 1, NULL, NULL, 0),
  ('cinnamon-roll', 'Caja x2', 'Box of 2', 28000, 1, NULL, NULL, 1),
  ('mini-cookies-rellenas', 'Caja x15 variadas', 'Box of 15, assorted', 45000, 1, NULL, NULL, 0),
  ('mini-cookies-rellenas', 'Caja x20 variadas', 'Box of 20, assorted', 59900, 1, NULL, NULL, 1),
  ('chocobombas', 'Caja x2', 'Box of 2', 23000, 1, NULL, NULL, 0),
  ('chocobombas', 'Caja x4', 'Box of 4', 42000, 1, NULL, NULL, 1),
  ('chocobombas', 'Caja x6', 'Box of 6', 62500, 1, NULL, NULL, 2),
  ('chocobombas', 'Caja x8', 'Box of 8', 81900, 1, NULL, NULL, 3),
  ('christmas-brownie', 'Unidad', 'Each', 10000, 1, 12, 8900, 0)
) AS v(slug, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price, ord)
JOIN public.products p ON p.slug = v.slug;

-- products.price = cheapest option ("Desde"); the checkout never charges it.
-- Sale prices are cleared: offers do not apply to products with options.
UPDATE public.products p
SET price = o.min_price, sale_price = NULL, sale_ends_at = NULL
FROM (SELECT product_id, min(price) AS min_price FROM public.product_options GROUP BY product_id) o
WHERE o.product_id = p.id
  AND p.slug IN ('chocobomba','cinnamon-roll','mini-cookies-rellenas','chocobombas','christmas-brownie');

-- Names (slugs stay the same) and EN texts.
UPDATE public.products SET name_es = 'Chocobomba (pedido desde 12)',
  name_en = 'Hot chocolate bomb (orders from 12)'
  WHERE slug = 'chocobomba';
UPDATE public.products SET name_es = 'Caja de chocobombas',
  name_en = 'Hot chocolate bomb box',
  description_en = E'The best hot chocolate\nDecorated chocolate bombs\nfilled with marshmallows and cocoa\nInstructions for use\nTo/from card',
  note_es = 'Descuento a partir de 12 cajas, escríbenos',
  note_en = 'Discount from 12 boxes, message us'
  WHERE slug = 'chocobombas';
UPDATE public.products SET name_es = btrim(name_es),
  name_en = 'Cinnamon roll',
  description_en = E'Christmas box with a cinnamon roll,\ncream cheese frosting and sprinkles'
  WHERE slug = 'cinnamon-roll';
-- «red Nutella» translated as red velvet Nutella: confirm with the shop.
UPDATE public.products SET name_es = btrim(name_es),
  name_en = 'Filled mini cookies',
  description_en = E'Christmas box of filled mini cookies\n(Klim brigadeiro, Kinder, chocolate chip,\ncaramel, Milo and red velvet Nutella)',
  note_es = 'Descuento a partir de 12 cajas, escríbenos',
  note_en = 'Discount from 12 boxes, message us'
  WHERE slug = 'mini-cookies-rellenas';
UPDATE public.products SET name_es = btrim(name_es),
  name_en = 'Christmas brownie',
  description_en = E'Milo brownie decorated with chocolate\nand sprinkles, with a card and ribbon'
  WHERE slug = 'christmas-brownie';

-- Check: 5 rows with price > 0; options chocobomba 2, chocobombas 4,
-- christmas-brownie 1, cinnamon-roll 2, mini-cookies-rellenas 2.
SELECT p.slug, p.name_es, p.price, count(o.*) AS opciones
FROM public.products p LEFT JOIN public.product_options o ON o.product_id = p.id
WHERE p.slug IN ('chocobomba','cinnamon-roll','mini-cookies-rellenas','chocobombas','christmas-brownie')
GROUP BY p.slug, p.name_es, p.price ORDER BY p.slug;

COMMIT;
