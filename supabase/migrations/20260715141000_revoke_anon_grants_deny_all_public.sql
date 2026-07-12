-- Expand grant revoke to server-only tables using deny_all_public / deny-all quals.
-- Prior pass only matched exact policy names deny_public_rest / No public access.

BEGIN;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT DISTINCT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = c.relname
          AND p.cmd = 'ALL'
          AND p.qual = 'false'
          AND COALESCE(p.with_check, 'false') = 'false'
      )
      -- Do not touch tables that also expose intentional allow policies.
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies p2
        WHERE p2.schemaname = 'public'
          AND p2.tablename = c.relname
          AND p2.qual IS DISTINCT FROM 'false'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
      table_name
    );
  END LOOP;
END
$$;

-- Keep marketing INSERT surface.
GRANT INSERT ON TABLE public.website_events TO anon, authenticated;
GRANT INSERT ON TABLE public.waitlist_leads TO anon, authenticated;

COMMIT;
