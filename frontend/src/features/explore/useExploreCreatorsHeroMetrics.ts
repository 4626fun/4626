import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useMigratedCoins } from '@/hooks/useMigratedCoins'
import {
  EXPLORE_CREATORS_METRICS_QUERY_KEY,
  LIVE_HERO_METRICS_REFETCH_MS,
  buildExploreHeroStatusLine,
  fetchExploreCreatorsMetrics,
  fetchLiveHeroFinancialEstimate,
  preferLiveMetricValue,
  readCachedExploreCreatorsMetrics,
  writeCachedExploreCreatorsMetrics,
} from '@/features/explore/exploreCreatorsMetrics'

export function useExploreCreatorsHeroMetrics() {
  const { migratedCoins } = useMigratedCoins()

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
  const partial = metrics?.totals?.partial === true
  const preferLiveFinancials = !exact || partial

  const liveFinancialsQuery = useQuery({
    queryKey: ['explore', 'creators', 'hero', 'live-financials', migratedCoins?.size ?? 0],
    queryFn: () => fetchLiveHeroFinancialEstimate(migratedCoins ?? null),
    enabled: preferLiveFinancials,
    staleTime: LIVE_HERO_METRICS_REFETCH_MS,
    refetchInterval: preferLiveFinancials ? LIVE_HERO_METRICS_REFETCH_MS : false,
    refetchIntervalInBackground: true,
    retry: 1,
  })

  const liveFinancials = liveFinancialsQuery.data ?? null

  const creatorsTotal = metrics?.totals?.creatorsTotal ?? null
  const creatorsNew24h = metrics?.totals?.creatorsNew24h ?? null
  const marketCap = metrics?.totals?.creatorCoinsMarketCapUsd ?? null
  const volume24h = preferLiveMetricValue(
    metrics?.totals?.creatorCoinsVolume24hUsd,
    liveFinancials?.volume24hUsd,
  )
  const fees24h = preferLiveMetricValue(
    metrics?.totals?.creatorCoinsFees24hUsd,
    liveFinancials?.fees24hUsd,
  )

  const usingLiveFinancials =
    preferLiveFinancials &&
    liveFinancials != null &&
    ((liveFinancials.volume24hUsd ?? 0) > 0 || (liveFinancials.fees24hUsd ?? 0) > 0)

  const statusLine = buildExploreHeroStatusLine({
    updatedAt: metrics?.updatedAt ?? null,
    exact,
    syncStatus: metrics?.syncStatus ?? 'idle',
    creatorsTotal,
    syncMeta: metrics?.sync ?? null,
    usingLiveFinancials,
  })

  return {
    metricsQuery,
    liveFinancialsQuery,
    exact,
    partial,
    usingLiveFinancials,
    creatorsLabel: exact ? 'Creators' : 'Indexed creators',
    creatorsTotal,
    creatorsNew24h,
    marketCap,
    volume24h,
    fees24h,
    statusLine,
    syncStatus: metrics?.syncStatus ?? 'running',
    creatorsTotalCount: creatorsTotal ?? 0,
    isLoading: metricsQuery.isLoading && !metricsQuery.data,
    isFetching: metricsQuery.isFetching || liveFinancialsQuery.isFetching,
  }
}
