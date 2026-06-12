-- Supports the restructured creator_ethos_projection refresh: a top-N candidate scan in
-- global volume/mcap order replaces a window function over all ~1M creator_coins rows.
-- DESC defaults to NULLS FIRST in Postgres, so NULLS LAST must be explicit to match the
-- query's ORDER BY and allow a pure index walk for the LIMIT.
CREATE INDEX IF NOT EXISTS idx_creator_coins_volume_rank
  ON public.creator_coins (
    chain_id,
    volume_24h_usd DESC NULLS LAST,
    market_cap_usd DESC NULLS LAST,
    created_at DESC NULLS LAST,
    coin_address ASC
  );
