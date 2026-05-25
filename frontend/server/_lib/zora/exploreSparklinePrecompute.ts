import type { getDb } from '../../../packages/server-core/src/index.js'

import { resolveCoinPriceSparkline } from './coinPriceSparkline.js'
import {
  isSparklineDbRowFresh,
  persistExploreSparklinesToDb,
  SPARKLINE_DB_TTL_MS,
} from './exploreSparklineCache.js'

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>

export const DEFAULT_SPARKLINE_PRECOMPUTE_BUDGET = 96
export const DEFAULT_SPARKLINE_PRECOMPUTE_CONCURRENCY = 8

export type ExploreSparklinePrecomputeResult = {
  attempted: number
  refreshed: number
  skippedFresh: number
  failed: number
  disabled?: boolean
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

export function normalizeSparklineCoinAddresses(addresses: ReadonlyArray<string>): string[] {
  const unique: string[] = []
  for (const address of addresses) {
    const normalized = address.trim().toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(normalized)) continue
    if (!unique.includes(normalized)) unique.push(normalized)
  }
  return unique
}

export function prioritizeSparklineCandidates(
  orderedCandidates: ReadonlyArray<string>,
  staleAddresses: ReadonlySet<string>,
  budget: number,
): string[] {
  if (budget <= 0) return []
  const selected: string[] = []
  for (const address of orderedCandidates) {
    if (!staleAddresses.has(address)) continue
    selected.push(address)
    if (selected.length >= budget) break
  }
  return selected
}

export async function listStaleSparklineCoinAddresses(
  db: Db,
  candidates: ReadonlyArray<string>,
): Promise<Set<string>> {
  const normalized = normalizeSparklineCoinAddresses([...candidates])
  if (normalized.length === 0) return new Set()

  const ttlMs = SPARKLINE_DB_TTL_MS
  const result = await db.sql`
    SELECT lower(coin_address) AS coin_address, sparkline_30d_updated_at
    FROM creator_coins
    WHERE chain_id = 8453
      AND lower(coin_address) = ANY(${normalized}::text[]);
  `

  const fresh = new Set<string>()
  for (const row of result.rows ?? []) {
    const address = typeof row.coin_address === 'string' ? row.coin_address.toLowerCase() : ''
    if (!address) continue
    if (isSparklineDbRowFresh(row.sparkline_30d_updated_at)) fresh.add(address)
  }

  const stale = new Set<string>()
  for (const address of normalized) {
    if (!fresh.has(address)) stale.add(address)
  }
  return stale
}

export async function listTopVolumeStaleSparklineCoinAddresses(
  db: Db,
  limit: number,
  exclude: ReadonlySet<string>,
): Promise<string[]> {
  if (limit <= 0) return []

  const ttlCutoff = new Date(Date.now() - SPARKLINE_DB_TTL_MS).toISOString()
  const excludeList = [...exclude]
  const result = await db.sql`
    SELECT lower(coin_address) AS coin_address
    FROM creator_coins
    WHERE chain_id = 8453
      AND (
        sparkline_30d_updated_at IS NULL
        OR sparkline_30d_updated_at < ${ttlCutoff}::timestamptz
        OR sparkline_30d_values IS NULL
        OR jsonb_array_length(sparkline_30d_values) < 2
      )
      AND NOT (lower(coin_address) = ANY(${excludeList}::text[]))
    ORDER BY volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, coin_address ASC
    LIMIT ${limit};
  `

  const addresses: string[] = []
  for (const row of result.rows ?? []) {
    const address = typeof row.coin_address === 'string' ? row.coin_address.toLowerCase() : ''
    if (!address) continue
    addresses.push(address)
  }
  return addresses
}

async function mapWithConcurrency<T>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  let index = 0
  const workerCount = Math.min(Math.max(1, concurrency), items.length)

  async function worker() {
    while (index < items.length) {
      const current = index
      index += 1
      await fn(items[current]!)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

export async function precomputeExploreSparklinesForCoins(
  sdk: unknown,
  db: Db,
  options: {
    coinAddresses: ReadonlyArray<string>
    budget?: number
    concurrency?: number
    fillFromTopVolume?: boolean
  },
): Promise<ExploreSparklinePrecomputeResult> {
  const enabled = process.env.CREATOR_METRICS_SPARKLINE_PRECOMPUTE_ENABLED !== '0'
  if (!enabled) {
    return { attempted: 0, refreshed: 0, skippedFresh: 0, failed: 0, disabled: true }
  }

  const budget = parsePositiveInt(
    process.env.CREATOR_METRICS_SPARKLINE_PRECOMPUTE_BUDGET,
    options.budget ?? DEFAULT_SPARKLINE_PRECOMPUTE_BUDGET,
  )
  const concurrency = parsePositiveInt(
    process.env.CREATOR_METRICS_SPARKLINE_PRECOMPUTE_CONCURRENCY,
    options.concurrency ?? DEFAULT_SPARKLINE_PRECOMPUTE_CONCURRENCY,
  )

  const orderedCandidates = normalizeSparklineCoinAddresses(options.coinAddresses)
  const staleCandidates = await listStaleSparklineCoinAddresses(db, orderedCandidates)
  const skippedFresh = Math.max(0, orderedCandidates.length - staleCandidates.size)

  let targets = prioritizeSparklineCandidates(orderedCandidates, staleCandidates, budget)

  if (options.fillFromTopVolume !== false && targets.length < budget) {
    const exclude = new Set([...orderedCandidates, ...targets])
    const backfill = await listTopVolumeStaleSparklineCoinAddresses(db, budget - targets.length, exclude)
    targets = [...targets, ...backfill]
  }

  if (targets.length === 0) {
    return { attempted: 0, refreshed: 0, skippedFresh, failed: 0 }
  }

  const fulfilled: Awaited<ReturnType<typeof resolveCoinPriceSparkline>>[] = []
  let failed = 0

  await mapWithConcurrency(targets, concurrency, async (coinAddress) => {
    try {
      const row = await resolveCoinPriceSparkline(coinAddress, { sdk, chainId: 8453 })
      if (row.values.length >= 2) fulfilled.push(row)
    } catch {
      failed += 1
    }
  })

  if (fulfilled.length > 0) {
    await persistExploreSparklinesToDb(db, fulfilled)
  }

  return {
    attempted: targets.length,
    refreshed: fulfilled.length,
    skippedFresh,
    failed,
  }
}
