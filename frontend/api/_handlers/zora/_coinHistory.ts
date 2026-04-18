import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  isAddressLike,
  requireServerKey,
  setCache,
  setCors,
} from '../../../server/zora/_shared.js'

/**
 * GET /api/zora/coinHistory?token=0x…&timeframe=1d
 *
 * Derives OHLCV candles for a Zora coin from its swap activity feed
 * (`@zoralabs/coins-sdk > getCoinSwaps`). Returned shape is intentionally
 * compatible with `/api/uniswap/poolHistory` so the same chart component
 * can consume either source.
 *
 * Intended as a fallback when the Uniswap 4626 subgraph has no history for
 * a newly-deployed coin. `liquidity` and `fees` fields are emitted as 0
 * because the Zora API does not expose pool TVL or LP fee accruals; those
 * remain a Uniswap-subgraph-only concern.
 */

type Timeframe = '1h' | '1d' | '1w' | '1m' | '1y'

const TIMEFRAME_CONFIG: Record<
  Timeframe,
  { bucketMs: number; buckets: number; swapsToFetch: number }
> = {
  // `1h` is a single bucket covering the last 60m. For a proper chart we
  // still return `buckets` buckets so there's something to render.
  '1h': { bucketMs: 5 * 60 * 1000, buckets: 12, swapsToFetch: 200 },
  '1d': { bucketMs: 60 * 60 * 1000, buckets: 24, swapsToFetch: 300 },
  '1w': { bucketMs: 24 * 60 * 60 * 1000, buckets: 7, swapsToFetch: 400 },
  '1m': { bucketMs: 24 * 60 * 60 * 1000, buckets: 30, swapsToFetch: 500 },
  '1y': { bucketMs: 24 * 60 * 60 * 1000, buckets: 365, swapsToFetch: 500 },
}

type HistoricalPoint = {
  timestamp: number
  volumeUSD: number
  feesUSD: number
  tvlUSD: number
  open?: number
  high?: number
  low?: number
  close?: number
}

type CoinHistoryEnvelope = {
  success: boolean
  data?: {
    tokenAddress: string
    timeframe: string
    poolId: string | null
    volumeUSD: number
    feesUSD: number
    tvlUSD: number
    priceChangePercent: number
    dataPoints: HistoricalPoint[]
  }
  error?: string
}

type SwapNode = {
  blockTimestamp?: string
  activityType?: string | null
  coinAmount?: string
  currencyAmountWithPrice?: {
    priceUsdc?: string | null
    currencyAmount?: {
      amountDecimal?: number | null
    }
  }
}

