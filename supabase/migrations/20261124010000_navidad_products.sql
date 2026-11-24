-- Christmas catalog with a page per product (/navidad and /navidad/[slug]).
-- Spec: docs/superpowers/specs/2026-11-24-navidad-design.md
--
--   1. categories.kind accepts 'navidad' (besides 'menu' and 'merch'), so the
--      Christmas products never mix with the menu or merch pages.
--   2. products.slug: the product page URL. Unique, NULL allowed (menu and
--      merch products don't need one), same format the admin checks
--      (src/lib/slug.ts): lowercase letters, digits and single hyphens, ≤ 80.
--      The unique index also serves the lookup by slug.
--   3. At most 5 photos per product. The admin form stops at 5, but it writes
--      straight to the table, so the database enforces it too.
--
-- The existing RLS policies (public read, admin write) already cover the new
-- column and the trigger; no policy change is needed.
-- Run AFTER 20261124000000_product_promos.sql and BEFORE deploying the code.
-- Checked on 2026-11-24: no product has more than 4 photos today, and the
-- trigger only checks new rows, so nothing existing breaks.

-- 1. Category kind ---------------------------------------------------------
-- The categories table was created outside these migrations, so `kind` may be
-- plain text, text with a CHECK, or an enum. Handle the three cases.
DO $$
DECLARE
  kind_type text;
  kind_is_enum boolean;
  con record;
BEGIN
  SELECT t.typname, t.typtype = 'e' INTO kind_type, kind_is_enum
  FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.categories'::regclass AND a.attname = 'kind';

  IF kind_is_enum THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', kind_type, 'navidad');
  ELSE
    -- Drop any CHECK that mentions kind, then add the widened one.
    FOR con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.categories'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%kind%'
    LOOP
      EXECUTE format('ALTER TABLE public.categories DROP CONSTRAINT %I', con.conname);
    END LOOP;
    ALTER TABLE public.categories ADD CONSTRAINT categories_kind_check
      CHECK (kind IN ('menu', 'merch', 'navidad'));
  END IF;
END $$;

-- 2. Product slug ----------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_slug_format;
ALTER TABLE public.products ADD CONSTRAINT products_slug_format
  CHECK (slug IS NULL OR (char_length(slug) <= 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug);

-- 3. Five photos per product -----------------------------------------------
CREATE OR REPLACE FUNCTION public.product_images_max_five()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Serialize inserts for the same product so two uploads at once can't both
  -- see 4 photos and end at 6.
  PERFORM pg_advisory_xact_lock(hashtext('product_images:' || NEW.product_id::text));
  IF (SELECT count(*) FROM public.product_images
      WHERE product_id = NEW.product_id AND id IS DISTINCT FROM NEW.id) >= 5 THEN
    RAISE EXCEPTION 'Un producto puede tener máximo 5 fotos'
      USING ERRCODE = 'check_violation', HINT = 'max_product_images';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS product_images_max_five ON public.product_images;
CREATE TRIGGER product_images_max_five
  BEFORE INSERT OR UPDATE OF product_id ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.product_images_max_five();

-- Rollback (only once no category uses kind 'navidad' and the code that reads
-- products.slug is gone):
-- DROP TRIGGER IF EXISTS product_images_max_five ON public.product_images;
-- DROP FUNCTION IF EXISTS public.product_images_max_five();
-- DROP INDEX IF EXISTS public.products_slug_key;
-- ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_slug_format;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS slug;
-- ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_kind_check;
-- (An enum value cannot be removed; if kind is an enum, 'navidad' stays unused.)
