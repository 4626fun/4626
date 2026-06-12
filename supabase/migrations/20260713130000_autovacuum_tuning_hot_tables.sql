-- Tighten autovacuum on churn-heavy tables so index/heap bloat does not regrow.
--
-- Context (2026-07-13 optimization pass): default autovacuum_vacuum_scale_factor
-- is 0.2, meaning a 1M-row table accrues ~200k dead tuples before a vacuum runs.
-- creator_coins (constant metric upserts + sparkline updates) had grown to 507 MB
-- of indexes on a 152 MB heap, and zora_csw_owners pkey to 138 MB, before manual
-- REINDEX/VACUUM FULL repair. These settings make autovacuum kick in at ~2% dead
-- tuples on the two large hot tables and 5% on the mid-size ones.

ALTER TABLE public.creator_coins SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.zora_csw_owners SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.creators SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE public.ethos_userkey_scores SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE public.creator_ethos_projection SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE public.creator_ethos_daily_snapshots SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);
