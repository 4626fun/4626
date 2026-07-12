import {
  getAllPerpMarketContexts,
  type HyperliquidPerpMarketContext,
} from '../hyperliquid.js'
import {
  bucketObservedAtMs,
  pruneMarketFeatureSnapshots,
  recordMarketFeatureSnapshot,
} from './featureSnapshotStore.js'
import type { FeatureSnapshotIngestResult, MarketFeatureSnapshot } from './types.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_TOP_N = 40
const DEFAULT_MIN_DAILY_VOLUME_USD = 10_000_000
const DEFAULT_MAX_STALE_MS = 120_000

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

function readPositiveNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

export function selectLiquidUniverse(
  contexts: HyperliquidPerpMarketContext[],
  params?: { topN?: number; minimumDailyVolumeUsd?: number },
): HyperliquidPerpMarketContext[] {
  const topN = params?.topN ?? DEFAULT_TOP_N
  const minimumDailyVolumeUsd = params?.minimumDailyVolumeUsd ?? DEFAULT_MIN_DAILY_VOLUME_USD
  return contexts
    .filter((row) => {
      const volume = row.volume24hUsd
      return volume != null && Number.isFinite(volume) && volume >= minimumDailyVolumeUsd
    })
    .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
    .slice(0, topN)
}

function toSnapshot(
  context: HyperliquidPerpMarketContext,
  observedAtMs: number,
): MarketFeatureSnapshot {
  return {
    symbol: context.symbol,
    observedAtMs,
    markPriceUsd: context.markPriceUsd,
    fundingRate: context.fundingRate,
    openInterestUsd: context.openInterestUsd,
    volume24hUsd: context.volume24hUsd,
    priceChange24hPct: context.priceChange24hPct,
    oraclePriceUsd: context.oraclePriceUsd ?? null,
    basisBps: context.basisBps ?? null,
    extras: {
      missing: [
        ...(context.oraclePriceUsd == null ? ['oraclePriceUsd'] : []),
        ...(context.basisBps == null ? ['basisBps'] : []),
        'orderFlow',
        'liquidationImbalance',
      ],
    },
  }
}

export async function ingestMarketFeatureSnapshots(deps?: {
  readAllContexts?: () => Promise<HyperliquidPerpMarketContext[] | null>
  recordSnapshot?: typeof recordMarketFeatureSnapshot
  prune?: typeof pruneMarketFeatureSnapshots
  now?: () => number
  topN?: number
  minimumDailyVolumeUsd?: number
  maxStaleMs?: number
}): Promise<FeatureSnapshotIngestResult> {
  const nowMs = (deps?.now ?? Date.now)()
  const observedAtMs = bucketObservedAtMs(nowMs)
  const maxStaleMs = deps?.maxStaleMs ?? DEFAULT_MAX_STALE_MS
  const readAll = deps?.readAllContexts ?? getAllPerpMarketContexts
  const recordSnapshot = deps?.recordSnapshot ?? recordMarketFeatureSnapshot
  const prune = deps?.prune ?? pruneMarketFeatureSnapshots

  if (Math.abs(nowMs - observedAtMs) > maxStaleMs) {
    // Clock skew / delayed worker: still sample at the bucketed timestamp.
  }

  const contexts = await readAll()
  if (!contexts) {
    return {
      scanned: 0,
      qualified: 0,
      inserted: 0,
      pruned: 0,
      staleSkipped: 0,
      observedAtMs,
    }
  }

  const qualified = selectLiquidUniverse(contexts, {
    topN: deps?.topN ?? readPositiveInt('INV_AKITA_SNAPSHOT_TOP_N', DEFAULT_TOP_N),
    minimumDailyVolumeUsd:
      deps?.minimumDailyVolumeUsd ??
      readPositiveNumber('INV_AKITA_SNAPSHOT_MIN_VOLUME_USD', DEFAULT_MIN_DAILY_VOLUME_USD),
  })

  let inserted = 0
  for (const context of qualified) {
    const result = await recordSnapshot(toSnapshot(context, observedAtMs))
    if (result.inserted) inserted += 1
  }

  const pruned = await prune({ nowMs }).catch(() => 0)
  return {
    scanned: contexts.length,
    qualified: qualified.length,
    inserted,
    pruned,
    staleSkipped: 0,
    observedAtMs,
  }
}
