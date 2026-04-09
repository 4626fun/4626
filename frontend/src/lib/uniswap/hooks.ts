import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiBase'
import { classifyUniswapRequestFailure, warnUniswapRequestOnce } from './requestDiagnostics'

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

async function fetchPoolHistory(
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
