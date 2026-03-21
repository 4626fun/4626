/**
 * React hook for checking coin migration status
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMigratedCoins, hasCoinMigratedSync } from '@/lib/zora/migrations'

/**
 * Hook to get the set of migrated coins
 * Triggers a fetch if not cached
 */
export function useMigratedCoins() {
  const [migratedCoins, setMigratedCoins] = useState<Set<string> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchMigratedCoins()
      .then((coins) => {
        if (!cancelled) {
          setMigratedCoins(coins)
          setIsLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e)
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { migratedCoins, isLoading, error }
}

/**
 * Hook to check if a specific coin has migrated
 */
export function useIsCoinMigrated(coinAddress: string | undefined): boolean | undefined {
  const normalized = useMemo(() => {
    return coinAddress ? coinAddress.toLowerCase() : null
  }, [coinAddress])

  const syncResult = useMemo(() => {
    if (!coinAddress) return undefined
    return hasCoinMigratedSync(coinAddress)
  }, [coinAddress])

  const query = useQuery({
    queryKey: ['migrations', 'isCoinMigrated', normalized],
    enabled: Boolean(normalized && syncResult === undefined),
    queryFn: async () => {
      const coins = await fetchMigratedCoins()
      return coins.has(normalized as string)
    },
    staleTime: 60_000,
    retry: 0,
  })

  if (!normalized) return undefined
  if (syncResult !== undefined) return syncResult
  return query.data
}

/**
 * Batch check for multiple coins
 * More efficient than individual checks
 */
export function useBatchMigrationCheck(coinAddresses: string[]): Map<string, boolean> {
  const { migratedCoins, isLoading } = useMigratedCoins()
  return useMemo(() => {
    const out = new Map<string, boolean>()
    if (isLoading || !migratedCoins) return out
    for (const addr of coinAddresses) {
      out.set(addr.toLowerCase(), migratedCoins.has(addr.toLowerCase()))
    }
    return out
  }, [coinAddresses, migratedCoins, isLoading])
}
