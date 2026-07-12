import { getDb } from '../../db/postgres.js'
import { ensureAlfaclubMarketFeatureSnapshotSchema } from '../../db/schemaBootstrap.js'
import {
  MARKET_FEATURE_METHODOLOGY_VERSION,
  MARKET_FEATURE_SOURCE_PROVIDER,
  type MarketFeatureDeltas,
  type MarketFeatureSnapshot,
} from './types.js'

const DEFAULT_DELTA_TOLERANCE_MS = 6 * 60 * 1000
const DEFAULT_RETENTION_DAYS = 45

function finiteOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function bucketObservedAtMs(observedAtMs: number, bucketMs = 5 * 60 * 1000): number {
  return Math.floor(observedAtMs / bucketMs) * bucketMs
}

export async function recordMarketFeatureSnapshot(
  input: MarketFeatureSnapshot,
): Promise<{ id: string | null; inserted: boolean }> {
  const db = await getDb()
  if (!db) return { id: null, inserted: false }
  await ensureAlfaclubMarketFeatureSnapshotSchema(db)

  const symbol = input.symbol.trim().toUpperCase()
  const observedAt = new Date(bucketObservedAtMs(input.observedAtMs))
  const result = await db.sql<{ id: string; inserted: boolean }>`
    INSERT INTO alfaclub.market_feature_snapshots (
      symbol,
      observed_at,
      source_provider,
      methodology_version,
      mark_price_usd,
      funding_rate,
      open_interest_usd,
      volume_24h_usd,
      price_change_24h_pct,
      oracle_price_usd,
      basis_bps,
      extras
    ) VALUES (
      ${symbol},
      ${observedAt},
      ${MARKET_FEATURE_SOURCE_PROVIDER},
      ${MARKET_FEATURE_METHODOLOGY_VERSION},
      ${input.markPriceUsd},
      ${input.fundingRate},
      ${input.openInterestUsd},
      ${input.volume24hUsd},
      ${input.priceChange24hPct},
      ${input.oraclePriceUsd},
      ${input.basisBps},
      ${JSON.stringify(input.extras ?? {})}::jsonb
    )
    ON CONFLICT (symbol, observed_at) DO UPDATE
    SET symbol = EXCLUDED.symbol
    RETURNING id, (xmax = 0) AS inserted
  `
  const row = result.rows[0]
  return { id: row?.id ?? null, inserted: Boolean(row?.inserted) }
}

export async function loadPriorMarketFeatureSnapshot(params: {
  symbol: string
  beforeObservedAtMs: number
  maxAgeMs?: number
}): Promise<MarketFeatureSnapshot | null> {
  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubMarketFeatureSnapshotSchema(db)

  const symbol = params.symbol.trim().toUpperCase()
  const before = new Date(params.beforeObservedAtMs)
  const minObservedAt = new Date(
    params.beforeObservedAtMs - (params.maxAgeMs ?? DEFAULT_DELTA_TOLERANCE_MS * 12),
  )
  const result = await db.sql<{
    symbol: string
    observed_at: Date | string
    mark_price_usd: number | string | null
    funding_rate: number | string | null
    open_interest_usd: number | string | null
    volume_24h_usd: number | string | null
    price_change_24h_pct: number | string | null
    oracle_price_usd: number | string | null
    basis_bps: number | string | null
  }>`
    SELECT
      symbol,
      observed_at,
      mark_price_usd,
      funding_rate,
      open_interest_usd,
      volume_24h_usd,
      price_change_24h_pct,
      oracle_price_usd,
      basis_bps
    FROM alfaclub.market_feature_snapshots
    WHERE symbol = ${symbol}
      AND observed_at < ${before}
      AND observed_at >= ${minObservedAt}
    ORDER BY observed_at DESC
    LIMIT 1
  `
  const row = result.rows[0]
  if (!row) return null
  return {
    symbol: String(row.symbol),
    observedAtMs: new Date(row.observed_at).getTime(),
    markPriceUsd: finiteOrNull(row.mark_price_usd),
    fundingRate: finiteOrNull(row.funding_rate),
    openInterestUsd: finiteOrNull(row.open_interest_usd),
    volume24hUsd: finiteOrNull(row.volume_24h_usd),
    priceChange24hPct: finiteOrNull(row.price_change_24h_pct),
    oraclePriceUsd: finiteOrNull(row.oracle_price_usd),
    basisBps: finiteOrNull(row.basis_bps),
  }
}

