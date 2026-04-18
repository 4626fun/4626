import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleOptions,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  logger,
  readRequestPrincipalAddress,
} from '../../../packages/server-core/src/index.js'


import { fetchExternalJson } from '../../../server/_lib/infra/externalFetch.js'


/**
 * Get historical pool data for a token
 * 
 * Query: GET /api/uniswap/poolHistory?token=0x...&timeframe=1d
 * 
 * Timeframes:
 * - 1h: Last hour (hourly data)
 * - 1d: Last 24 hours (hourly data)
 * - 1w: Last 7 days (daily data)
 * - 1m: Last 30 days (daily data)
 * - 1y: Last 365 days (daily data)
 */

// The Graph API key from environment (supports both naming conventions)
const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY || process.env.GRAPH_API_KEY || ''

// Custom 4626 subgraph for Zora coins on Uniswap V4 Base
// Owner: 0xakita.eth - https://thegraph.com/studio/subgraph/4626
// Deploy with: git clone https://github.com/Uniswap/v4-subgraph && yarn generate-subgraph base && graph deploy 4626
const CUSTOM_4626_SUBGRAPH_ID = 'Gqm2b5J85n1bhCyDMpGbtbVn4935EvvdyHdHrx3dibyj'

const UNISWAP_V4_BASE_SUBGRAPH_ID = process.env.UNISWAP_V4_BASE_SUBGRAPH_ID || CUSTOM_4626_SUBGRAPH_ID

function getSubgraphUrl(): string {
  if (!THEGRAPH_API_KEY || !UNISWAP_V4_BASE_SUBGRAPH_ID) {
    throw new Error('Missing THEGRAPH_API_KEY or UNISWAP_V4_BASE_SUBGRAPH_ID')
  }
  return `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/${UNISWAP_V4_BASE_SUBGRAPH_ID}`
}

type TimeframeConfig = {
  useHourData: boolean
  dataPoints: number
}

const TIMEFRAME_CONFIG: Record<string, TimeframeConfig> = {
  '1h': { useHourData: true, dataPoints: 1 },
  '1d': { useHourData: true, dataPoints: 24 },
  '1w': { useHourData: false, dataPoints: 7 },
  '1m': { useHourData: false, dataPoints: 30 },
  '1y': { useHourData: false, dataPoints: 365 },
}

type HistoricalData = {
  timestamp: number
  volumeUSD: number
  feesUSD: number
  tvlUSD: number
  priceUSD?: number
  open?: number
  high?: number
  low?: number
  close?: number
}

/**
 * Current-snapshot breakdown of the pool's two tokens.
 *
 * We emit USD shares (0..1) rather than raw token amounts so the client
 * can multiply historical `tvlUSD` values by them to render a stacked
 * composition view. Shares are a best-effort approximation: the subgraph
 * only exposes current-state liquidity per token, so applying the current
 * ratio historically will drift whenever the pool's composition shifted.
 */
type PoolTokenComposition = {
  token0Symbol: string | null
  token1Symbol: string | null
  token0UsdShare: number | null
  token1UsdShare: number | null
  token0UsdTVL: number | null
  token1UsdTVL: number | null
  /**
   * Whether `token0` corresponds to the `?token=` the caller asked about
   * (vs `token1`). Lets the UI label the creator coin side consistently.
   */
  isQueriedTokenToken0: boolean
}

type PoolHistoryResponse = {
  success: boolean
  data?: {
    tokenAddress: string
    timeframe: string
    poolId: string | null
    volumeUSD: number
    feesUSD: number
    tvlUSD: number
    priceChangePercent: number
    dataPoints: HistoricalData[]
    pool?: PoolTokenComposition | null
  }
  error?: string
}

