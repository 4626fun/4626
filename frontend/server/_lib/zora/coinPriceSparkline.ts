import type { Address } from 'viem'

export type CoinSparklineTimeframe = '1m'

export type CoinPriceSparklineResult = {
  coinAddress: string
  values: number[]
  changePercent: number | null
}

const SPARKLINE_CONFIG: Record<
  CoinSparklineTimeframe,
  { bucketMs: number; buckets: number; swapsToFetch: number }
> = {
  '1m': { bucketMs: 24 * 60 * 60 * 1000, buckets: 30, swapsToFetch: 180 },
}

type SwapNode = {
  blockTimestamp?: string
  coinAmount?: string
  currencyAmountWithPrice?: {
    priceUsdc?: string | null
  }
}

function parsePrice(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string') return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function bucketKey(timestampMs: number, bucketMs: number): number {
  return Math.floor(timestampMs / bucketMs) * bucketMs
}

export function buildCoinPriceSparklineFromSwapEdges(
  edges: ReadonlyArray<{ node?: SwapNode }>,
  timeframe: CoinSparklineTimeframe = '1m',
): Omit<CoinPriceSparklineResult, 'coinAddress'> {
  const config = SPARKLINE_CONFIG[timeframe]
  const windowStartMs = Date.now() - config.bucketMs * config.buckets

  const parsed = edges
    .map((edge) => {
      const node = edge?.node
      if (!node?.blockTimestamp) return null
      const tsMs = Date.parse(node.blockTimestamp)
      if (!Number.isFinite(tsMs) || tsMs < windowStartMs) return null
      const price = parsePrice(node.currencyAmountWithPrice?.priceUsdc)
      if (price == null) return null
      return { tsMs, price }
    })
    .filter((entry): entry is { tsMs: number; price: number } => Boolean(entry))
    .sort((a, b) => a.tsMs - b.tsMs)

  if (parsed.length === 0) {
    return { values: [], changePercent: null }
  }

  type Bucket = { timestamp: number; close: number }
  const buckets = new Map<number, Bucket>()
  for (const point of parsed) {
    const key = bucketKey(point.tsMs, config.bucketMs)
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, { timestamp: Math.floor(key / 1000), close: point.price })
    } else {
      existing.close = point.price
    }
  }

  const ordered = [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp)
  const values = ordered.map((bucket) => bucket.close)
  const firstClose = values[0] ?? 0
  const lastClose = values[values.length - 1] ?? 0
  const changePercent =
    firstClose > 0 && values.length >= 2 ? ((lastClose - firstClose) / firstClose) * 100 : null

  return { values, changePercent }
}

export async function fetchCoinPriceSparkline(
  sdk: any,
  coinAddress: string,
  chainId: number,
  timeframe: CoinSparklineTimeframe = '1m',
): Promise<CoinPriceSparklineResult> {
  const config = SPARKLINE_CONFIG[timeframe]
  const swaps = await sdk.getCoinSwaps({
    address: coinAddress as Address,
    chain: chainId,
    first: config.swapsToFetch,
  })
  const edges: Array<{ node?: SwapNode }> = swaps?.data?.zora20Token?.swapActivities?.edges ?? []
  const built = buildCoinPriceSparklineFromSwapEdges(edges, timeframe)
  return {
    coinAddress: coinAddress.toLowerCase(),
    ...built,
  }
}
