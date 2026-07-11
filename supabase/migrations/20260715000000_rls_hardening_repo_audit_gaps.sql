-- Close canonical-migration RLS gaps for server-only public tables.
-- This forward migration supersedes the policy intent of legacy migrations
-- 023/037 without FORCE ROW LEVEL SECURITY, which would block postgres-pooler
-- writes used by server handlers.

BEGIN;

DO $$
DECLARE
  table_name TEXT;
  server_only_tables TEXT[] := ARRAY[
    'profiles',
    'telegram_user_links',
    'telegram_action_tokens',
    'telegram_action_audit',
    'telegram_funnel_events',
    'telegram_miniapp_replay_nonces',
    'telegram_miniapp_sessions',
    'telegram_link_start_token_claims',
    'telegram_chat_vault_scope',
    'telegram_holder_room_policies',
    'telegram_holder_room_members',
    'telegram_trade_percent_prompts',
    'telegram_inline_signal_feeds',
    'telegram_active_messages',
    'telegram_onboarding_sessions',
    'telegram_private_dm_welcome_sent',
    'auth_handoffs',
    'lottery_amoe_nonces',
    'lottery_amoe_entries',
    'lottery_amoe_daily_twitter_checkins',
    'amoe_burn_credits_intents',
    'amoe_points_burn_ledger',
    'amoe_points_burn_ledger_snapshots',
    'amoe_publisher_runs',
    'amoe_wallet_allowlist_snapshots',
    'allowlist',
    'access_requests',
    'creator_allowlist',
    'creator_access_requests',
    'image_generation_projects',
    'image_generation_assets',
    'image_generation_attempts',
    'image_generation_jobs',
    'agent_access_nonces',
    'agent_room_access_tokens',
    'zora_csw_gate_telegram_tokens',
    'zora_csw_gate_entry_challenges',
    'keepr_vault_automation',
    'keepr_send_daily_ledger',
    'solana_sweep_jobs',
    'admin_logs',
    'chat_friend_requests',
    'creator_strategy_catalog_notes'
  ];
BEGIN
  FOREACH table_name IN ARRAY server_only_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = 'deny_public_rest'
    ) THEN
      EXECUTE format(
        'CREATE POLICY deny_public_rest ON public.%I AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false)',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

COMMENT ON TABLE public.profiles IS
  'Canonical 4626 identity and wallet profile. Server-only; PostgREST access is denied by restrictive RLS.';

COMMENT ON TABLE public.auth_handoffs IS
  'Single-use auth-context handoffs. Server-only; PostgREST access is denied by restrictive RLS.';

COMMIT;