async function fetchGraphQL<T>(subgraphUrl: string, query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const { data: result } = await fetchExternalJson<{ data?: T }>(subgraphUrl, {
      label: 'uniswap_pool_history',
      allowedHosts: ['gateway.thegraph.com'],
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      timeoutMs: 10_000,
      maxResponseBytes: 1_000_000,
    })
    return result.data ?? null
  } catch (error) {
    logger.warn('[uniswap/poolHistory] GraphQL upstream rejected', error)
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('graph', principalAddress, clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  if (!THEGRAPH_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Uniswap data service not configured',
    })
  }

  const { token, timeframe = '1d' } = req.query
  
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing token address' })
  }

  const config = TIMEFRAME_CONFIG[timeframe as string]
  if (!config) {
    return res.status(400).json({
      success: false,
      error: `Invalid timeframe. Use: ${Object.keys(TIMEFRAME_CONFIG).join(', ')}`,
    })
  }

  try {
    const subgraphUrl = getSubgraphUrl()
    const tokenLower = token.toLowerCase()
    
    // Step 1: Find pools for this token. We request per-token liquidity and
    // symbols so the client can render a composition view for liquidity,
    // but the fragment is forgiving — if the subgraph variant is missing
    // any of these optional fields, computeComposition() below falls back
    // to null and the client degrades to a single TVL bar.
    const POOL_FIELDS = `
      id
      totalValueLockedUSD
      volumeUSD
      feesUSD
      token0Price
      token1Price
      totalValueLockedToken0
      totalValueLockedToken1
      token0 { id symbol decimals derivedETH }
      token1 { id symbol decimals derivedETH }
    `
    const poolsQuery = `
      query GetPoolsByToken($token: String!) {
        pools0: pools(
          where: { token0: $token }
          orderBy: totalValueLockedUSD
          orderDirection: desc
          first: 5
        ) { ${POOL_FIELDS} }
        pools1: pools(
          where: { token1: $token }
          orderBy: totalValueLockedUSD
          orderDirection: desc
          first: 5
        ) { ${POOL_FIELDS} }
        bundles(first: 1) { ethPriceUSD }
      }
    `

    type TokenMeta = {
      id?: string | null
      symbol?: string | null
      decimals?: string | null
      derivedETH?: string | null
    }

    type PoolData = {
      id: string
      totalValueLockedUSD: string
      volumeUSD: string
      feesUSD: string
      token0Price: string
      token1Price: string
      totalValueLockedToken0?: string | null
      totalValueLockedToken1?: string | null
      token0?: TokenMeta | null
      token1?: TokenMeta | null
    }
    
    const poolsData = await fetchGraphQL<{
      pools0: PoolData[]
      pools1: PoolData[]
      bundles?: Array<{ ethPriceUSD?: string | null }>
    }>(subgraphUrl, poolsQuery, { token: tokenLower })

    if (!poolsData) {
      return res.status(200).json({
        success: true,
        data: {
          tokenAddress: token,
          timeframe,
          poolId: null,
          volumeUSD: 0,
          feesUSD: 0,
          tvlUSD: 0,
          priceChangePercent: 0,
          dataPoints: [],
        },
      } as PoolHistoryResponse)
    }

    // Get the primary pool (highest TVL)
    const allPools = [...poolsData.pools0, ...poolsData.pools1]
    if (allPools.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          tokenAddress: token,
          timeframe,
          poolId: null,
          volumeUSD: 0,
          feesUSD: 0,
          tvlUSD: 0,
          priceChangePercent: 0,
          dataPoints: [],
        },
      } as PoolHistoryResponse)
    }

    const primaryPool = allPools.sort(
      (a, b) => parseFloat(b.totalValueLockedUSD) - parseFloat(a.totalValueLockedUSD)
    )[0]

    // Step 2: Get historical data
    let dataPoints: HistoricalData[] = []

    if (config.useHourData) {
      const hourQuery = `
        query GetPoolHourData($pool: String!, $first: Int!) {
          poolHourDatas(
            where: { pool: $pool }
            orderBy: periodStartUnix
            orderDirection: desc
            first: $first
          ) {
            periodStartUnix
            tvlUSD
            volumeUSD
            feesUSD
            open
            high
            low
            close
          }
        }
      `
      
      type HourData = {
        periodStartUnix: number
        tvlUSD: string
        volumeUSD: string
        feesUSD: string
        open: string
        high: string
        low: string
        close: string
      }
      
      const hourData = await fetchGraphQL<{ poolHourDatas: HourData[] }>(
        subgraphUrl,
        hourQuery,
        { pool: primaryPool.id, first: config.dataPoints }
      )

      dataPoints = (hourData?.poolHourDatas ?? []).map((h) => ({
        timestamp: h.periodStartUnix,
        volumeUSD: parseFloat(h.volumeUSD) || 0,
        feesUSD: parseFloat(h.feesUSD) || 0,
        tvlUSD: parseFloat(h.tvlUSD) || 0,
        open: parseFloat(h.open) || 0,
        high: parseFloat(h.high) || 0,
        low: parseFloat(h.low) || 0,
        close: parseFloat(h.close) || 0,
      }))
    } else {
      const dayQuery = `
        query GetPoolDayData($pool: String!, $first: Int!) {
          poolDayDatas(
            where: { pool: $pool }
            orderBy: date
            orderDirection: desc
            first: $first
          ) {
            date
            tvlUSD
            volumeUSD
            feesUSD
            open
            high
            low
            close
          }
        }
      `
      
      type DayData = {
        date: number
        tvlUSD: string
        volumeUSD: string
        feesUSD: string
        open: string
        high: string
        low: string
        close: string
      }
      
      const dayData = await fetchGraphQL<{ poolDayDatas: DayData[] }>(
        subgraphUrl,
        dayQuery,
        { pool: primaryPool.id, first: config.dataPoints }
      )

      dataPoints = (dayData?.poolDayDatas ?? []).map((d) => ({
        timestamp: d.date,
        volumeUSD: parseFloat(d.volumeUSD) || 0,
        feesUSD: parseFloat(d.feesUSD) || 0,
        tvlUSD: parseFloat(d.tvlUSD) || 0,
        open: parseFloat(d.open) || 0,
        high: parseFloat(d.high) || 0,
        low: parseFloat(d.low) || 0,
        close: parseFloat(d.close) || 0,
      }))
    }

    // Calculate aggregates
    const volumeUSD = dataPoints.reduce((sum, d) => sum + d.volumeUSD, 0)
    const feesUSD = dataPoints.reduce((sum, d) => sum + d.feesUSD, 0)
    const tvlUSD = dataPoints[0]?.tvlUSD ?? parseFloat(primaryPool.totalValueLockedUSD) ?? 0

    // Price change
    const firstPrice = dataPoints[dataPoints.length - 1]?.close ?? 0
    const lastPrice = dataPoints[0]?.close ?? 0
    const priceChangePercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0

    // Current-snapshot pool composition (best-effort). Uses the subgraph's
    // `totalValueLockedToken{0,1} * token{0,1}.derivedETH * bundle.ethPriceUSD`
    // to derive per-side USD TVL. If any required field is missing we fall
    // back to null so the client can render a simple (non-stacked) bar.
    const ethPriceUSD = parseFloat(poolsData?.bundles?.[0]?.ethPriceUSD ?? '')
    const t0 = primaryPool.token0
    const t1 = primaryPool.token1
    const t0Amount = parseFloat(primaryPool.totalValueLockedToken0 ?? '')
    const t1Amount = parseFloat(primaryPool.totalValueLockedToken1 ?? '')
    const t0DerivedETH = parseFloat(t0?.derivedETH ?? '')
    const t1DerivedETH = parseFloat(t1?.derivedETH ?? '')
    let pool: PoolTokenComposition | null = null
    if (
      t0 &&
      t1 &&
      Number.isFinite(ethPriceUSD) &&
      ethPriceUSD > 0 &&
      Number.isFinite(t0Amount) &&
      Number.isFinite(t1Amount) &&
      Number.isFinite(t0DerivedETH) &&
      Number.isFinite(t1DerivedETH)
    ) {
      const t0UsdTVL = t0Amount * t0DerivedETH * ethPriceUSD
      const t1UsdTVL = t1Amount * t1DerivedETH * ethPriceUSD
      const totalUsd = t0UsdTVL + t1UsdTVL
      if (totalUsd > 0) {
        pool = {
          token0Symbol: t0.symbol ?? null,
          token1Symbol: t1.symbol ?? null,
          token0UsdTVL: t0UsdTVL,
          token1UsdTVL: t1UsdTVL,
          token0UsdShare: t0UsdTVL / totalUsd,
          token1UsdShare: t1UsdTVL / totalUsd,
          isQueriedTokenToken0: (t0.id ?? '').toLowerCase() === tokenLower,
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        pool,
        tokenAddress: token,
        timeframe,
        poolId: primaryPool.id,
        volumeUSD,
        feesUSD,
        tvlUSD,
        priceChangePercent,
        dataPoints: dataPoints.reverse(), // Chronological order
      },
    } as PoolHistoryResponse)
  } catch (error) {
    logger.error('[uniswap/poolHistory] Proxy failure', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
