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
} from '../../../packages/server-core/src/index.js'


import { fetchExternalJson } from '../../../server/_lib/externalFetch.js'


/**
 * Uniswap V4 Subgraph GraphQL Proxy
 * 
 * Proxies GraphQL queries to The Graph's decentralized network,
 * keeping the API key secure on the server side.
 */

// The Graph API key from environment (supports both naming conventions)
const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY || process.env.GRAPH_API_KEY || ''

// Custom 4626 subgraph for Zora coins on Uniswap V4 Base
// Owner: 0xakita.eth - https://thegraph.com/studio/subgraph/4626
// Deploy with: git clone https://github.com/Uniswap/v4-subgraph && yarn generate-subgraph base && graph deploy 4626
const CUSTOM_4626_SUBGRAPH_ID = 'Gqm2b5J85n1bhCyDMpGbtbVn4935EvvdyHdHrx3dibyj'

// Override via env var if needed
const UNISWAP_V4_BASE_SUBGRAPH_ID = process.env.UNISWAP_V4_BASE_SUBGRAPH_ID || CUSTOM_4626_SUBGRAPH_ID

function getSubgraphUrl(): string {
  if (!THEGRAPH_API_KEY || !UNISWAP_V4_BASE_SUBGRAPH_ID) {
    throw new Error('Missing THEGRAPH_API_KEY or UNISWAP_V4_BASE_SUBGRAPH_ID')
  }
  return `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/${UNISWAP_V4_BASE_SUBGRAPH_ID}`
}

type GraphQLRequest = {
  query?: string
  operation?: string
  variables?: Record<string, unknown>
}

const ALLOWED_QUERY_BY_OPERATION: Record<string, string> = {
  GetPoolsByToken: `query GetPoolsByToken($token: String!) {
    pools0: pools(where: { token0: $token }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 10) {
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
    pools1: pools(where: { token1: $token }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 10) {
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
  }`,
  GetPoolHourData: `query GetPoolHourData($pool: String!, $first: Int!) {
    poolHourDatas(where: { pool: $pool }, orderBy: periodStartUnix, orderDirection: desc, first: $first) {
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
  }`,
  GetPoolDayData: `query GetPoolDayData($pool: String!, $first: Int!) {
    poolDayDatas(where: { pool: $pool }, orderBy: date, orderDirection: desc, first: $first) {
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
  }`,
  GetPoolSwaps: `query GetPoolSwaps($pool: String!, $first: Int!) {
    swaps(where: { pool: $pool }, orderBy: timestamp, orderDirection: desc, first: $first) {
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
  }`,
  GetToken: `query GetToken($id: ID!) {
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
  }`,
  GetTokenDayData: `query GetTokenDayData($token: String!, $first: Int!) {
    tokenDayDatas(where: { token: $token }, orderBy: date, orderDirection: desc, first: $first) {
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
  }`,
  HealthMeta: `query HealthMeta {
    _meta {
      block {
        number
      }
    }
  }`,
}

function extractOperationName(query: string): string | null {
  const match = query.match(/^\s*query\s+([_A-Za-z][_0-9A-Za-z]*)\b/)
  return match?.[1] ?? null
}

function hasOwn<T extends object>(obj: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('graph', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  // Check for required env vars
  if (!THEGRAPH_API_KEY) {
    logger.error('[uniswap/query] Missing THEGRAPH_API_KEY environment variable')
    return res.status(503).json({
      success: false,
      error: 'Uniswap data service not configured',
    })
  }

  try {
    const body = req.body as GraphQLRequest
    const requestedOperation =
      typeof body?.operation === 'string' && body.operation.trim()
        ? body.operation.trim()
        : typeof body?.query === 'string'
          ? extractOperationName(body.query)
          : null
    if (!requestedOperation || !hasOwn(ALLOWED_QUERY_BY_OPERATION, requestedOperation)) {
      return res.status(400).json({ success: false, error: 'Operation not allowed' })
    }
    const safeQuery = ALLOWED_QUERY_BY_OPERATION[requestedOperation]
    const safeVariables = isPlainRecord(body?.variables) ? body.variables : {}

    const subgraphUrl = getSubgraphUrl()

    const upstream = await fetchExternalJson<Record<string, unknown>>(subgraphUrl, {
      label: 'uniswap_query',
      allowedHosts: ['gateway.thegraph.com'],
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: safeQuery,
        variables: safeVariables,
      }),
      timeoutMs: 10_000,
      maxResponseBytes: 1_000_000,
    })

    // Return the GraphQL response as-is
    return res.status(upstream.status).json(upstream.data)
  } catch (error) {
    logger.error('[uniswap/query] Proxy failure', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
