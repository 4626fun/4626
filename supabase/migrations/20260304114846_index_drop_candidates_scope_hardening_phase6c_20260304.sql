-- Phase 6c: harden index drop candidate generation scope.
-- - Restrict candidates to public schema snapshots only
-- - Exclude monitoring table indexes from self-suggestions
-- - Treat min_days = 0 as "no time window filter"

CREATE OR REPLACE FUNCTION public.index_drop_candidates(
  min_days INTEGER DEFAULT 14,
  min_samples INTEGER DEFAULT 2,
  min_table_writes BIGINT DEFAULT 0
)
RETURNS TABLE (
  schemaname TEXT,
  tablename TEXT,
  indexname TEXT,
  sample_count BIGINT,
  sample_window INTERVAL,
  idx_scan_delta BIGINT,
  table_writes_delta BIGINT,
  index_size_pretty TEXT,
  drop_sql TEXT,
  rollback_sql TEXT
)
LANGUAGE sql
SET search_path = pg_catalog, public
AS $$
  WITH latest_reset AS (
    SELECT stats_reset
    FROM public.index_usage_snapshots
    ORDER BY snapshot_at DESC
    LIMIT 1
  ),
  windowed AS (
    SELECT s.*
    FROM public.index_usage_snapshots s
    CROSS JOIN latest_reset r
    WHERE r.stats_reset IS NOT NULL
      AND s.stats_reset = r.stats_reset
      AND s.schemaname = 'public'
      AND s.tablename <> 'index_usage_snapshots'
      AND (
        GREATEST(min_days, 0) = 0
        OR s.snapshot_at >= NOW() - make_interval(days => GREATEST(min_days, 0))
      )
  ),
  agg AS (
    SELECT
      schemaname,
      tablename,
      indexname,
      COUNT(*)::BIGINT AS sample_count,
      MAX(snapshot_at) - MIN(snapshot_at) AS sample_window,
      (MAX(idx_scan) - MIN(idx_scan))::BIGINT AS idx_scan_delta,
      (MAX(n_tup_ins + n_tup_upd + n_tup_del) - MIN(n_tup_ins + n_tup_upd + n_tup_del))::BIGINT AS table_writes_delta,
      MAX(index_size_bytes)::BIGINT AS index_size_bytes,
      BOOL_OR(is_unique) AS is_unique,
      BOOL_OR(is_primary) AS is_primary
    FROM windowed
    GROUP BY 1, 2, 3
  )
  SELECT
    a.schemaname,
    a.tablename,
    a.indexname,
    a.sample_count,
    a.sample_window,
    a.idx_scan_delta,
    a.table_writes_delta,
    pg_size_pretty(a.index_size_bytes) AS index_size_pretty,
    FORMAT('DROP INDEX IF EXISTS %I.%I;', a.schemaname, a.indexname) AS drop_sql,
    REPLACE(
      REPLACE(pi.indexdef, 'CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS '),
      'CREATE INDEX ',
      'CREATE INDEX IF NOT EXISTS '
    ) || ';' AS rollback_sql
  FROM agg a
  LEFT JOIN pg_indexes pi
    ON pi.schemaname = a.schemaname
   AND pi.tablename = a.tablename
   AND pi.indexname = a.indexname
  WHERE a.sample_count >= GREATEST(min_samples, 1)
    AND a.idx_scan_delta = 0
    AND a.table_writes_delta >= GREATEST(min_table_writes, 0)
    AND NOT a.is_unique
    AND NOT a.is_primary
    AND a.indexname NOT LIKE '%_pkey'
    AND a.indexname NOT LIKE '%_key'
  ORDER BY a.index_size_bytes DESC, a.tablename ASC, a.indexname ASC;
$$;;
