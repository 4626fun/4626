-- Query performance observability for the Ethos chart system (137+ charts on the single interconnected source).
-- Pulls expensive statements that are either:
--   a) tagged with our chart application_name prefix (supabase-chart:*), or
--   b) touch the core Ethos tables (creator_ethos_projection + the snapshot tables).
--
-- This powers the "Suggested New Indexes" / slow query diagnostics section in the admin health UI.
-- It does NOT execute any DDL — it is read-only advisory data.

CREATE OR REPLACE VIEW public.ethos_expensive_chart_queries AS
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  rows,
  -- Extract a short label when the query was tagged via our chart helpers
  regexp_replace(
    COALESCE(
      (regexp_match(query, 'application_name''?[:=]?\s*supabase-chart:([^''\s]+)'))[1],
      'untagged'
    ),
    '[\n\r\t]+', ' ', 'g'
  ) AS chart_tag,
  pg_size_pretty(pg_total_relation_size('public.creator_ethos_projection')) AS projection_size_at_capture
FROM pg_stat_statements
WHERE (
    -- Tagged via our withChartQuery / withAutoChartTagging helpers
    query ILIKE '%supabase-chart:%'
    OR query ILIKE '%creator_ethos_projection%'
    OR query ILIKE '%v_explore_creators%'
    OR query ILIKE '%creator_ethos_daily_snapshots%'
    OR query ILIKE '%creator_ethos_hourly_snapshots%'
    OR query ILIKE '%creator_ethos_15min_snapshots%'
  )
  AND calls > 0
ORDER BY total_time DESC
LIMIT 50;

COMMENT ON VIEW public.ethos_expensive_chart_queries IS
  'Top expensive queries (by total_time) that touch the unified Ethos chart tables or carry our supabase-chart:* application_name tag. Used to drive index recommendation suggestions in the admin dashboard. All charts and Explore sorts must continue to target the single source (projection + v_explore_creators).';

-- Lightweight helper view that surfaces the most common filter/sort column combinations
-- observed in our controlled hot paths (Explore lists, ethos filters, multi-column ORDER BY).
-- This is intentionally a curated starting point that can be augmented later from real
-- pg_stat_statements analysis in the admin UI.
CREATE OR REPLACE VIEW public.ethos_common_access_patterns AS
SELECT
  'explore-creators-ethos-volume-marketcap' AS pattern,
  'ethos_score + volume_24h_usd + market_cap_usd (multi-sort + ethosMin filter)' AS description,
  'creator_ethos_projection / v_explore_creators' AS target,
  'High frequency from /api/zora/explore creator lists (all sort modes) and many of the 137 charts' AS notes
UNION ALL
SELECT
  'explore-creators-recent-ethos',
  'created_at + ethos_score (new + quality sorts)',
  'creator_ethos_projection / v_explore_creators',
  'Used by NEW_CREATORS, FEATURED, and quality-gated leaderboards'
UNION ALL
SELECT
  'chart-distribution-by-score',
  'ethos_score range filters + distribution buckets',
  'creator_ethos_score_distribution + projection',
  'Distribution and leaderboard charts'
UNION ALL
SELECT
  'snapshot-time-series',
  'snapshot_date/hour + ethos_score + market_cap joins',
  'daily/hourly/15min snapshots',
  'Time-series panels and retention/cohort charts';

COMMENT ON VIEW public.ethos_common_access_patterns IS
  'Curated list of the dominant access patterns on the single interconnected Ethos source. Drives the initial suggested index recommendations shown in the admin health dashboard.';
