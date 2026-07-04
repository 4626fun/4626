#!/usr/bin/env tsx
/**
 * One-off / ops helper: zero metrics for unlisted creator_coins older than 24h.
 * Mirrors supabase/migrations/20260714170000_finalize_unlisted_creator_coin_metrics.sql
 */

import { getDb } from '../server/_lib/db/postgres.js'

async function main(): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('database_not_configured')

  let total = 0
  for (;;) {
    const batch = await db.sql`
      WITH batch AS (
        SELECT ctid
        FROM creator_coins
        WHERE chain_id = 8453
          AND (market_cap_usd IS NULL OR volume_24h_usd IS NULL OR fees_24h_usd IS NULL)
          AND created_at IS NOT NULL
          AND created_at < NOW() - INTERVAL '1 day'
        LIMIT 25000
      )
      UPDATE creator_coins AS c
      SET
        market_cap_usd = 0,
        volume_24h_usd = 0,
        fees_24h_usd = 0,
        last_seen_at = NOW()
      FROM batch
      WHERE c.ctid = batch.ctid
      RETURNING c.coin_address
    `
    const batchCount = batch.rows?.length ?? 0
    total += batchCount
    console.log(`batch=${batchCount} total=${total}`)
    if (batchCount === 0) break
  }

  await db.sql`
    UPDATE creator_metrics_state
    SET
      sync_error = NULL,
      cached_market_cap_usd = totals.market_cap_usd,
      cached_volume_24h_usd = totals.volume_24h_usd,
      cached_fees_24h_usd = totals.fees_24h_usd,
      cached_totals_at = NOW()
    FROM (
      SELECT
        COALESCE(SUM(market_cap_usd), 0)::numeric AS market_cap_usd,
        COALESCE(SUM(volume_24h_usd), 0)::numeric AS volume_24h_usd,
        COALESCE(SUM(fees_24h_usd), 0)::numeric AS fees_24h_usd
      FROM creator_coins
      WHERE chain_id = 8453
    ) AS totals
    WHERE id = 1
  `

  const missing = await db.sql`
    SELECT COUNT(*)::int AS missing
    FROM creator_coins
    WHERE chain_id = 8453
      AND (market_cap_usd IS NULL OR volume_24h_usd IS NULL OR fees_24h_usd IS NULL)
  `
  const state = await db.sql`SELECT sync_error FROM creator_metrics_state WHERE id = 1`
  console.log('done', {
    missing: missing.rows?.[0]?.missing ?? null,
    sync_error: state.rows?.[0]?.sync_error ?? null,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
