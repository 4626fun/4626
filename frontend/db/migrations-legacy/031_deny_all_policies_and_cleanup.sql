-- Declare explicit "no public REST access" intent for the 12 `public.*`
-- tables that have RLS enabled but no policies. Satisfies Supabase's
-- `rls_enabled_no_policy` info-level linter (lint 0008) and documents
-- that these tables are server-only.
--
-- Pattern: a single restrictive `FOR ALL ... USING (false)` policy to
-- `public` per table. Restrictive policies intersect with any permissive
-- policies (there are none here), so the net effect is hard-deny for
-- `anon` and `authenticated`. Server connections enter as `postgres`
-- (superuser) via the pooler and bypass RLS entirely — unaffected.
--
-- Also includes a small forensic cleanup: removes the stale
-- `profile_wallets` row for profile #728 (tombstoned during the merge
-- session that introduced `privy_user_aliases`). The wallet is already
-- linked to the canonical profile #1 via the alias; the duplicate on the
-- tombstone only pollutes `diagnose-splits.ts` output.
--
-- `DROP POLICY IF EXISTS` before each `CREATE POLICY` makes this
-- idempotent without requiring PG 15's `CREATE POLICY IF NOT EXISTS`.

DO $$
DECLARE
  t TEXT;
  tables CONSTANT TEXT[] := ARRAY[
    'workspace_strategy_targets',
    'workspace_monitoring_snapshots',
    'workspace_alert_events',
    'workspace_approvals',
    'workspace_task_state',
    'workspace_activity_events',
    'workspace_notification_preferences',
    'workspace_audit_logs',
    'agent_control_audit_events',
    'command_issuer_execution_context',
    'command_issuer_daily_spend',
    'privy_user_aliases'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS "deny_public_rest" ON public.%I;', t);
    EXECUTE FORMAT(
      'CREATE POLICY "deny_public_rest" ON public.%I AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false);',
      t
    );
  END LOOP;
END
$$;

-- Cosmetic forensic cleanup.
DELETE FROM public.profile_wallets
WHERE profile_id = 728
  AND LOWER(address) = LOWER('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD');
