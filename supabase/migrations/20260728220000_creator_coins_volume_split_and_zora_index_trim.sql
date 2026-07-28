-- creator_coins volume split + zora_csw_owners index trim (2026-07-28)
-- Applied live via CREATE/DROP INDEX CONCURRENTLY (deadlock-safe).
-- This file keeps repo migrations aligned with production.

-- Zero-volume mcap fill for projection (pairs with idx_creator_coins_volume_rank_hot)
CREATE INDEX IF NOT EXISTS idx_creator_coins_mcap_fill
  ON public.creator_coins (
    chain_id,
    market_cap_usd DESC NULLS LAST,
    created_at DESC NULLS LAST,
    coin_address ASC
  )
  WHERE volume_24h_usd = 0;

-- Full volume rank no longer needed after projection volume_hot + volume_fill split
DROP INDEX IF EXISTS public.idx_creator_coins_volume_rank;

-- Zora enrich partials (replace unused full last_owner_sync_at btree, 0 scans / ~39MB)
CREATE INDEX IF NOT EXISTS idx_zora_csw_owners_pending_owners
  ON public.zora_csw_owners (creation_block ASC NULLS LAST)
  WHERE current_owners IS NULL;

CREATE INDEX IF NOT EXISTS idx_zora_csw_owners_stale_sync
  ON public.zora_csw_owners (last_owner_sync_at ASC NULLS FIRST)
  WHERE last_owner_sync_at IS NOT NULL;

DROP INDEX IF EXISTS public.idx_zora_csw_owners_last_owner_sync_at;
