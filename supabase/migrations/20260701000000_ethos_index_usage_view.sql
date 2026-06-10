-- Monitoring view for index usage on the core Ethos projection and snapshot tables.
-- Extremely useful when you have 137+ charts and want to know which indexes are actually being used.

CREATE OR REPLACE VIEW public.ethos_index_usage AS
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname IN (
    'creator_ethos_projection',
    'creator_ethos_daily_snapshots',
    'creator_ethos_hourly_snapshots',
    'creator_ethos_15min_snapshots'
)
ORDER BY idx_scan DESC, relname, indexrelname;

COMMENT ON VIEW public.ethos_index_usage IS 
  'Shows how much the indexes on the Ethos chart tables are being used. Helps validate that the many composite indexes we added are actually helping.';
