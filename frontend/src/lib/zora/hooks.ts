import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

import {
  fetchZoraCoin,
  fetchZoraExplore,
  fetchZoraProfile,
  fetchZoraProfileCoins,
  fetchZoraTopCreators,
  normalizeZoraCoinAddress,
  normalizeZoraProfileIdentifier,
} from './client'
import type { ZoraExploreListType } from './types'

export function useZoraCoin(address?: Address) {
  const normalizedAddress = address ? normalizeZoraCoinAddress(address) : undefined
  return useQuery({
    queryKey: ['zora', 'coin', normalizedAddress],
    queryFn: async () => fetchZoraCoin(normalizedAddress as Address),
    enabled: !!normalizedAddress,
    // Coin stats change frequently; keep this fairly fresh.
    staleTime: 1000 * 60,
  })
}

export function useZoraProfile(identifier?: string) {
  const normalizedIdentifier = identifier ? normalizeZoraProfileIdentifier(identifier) : undefined
  return useQuery({
    queryKey: ['zora', 'profile', normalizedIdentifier],
    queryFn: async () => fetchZoraProfile(normalizedIdentifier as string),
    enabled: !!normalizedIdentifier,
    staleTime: 1000 * 60 * 5,
  })
}

export function useZoraExplore(list: ZoraExploreListType, params?: { count?: number; after?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['zora', 'explore', list, params?.count, params?.after],
    queryFn: async () => fetchZoraExplore({ list, count: params?.count, after: params?.after }),
    enabled: params?.enabled ?? true,
    staleTime: 1000 * 60 * 2,
  })
}

export function useZoraProfileCoins(identifier?: string, params?: { count?: number; after?: string }) {
  const normalizedIdentifier = identifier ? normalizeZoraProfileIdentifier(identifier) : undefined
  return useQuery({
    queryKey: ['zora', 'profileCoins', normalizedIdentifier, params?.count, params?.after],
    queryFn: async () =>
      fetchZoraProfileCoins({
        identifier: normalizedIdentifier as string,
        count: params?.count,
        after: params?.after,
      }),
    enabled: !!normalizedIdentifier,
    staleTime: 1000 * 60 * 5,
  })
}

export function useZoraTopCreators(params?: { count?: number; after?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['zora', 'topCreators', params?.count, params?.after],
    queryFn: async () => fetchZoraTopCreators({ count: params?.count, after: params?.after }),
    enabled: params?.enabled ?? true,
    staleTime: 1000 * 60 * 2,
  })
}
