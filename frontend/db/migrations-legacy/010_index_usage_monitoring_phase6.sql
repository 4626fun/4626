-- Phase 6: monitor index usage over time and auto-generate drop drafts.
-- Usage:
--   SELECT public.capture_index_usage_snapshot();
--   SELECT * FROM public.index_drop_candidates(14, 2, 0);
--   SELECT public.index_drop_migration_draft(14, 2, 0);

CREATE TABLE IF NOT EXISTS public.index_usage_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stats_reset TIMESTAMPTZ,
  schemaname TEXT NOT NULL,
  tablename TEXT NOT NULL,
  indexname TEXT NOT NULL,
  idx_scan BIGINT NOT NULL DEFAULT 0,
  idx_tup_read BIGINT NOT NULL DEFAULT 0,
  idx_tup_fetch BIGINT NOT NULL DEFAULT 0,
  index_size_bytes BIGINT NOT NULL DEFAULT 0,
  is_unique BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  n_live_tup BIGINT NOT NULL DEFAULT 0,
  n_tup_ins BIGINT NOT NULL DEFAULT 0,
  n_tup_upd BIGINT NOT NULL DEFAULT 0,
  n_tup_del BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS index_usage_snapshots_index_time_idx
  ON public.index_usage_snapshots (indexname, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS index_usage_snapshots_time_idx
  ON public.index_usage_snapshots (snapshot_at DESC);

CREATE OR REPLACE FUNCTION public.capture_index_usage_snapshot()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count BIGINT := 0;
BEGIN
  INSERT INTO public.index_usage_snapshots (
    snapshot_at,
    stats_reset,
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    index_size_bytes,
    is_unique,
    is_primary,
    n_live_tup,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
  )
  SELECT
    NOW(),
    db.stats_reset,
    s.schemaname,
    s.relname,
    s.indexrelname,
    COALESCE(s.idx_scan, 0),
    COALESCE(s.idx_tup_read, 0),
    COALESCE(s.idx_tup_fetch, 0),
    COALESCE(pg_relation_size(s.indexrelid), 0),
    COALESCE(ix.indisunique, false),
    COALESCE(ix.indisprimary, false),
    COALESCE(st.n_live_tup, 0),
    COALESCE(st.n_tup_ins, 0),
    COALESCE(st.n_tup_upd, 0),
    COALESCE(st.n_tup_del, 0)
  FROM pg_stat_user_indexes s
  JOIN pg_index ix ON ix.indexrelid = s.indexrelid
  JOIN pg_stat_user_tables st ON st.relid = s.relid
  CROSS JOIN LATERAL (
    SELECT stats_reset
    FROM pg_stat_database
    WHERE datname = current_database()
    LIMIT 1
  ) AS db;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

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
$$;

CREATE OR REPLACE FUNCTION public.index_drop_migration_draft(
  min_days INTEGER DEFAULT 14,
  min_samples INTEGER DEFAULT 2,
  min_table_writes BIGINT DEFAULT 0
)
RETURNS TEXT
LANGUAGE sql
AS $$
  WITH candidates AS (
    SELECT *
    FROM public.index_drop_candidates(min_days, min_samples, min_table_writes)
  ),
  drop_lines AS (
    SELECT STRING_AGG(drop_sql, E'\n' ORDER BY tablename ASC, indexname ASC) AS sql_text
    FROM candidates
  ),
  rollback_lines AS (
    SELECT STRING_AGG(rollback_sql, E'\n' ORDER BY tablename ASC, indexname ASC) AS sql_text
    FROM candidates
  )
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM candidates) THEN
        '-- Auto-generated unused-index prune draft' || E'\n' ||
        '-- Criteria: min_days=' || GREATEST(min_days, 0)::TEXT ||
        ', min_samples=' || GREATEST(min_samples, 1)::TEXT ||
        ', min_table_writes=' || GREATEST(min_table_writes, 0)::TEXT || E'\n\n' ||
        COALESCE((SELECT sql_text FROM drop_lines), '-- no DROP statements') ||
        E'\n\n-- Rollback SQL\n' ||
        COALESCE((SELECT sql_text FROM rollback_lines), '-- no rollback statements')
      ELSE
        '-- No drop candidates for the requested window/threshold.'
    END;
$$;
