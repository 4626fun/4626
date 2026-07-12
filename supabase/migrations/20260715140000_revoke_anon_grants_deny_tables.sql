-- Defense-in-depth: revoke leftover table privileges from PostgREST roles on
-- server-only tables that already have restrictive deny policies.
-- Preserve public INSERT on marketing attribution tables.

BEGIN;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = c.relname
          AND (
            p.policyname IN ('deny_public_rest', 'No public access')
            OR (
              p.cmd = 'ALL'
              AND p.permissive = 'RESTRICTIVE'
              AND p.qual = 'false'
            )
          )
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
      table_name
    );
  END LOOP;
END
$$;

-- Marketing attribution: INSERT only for anon/authenticated (RLS WITH CHECK remains).
GRANT INSERT ON TABLE public.website_events TO anon, authenticated;
GRANT INSERT ON TABLE public.waitlist_leads TO anon, authenticated;

REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.website_events
  FROM anon, authenticated;

REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.waitlist_leads
  FROM anon, authenticated;

COMMIT;
