-- Site-wide settings, one row. For now it only holds the seasonal home
-- decoration the admin switched on (NULL = none). A single row guarantees
-- that only one season can be active at a time.

CREATE TABLE IF NOT EXISTS public.site_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_season TEXT CHECK (active_season IN (
    'san-valentin', 'carnaval', 'semana-santa', 'amor-amistad',
    'halloween', 'noviembre', 'navidad'
  )),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id, active_season)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- The home page reads it for every visitor.
DROP POLICY IF EXISTS "Site settings public read" ON public.site_settings;
CREATE POLICY "Site settings public read" ON public.site_settings
  FOR SELECT USING (true);

-- Same rule as products and categories: the admin is any signed-in user.
DROP POLICY IF EXISTS "Site settings authenticated update" ON public.site_settings;
CREATE POLICY "Site settings authenticated update" ON public.site_settings
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- No insert/delete for clients: the single row is seeded above.
REVOKE INSERT, DELETE, TRUNCATE ON public.site_settings FROM anon, authenticated;
