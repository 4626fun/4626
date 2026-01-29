import { useQuery } from '@tanstack/react-query'

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

async function fetchPoolHistory(
  tokenAddress: string,
  timeframe: string
): Promise<PoolHistoryData | null> {
  try {
    const response = await fetch(
      `/api/uniswap/poolHistory?token=${encodeURIComponent(tokenAddress)}&timeframe=${timeframe}`
    )
    
    if (!response.ok) {
      console.error('Pool history fetch failed:', response.status)
      return null
    }
    
    const result = (await response.json()) as ApiResponse
    return result.data ?? null
  } catch (error) {
    console.error('Pool history error:', error)
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
        const response = await fetch('/api/uniswap/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: '{ _meta { block { number } } }',
          }),
        })
        
        if (response.status === 503) {
          // Service not configured
          return { available: false, reason: 'not-configured' }
        }
        
        if (!response.ok) {
          return { available: false, reason: 'error' }
        }
        
        return { available: true, reason: null }
      } catch {
        return { available: false, reason: 'network-error' }
      }
    },
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 30 * 60_000, // 30 minutes
  })
}
