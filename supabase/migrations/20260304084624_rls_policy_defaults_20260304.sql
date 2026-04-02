DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_registration_state'
      AND policyname = 'agent_registration_state_deny_all'
  ) THEN
    CREATE POLICY agent_registration_state_deny_all
      ON public.agent_registration_state
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_message_memory'
      AND policyname = 'agent_message_memory_deny_all'
  ) THEN
    CREATE POLICY agent_message_memory_deny_all
      ON public.agent_message_memory
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_meteora_alpha_vaults'
      AND policyname = 'creator_meteora_alpha_vaults_deny_all'
  ) THEN
    CREATE POLICY creator_meteora_alpha_vaults_deny_all
      ON public.creator_meteora_alpha_vaults
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_intelligence_cache'
      AND policyname = 'wallet_intelligence_cache_deny_all'
  ) THEN
    CREATE POLICY wallet_intelligence_cache_deny_all
      ON public.wallet_intelligence_cache
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_labels_cache'
      AND policyname = 'entity_labels_cache_deny_all'
  ) THEN
    CREATE POLICY entity_labels_cache_deny_all
      ON public.entity_labels_cache
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_index'
      AND policyname = 'feedback_index_deny_all'
  ) THEN
    CREATE POLICY feedback_index_deny_all
      ON public.feedback_index
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_wallets'
      AND policyname = 'creator_wallets_deny_all'
  ) THEN
    CREATE POLICY creator_wallets_deny_all
      ON public.creator_wallets
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'farcaster_rollout_events'
      AND policyname = 'farcaster_rollout_events_deny_all'
  ) THEN
    CREATE POLICY farcaster_rollout_events_deny_all
      ON public.farcaster_rollout_events
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_agent_nonces'
      AND policyname = 'auth_agent_nonces_deny_all'
  ) THEN
    CREATE POLICY auth_agent_nonces_deny_all
      ON public.auth_agent_nonces
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'csw_owner_link_status'
      AND policyname = 'csw_owner_link_status_deny_all'
  ) THEN
    CREATE POLICY csw_owner_link_status_deny_all
      ON public.csw_owner_link_status
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'keepr_workflow_checkpoints'
      AND policyname = 'keepr_workflow_checkpoints_deny_all'
  ) THEN
    CREATE POLICY keepr_workflow_checkpoints_deny_all
      ON public.keepr_workflow_checkpoints
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;;
