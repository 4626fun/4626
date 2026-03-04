-- Phase 4 conservative unused-index pruning.
-- Scope: indexes not aligned with current WHERE/ORDER patterns.

DROP INDEX IF EXISTS public.allowlist_revoked_at_idx;
DROP INDEX IF EXISTS public.allowlist_csw_idx;
DROP INDEX IF EXISTS public.access_requests_wallet_idx;
DROP INDEX IF EXISTS public.creator_wallets_wallet_idx;
DROP INDEX IF EXISTS public.creator_wallets_coin_idx;
DROP INDEX IF EXISTS public.creator_agent_wallets_address_idx;
DROP INDEX IF EXISTS public.wallets_type_idx;

-- Rollback (if needed):
-- CREATE INDEX IF NOT EXISTS allowlist_revoked_at_idx
--   ON public.allowlist (revoked_at);
-- CREATE INDEX IF NOT EXISTS allowlist_csw_idx
--   ON public.allowlist (csw_address) WHERE csw_address IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS access_requests_wallet_idx
--   ON public.access_requests (wallet_address);
-- CREATE INDEX IF NOT EXISTS creator_wallets_wallet_idx
--   ON public.creator_wallets (wallet_address);
-- CREATE INDEX IF NOT EXISTS creator_wallets_coin_idx
--   ON public.creator_wallets (coin_address);
-- CREATE INDEX IF NOT EXISTS creator_agent_wallets_address_idx
--   ON public.creator_agent_wallets (agent_wallet_address);
-- CREATE INDEX IF NOT EXISTS wallets_type_idx
--   ON public.wallets (wallet_type);
