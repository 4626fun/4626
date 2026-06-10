-- Zora indexer index usage report (run in Supabase SQL editor or psql).
-- Re-run after ~7 days of normal traffic before dropping any index with idx_scan = 0.
-- See docs/operations/supabase-zora-db-optimization.md

SELECT
  s.relname AS table_name,
  s.indexrelname AS index_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
  i.indexdef
FROM pg_stat_user_indexes s
JOIN pg_indexes i
  ON i.schemaname = s.schemaname
 AND i.tablename = s.relname
 AND i.indexname = s.indexrelname
WHERE s.schemaname = 'public'
  AND s.relname IN ('zora_csw_owners', 'zora_csw_owner_class')
ORDER BY pg_relation_size(s.indexrelid) DESC;

-- Unused only (candidates for review — never drop PK/FK indexes)
SELECT
  s.relname,
  s.indexrelname,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public'
  AND s.relname IN ('zora_csw_owners', 'zora_csw_owner_class')
  AND s.idx_scan = 0
  AND s.indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(s.indexrelid) DESC;
