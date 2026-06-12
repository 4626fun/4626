-- Time-gate for the full creators reconcile pass (recomputeCreatorCounts).
--
-- The reconcile is a drift-repair routine: three full passes over ~1M creator_coins
-- rows (orphan INSERT repair, coin_count GROUP BY + diff UPDATE, orphan DELETE),
-- ~8-10s of DB time. It was running on every sync cron tick (hot mode every 5 min +
-- backfill twice an hour) even though the incremental sync upserts creators rows
-- inline, so reconcile only needs to catch rare drift. The watermark lets the sync
-- skip the full pass unless CREATOR_METRICS_RECONCILE_INTERVAL_MINUTES has elapsed.
ALTER TABLE public.creator_metrics_state
  ADD COLUMN IF NOT EXISTS creators_reconciled_at TIMESTAMPTZ;
