import type { getDb } from '@4626/server-core'

import type { CoinPriceSparklineResult } from './coinPriceSparkline.js'

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>

const DEFAULT_CHAIN_ID = 8453
/** Reuse cached sparklines on explore reads for this long before forcing a Zora refetch. */
export const SPARKLINE_DB_TTL_MS = 6 * 60 * 60_000

export function parseSparklineValuesFromDb(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const values: number[] = []
  for (const entry of raw) {
    const n = typeof entry === 'number' ? entry : typeof entry === 'string' ? Number(entry) : NaN
    if (Number.isFinite(n) && n > 0) values.push(n)
  }
  return values
}

export function isSparklineDbRowFresh(updatedAt: unknown, nowMs = Date.now()): boolean {
  if (typeof updatedAt !== 'string') return false
  const ms = Date.parse(updatedAt)
  if (!Number.isFinite(ms)) return false
  return nowMs - ms <= SPARKLINE_DB_TTL_MS
}

export async function persistExploreSparklinesToDb(
  db: Db,
  rows: ReadonlyArray<CoinPriceSparklineResult>,
): Promise<void> {
  const eligible = rows.filter((row) => row.coinAddress && row.values.length >= 2)
  if (eligible.length === 0) return

  await Promise.allSettled(
    eligible.map((row) =>
      db.sql`
        UPDATE creator_coins
        SET
          sparkline_30d_values = ${JSON.stringify(row.values)}::jsonb,
          sparkline_30d_change_pct = ${row.changePercent},
          sparkline_30d_updated_at = NOW()
        WHERE lower(coin_address) = ${row.coinAddress.toLowerCase()}
          AND chain_id = ${DEFAULT_CHAIN_ID};
      `,
    ),
  )
}
