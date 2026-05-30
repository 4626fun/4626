-- Indexed explore row parity fields for Ethos-sorted creator tables.

ALTER TABLE public.creator_coins
  ADD COLUMN IF NOT EXISTS unique_holders INTEGER,
  ADD COLUMN IF NOT EXISTS market_cap_delta_24h NUMERIC(38, 12);

COMMENT ON COLUMN public.creator_coins.unique_holders IS
  'Indexed holder count from Zora explore/getCoin enrichment.';
COMMENT ON COLUMN public.creator_coins.market_cap_delta_24h IS
  'Indexed 24h market-cap delta from Zora explore/getCoin enrichment.';
