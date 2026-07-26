-- Additive fee-bucket columns for CoinTradeRewards indexing (Explore hero + row breakdown).
-- Creator / platform / trade_ref / protocol come from on-chain logs; lp / doppler are derived.

ALTER TABLE public.creator_coins
  ADD COLUMN IF NOT EXISTS fees_24h_creator_usd NUMERIC(38, 12),
  ADD COLUMN IF NOT EXISTS fees_24h_platform_usd NUMERIC(38, 12),
  ADD COLUMN IF NOT EXISTS fees_24h_trade_ref_usd NUMERIC(38, 12),
  ADD COLUMN IF NOT EXISTS fees_24h_protocol_usd NUMERIC(38, 12),
  ADD COLUMN IF NOT EXISTS fees_24h_lp_usd NUMERIC(38, 12),
  ADD COLUMN IF NOT EXISTS fees_24h_doppler_usd NUMERIC(38, 12),
  ADD COLUMN IF NOT EXISTS fees_24h_indexed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.creator_coins.fees_24h_creator_usd IS
  '24h creator reward USD from CoinTradeRewards logs (indexed).';
COMMENT ON COLUMN public.creator_coins.fees_24h_platform_usd IS
  '24h platform referrer reward USD from CoinTradeRewards logs (indexed).';
COMMENT ON COLUMN public.creator_coins.fees_24h_trade_ref_usd IS
  '24h trade referrer reward USD from CoinTradeRewards logs (indexed).';
COMMENT ON COLUMN public.creator_coins.fees_24h_protocol_usd IS
  '24h protocol (Zora) reward USD from CoinTradeRewards logs (indexed).';
COMMENT ON COLUMN public.creator_coins.fees_24h_lp_usd IS
  '24h LP remint fee USD derived from indexed market rewards (v4) or 0 (legacy).';
COMMENT ON COLUMN public.creator_coins.fees_24h_doppler_usd IS
  '24h Doppler fee USD derived from indexed market rewards (v4; not in event) or 0 (legacy).';
COMMENT ON COLUMN public.creator_coins.fees_24h_indexed_at IS
  'When fee buckets were last written from CoinTradeRewards indexing.';
