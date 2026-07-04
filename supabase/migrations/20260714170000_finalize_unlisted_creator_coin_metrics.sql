-- One-time drain of the creator_coins metrics enrichment backlog (batched).
--
-- Chain scan inserts ~918k factory events; most never list on Zora explore.
-- Treat coins older than 24h with NULL financials as unlisted (zero metrics)
-- so cached totals and backfill_complete reflect listed-coin sums only.
-- Ongoing sync uses the same rule via creatorMetricsSync finalizeStaleUnlistedCoinMetrics.

BEGIN;

DO $$
DECLARE
  v_batch_size integer := 25000;
  v_updated bigint := 0;
  v_total bigint := 0;
BEGIN
  LOOP
    UPDATE public.creator_coins AS c
    SET
      market_cap_usd = 0,
      volume_24h_usd = 0,
      fees_24h_usd = 0,
      last_seen_at = NOW()
    WHERE c.ctid IN (
      SELECT cc.ctid
      FROM public.creator_coins AS cc
      WHERE cc.chain_id = 8453
        AND (cc.market_cap_usd IS NULL OR cc.volume_24h_usd IS NULL OR cc.fees_24h_usd IS NULL)
        AND cc.created_at IS NOT NULL
        AND cc.created_at < NOW() - INTERVAL '1 day'
      LIMIT v_batch_size
    );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    v_total := v_total + v_updated;
    EXIT WHEN v_updated = 0;
  END LOOP;

  RAISE NOTICE 'creator_coins unlisted metrics zeroed: % rows', v_total;
END;
$$;

UPDATE public.creator_metrics_state
SET
  sync_error = NULL,
  backfill_complete = COALESCE(backfill_complete, false),
  cached_market_cap_usd = totals.market_cap_usd,
  cached_volume_24h_usd = totals.volume_24h_usd,
  cached_fees_24h_usd = totals.fees_24h_usd,
  cached_totals_at = NOW()
FROM (
  SELECT
    COALESCE(SUM(market_cap_usd), 0)::NUMERIC AS market_cap_usd,
    COALESCE(SUM(volume_24h_usd), 0)::NUMERIC AS volume_24h_usd,
    COALESCE(SUM(fees_24h_usd), 0)::NUMERIC AS fees_24h_usd
  FROM public.creator_coins
  WHERE chain_id = 8453
) AS totals
WHERE id = 1;

COMMIT;
