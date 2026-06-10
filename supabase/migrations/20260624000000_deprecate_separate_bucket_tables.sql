-- Deprecation of the old separate bucket tables.
--
-- These were created during exploration but go against the "everything interconnected"
-- principle. All segmented analysis should now go through the materialized views
-- in 20260620000000_unified_ethos_chart_support.sql (which are refreshed together
-- from creator_ethos_projection).
--
-- Do not rely on these tables for new work. They may be dropped in a future migration.

COMMENT ON TABLE public.creator_ethos_by_market_cap_bucket IS 
  'DEPRECATED - Use mv_ethos_by_market_cap_tier instead (refreshed as part of the unified views).';

COMMENT ON TABLE public.creator_ethos_by_volume_bucket IS 
  'DEPRECATED - Use mv_ethos_by_volume_tier instead (refreshed as part of the unified views).';

COMMENT ON TABLE public.creator_ethos_by_age_bucket IS 
  'DEPRECATED - Use v_ethos_by_creator_age instead (computed from the interconnected snapshots + projection).';

-- Note: We are not dropping them yet to avoid breaking any existing charts,
-- but new development should not use them.
