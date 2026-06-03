-- Thin, interconnected view specifically for the Explore/Creators sortable list.
--
-- This view sits on top of creator_ethos_projection (the single source of truth).
-- Different sort orders (market cap, ethos, volume, etc.) are just different
-- ORDER BY clauses against this same view — no separate data or "charts".
--
-- The frontend should query this view (or the projection directly) and apply
-- ORDER BY based on the user's selected sort.

CREATE OR REPLACE VIEW public.v_explore_creators AS
SELECT
    lower(creator_address) AS creator_address,
    lower(coin_address) AS coin_address,
    twitter_username,
    zora_handle,
    created_at,
    market_cap_usd,
    volume_24h_usd,
    fees_24h_usd,                    -- if populated
    ethos_score,
    ethos_level,
    ethos_score_source,
    refreshed_at
FROM public.creator_ethos_projection;

COMMENT ON VIEW public.v_explore_creators IS 
  'Canonical view for the Explore/Creators page. All sortable columns live here. Change sort order by changing ORDER BY on this view — do not create separate tables for different sorts.';
