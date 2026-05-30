-- Phase 3 conservative unused-index pruning.
-- Scope: indexes with no current filter/order query usage in runtime paths.

DROP INDEX IF EXISTS public.keepr_vaults_owner_idx;
DROP INDEX IF EXISTS public.keepr_vaults_lens_group_idx;
DROP INDEX IF EXISTS public.keepr_actions_group_idx;
DROP INDEX IF EXISTS public.keepr_audit_vault_idx;
DROP INDEX IF EXISTS public.keepr_join_requests_status_idx;
DROP INDEX IF EXISTS public.agent_subdomains_owner_idx;
DROP INDEX IF EXISTS public.agent_subdomains_lens_owner_idx;
DROP INDEX IF EXISTS public.agent_subdomains_updated_idx;
DROP INDEX IF EXISTS public.creator_coins_last_seen_idx;
DROP INDEX IF EXISTS public.creators_first_seen_idx;

-- Rollback (if needed):
-- CREATE INDEX IF NOT EXISTS keepr_vaults_owner_idx
--   ON public.keepr_vaults (canonical_owner_address);
-- CREATE INDEX IF NOT EXISTS keepr_vaults_lens_group_idx
--   ON public.keepr_vaults (lens_group_address);
-- CREATE INDEX IF NOT EXISTS keepr_actions_group_idx
--   ON public.keepr_actions (group_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS keepr_audit_vault_idx
--   ON public.keepr_logs (vault_address, created_at DESC);
-- CREATE INDEX IF NOT EXISTS keepr_join_requests_status_idx
--   ON public.keepr_join_requests (status, next_check_at, updated_at DESC);
-- CREATE INDEX IF NOT EXISTS agent_subdomains_owner_idx
--   ON public.agent_subdomains (owner_address);
-- CREATE INDEX IF NOT EXISTS agent_subdomains_lens_owner_idx
--   ON public.agent_subdomains (lens_owner_address);
-- CREATE INDEX IF NOT EXISTS agent_subdomains_updated_idx
--   ON public.agent_subdomains (updated_at DESC);
-- CREATE INDEX IF NOT EXISTS creator_coins_last_seen_idx
--   ON public.creator_coins (last_seen_at DESC);
-- CREATE INDEX IF NOT EXISTS creators_first_seen_idx
--   ON public.creators (first_seen_at DESC);
