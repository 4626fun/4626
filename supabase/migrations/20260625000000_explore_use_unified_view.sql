-- Recommendation / migration note for Explore to use the unified view.
--
-- The Explore/Creators page should source its Ethos + market data from
-- the single interconnected table (creator_ethos_projection) or the thin
-- view v_explore_creators.
--
-- This ensures that sorting by market_cap, ethos_score, volume, etc.
-- all operate on exactly the same rows — only the ORDER BY changes.
--
-- No separate "market cap chart data" vs "ethos chart data".

-- (The actual query change lives in the application code in _explore.ts
--  and related loaders. This migration just documents the intent and
--  can be used to create the view if it doesn't exist in prod yet.)

-- Ensure the view exists (safe if already created by 20260622000000)
CREATE OR REPLACE VIEW public.v_explore_creators AS
SELECT
    lower(creator_address) AS creator_address,
    lower(coin_address) AS coin_address,
    twitter_username,
    zora_handle,
    created_at,
    market_cap_usd,
    volume_24h_usd,
    NULL::numeric AS fees_24h_usd,   -- populated later via join if needed
    ethos_score,
    ethos_level,
    ethos_score_source,
    refreshed_at
FROM public.creator_ethos_projection;

COMMENT ON VIEW public.v_explore_creators IS
  'Single source for Explore/Creators sortable lists. All sort columns (market cap, ethos, volume...) live here. Different user sort orders = different ORDER BY on this same view.';
