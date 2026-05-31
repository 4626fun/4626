-- View to identify potentially unused indexes on the core Ethos chart tables.
-- Extremely valuable when you have many composite indexes supporting 137+ charts.

CREATE OR REPLACE VIEW public.ethos_unused_indexes AS
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname IN (
    'creator_ethos_projection',
    'creator_ethos_daily_snapshots',
    'creator_ethos_hourly_snapshots',
    'creator_ethos_15min_snapshots'
)
  AND idx_scan < 50          -- very low usage threshold
  AND pg_relation_size(indexrelid) > 1024 * 1024 * 5   -- only show indexes > 5MB
ORDER BY pg_relation_size(indexrelid) DESC, idx_scan;

COMMENT ON VIEW public.ethos_unused_indexes IS 
  'Shows indexes on the Ethos chart tables that have seen very little usage. Use as input for potential cleanup (after reviewing for 7+ days of normal traffic).';
