import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  EXPLORE_CREATORS_METRICS_QUERY_KEY,
  LIVE_HERO_METRICS_REFETCH_MS,
  buildExploreHeroStatusLine,
  fetchExploreCreatorsMetrics,
  readCachedExploreCreatorsMetrics,
  writeCachedExploreCreatorsMetrics,
} from '@/features/explore/exploreCreatorsMetrics'

export function useExploreCreatorsHeroMetrics() {
  const metricsQuery = useQuery({
    queryKey: EXPLORE_CREATORS_METRICS_QUERY_KEY,
    queryFn: fetchExploreCreatorsMetrics,
    initialData: readCachedExploreCreatorsMetrics() ?? undefined,
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchInterval: LIVE_HERO_METRICS_REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
  })

  useEffect(() => {
    if (metricsQuery.data) writeCachedExploreCreatorsMetrics(metricsQuery.data)
  }, [metricsQuery.data])

  const metrics = metricsQuery.data
  const exact = metrics?.exact === true

  const creatorsTotal = metrics?.totals?.creatorsTotal ?? null
  const creatorsNew24h = metrics?.totals?.creatorsNew24h ?? null
  const marketCap = metrics?.totals?.creatorCoinsMarketCapUsd ?? null
  const volume24h = metrics?.totals?.creatorCoinsVolume24hUsd ?? null
  const fees24h = metrics?.totals?.creatorCoinsFees24hUsd ?? null
  const history30d = metrics?.history30d ?? []

  const statusLine = buildExploreHeroStatusLine({
    updatedAt: metrics?.updatedAt ?? null,
    exact,
    syncStatus: metrics?.syncStatus ?? 'idle',
    creatorsTotal,
    syncMeta: metrics?.sync ?? null,
  })

  return {
    metricsQuery,
    exact,
    partial: metrics?.totals?.partial === true,
    creatorsLabel: exact ? 'Creators' : 'Indexed creators',
    creatorsTotal,
    creatorsNew24h,
    marketCap,
    volume24h,
    fees24h,
    history30d,
    statusLine,
    syncStatus: metrics?.syncStatus ?? 'running',
    creatorsTotalCount: creatorsTotal ?? 0,
    isLoading: metricsQuery.isLoading && !metricsQuery.data,
    isFetching: metricsQuery.isFetching,
  }
}
