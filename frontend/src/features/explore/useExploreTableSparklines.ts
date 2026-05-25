import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchExploreTableSparklines,
  mergeExploreTableSparklineMaps,
  readPersistedExploreTableSparklines,
  seedSparklinesFromCoins,
  writePersistedExploreTableSparklines,
  type ExploreTableSparkline,
} from '@/features/explore/exploreTableSparklines'
import type { ZoraCoin } from '@/lib/zora/types'

function listMissingSparklineAddresses(
  addresses: string[],
  covered: ReadonlyMap<string, ExploreTableSparkline>,
): string[] {
  return addresses.filter((address) => {
    const row = covered.get(address)
    return !row || row.values.length < 2
  })
}

export function useExploreTableSparklines(
  coinAddresses: ReadonlyArray<string | undefined | null>,
  seedCoins: ReadonlyArray<Pick<ZoraCoin, 'address' | 'trend30d'>> = [],
) {
  const normalizedAddresses = useMemo(() => {
    return [
      ...new Set(
        coinAddresses
          .map((address) => (typeof address === 'string' ? address.toLowerCase() : ''))
          .filter(Boolean),
      ),
    ].sort()
  }, [coinAddresses])

  const seededSparklines = useMemo(() => seedSparklinesFromCoins(seedCoins), [seedCoins])
  const [persistedSparklines] = useState(() => readPersistedExploreTableSparklines())

  const warmSparklines = useMemo(
    () => mergeExploreTableSparklineMaps(persistedSparklines, seededSparklines),
    [persistedSparklines, seededSparklines],
  )

  const missingAddresses = useMemo(
    () => listMissingSparklineAddresses(normalizedAddresses, warmSparklines),
    [normalizedAddresses, warmSparklines],
  )

  const query = useQuery({
    queryKey: ['explore', 'table-sparklines', missingAddresses.join(',')],
    queryFn: async () => {
      const fetched = await fetchExploreTableSparklines(missingAddresses)
      if (fetched.size > 0) writePersistedExploreTableSparklines(fetched)
      return fetched
    },
    enabled: missingAddresses.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: warmSparklines,
  })

  const sparklines = useMemo(
    () => mergeExploreTableSparklineMaps(warmSparklines, query.data),
    [warmSparklines, query.data],
  )

  return {
    sparklines,
    isLoading: query.isLoading && sparklines.size === 0,
    isFetching: query.isFetching,
  }
}
