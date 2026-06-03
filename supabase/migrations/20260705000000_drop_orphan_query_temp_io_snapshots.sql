-- Drop orphan telemetry table `query_temp_io_snapshots`.
--
-- Audit finding (2026-06/07):
-- - Listed in TELEMETRY_CANDIDATES in audit-telemetry-optimization.ts with highest
--   optimization potential (~70-75%).
-- - Only references anywhere in the repo: the retention cleanup job (DELETE only)
--   and the analyzer/docs.
-- - ZERO code references that write to it (no INSERT, no producer, no jobs).
-- - ZERO TypeScript type definition in supabase.types.ts.
-- - ZERO CREATE TABLE migration in supabase/migrations/ or legacy/.
-- - The table may still physically exist in the production Supabase instance
--   from an earlier experiment (pg_stat_io / query temp I/O snapshotting),
--   but it has no owner, no producer, and no consumers.
--
-- Retention job (20260612000000) already had a DELETE for it (7d default).
-- This migration removes the table entirely so it stops consuming storage,
-- vacuum work, and appearing in "137 tables" counts.
--
-- Safe: DROP TABLE IF EXISTS + comment. Reversible via restore from backup
-- if any historical data is ever needed (unlikely).

DROP TABLE IF EXISTS public.query_temp_io_snapshots;

-- Also clean up the retention function parameter if it exists (idempotent).
-- The function definition lives in 20260612000000; we leave the parameter
-- handling to a future cleanup of that function when we remove more orphans.
COMMENT ON SCHEMA public IS 'query_temp_io_snapshots dropped as confirmed orphan (no writers, no types, no creation migration) - 2026-07';