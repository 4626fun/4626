/**
 * Uniswap V4 Subgraph Client for Base
 * 
 * Queries The Graph's decentralized network for Uniswap V4 pool data.
 * Requires VITE_THEGRAPH_API_KEY environment variable.
 */

import type {
  UniswapPool,
  UniswapPoolDayData,
  UniswapPoolHourData,
  UniswapSwap,
  UniswapToken,
  UniswapTokenDayData,
  HistoricalVolumeData,
  TimeframeData,
} from './types'

// Fallback: Use our API route which handles the key securely
const API_BASE = '/api/uniswap'

type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ message: string }>
}

async function fetchGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    
    if (!response.ok) {
      console.error(`GraphQL request failed: ${response.status}`)
      return null
    }
    
    const result = (await response.json()) as GraphQLResponse<T>
    if (result.errors?.length) {
      console.error('GraphQL errors:', result.errors)
      return null
    }
    
    return result.data ?? null
  } catch (error) {
    console.error('GraphQL fetch error:', error)
    return null
  }
}

/**
 * Get pool by token address
 * Finds pools where the token is either token0 or token1
 */
export async function getPoolsByToken(tokenAddress: string): Promise<UniswapPool[]> {
  const query = `
    query GetPoolsByToken($token: String!) {
      pools0: pools(
        where: { token0: $token }
        orderBy: totalValueLockedUSD
        orderDirection: desc
        first: 10
      ) {
        id
        token0 { id symbol name decimals }
        token1 { id symbol name decimals }
        feeTier
        liquidity
        sqrtPrice
        token0Price
        token1Price
        volumeUSD
        feesUSD
        txCount
        totalValueLockedUSD
        hooks
        createdAtTimestamp
      }
      pools1: pools(
        where: { token1: $token }
        orderBy: totalValueLockedUSD
        orderDirection: desc
        first: 10
      ) {
        id
        token0 { id symbol name decimals }
        token1 { id symbol name decimals }
        feeTier
        liquidity
        sqrtPrice
        token0Price
        token1Price
        volumeUSD
        feesUSD
        txCount
        totalValueLockedUSD
        hooks
        createdAtTimestamp
      }
    }
  `
  
  const data = await fetchGraphQL<{ pools0: UniswapPool[]; pools1: UniswapPool[] }>(query, {
    token: tokenAddress.toLowerCase(),
  })
  
  if (!data) return []
  
  // Combine and dedupe pools
  const poolMap = new Map<string, UniswapPool>()
  for (const pool of [...data.pools0, ...data.pools1]) {
    poolMap.set(pool.id, pool)
  }
  
  return Array.from(poolMap.values())
}

/**
 * Get pool day data for historical volume/fees
 */
export async function getPoolDayData(
  poolId: string,
  days: number = 30
): Promise<UniswapPoolDayData[]> {
  const query = `
    query GetPoolDayData($pool: String!, $first: Int!) {
      poolDayDatas(
        where: { pool: $pool }
        orderBy: date
        orderDirection: desc
        first: $first
      ) {
        id
        date
        pool { id }
        liquidity
        sqrtPrice
        token0Price
        token1Price
        tick
        tvlUSD
        volumeToken0
        volumeToken1
        volumeUSD
        feesUSD
        txCount
        open
        high
        low
        close
      }
    }
  `
  
  const data = await fetchGraphQL<{ poolDayDatas: UniswapPoolDayData[] }>(query, {
    pool: poolId.toLowerCase(),
    first: days,
  })
  
  return data?.poolDayDatas ?? []
}

/**
 * Get pool hour data for granular historical data
 */
export async function getPoolHourData(
  poolId: string,
  hours: number = 24
): Promise<UniswapPoolHourData[]> {
  const query = `
    query GetPoolHourData($pool: String!, $first: Int!) {
      poolHourDatas(
        where: { pool: $pool }
        orderBy: periodStartUnix
        orderDirection: desc
        first: $first
      ) {
        id
        periodStartUnix
        pool { id }
        liquidity
        sqrtPrice
        token0Price
        token1Price
        tick
        tvlUSD
        volumeToken0
        volumeToken1
        volumeUSD
        feesUSD
        txCount
        open
        high
        low
        close
      }
    }
  `
  
  const data = await fetchGraphQL<{ poolHourDatas: UniswapPoolHourData[] }>(query, {
    pool: poolId.toLowerCase(),
    first: hours,
  })
  
  return data?.poolHourDatas ?? []
}

