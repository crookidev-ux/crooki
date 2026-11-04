-- Delivery rule per category, editable in /admin/categorias:
--   any    = delivered to every zone the fee table covers
--   nearby = delivered only within NEARBY_MAX_KM (src/lib/delivery-zones.ts)
--   none   = never delivered: pick-up or dine-in only
-- Run this BEFORE deploying the code that reads the column.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS delivery_rule TEXT NOT NULL DEFAULT 'any'
  CHECK (delivery_rule IN ('any', 'nearby', 'none'));

UPDATE categories SET delivery_rule = 'nearby'
  WHERE slug IN ('helados', 'combos', 'malteadas');

UPDATE categories SET delivery_rule = 'none'
  WHERE slug IN ('bebidas-frias', 'bebidas-calientes');
