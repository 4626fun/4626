-- Phase 11: tighten runtime lease table RLS defaults.
-- This table is created lazily by the XMTP runtime lock path; hardening is
-- applied defensively when the table exists.

DO $$
BEGIN
  ALTER TABLE IF EXISTS public.agent_runtime_leases ENABLE ROW LEVEL SECURITY;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'agent_runtime_leases'
      AND c.relkind = 'r'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'agent_runtime_leases'
        AND policyname = 'deny_all_non_service'
    ) THEN
      ALTER POLICY deny_all_non_service
        ON public.agent_runtime_leases
        USING (false)
        WITH CHECK (false);
    ELSE
      CREATE POLICY deny_all_non_service
        ON public.agent_runtime_leases
        FOR ALL
        TO public
        USING (false)
        WITH CHECK (false);
    END IF;
  END IF;
END
$$;