/**
 * Get token day data for historical price/volume
 */
export async function getTokenDayData(
  tokenAddress: string,
  days: number = 30
): Promise<UniswapTokenDayData[]> {
  const query = `
    query GetTokenDayData($token: String!, $first: Int!) {
      tokenDayDatas(
        where: { token: $token }
        orderBy: date
        orderDirection: desc
        first: $first
      ) {
        id
        date
        token { id symbol name }
        volume
        volumeUSD
        untrackedVolumeUSD
        totalValueLocked
        totalValueLockedUSD
        priceUSD
        feesUSD
        open
        high
        low
        close
      }
    }
  `
  
  const data = await fetchGraphQL<{ tokenDayDatas: UniswapTokenDayData[] }>(query, {
    token: tokenAddress.toLowerCase(),
    first: days,
  })
  
  return data?.tokenDayDatas ?? []
}

/**
 * Get aggregated volume/fees data for a specific timeframe
 */
export async function getTimeframeData(
  tokenAddress: string,
  timeframe: '1h' | '1d' | '1w' | '1m' | '1y'
): Promise<TimeframeData | null> {
  // Determine how much data to fetch based on timeframe
  const config = {
    '1h': { hours: 1, days: 0 },
    '1d': { hours: 24, days: 1 },
    '1w': { hours: 0, days: 7 },
    '1m': { hours: 0, days: 30 },
    '1y': { hours: 0, days: 365 },
  }[timeframe]
  
  // Get pools for this token
  const pools = await getPoolsByToken(tokenAddress)
  if (pools.length === 0) return null
  
  // Get the primary pool (highest TVL)
  const primaryPool = pools[0]
  
  let dataPoints: HistoricalVolumeData[] = []
  
  if (config.hours > 0 && config.hours <= 24) {
    // Use hour data for short timeframes
    const hourData = await getPoolHourData(primaryPool.id, config.hours)
    dataPoints = hourData.map((h) => ({
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
    // Use day data for longer timeframes
    const dayData = await getPoolDayData(primaryPool.id, config.days)
    dataPoints = dayData.map((d) => ({
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
  const tvlUSD = dataPoints[0]?.tvlUSD ?? 0
  
  // Calculate price change
  const firstPrice = dataPoints[dataPoints.length - 1]?.close ?? 0
  const lastPrice = dataPoints[0]?.close ?? 0
  const priceChangePercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0
  
  return {
    timeframe,
    volumeUSD,
    feesUSD,
    tvlUSD,
    priceChangePercent,
    dataPoints: dataPoints.reverse(), // Chronological order
  }
}

/**
 * Get token info from the subgraph
 */
export async function getToken(tokenAddress: string): Promise<UniswapToken | null> {
  const query = `
    query GetToken($id: ID!) {
      token(id: $id) {
        id
        symbol
        name
        decimals
        volume
        volumeUSD
        feesUSD
        txCount
        totalValueLocked
        totalValueLockedUSD
        derivedETH
      }
    }
  `
  
  const data = await fetchGraphQL<{ token: UniswapToken | null }>(query, {
    id: tokenAddress.toLowerCase(),
  })
  
  return data?.token ?? null
}

/**
 * Get recent swaps for a pool
 */
export async function getPoolSwaps(poolId: string, first: number = 20): Promise<UniswapSwap[]> {
  const query = `
    query GetPoolSwaps($pool: String!, $first: Int!) {
      swaps(
        where: { pool: $pool }
        orderBy: timestamp
        orderDirection: desc
        first: $first
      ) {
        id
        timestamp
        transaction { id timestamp }
        token0 { id symbol decimals }
        token1 { id symbol decimals }
        sender
        origin
        amount0
        amount1
        amountUSD
      }
    }
  `

  const data = await fetchGraphQL<{ swaps: UniswapSwap[] }>(query, {
    pool: poolId.toLowerCase(),
    first,
  })

  return data?.swaps ?? []
}
