-- Pre-launch optional index trim:
-- keep high-value access-path indexes restored, but drop low-signal helpers.

DROP INDEX IF EXISTS public.creator_coins_last_seen_idx;
DROP INDEX IF EXISTS public.creators_first_seen_idx;
DROP INDEX IF EXISTS public.wallets_type_idx;

-- Rollback (if needed):
-- CREATE INDEX IF NOT EXISTS creator_coins_last_seen_idx
--   ON public.creator_coins (last_seen_at DESC);
-- CREATE INDEX IF NOT EXISTS creators_first_seen_idx
--   ON public.creators (first_seen_at DESC);
-- CREATE INDEX IF NOT EXISTS wallets_type_idx
--   ON public.wallets (wallet_type);
