ALTER TABLE IF EXISTS public.agent_registration_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_message_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.creator_meteora_alpha_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_intelligence_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entity_labels_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feedback_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.creator_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farcaster_rollout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_agent_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.csw_owner_link_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.keepr_workflow_checkpoints ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS public.creator_access_requests_wallet_idx;
DROP INDEX IF EXISTS public.creator_access_requests_wallet_pending_unique;
DROP INDEX IF EXISTS public.creator_allowlist_revoked_at_idx;
DROP INDEX IF EXISTS public.deploy_sessions_session_address_idx;;
