-- Document service-role-only access model for RLS-enabled tables with no permissive policies.
--
-- Context (audit finding I-10, Linear 4626-392):
-- Several core tables have `ENABLE ROW LEVEL SECURITY` set but intentionally
-- expose NO permissive `CREATE POLICY` rules. This is a deliberate
-- "service-role only" access pattern: with RLS enabled and no permissive
-- policy, the default PostgreSQL behaviour is that anon / authenticated
-- roles cannot read or write the table at all. Only a connection that
-- bypasses RLS (Supabase service-role key, or a direct superuser
-- connection) can touch these rows.
--
-- Why this pattern is used:
--   * All reads/writes to these tables are proxied through server-side
--     Vercel API routes (frontend/api/**) that hold the service-role key
--     via `SUPABASE_SERVICE_ROLE_KEY`. The client never connects with a
--     role that could evaluate RLS for these tables.
--   * Adding permissive user-facing policies to these tables would be a
--     security regression: user-side contexts should never be given
--     direct select/insert access.
--
-- DO NOT add `CREATE POLICY ... USING (true)` or similar permissive
-- policies on these tables without an explicit security review. If a
-- user-scoped access path is required, design it via the server API
-- layer with service-role credentials instead.

COMMENT ON TABLE IF EXISTS public.profiles IS
  'RLS enabled; no permissive policies. Service-role only (see migration 20260422231500). Proxy all reads/writes via server-side API routes.';

-- The following tables follow the same pattern. COMMENT ON is idempotent
-- and safe to re-run. If a table does not exist in this environment,
-- Postgres raises a notice; we wrap each in DO $$ ... EXCEPTION WHEN
-- undefined_table $$ to keep the migration non-fatal across envs.

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.agent_registration_state IS ''RLS enabled, service-role only. See migration 20260422231500.''';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.agent_message_memory IS ''RLS enabled, service-role only. See migration 20260422231500.''';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.creator_wallets IS ''RLS enabled, service-role only. See migration 20260422231500.''';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.wallet_intelligence_cache IS ''RLS enabled, service-role only. See migration 20260422231500.''';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.entity_labels_cache IS ''RLS enabled, service-role only. See migration 20260422231500.''';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.auth_agent_nonces IS ''RLS enabled, service-role only. See migration 20260422231500.''';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.keepr_workflow_checkpoints IS ''RLS enabled, service-role only. See migration 20260422231500.''';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
