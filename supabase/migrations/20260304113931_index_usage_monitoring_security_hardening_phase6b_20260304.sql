-- Phase 6b: security hardening for index usage monitoring objects.
-- - Enable RLS + default deny policy on index_usage_snapshots
-- - Set explicit function search_path for linter compliance

ALTER TABLE public.index_usage_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'index_usage_snapshots'
      AND policyname = 'index_usage_snapshots_deny_all'
  ) THEN
    CREATE POLICY index_usage_snapshots_deny_all
      ON public.index_usage_snapshots
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

ALTER FUNCTION public.capture_index_usage_snapshot()
SET search_path = pg_catalog, public;

ALTER FUNCTION public.index_drop_candidates(INTEGER, INTEGER, BIGINT)
SET search_path = pg_catalog, public;

ALTER FUNCTION public.index_drop_migration_draft(INTEGER, INTEGER, BIGINT)
SET search_path = pg_catalog, public;;