export function computeFeatureDeltas(params: {
  current: MarketFeatureSnapshot
  prior: MarketFeatureSnapshot | null
  maxAgeMs?: number
}): MarketFeatureDeltas {
  const maxAgeMs = params.maxAgeMs ?? DEFAULT_DELTA_TOLERANCE_MS * 3
  if (!params.prior) {
    return {
      dFunding: null,
      dOpenInterestUsd: null,
      dVolume24hUsd: null,
      dMarkPriceUsd: null,
      lookbackMs: null,
      priorObservedAtMs: null,
      missing: ['dFunding', 'dOpenInterestUsd', 'dVolume24hUsd', 'dMarkPriceUsd'],
    }
  }
  const lookbackMs = params.current.observedAtMs - params.prior.observedAtMs
  if (!Number.isFinite(lookbackMs) || lookbackMs <= 0 || lookbackMs > maxAgeMs) {
    return {
      dFunding: null,
      dOpenInterestUsd: null,
      dVolume24hUsd: null,
      dMarkPriceUsd: null,
      lookbackMs: Number.isFinite(lookbackMs) ? lookbackMs : null,
      priorObservedAtMs: params.prior.observedAtMs,
      missing: ['dFunding', 'dOpenInterestUsd', 'dVolume24hUsd', 'dMarkPriceUsd'],
    }
  }

  const missing: MarketFeatureDeltas['missing'] = []
  const dFunding =
    params.current.fundingRate != null && params.prior.fundingRate != null
      ? params.current.fundingRate - params.prior.fundingRate
      : null
  const dOpenInterestUsd =
    params.current.openInterestUsd != null && params.prior.openInterestUsd != null
      ? params.current.openInterestUsd - params.prior.openInterestUsd
      : null
  const dVolume24hUsd =
    params.current.volume24hUsd != null && params.prior.volume24hUsd != null
      ? params.current.volume24hUsd - params.prior.volume24hUsd
      : null
  const dMarkPriceUsd =
    params.current.markPriceUsd != null && params.prior.markPriceUsd != null
      ? params.current.markPriceUsd - params.prior.markPriceUsd
      : null

  if (dFunding == null) missing.push('dFunding')
  if (dOpenInterestUsd == null) missing.push('dOpenInterestUsd')
  if (dVolume24hUsd == null) missing.push('dVolume24hUsd')
  if (dMarkPriceUsd == null) missing.push('dMarkPriceUsd')

  return {
    dFunding,
    dOpenInterestUsd,
    dVolume24hUsd,
    dMarkPriceUsd,
    lookbackMs,
    priorObservedAtMs: params.prior.observedAtMs,
    missing,
  }
}

export async function loadFeatureHistory(params: {
  symbol: string
  field: 'funding_rate' | 'open_interest_usd' | 'volume_24h_usd' | 'price_change_24h_pct'
  lookbackHours: number
  nowMs?: number
}): Promise<number[]> {
  const db = await getDb()
  if (!db) return []
  await ensureAlfaclubMarketFeatureSnapshotSchema(db)

  const symbol = params.symbol.trim().toUpperCase()
  const nowMs = params.nowMs ?? Date.now()
  const since = new Date(nowMs - params.lookbackHours * 60 * 60 * 1000)
  const until = new Date(nowMs)

  let result: { rows: Array<{ value: number | string | null }> }
  switch (params.field) {
    case 'funding_rate':
      result = await db.sql<{ value: number | string | null }>`
        SELECT funding_rate AS value
        FROM alfaclub.market_feature_snapshots
        WHERE symbol = ${symbol}
          AND observed_at >= ${since}
          AND observed_at <= ${until}
        ORDER BY observed_at ASC
      `
      break
    case 'open_interest_usd':
      result = await db.sql<{ value: number | string | null }>`
        SELECT open_interest_usd AS value
        FROM alfaclub.market_feature_snapshots
        WHERE symbol = ${symbol}
          AND observed_at >= ${since}
          AND observed_at <= ${until}
        ORDER BY observed_at ASC
      `
      break
    case 'volume_24h_usd':
      result = await db.sql<{ value: number | string | null }>`
        SELECT volume_24h_usd AS value
        FROM alfaclub.market_feature_snapshots
        WHERE symbol = ${symbol}
          AND observed_at >= ${since}
          AND observed_at <= ${until}
        ORDER BY observed_at ASC
      `
      break
    case 'price_change_24h_pct':
      result = await db.sql<{ value: number | string | null }>`
        SELECT price_change_24h_pct AS value
        FROM alfaclub.market_feature_snapshots
        WHERE symbol = ${symbol}
          AND observed_at >= ${since}
          AND observed_at <= ${until}
        ORDER BY observed_at ASC
      `
      break
    default: {
      const _exhaustive: never = params.field
      void _exhaustive
      return []
    }
  }

  return result.rows
    .map((row) => finiteOrNull(row.value))
    .filter((value): value is number => value != null)
}

export async function pruneMarketFeatureSnapshots(params?: {
  retentionDays?: number
  nowMs?: number
}): Promise<number> {
  const db = await getDb()
  if (!db) return 0
  await ensureAlfaclubMarketFeatureSnapshotSchema(db)
  const retentionDays = params?.retentionDays ?? DEFAULT_RETENTION_DAYS
  const cutoff = new Date((params?.nowMs ?? Date.now()) - retentionDays * 24 * 60 * 60 * 1000)
  const result = await db.sql`
    DELETE FROM alfaclub.market_feature_snapshots
    WHERE observed_at < ${cutoff}
  `
  return result.rowCount ?? 0
}
