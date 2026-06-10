import type { getDb } from '@4626/server-core'

import { resolveCoinPriceSparkline, type CoinPriceSparklineResult } from './coinPriceSparkline.js'
import { persistExploreSparklinesToDb } from './exploreSparklineCache.js'

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>

export const DEFAULT_EXPLORE_SPARKLINE_HYDRATE_MAX = 48
export const DEFAULT_EXPLORE_SPARKLINE_HYDRATE_CONCURRENCY = 8

type ExploreEdge = {
  node?: { address?: string; trend30d?: { values?: unknown; changePercent?: unknown } }
}

function edgeHasTrend30d(node: ExploreEdge['node']): boolean {
  return Array.isArray(node?.trend30d?.values) && node.trend30d.values.length >= 2
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

/**
 * Resolve subgraph-first sparklines for visible explore rows missing cached trend30d.
 * Keeps the client on a single /api/zora/explore round-trip for first paint.
 */
export async function hydrateExploreSparklinesOnEdges(
  db: Db,
  edges: ReadonlyArray<ExploreEdge>,
  options: {
    sdk?: unknown
    maxResolve?: number
    concurrency?: number
  } = {},
): Promise<{ hydrated: number; attempted: number }> {
  const maxResolve = options.maxResolve ?? DEFAULT_EXPLORE_SPARKLINE_HYDRATE_MAX
  const concurrency = options.concurrency ?? DEFAULT_EXPLORE_SPARKLINE_HYDRATE_CONCURRENCY

  const missing: string[] = []
  for (const edge of edges) {
    const address = typeof edge?.node?.address === 'string' ? edge.node.address.toLowerCase() : ''
    if (!address || edgeHasTrend30d(edge.node)) continue
    if (!missing.includes(address)) missing.push(address)
    if (missing.length >= maxResolve) break
  }

  if (missing.length === 0) return { hydrated: 0, attempted: 0 }

  const fulfilled: CoinPriceSparklineResult[] = []
  await mapWithConcurrency(missing, concurrency, async (coinAddress) => {
    try {
      const row = await resolveCoinPriceSparkline(coinAddress, { sdk: options.sdk, chainId: 8453 })
      if (row.values.length >= 2) fulfilled.push(row)
    } catch {
      // Skip individual coin failures — explore list must still return.
    }
  })

  const byAddress = new Map(fulfilled.map((row) => [row.coinAddress, row]))
  for (const edge of edges) {
    const address = typeof edge?.node?.address === 'string' ? edge.node.address.toLowerCase() : ''
    const row = byAddress.get(address)
    if (!row || !edge?.node || edgeHasTrend30d(edge.node)) continue
    edge.node.trend30d = {
      values: row.values,
      changePercent: row.changePercent,
    }
  }

  if (fulfilled.length > 0) {
    void persistExploreSparklinesToDb(db, fulfilled).catch(() => undefined)
  }

  return { hydrated: fulfilled.length, attempted: missing.length }
}