function parsePrice(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string') return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Zora ZORA-20 content coins always use 18 decimals. Scale from wei into
// whole-coin units so `price * coinAmount` yields a real USD notional.
const COIN_DECIMALS_SCALE = 1e18

function parseCoinAmount(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n / COIN_DECIMALS_SCALE
}

function bucketKey(timestampMs: number, bucketMs: number): number {
  return Math.floor(timestampMs / bucketMs) * bucketMs
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies CoinHistoryEnvelope)
  }

  const key = requireServerKey()
  if (!key) {
    return res
      .status(503)
      .json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' } satisfies CoinHistoryEnvelope)
  }

  const token = getStringQuery(req, 'token') ?? getStringQuery(req, 'address')
  if (!token || !isAddressLike(token)) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid token address' } satisfies CoinHistoryEnvelope)
  }

  const rawTimeframe = (getStringQuery(req, 'timeframe') ?? '1d') as Timeframe
  const config = TIMEFRAME_CONFIG[rawTimeframe]
  if (!config) {
    return res.status(400).json({
      success: false,
      error: `Invalid timeframe. Use: ${Object.keys(TIMEFRAME_CONFIG).join(', ')}`,
    } satisfies CoinHistoryEnvelope)
  }

  const chain = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const swaps = await sdk.getCoinSwaps({
      address: token as Address,
      chain,
      first: config.swapsToFetch,
    })

    const edges: Array<{ node?: SwapNode }> =
      swaps?.data?.zora20Token?.swapActivities?.edges ?? []

    // Filter down to the requested window and parse. Swaps come back in
    // descending-time order; we want ascending for candle construction.
    const windowStartMs = Date.now() - config.bucketMs * config.buckets
    const parsed = edges
      .map((edge) => {
        const node = edge?.node
        if (!node?.blockTimestamp) return null
        const tsMs = Date.parse(node.blockTimestamp)
        if (!Number.isFinite(tsMs)) return null
        if (tsMs < windowStartMs) return null
        const price = parsePrice(node.currencyAmountWithPrice?.priceUsdc)
        if (price == null) return null
        const coinAmount = parseCoinAmount(node.coinAmount)
        // USD notional for this swap = price per coin × coins traded.
        const volumeUSD = coinAmount != null ? price * coinAmount : 0
        return { tsMs, price, volumeUSD }
      })
      .filter((p): p is { tsMs: number; price: number; volumeUSD: number } => Boolean(p))
      .sort((a, b) => a.tsMs - b.tsMs)

    // If no swaps in the window, return an empty but successful envelope so
    // the client can decide how to render.
    if (parsed.length === 0) {
      setCache(res, 60)
      return res.status(200).json({
        success: true,
        data: {
          tokenAddress: token,
          timeframe: rawTimeframe,
          poolId: null,
          volumeUSD: 0,
          feesUSD: 0,
          tvlUSD: 0,
          priceChangePercent: 0,
          dataPoints: [],
        },
      } satisfies CoinHistoryEnvelope)
    }

    // Bucket into OHLCV candles.
    type Bucket = {
      timestamp: number
      open: number
      high: number
      low: number
      close: number
      volumeUSD: number
    }
    const buckets = new Map<number, Bucket>()
    for (const p of parsed) {
      const key = bucketKey(p.tsMs, config.bucketMs)
      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          timestamp: Math.floor(key / 1000),
          open: p.price,
          high: p.price,
          low: p.price,
          close: p.price,
          volumeUSD: p.volumeUSD,
        })
      } else {
        // swaps are sorted ascending, so the first write establishes `open`
        // and each subsequent write overwrites `close`.
        existing.close = p.price
        if (p.price > existing.high) existing.high = p.price
        if (p.price < existing.low) existing.low = p.price
        existing.volumeUSD += p.volumeUSD
      }
    }

    const ordered = [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp)

    // Forward-fill flat candles into any empty buckets between the first and
    // last observed swap so the chart reads continuously.
    const dense: HistoricalPoint[] = []
    const firstKey = ordered[0].timestamp * 1000
    const lastKey = ordered[ordered.length - 1].timestamp * 1000
    let cursorPrice = ordered[0].open
    const byKey = new Map(ordered.map((b) => [b.timestamp * 1000, b]))
    for (let k = firstKey; k <= lastKey; k += config.bucketMs) {
      const bucket = byKey.get(k)
      if (bucket) {
        cursorPrice = bucket.close
        dense.push({
          timestamp: bucket.timestamp,
          volumeUSD: bucket.volumeUSD,
          feesUSD: 0,
          tvlUSD: 0,
          open: bucket.open,
          high: bucket.high,
          low: bucket.low,
          close: bucket.close,
        })
      } else {
        dense.push({
          timestamp: Math.floor(k / 1000),
          volumeUSD: 0,
          feesUSD: 0,
          tvlUSD: 0,
          open: cursorPrice,
          high: cursorPrice,
          low: cursorPrice,
          close: cursorPrice,
        })
      }
    }

    const totalVolumeUSD = dense.reduce((sum, p) => sum + p.volumeUSD, 0)
    const firstClose = dense[0]?.close ?? 0
    const lastClose = dense[dense.length - 1]?.close ?? 0
    const priceChangePercent =
      firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0

    setCache(res, 60)
    return res.status(200).json({
      success: true,
      data: {
        tokenAddress: token,
        timeframe: rawTimeframe,
        poolId: null,
        volumeUSD: totalVolumeUSD,
        feesUSD: 0,
        tvlUSD: 0,
        priceChangePercent,
        dataPoints: dense,
      },
    } satisfies CoinHistoryEnvelope)
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500
    return res.status(status).json({
      success: false,
      error: error?.message || 'Failed to derive coin history',
    } satisfies CoinHistoryEnvelope)
  }
}
