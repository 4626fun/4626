-- Declare explicit "no public REST access" intent for the 12 public tables
-- that have RLS enabled without policies. Satisfies the Supabase linter
-- (`rls_enabled_no_policy`, lint 0008) and documents that these tables
-- are server-only.
--
-- Pattern: `FOR ALL ... USING (false)` as RESTRICTIVE policy to `public`.
-- Restrictive policies intersect with any permissive policies (there are
-- none here), so the net effect is hard-deny for `anon` and `authenticated`.
-- Server connections come in as `postgres` (superuser) via the pooler
-- and bypass RLS entirely — unaffected.
--
-- `IF NOT EXISTS` on `CREATE POLICY` was added in PG 15+; guard with an
-- explicit drop so this migration is idempotent across versions.

begin;

do $$
declare
  t text;
  tables constant text[] := array[
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
begin
  foreach t in array tables loop
    execute format('drop policy if exists "deny_public_rest" on public.%I;', t);
    execute format(
      'create policy "deny_public_rest" on public.%I as restrictive for all to public using (false) with check (false);',
      t
    );
  end loop;
end
$$;

-- Cosmetic: remove the stale profile_wallets row for profile #728 (which
-- was tombstoned during the 728 → 1 merge). The wallet is already linked
-- to the canonical profile via the alias; leaving the duplicate on the
-- tombstoned side just pollutes future audits like `diagnose-splits.ts`.
delete from public.profile_wallets
where profile_id = 728
  and lower(address) = lower('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD');

commit;
