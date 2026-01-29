import type { VercelRequest, VercelResponse } from '@vercel/node'

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
  }
  error?: string
}

async function fetchGraphQL<T>(subgraphUrl: string, query: string, variables: Record<string, unknown>): Promise<T | null> {
  const response = await fetch(subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  
  if (!response.ok) {
    console.error('GraphQL error:', response.status, await response.text())
    return null
  }
  
  const result = await response.json()
  return result.data ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
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
    
    // Step 1: Find pools for this token
    const poolsQuery = `
      query GetPoolsByToken($token: String!) {
        pools0: pools(
          where: { token0: $token }
          orderBy: totalValueLockedUSD
          orderDirection: desc
          first: 5
        ) {
          id
          totalValueLockedUSD
          volumeUSD
          feesUSD
          token0Price
          token1Price
        }
        pools1: pools(
          where: { token1: $token }
          orderBy: totalValueLockedUSD
          orderDirection: desc
          first: 5
        ) {
          id
          totalValueLockedUSD
          volumeUSD
          feesUSD
          token0Price
          token1Price
        }
      }
    `
    
    type PoolData = {
      id: string
      totalValueLockedUSD: string
      volumeUSD: string
      feesUSD: string
      token0Price: string
      token1Price: string
    }
    
    const poolsData = await fetchGraphQL<{ pools0: PoolData[]; pools1: PoolData[] }>(
      subgraphUrl,
      poolsQuery,
      { token: tokenLower }
    )

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

    return res.status(200).json({
      success: true,
      data: {
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
    console.error('Pool history error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
