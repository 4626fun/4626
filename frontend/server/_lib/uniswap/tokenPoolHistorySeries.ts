import { fetchExternalJson } from '../infra/externalFetch.js'
import { logger } from '../infra/logger.js'

const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY || process.env.GRAPH_API_KEY || ''
const CUSTOM_4626_SUBGRAPH_ID = 'Gqm2b5J85n1bhCyDMpGbtbVn4935EvvdyHdHrx3dibyj'
const UNISWAP_V4_BASE_SUBGRAPH_ID = process.env.UNISWAP_V4_BASE_SUBGRAPH_ID || CUSTOM_4626_SUBGRAPH_ID

export type TokenPoolDayCloseSeries = {
  values: number[]
  changePercent: number | null
  poolId: string | null
}

type PoolData = {
  id: string
  totalValueLockedUSD: string
}

type DayData = {
  date: number
  close: string
}

function getSubgraphUrl(): string | null {
  if (!THEGRAPH_API_KEY || !UNISWAP_V4_BASE_SUBGRAPH_ID) return null
  return `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/${UNISWAP_V4_BASE_SUBGRAPH_ID}`
}

async function fetchGraphQL<T>(subgraphUrl: string, query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const { data: result } = await fetchExternalJson<{ data?: T }>(subgraphUrl, {
      label: 'uniswap_token_pool_history_series',
      allowedHosts: ['gateway.thegraph.com'],
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      timeoutMs: 10_000,
      maxResponseBytes: 512_000,
    })
    return result.data ?? null
  } catch (error) {
    logger.warn('[uniswap/tokenPoolHistorySeries] GraphQL upstream rejected', error)
    return null
  }
}

export function buildSparklineFromDailyCloses(closes: ReadonlyArray<number>): Omit<TokenPoolDayCloseSeries, 'poolId'> {
  const values = closes.filter((value) => Number.isFinite(value) && value > 0)
  if (values.length < 2) {
    return { values: [], changePercent: null }
  }
  const firstClose = values[0] ?? 0
  const lastClose = values[values.length - 1] ?? 0
  const changePercent = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : null
  return { values: [...values], changePercent }
}

/**
 * Uniswap V4 subgraph path for 30d daily closes (PoolDayData.close).
 * Mirrors `/api/uniswap/poolHistory?timeframe=1m` without HTTP overhead.
 */
export async function fetchTokenPoolDayCloseSeries(
  tokenAddress: string,
  dataPoints = 30,
): Promise<TokenPoolDayCloseSeries | null> {
  const subgraphUrl = getSubgraphUrl()
  if (!subgraphUrl) return null

  const tokenLower = tokenAddress.toLowerCase()
  const poolsQuery = `
    query GetPoolsByToken($token: String!) {
      pools0: pools(
        where: { token0: $token }
        orderBy: totalValueLockedUSD
        orderDirection: desc
        first: 5
      ) { id totalValueLockedUSD }
      pools1: pools(
        where: { token1: $token }
        orderBy: totalValueLockedUSD
        orderDirection: desc
        first: 5
      ) { id totalValueLockedUSD }
    }
  `

  const poolsData = await fetchGraphQL<{ pools0: PoolData[]; pools1: PoolData[] }>(subgraphUrl, poolsQuery, {
    token: tokenLower,
  })
  const allPools = [...(poolsData?.pools0 ?? []), ...(poolsData?.pools1 ?? [])]
  if (allPools.length === 0) return null

  const primaryPool = allPools.sort(
    (a, b) => parseFloat(b.totalValueLockedUSD) - parseFloat(a.totalValueLockedUSD),
  )[0]
  if (!primaryPool?.id) return null

  const dayQuery = `
    query GetPoolDayData($pool: String!, $first: Int!) {
      poolDayDatas(
        where: { pool: $pool }
        orderBy: date
        orderDirection: desc
        first: $first
      ) {
        date
        close
      }
    }
  `

  const dayData = await fetchGraphQL<{ poolDayDatas: DayData[] }>(subgraphUrl, dayQuery, {
    pool: primaryPool.id,
    first: dataPoints,
  })

  const closes = (dayData?.poolDayDatas ?? [])
    .map((row) => parseFloat(row.close))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reverse()

  const built = buildSparklineFromDailyCloses(closes)
  if (built.values.length < 2) return null

  return {
    ...built,
    poolId: primaryPool.id,
  }
}
