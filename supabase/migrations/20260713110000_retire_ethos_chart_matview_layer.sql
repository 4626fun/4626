-- Retire the unified Ethos chart materialized-view layer (2026-07-13).
--
-- Audit findings:
--   * The four mv_ethos_* materialized views were refreshed after every projection
--     refresh (REFRESH MATERIALIZED VIEW x4, several times an hour) but had ZERO
--     readers — no API handler, no UI, no script ever SELECTed from them. They were
--     also REVOKEd from anon/authenticated in the 2026-07-13 security pass, so no
--     PostgREST consumer could exist either.
--   * Each one is a trivial GROUP BY over creator_ethos_projection (~85K rows);
--     any future chart can compute the same aggregate live in ~30 ms.
--   * v_ethos_by_creator_age: same shape, no readers.
--   * ethos_last_refreshes / ethos_chart_system_health: meta-views whose only
--     consumer was the admin ethos health endpoint, which was already broken
--     (it also queries ethos_index_usage / ethos_unused_indexes /
--     ethos_expensive_chart_queries — views that do not exist). The endpoint and
--     handlers are removed in the same change.
--   * run_zora_owner_ethos_projection / backfill_zora_owner_ethos_from_cache:
--     legacy pg_cron-era functions; no cron.job entry references them and no code
--     calls them.
--
-- What stays (the single Ethos chart source of truth):
--   * creator_ethos_projection      — live scores (read by Explore + charts)
--   * creator_ethos_daily_snapshots — daily history for trend charts
--   * snapshot_creator_ethos_daily() / prune_ethos_daily_snapshots()

-- Meta-views depend on the matviews; drop them first.
DROP VIEW IF EXISTS public.v_ethos_by_creator_age;
DROP VIEW IF EXISTS public.ethos_last_refreshes;
DROP VIEW IF EXISTS public.ethos_chart_system_health;

DROP MATERIALIZED VIEW IF EXISTS public.mv_ethos_level_distribution;
DROP MATERIALIZED VIEW IF EXISTS public.mv_ethos_by_source;
DROP MATERIALIZED VIEW IF EXISTS public.mv_ethos_by_market_cap_tier;
DROP MATERIALIZED VIEW IF EXISTS public.mv_ethos_by_volume_tier;

DROP FUNCTION IF EXISTS public.refresh_all_ethos_chart_views();
DROP FUNCTION IF EXISTS public.run_zora_owner_ethos_projection(integer);
DROP FUNCTION IF EXISTS public.backfill_zora_owner_ethos_from_cache(integer);
