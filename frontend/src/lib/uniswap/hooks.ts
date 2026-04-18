import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/apiBase'
import { classifyUniswapRequestFailure, warnUniswapRequestOnce } from './requestDiagnostics'

export type PoolTokenComposition = {
  token0Symbol: string | null
  token1Symbol: string | null
  token0UsdShare: number | null
  token1UsdShare: number | null
  token0UsdTVL: number | null
  token1UsdTVL: number | null
  isQueriedTokenToken0: boolean
}

export type PoolHistoryData = {
  tokenAddress: string
  timeframe: string
  poolId: string | null
  volumeUSD: number
  feesUSD: number
  tvlUSD: number
  priceChangePercent: number
  dataPoints: Array<{
    timestamp: number
    volumeUSD: number
    feesUSD: number
    tvlUSD: number
    open?: number
    high?: number
    low?: number
    close?: number
  }>
  pool?: PoolTokenComposition | null
}

type ApiResponse = {
  success: boolean
  data?: PoolHistoryData
  error?: string
}

type UniswapServiceReason =
  | 'auth-required'
  | 'forbidden'
  | 'rate-limited'
  | 'not-configured'
  | 'network-error'
  | 'error'

function toServiceReason(status: number | null): UniswapServiceReason {
  const failure = classifyUniswapRequestFailure(status)
  if (failure.code === 'auth-required') return 'auth-required'
  if (failure.code === 'forbidden') return 'forbidden'
  if (failure.code === 'rate-limited') return 'rate-limited'
  if (failure.code === 'not-configured') return 'not-configured'
  if (failure.code === 'network-error') return 'network-error'
  return 'error'
}

async function fetchUniswapPoolHistory(
  tokenAddress: string,
  timeframe: string
): Promise<PoolHistoryData | null> {
  try {
    const response = await apiFetch(
      `/api/uniswap/poolHistory?token=${encodeURIComponent(tokenAddress)}&timeframe=${timeframe}`
    )

    if (!response.ok) {
      warnUniswapRequestOnce({
        scope: 'pool-history',
        failure: classifyUniswapRequestFailure(response.status),
        detail: `timeframe=${timeframe}`,
      })
      return null
    }

    const result = (await response.json().catch(() => null)) as ApiResponse | null
    if (!result?.success || !result.data) {
      warnUniswapRequestOnce({
        scope: 'pool-history',
        failure: classifyUniswapRequestFailure(502),
        detail: result?.error ?? 'invalid-envelope',
      })
      return null
    }
    return result.data ?? null
  } catch {
    warnUniswapRequestOnce({
      scope: 'pool-history-network',
      failure: classifyUniswapRequestFailure(null),
    })
    return null
  }
}

/**
 * Derives history from Zora swap activity. Used as a fallback when the
 * Uniswap subgraph returns no data points for a recently-deployed coin.
 * Note: liquidity/fees remain 0 from this source (Zora does not expose
 * pool TVL or LP fees) — the chart will correctly render `price` and
 * `volume` and show an empty state for the other two metrics.
 */
async function fetchZoraCoinHistory(
  tokenAddress: string,
  timeframe: string
): Promise<PoolHistoryData | null> {
  try {
    const response = await apiFetch(
      `/api/zora/coinHistory?token=${encodeURIComponent(tokenAddress)}&timeframe=${timeframe}`
    )
    if (!response.ok) return null
    const result = (await response.json().catch(() => null)) as ApiResponse | null
    if (!result?.success || !result.data) return null
    return result.data ?? null
  } catch {
    return null
  }
}

async function fetchPoolHistory(
  tokenAddress: string,
  timeframe: string
): Promise<PoolHistoryData | null> {
  const primary = await fetchUniswapPoolHistory(tokenAddress, timeframe)
  if (primary && primary.dataPoints.length > 0) return primary

  // Fallback: if the Uniswap subgraph has no history for this coin, try
  // deriving candles from Zora swap activity. This covers brand-new coins
  // that the 4626 subgraph hasn't indexed yet.
  const fallback = await fetchZoraCoinHistory(tokenAddress, timeframe)
  if (fallback && fallback.dataPoints.length > 0) return fallback

  // Both empty — return whichever is non-null so callers still see pool
  // metadata (e.g. subgraph-known pool id with zero history).
  return primary ?? fallback ?? null
}

/**
 * Hook to fetch historical pool data for a token
 * 
 * @param tokenAddress - The token contract address
 * @param timeframe - One of: 1h, 1d, 1w, 1m, 1y
 * @param options - Query options (enabled, etc.)
 */
export function usePoolHistory(
  tokenAddress: string | undefined,
  timeframe: '1h' | '1d' | '1w' | '1m' | '1y' = '1d',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['uniswap', 'poolHistory', tokenAddress, timeframe],
    queryFn: () => fetchPoolHistory(tokenAddress!, timeframe),
    enabled: Boolean(tokenAddress) && options?.enabled !== false,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
    retry: 1,
  })
}

/**
 * Check if Uniswap data service is available
 * This can be used to conditionally enable timeframe filters
 */
export function useUniswapServiceStatus() {
  return useQuery({
    queryKey: ['uniswap', 'status'],
    queryFn: async () => {
      try {
        // Try a minimal query to check if service is configured
        const response = await apiFetch('/api/uniswap/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'HealthMeta',
            query: 'query HealthMeta { _meta { block { number } } }',
          }),
        })

        if (!response.ok) {
          const failure = classifyUniswapRequestFailure(response.status)
          warnUniswapRequestOnce({
            scope: 'status',
            failure,
          })
          return { available: false, reason: toServiceReason(response.status) }
        }

        return { available: true, reason: null }
      } catch {
        warnUniswapRequestOnce({
          scope: 'status-network',
          failure: classifyUniswapRequestFailure(null),
        })
        return { available: false, reason: 'network-error' }
      }
    },
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 30 * 60_000, // 30 minutes
  })
}
