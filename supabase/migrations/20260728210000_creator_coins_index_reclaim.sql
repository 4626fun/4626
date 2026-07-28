-- creator_coins index reclaim (2026-07-28)
-- Does NOT touch shovel.* or protocol_* (Shovel indexer path is separate).
--
-- Live context:
--   ~1.02M rows; heap ~179 MB; indexes were ~759 MB (bloat from metric upserts).
--   volume_24h_usd: ~282 rows > 0, rest = 0.
--   creator_coins_creator_idx: 0 scans (lower(creator) served by chain_creator_rank_idx).
--
-- After apply: REINDEX INDEX CONCURRENTLY on remaining indexes (run outside txn):
--   REINDEX INDEX CONCURRENTLY public.idx_creator_coins_volume_rank;
--   REINDEX INDEX CONCURRENTLY public.creator_coins_chain_creator_rank_idx;
--   REINDEX INDEX CONCURRENTLY public.creator_coins_pkey;
--   REINDEX INDEX CONCURRENTLY public.idx_creator_coins_coin_address_lower;
--   REINDEX INDEX CONCURRENTLY public.creator_coins_created_at_idx;
--   ANALYZE public.creator_coins;

DROP INDEX IF EXISTS public.creator_coins_creator_idx;

CREATE INDEX IF NOT EXISTS idx_creator_coins_volume_rank_hot
  ON public.creator_coins (
    chain_id,
    volume_24h_usd DESC,
    market_cap_usd DESC NULLS LAST,
    created_at DESC NULLS LAST,
    coin_address ASC
  )
  WHERE volume_24h_usd > 0;

COMMENT ON INDEX public.idx_creator_coins_volume_rank_hot IS
  'Hot volume leaders only. Prefer with WHERE volume_24h_usd > 0; full idx_creator_coins_volume_rank remains for unfiltered ORDER BY LIMIT.';
