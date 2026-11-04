-- Admin allowlist: only the accounts in `admin_users` can manage the shop.
--
-- Until now every write policy (and reading orders) checked
-- `auth.role() = 'authenticated'`, so ANY account in auth.users was a full
-- admin. Sign-up is closed, but one stray or reopened account would see every
-- order with customer data and could change prices.
--
-- This migration:
--   1. creates `admin_users` and `is_admin()`;
--   2. seeds it with the accounts that exist today (the three approved by the
--      owner on 2026-11-04);
--   3. rewrites every policy in `public` and `storage` that grants access to
--      "any authenticated user" so it requires `is_admin()` instead. It works
--      on whatever policies exist in the database (some were created in the
--      dashboard), not only on the ones in these migration files.
--
-- To add an admin later:
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = 'nueva@persona.com';

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Seed: the three accounts that exist today, all approved as admins.
INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Swap "any authenticated user" for "an admin" in every policy that uses it.
DO $$
DECLARE
  p record;
  new_qual  text;
  new_check text;
  stmt      text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (qual ILIKE '%auth.role() = ''authenticated''%'
           OR with_check ILIKE '%auth.role() = ''authenticated''%')
  LOOP
    new_qual  := regexp_replace(p.qual,
                   'auth\.role\(\) = ''authenticated''(::text)?', 'public.is_admin()', 'g');
    new_check := regexp_replace(p.with_check,
                   'auth\.role\(\) = ''authenticated''(::text)?', 'public.is_admin()', 'g');

    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    RAISE NOTICE 'admin-only: %.% / %', p.schemaname, p.tablename, p.policyname;
    EXECUTE stmt;
  END LOOP;
END
$$;

-- Check afterwards: this should return no rows.
--   select schemaname, tablename, policyname from pg_policies
--   where schemaname in ('public','storage')
--     and (qual ilike '%authenticated%' or with_check ilike '%authenticated%');
