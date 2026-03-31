-- Phase 10: security hardening for internal public tables exposed to PostgREST.
-- Enable RLS and set explicit deny-all policies by default.

DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
  internal_tables TEXT[] := ARRAY[
    'image_generation_assets',
    'image_generation_projects',
    'lottery_amoe_nonces',
    'lottery_amoe_entries',
    'image_generation_attempts',
    'lottery_amoe_daily_twitter_checkins',
    'image_generation_jobs',
    'miniapp_notifications',
    'telegram_holder_room_policies',
    'keepr_vault_automation',
    'telegram_action_tokens',
    'telegram_user_links',
    'telegram_action_audit',
    'telegram_chat_vault_scope',
    'telegram_holder_room_members',
    'telegram_trade_percent_prompts',
    'telegram_funnel_events',
    'telegram_miniapp_replay_nonces',
    'telegram_miniapp_sessions',
    'telegram_arena_watchers',
    'creator_metrics_daily_snapshots',
    'telegram_onboarding_sessions',
    'telegram_private_dm_welcome_sent',
    'telegram_link_start_token_claims',
    'telegram_inline_signal_feeds',
    'telegram_active_messages',
    'agent_subdomains'
  ];
BEGIN
  FOREACH table_name IN ARRAY internal_tables
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', table_name);

    IF EXISTS (
      SELECT 1
      FROM pg_class c
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = table_name
        AND c.relkind = 'r'
    ) THEN
      policy_name := table_name || '_deny_all';

      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = table_name
          AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO public USING (false) WITH CHECK (false)',
          policy_name,
          table_name
        );
      END IF;
    END IF;
  END LOOP;
END
$$;
