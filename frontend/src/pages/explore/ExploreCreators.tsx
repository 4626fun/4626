import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageMeta, META } from '@/components/seo/PageMeta'
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExplorePageShell } from '@/components/explore/ExplorePageShell'
import { ExploreTableSurface } from '@/components/explore/ExploreTableSurface'
import { TokenRow, TokenTableHeader, TokenRowSkeleton } from '@/components/explore/TokenRow'
import { ExploreLoadMoreButton, ExploreLoadingMoreRows, ExploreTableMessage } from '@/components/explore/ExploreUiPrimitives'
import { ExploreUnfurlDebugCopy } from '@/components/explore/ExploreUnfurlDebugCopy'
import { useExploreHorizontalTableSync } from '@/components/explore/useExploreHorizontalTableSync'
import { getExploreColumns, getHorizontalScrollStops } from '@/components/explore/tableColumns'
import { fetchZoraCoin, fetchZoraExplore, fetchZoraProfile, fetchZoraProfileCoins } from '@/lib/zora/client'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { useMigratedCoins } from '@/hooks/useMigratedCoins'
import { useWindowInfiniteScrollLoadMore } from '@/hooks/useWindowInfiniteScrollLoadMore'
import type { ZoraCoin, ZoraExploreListType } from '@/lib/zora/types'
import { getZoraExploreVolumeNote } from '@/lib/zora/exploreVolume'
import { useScreenshotMode, useScreenshotReady } from '@/lib/ui/screenshotMode'
import { buildEthosSocialUserkeyFromZoraProfile, getZoraCreatorProfileIdentifier } from '@/lib/ethos/zoraSocial'
import { fetchEthosScoreForUserkey, getEthosScorePalette, type EthosScoreValue } from '@/components/chat/EthosScorePill'
import {
  flattenExplorePagedNodes,
  matchesCoinSearchQuery,
  normalizeCoinSearchQuery,
  recordExploreQueryRefresh,
  useDebouncedValue,
  useExploreSubnavParams,
} from '@/features/explore/exploreShared'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_CREATORS_24H',
  marketCap: 'MOST_VALUABLE_CREATORS',
  priceChange: 'TOP_GAINERS',
  new: 'NEW_CREATORS',
}

const PAGE_SIZE = 20
const SEARCH_AUTO_FETCH_MAX_PAGES = 30
const REMOTE_SEARCH_MIN_QUERY_LENGTH = 3
const LIVE_METRICS_REFETCH_MS = 10_000
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const V4_CUTOFF_DATE_MS = Date.parse('2025-06-06T00:00:00Z')
const CREATORS_SORT_VALUES = ['volume', 'marketCap', 'priceChange', 'new', 'ethosScore'] as const
const CREATORS_TIME_FILTER_VALUES = ['1d', '1w', '1y'] as const
const ETHOS_FILTER_VALUES = ['all', '1200', '1600', '1800'] as const
const ETHOS_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: '1200+', value: '1200' },
  { label: '1600+', value: '1600' },
  { label: '1800+', value: '1800' },
] as const satisfies ReadonlyArray<{ label: string; value: (typeof ETHOS_FILTER_VALUES)[number] }>
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const CREATOR_SEARCH_MATCH_OPTIONS = {
  includeCreatorAddress: true,
  includePayoutAddress: true,
  includeQueryVariants: true,
  includeHandleBasenameVariant: true,
} as const
const SCREENSHOT_DEMO_METRICS = {
  creatorsTotal: 12840,
  creatorsNew24h: 184,
  creatorCoinsMarketCapUsd: 14200000,
  creatorCoinsVolume24hUsd: 845000,
  creatorCoinsFees24hUsd: 25350,
} as const
const SCREENSHOT_DEMO_COINS: ZoraCoin[] = [
  {
    address: '0x1111111111111111111111111111111111111111',
    symbol: 'AKITA',
    name: 'Akita',
    chainId: 8453,
    uniqueHolders: 1824,
    marketCap: '4200000',
    marketCapDelta24h: '11.4',
    volume24h: '245000',
    totalVolume: '1280000',
    createdAt: '2025-07-01T12:00:00Z',
    creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    payoutRecipientAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  },
  {
    address: '0x2222222222222222222222222222222222222222',
    symbol: 'BUILD',
    name: 'Base Builder',
    chainId: 8453,
    uniqueHolders: 1450,
    marketCap: '3100000',
    marketCapDelta24h: '6.1',
    volume24h: '193000',
    totalVolume: '940000',
    createdAt: '2025-08-14T12:00:00Z',
    creatorAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    payoutRecipientAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
  },
  {
    address: '0x3333333333333333333333333333333333333333',
    symbol: 'VAULT',
    name: 'Vault Pilot',
    chainId: 8453,
    uniqueHolders: 978,
    marketCap: '2200000',
    marketCapDelta24h: '3.8',
    volume24h: '118000',
    totalVolume: '670000',
    createdAt: '2025-09-05T12:00:00Z',
    creatorAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    payoutRecipientAddress: '0xffffffffffffffffffffffffffffffffffffffff',
  },
]

type CreatorEthosRecord = {
  coinKey: string
  userkey: string | null
  score: EthosScoreValue | null
}

type ExploreMetrics = {
  scope: 'creators'
  updatedAt: string
  exact: boolean
  syncStatus: 'idle' | 'running' | 'error'
  sync: {
    backfillComplete: boolean
    sampledCreators: number
    lastSyncStartedAt: string | null
    lastSyncFinishedAt: string | null
    lastFullSyncAt: string | null
    syncError: string | null
    driftEstimateTotal: number | null
    driftPct: number | null
  }
  totals: {
    creatorsTotal: number | null
    creatorsNew24h: number | null
    creatorCoinsMarketCapUsd: number | null
    creatorCoinsVolume24hUsd: number | null
    creatorCoinsFees24hUsd: number | null
    partial: boolean
    sampledCreators: number
  }
  history30d: Array<{
    date: string
    creatorCoinsMarketCapUsd: number | null
  }>
}

async function fetchExploreCreatorsMetrics(): Promise<ExploreMetrics | null> {
  // Prefer server-side metrics (fast + cached) via apiFetch (alias-aware).
  try {
    const res = await apiFetch(`${API_ENDPOINTS.zora.metrics}?scope=creators`, { method: 'GET' })
    const json = (await res.json().catch(() => null)) as ApiEnvelope<ExploreMetrics | null> | null
    if (res.ok && json?.success) return json.data ?? null
  } catch {
    // ignore and return null below
  }
  return null
}

function formatCompactUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const n = v
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return null
  return n
}

function coalesceMetricValue(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value == null) continue
    if (Number.isFinite(value)) return value
  }
  return null
}

function dedupeCoinsByAddress(coins: ZoraCoin[]): ZoraCoin[] {
  const out: ZoraCoin[] = []
  const seen = new Set<string>()
  for (const coin of coins) {
    const address = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
    const fallback = `${coin.creatorAddress ?? ''}:${coin.symbol ?? ''}:${coin.name ?? ''}`.toLowerCase()
    const key = address || fallback
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(coin)
  }
  return out
}

function getCoinKey(coin: ZoraCoin, fallbackIndex?: number): string {
  const address = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
  if (address) return address
  return `${coin.creatorAddress ?? ''}:${coin.symbol ?? ''}:${coin.name ?? ''}:${fallbackIndex ?? ''}`.toLowerCase()
}

function deriveImmediateEthosUserkey(coin: ZoraCoin): string | null {
  void coin
  return null
}

function getEthosFilterMinimum(value: string): number | null {
  if (value === 'all') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getEthosFilterTone(value: (typeof ETHOS_FILTER_VALUES)[number]): string {
  if (value === 'all') return 'border-white/12 bg-white/7 text-zinc-200'
  const palette = getEthosScorePalette(Number(value))
  return `${palette.borderClass} ${palette.bgClass} ${palette.textClass}`
}

function buildProfileIdentifierCandidates(query: string): string[] {
  const normalized = normalizeCoinSearchQuery(query)
  const base = normalized.withoutAt
  if (!base) return []

  const candidates: string[] = []
  const pushUnique = (value: string) => {
    if (!value || candidates.includes(value)) return
    candidates.push(value)
  }

  pushUnique(base)
  if (base.endsWith('.base.eth')) {
    pushUnique(base.slice(0, -'.base.eth'.length))
  } else if (!base.includes('.')) {
    pushUnique(`${base}.base.eth`)
  }
  return candidates
}

async function resolveCreatorSearchCandidates(query: string): Promise<ZoraCoin[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const results: ZoraCoin[] = []
  const addCoin = (coin: ZoraCoin | null | undefined) => {
    if (!coin) return
    results.push(coin)
  }

  if (ADDRESS_REGEX.test(trimmed)) {
    try {
      const directCoin = await fetchZoraCoin(trimmed as `0x${string}`)
      addCoin(directCoin)
    } catch {
      // Best-effort direct address lookup; continue with profile search.
    }
  }

  const profileCandidates = buildProfileIdentifierCandidates(trimmed)
  for (const identifier of profileCandidates) {
    let profile = null as Awaited<ReturnType<typeof fetchZoraProfile>> | null
    try {
      profile = await fetchZoraProfile(identifier)
    } catch {
      profile = null
    }
    if (!profile) continue

    const creatorCoinAddress = typeof profile.creatorCoin?.address === 'string' ? profile.creatorCoin.address : null
    if (creatorCoinAddress && ADDRESS_REGEX.test(creatorCoinAddress)) {
      try {
        const creatorCoin = await fetchZoraCoin(creatorCoinAddress as `0x${string}`)
        addCoin(creatorCoin)
      } catch {
        // keep going; fallback to createdCoins below
      }
    }

    const profileEdges = Array.isArray(profile.createdCoins?.edges) ? profile.createdCoins.edges : []
    for (const edge of profileEdges) {
      addCoin(edge?.node as ZoraCoin | undefined)
    }

    if (creatorCoinAddress || profileEdges.length > 0) continue

    try {
      const profileWithCoins = await fetchZoraProfileCoins({ identifier, count: 8 })
      const profileCoinsEdges = Array.isArray(profileWithCoins?.createdCoins?.edges)
        ? profileWithCoins.createdCoins.edges
        : []
      for (const edge of profileCoinsEdges) {
        addCoin(edge?.node as ZoraCoin | undefined)
      }
    } catch {
      // ignore profile coin expansion errors
    }
  }

  return dedupeCoinsByAddress(results)
}

function inferFeeRate(coin: ZoraCoin, migratedCoins: Set<string> | null): number {
  const address = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
  if (address && migratedCoins?.has(address)) return 0.01
  const createdAtMs = typeof coin.createdAt === 'string' ? Date.parse(coin.createdAt) : NaN
  if (!Number.isFinite(createdAtMs)) return 0.01
  return createdAtMs >= V4_CUTOFF_DATE_MS ? 0.01 : 0.03
}

export function ExploreCreators() {
  const [expandedFees, setExpandedFees] = useState<string | null>(null)
  const [collapseIdentity, setCollapseIdentity] = useState(false)
  const [ethosFilter, setEthosFilter] = useState<(typeof ETHOS_FILTER_VALUES)[number]>('all')
  const screenshotMode = useScreenshotMode()

  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
    sortValues: CREATORS_SORT_VALUES,
    defaultSort: 'volume',
    timeValues: CREATORS_TIME_FILTER_VALUES,
    defaultTime: '1d',
    debugScope: 'explore-creators',
    })

  const listType = SORT_TO_LIST_TYPE[currentSort] || 'TOP_VOLUME_CREATORS_24H'
  
  // Fetch migrated coins for accurate fee detection
  const { migratedCoins } = useMigratedCoins()

  const metricsQuery = useQuery({
    queryKey: ['explore', 'creators', 'metrics'],
    queryFn: fetchExploreCreatorsMetrics,
    staleTime: 10_000,
    retry: 1,
    refetchInterval: (query) => {
      const data = (query.state.data as ExploreMetrics | null | undefined) ?? null
      if (!data) return 5_000
      if (data.exact) return 60_000
      if (data.syncStatus === 'error') return 20_000
      return 5_000
    },
    refetchIntervalInBackground: true,
  })

  // Fast-updating top-creator slice used for visibly-live metric cards.
  const liveMetricsQuery = useQuery({
    queryKey: ['explore', 'creators', 'live', 'top-volume-24h'],
    queryFn: async () =>
      fetchZoraExplore({
        list: 'TOP_VOLUME_CREATORS_24H',
        count: PAGE_SIZE,
      }),
    staleTime: LIVE_METRICS_REFETCH_MS,
    refetchInterval: LIVE_METRICS_REFETCH_MS,
    refetchIntervalInBackground: true,
    retry: 1,
  })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['explore', 'creators', listType],
    queryFn: async ({ pageParam }) => {
      const result = await fetchZoraExplore({
        list: listType,
        count: PAGE_SIZE,
        after: pageParam,
      })
      return result
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pageInfo?.hasNextPage) return undefined
      return lastPage.pageInfo.endCursor
    },
    staleTime: 30_000,
  })

  // Flatten all pages into a single array of coins
  const allCoins = useMemo(() => {
    return flattenExplorePagedNodes(data?.pages)
  }, [data?.pages])

  const trimmedSearchQuery = searchQuery.trim()
  const debouncedSearchQuery = useDebouncedValue(trimmedSearchQuery, 250)

  // Local filtering over currently loaded ranking pages.
  const localFilteredCoins = useMemo(() => {
    if (!trimmedSearchQuery) return allCoins
    return allCoins.filter((coin) =>
      matchesCoinSearchQuery(coin, trimmedSearchQuery, CREATOR_SEARCH_MATCH_OPTIONS),
    )
  }, [allCoins, trimmedSearchQuery])

  // Fallback search resolves by creator handle/profile/address so creators outside
  // currently fetched ranking pages can still be discovered from the search box.
  const directSearchQuery = useQuery({
    queryKey: ['explore', 'creators', 'direct-search', debouncedSearchQuery.toLowerCase()],
    queryFn: () => {
      recordExploreQueryRefresh('explore-creators-remote-search', debouncedSearchQuery)
      return resolveCreatorSearchCandidates(debouncedSearchQuery)
    },
    enabled: debouncedSearchQuery.length >= REMOTE_SEARCH_MIN_QUERY_LENGTH && localFilteredCoins.length === 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  })

  const directSearchCoins = useMemo(() => {
    const data = directSearchQuery.data
    if (!Array.isArray(data) || !trimmedSearchQuery) return []
    return data.filter((coin) =>
      matchesCoinSearchQuery(coin, trimmedSearchQuery, CREATOR_SEARCH_MATCH_OPTIONS),
    )
  }, [directSearchQuery.data, trimmedSearchQuery])

  const filteredCoins = useMemo(() => {
    if (!trimmedSearchQuery) return allCoins
    if (localFilteredCoins.length > 0) return localFilteredCoins
    if (directSearchCoins.length > 0) return dedupeCoinsByAddress(directSearchCoins)
    return localFilteredCoins
  }, [allCoins, directSearchCoins, localFilteredCoins, trimmedSearchQuery])

  const liveMetricCoins = useMemo(() => {
    const edges = Array.isArray(liveMetricsQuery.data?.edges) ? liveMetricsQuery.data.edges : []
    const nodes = edges
      .map((edge) => edge?.node as ZoraCoin | undefined)
      .filter((node): node is ZoraCoin => Boolean(node))
    return nodes.length > 0 ? nodes : allCoins
  }, [allCoins, liveMetricsQuery.data])

  const localMetricsFallback = useMemo(() => {
    const seenCoinKeys = new Set<string>()
    const seenCreators = new Set<string>()
    const creatorLatestCreatedAt = new Map<string, number>()
    const createdAtSamples: number[] = []

    let marketCapUsd = 0
    let volume24hUsd = 0
    let fees24hUsd = 0

    for (const coin of liveMetricCoins) {
      const coinAddress = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
      const coinKey =
        coinAddress ||
        `${coin.creatorAddress ?? ''}:${coin.payoutRecipientAddress ?? ''}:${coin.symbol ?? ''}:${coin.createdAt ?? ''}`
      if (seenCoinKeys.has(coinKey)) continue
      seenCoinKeys.add(coinKey)

      const creatorAddressRaw =
        (typeof coin.creatorAddress === 'string' && coin.creatorAddress) ||
        (typeof coin.payoutRecipientAddress === 'string' && coin.payoutRecipientAddress) ||
        ''
      const creatorAddress = creatorAddressRaw.toLowerCase()
      if (creatorAddress) seenCreators.add(creatorAddress)

      const createdAtMs = typeof coin.createdAt === 'string' ? Date.parse(coin.createdAt) : NaN
      if (Number.isFinite(createdAtMs)) {
        createdAtSamples.push(createdAtMs)
      }
      if (creatorAddress && Number.isFinite(createdAtMs)) {
        const prevCreatedAt = creatorLatestCreatedAt.get(creatorAddress)
        if (prevCreatedAt == null || createdAtMs > prevCreatedAt) {
          creatorLatestCreatedAt.set(creatorAddress, createdAtMs)
        }
      }

      const marketCapValue = toFiniteNumber(coin.marketCap)
      if (marketCapValue != null) marketCapUsd += marketCapValue

      const volumeValue = toFiniteNumber(coin.volume24h)
      if (volumeValue != null) {
        volume24hUsd += volumeValue
        fees24hUsd += volumeValue * inferFeeRate(coin, migratedCoins)
      }
    }

    const metricsUpdatedAtMs = Date.parse(metricsQuery.data?.updatedAt ?? '')
    const fallbackNowMs =
      Number.isFinite(metricsUpdatedAtMs) ? metricsUpdatedAtMs : createdAtSamples.length > 0 ? Math.max(...createdAtSamples) : null
    const dayAgoMs = fallbackNowMs != null ? fallbackNowMs - ONE_DAY_MS : null
    let creatorsNew24h = 0
    if (dayAgoMs != null) {
      for (const createdAtMs of creatorLatestCreatedAt.values()) {
        if (createdAtMs >= dayAgoMs) creatorsNew24h += 1
      }
    }

    return {
      creatorsTotal: seenCreators.size > 0 ? seenCreators.size : seenCoinKeys.size,
      creatorsNew24h,
      creatorCoinsMarketCapUsd: marketCapUsd,
      creatorCoinsVolume24hUsd: volume24hUsd,
      creatorCoinsFees24hUsd: fees24hUsd,
    }
  }, [liveMetricCoins, metricsQuery.data?.updatedAt, migratedCoins])

  const exactMetrics = metricsQuery.data?.exact === true
  const syncStatus = metricsQuery.data?.syncStatus ?? 'running'
  const syncMeta = metricsQuery.data?.sync ?? null
  const metricsTotals = metricsQuery.data?.totals ?? null
  const metricsUpdatedAtMs = Date.parse(metricsQuery.data?.updatedAt ?? '')
  const metricsFreshnessRefMs = metricsQuery.dataUpdatedAt || metricsUpdatedAtMs
  const metricsAgeMs =
    Number.isFinite(metricsUpdatedAtMs) && Number.isFinite(metricsFreshnessRefMs)
      ? metricsFreshnessRefMs - metricsUpdatedAtMs
      : Number.POSITIVE_INFINITY
  const canonicalMetricsStale = metricsAgeMs > LIVE_METRICS_REFETCH_MS * 3
  const useLiveMetricCards = !exactMetrics || metricsTotals?.partial === true || canonicalMetricsStale
  const preferLiveTotals = useLiveMetricCards && liveMetricCoins.length > 0
  const creatorsTotalDisplay = preferLiveTotals
    ? coalesceMetricValue(localMetricsFallback.creatorsTotal, metricsTotals?.creatorsTotal)
    : coalesceMetricValue(metricsTotals?.creatorsTotal, localMetricsFallback.creatorsTotal)
  const creatorsNew24hDisplay = preferLiveTotals
    ? coalesceMetricValue(localMetricsFallback.creatorsNew24h, metricsTotals?.creatorsNew24h)
    : coalesceMetricValue(metricsTotals?.creatorsNew24h, localMetricsFallback.creatorsNew24h)
  const marketCapDisplay = preferLiveTotals
    ? coalesceMetricValue(localMetricsFallback.creatorCoinsMarketCapUsd, metricsTotals?.creatorCoinsMarketCapUsd)
    : coalesceMetricValue(metricsTotals?.creatorCoinsMarketCapUsd, localMetricsFallback.creatorCoinsMarketCapUsd)
  const volume24hDisplay = preferLiveTotals
    ? coalesceMetricValue(localMetricsFallback.creatorCoinsVolume24hUsd, metricsTotals?.creatorCoinsVolume24hUsd)
    : coalesceMetricValue(metricsTotals?.creatorCoinsVolume24hUsd, localMetricsFallback.creatorCoinsVolume24hUsd)
  const fees24hDisplay = preferLiveTotals
    ? coalesceMetricValue(localMetricsFallback.creatorCoinsFees24hUsd, metricsTotals?.creatorCoinsFees24hUsd)
    : coalesceMetricValue(metricsTotals?.creatorCoinsFees24hUsd, localMetricsFallback.creatorCoinsFees24hUsd)
  const creatorsTotalCount = creatorsTotalDisplay ?? 0
  const useScreenshotFallback = screenshotMode.enabled && !trimmedSearchQuery && filteredCoins.length === 0
  const baseDisplayCoins = useScreenshotFallback ? SCREENSHOT_DEMO_COINS : filteredCoins

  const profileIdentifiers = useMemo(() => {
    return baseDisplayCoins.map((coin) => ({
      coinKey: getCoinKey(coin),
      identifier: getZoraCreatorProfileIdentifier(coin),
      immediateUserkey: deriveImmediateEthosUserkey(coin),
    }))
  }, [baseDisplayCoins])

  const profileQueries = useQueries({
    queries: profileIdentifiers.map(({ coinKey, identifier, immediateUserkey }) => ({
      queryKey: ['explore', 'creators', 'ethos-profile-userkey', coinKey, identifier],
      queryFn: async () => {
        if (!identifier) return null
        const profile = await fetchZoraProfile(identifier)
        return buildEthosSocialUserkeyFromZoraProfile(profile)
      },
      enabled: Boolean(identifier && !immediateUserkey),
      staleTime: 6 * 60 * 60 * 1000,
      retry: 1,
    })),
  })

  const coinEthosUserkeys = useMemo(() => {
    const out = new Map<string, string>()
    profileIdentifiers.forEach((entry, index) => {
      const userkey = entry.immediateUserkey ?? profileQueries[index]?.data ?? null
      if (userkey) out.set(entry.coinKey, userkey)
    })
    return out
  }, [profileIdentifiers, profileQueries])

  const ethosScoreQueries = useQueries({
    queries: Array.from(coinEthosUserkeys.entries()).map(([coinKey, userkey]) => ({
      queryKey: ['explore', 'creators', 'ethos-score', coinKey, userkey],
      queryFn: () => fetchEthosScoreForUserkey(userkey),
      enabled: Boolean(userkey),
      staleTime: 6 * 60 * 60 * 1000,
      retry: 1,
    })),
  })

  const ethosByCoinKey = useMemo(() => {
    const out = new Map<string, CreatorEthosRecord>()
    const entries = Array.from(coinEthosUserkeys.entries())
    entries.forEach(([coinKey, userkey], index) => {
      out.set(coinKey, {
        coinKey,
        userkey,
        score: ethosScoreQueries[index]?.data ?? null,
      })
    })
    return out
  }, [coinEthosUserkeys, ethosScoreQueries])

  const displayCoins = useMemo(() => {
    const minimumScore = getEthosFilterMinimum(ethosFilter)
    const filtered =
      minimumScore == null
        ? baseDisplayCoins
        : baseDisplayCoins.filter((coin) => {
            const score = ethosByCoinKey.get(getCoinKey(coin))?.score?.score
            return typeof score === 'number' && score >= minimumScore
          })

    if (currentSort !== 'ethosScore') return filtered

    return [...filtered].sort((a, b) => {
      const aScore = ethosByCoinKey.get(getCoinKey(a))?.score?.score ?? Number.NEGATIVE_INFINITY
      const bScore = ethosByCoinKey.get(getCoinKey(b))?.score?.score ?? Number.NEGATIVE_INFINITY
      return bScore - aScore
    })
  }, [baseDisplayCoins, currentSort, ethosByCoinKey, ethosFilter])

  const hasScreenshotFallbackRows = useScreenshotFallback && displayCoins.length > 0
  const creatorsTotalUi = useScreenshotFallback ? SCREENSHOT_DEMO_METRICS.creatorsTotal : creatorsTotalDisplay
  const creatorsNew24hUi = useScreenshotFallback ? SCREENSHOT_DEMO_METRICS.creatorsNew24h : creatorsNew24hDisplay
  const marketCapUi = useScreenshotFallback ? SCREENSHOT_DEMO_METRICS.creatorCoinsMarketCapUsd : marketCapDisplay
  const volume24hUi = useScreenshotFallback ? SCREENSHOT_DEMO_METRICS.creatorCoinsVolume24hUsd : volume24hDisplay
  const fees24hUi = useScreenshotFallback ? SCREENSHOT_DEMO_METRICS.creatorCoinsFees24hUsd : fees24hDisplay
  const canonicalUpdatedAt = syncMeta?.lastFullSyncAt ?? null
  const updatedTimeDisplay = canonicalUpdatedAt
    ? new Date(canonicalUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null
  const indexedCreatorProgress =
    !exactMetrics && creatorsTotalCount > 0
      ? syncMeta?.driftEstimateTotal && syncMeta.driftEstimateTotal > creatorsTotalCount
        ? `Indexed ${creatorsTotalCount.toLocaleString()} of ~${syncMeta.driftEstimateTotal.toLocaleString()} creators`
        : `Indexed ${creatorsTotalCount.toLocaleString()} creators`
      : null
  const liveEstimateStatus = `Live estimate updates every ${Math.floor(LIVE_METRICS_REFETCH_MS / 1000)}s`
  const metricsStatusLine =
    syncStatus === 'error'
      ? `${liveEstimateStatus} while canonical totals retry in background.`
      : useLiveMetricCards
        ? [liveEstimateStatus, indexedCreatorProgress ?? (updatedTimeDisplay ? `Canonical refreshed ${updatedTimeDisplay}` : null)]
            .filter(Boolean)
            .join(' | ')
        : exactMetrics && updatedTimeDisplay
          ? `Canonical totals refreshed ${updatedTimeDisplay}`
          : indexedCreatorProgress
  const creatorsLabel = exactMetrics ? 'Creators' : 'Indexed creators'
  const marketLabel = 'Market Cap'
  const isSearchingDirectMatches =
    trimmedSearchQuery.length >= REMOTE_SEARCH_MIN_QUERY_LENGTH &&
    localFilteredCoins.length === 0 &&
    (directSearchQuery.isLoading || directSearchQuery.isFetching)
  const showSyncingEmptyState =
    !trimmedSearchQuery &&
    displayCoins.length === 0 &&
    !isLoading &&
    !isError &&
    (creatorsTotalCount > 0 || syncStatus === 'running' || syncStatus === 'error')
  const shouldAutoFetchForSearch =
    trimmedSearchQuery.length > 0 &&
    displayCoins.length === 0 &&
    !isLoading &&
    !isError &&
    !isSearchingDirectMatches &&
    hasNextPage === true &&
    !isFetchingNextPage &&
    (data?.pages?.length ?? 0) < SEARCH_AUTO_FETCH_MAX_PAGES
  const screenshotReady = displayCoins.length > 0 && (!isLoading || hasScreenshotFallbackRows)

  useScreenshotReady(screenshotReady)

  useWindowInfiniteScrollLoadMore({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

  useEffect(() => {
    if (!shouldAutoFetchForSearch) return
    const timer = window.setTimeout(() => {
      fetchNextPage().catch(() => undefined)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [fetchNextPage, shouldAutoFetchForSearch])

  const onHorizontalControlsChange = useCallback(({ overflow, atLeftEdge }: { overflow: boolean; atLeftEdge: boolean }) => {
    setCollapseIdentity(overflow && !atLeftEdge && window.innerWidth <= 1024)
  }, [])

  const { hasHorizontalOverflow, canScrollLeft, canScrollRight, handleHeaderScroll, handleBodyScroll, handleArrowClick } =
    useExploreHorizontalTableSync({
      headerId: 'explore-creators-header',
      bodyId: 'explore-creators-body',
      onControlsChange: onHorizontalControlsChange,
    })

  const columnScrollStops = useMemo(() => {
    const columns = getExploreColumns({ variant: 'creators', timeframe: currentTimeFilter, collapseIdentity })
    return getHorizontalScrollStops(columns)
  }, [currentTimeFilter, collapseIdentity])

  return (
    <ExplorePageShell
      leading={<PageMeta title={META.explore.title} description={META.explore.description} canonicalPath="/explore" />}
      title="Top Creators on Base"
      subtitle="Creator Coins ranked by volume, market cap, and more."
      headerContent={
        <>
          {/* Metrics strip — compact 2x2 on mobile, 4-col on desktop */}
          <div className="mt-4 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">{creatorsLabel}</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {creatorsTotalUi?.toLocaleString() ?? '—'}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                {creatorsNew24hUi != null
                  ? `+${creatorsNew24hUi.toLocaleString()} today`
                  : 'Tracking newly created creators'}
              </div>
            </div>

            <div className="vault-surface-elevated vault-hover-lift rounded-xl sm:rounded-2xl border-blue-300/30 bg-blue-950/16 px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] font-medium text-zinc-400">{marketLabel}</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(marketCapUi)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">Live market-cap snapshot</div>
            </div>

            <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">1D Vol</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(volume24hUi)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                24H trade volume across creator coins
              </div>
            </div>

            <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">1D Fees</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(fees24hUi)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                24H fees from creator-coin trading
              </div>
            </div>
          </div>

          {metricsStatusLine ? <div className="app-meta-value mt-2 text-right text-zinc-500">{metricsStatusLine}</div> : null}
          <div className="mt-3 flex justify-end">
            <ExploreUnfurlDebugCopy path="/explore/creators" />
          </div>
        </>
      }
      subnav={
        <ExploreSubnav
          searchPlaceholder="Search creators"
          searchValue={searchQuery}
          onSearch={handleSearchChange}
          onTimeFilterChange={handleTimeFilterChange}
          onSortChange={handleSortChange}
          currentTimeFilter={currentTimeFilter}
          currentSort={currentSort}
          sortOptions={[
            { label: 'Volume', value: 'volume' },
            { label: 'Market cap', value: 'marketCap' },
            { label: 'Price change', value: 'priceChange' },
            { label: 'Ethos score', value: 'ethosScore' },
            { label: 'Recently added', value: 'new' },
          ]}
          volumeColumnNote={getZoraExploreVolumeNote(currentTimeFilter)}
          extraFilters={
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Ethos</span>
              <div className="flex h-8 items-center gap-0.5 rounded-full border border-white/12 bg-linear-to-b from-white/7 to-white/3 p-0.5">
                {ETHOS_FILTER_OPTIONS.map((filter) => {
                  const active = ethosFilter === filter.value
                  const tone = getEthosFilterTone(filter.value)
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setEthosFilter(filter.value as (typeof ETHOS_FILTER_VALUES)[number])}
                      className={`h-6 rounded-full border px-2 text-[10px] font-medium leading-none transition-all duration-200 ${
                        active
                          ? tone
                          : 'border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/7 hover:text-white'
                      }`}
                    >
                      {filter.label}
                    </button>
                  )
                })}
              </div>
            </div>
          }
        />
      }
      table={
        <>
          <ExploreTableSurface
            headerId="explore-creators-header"
            bodyId="explore-creators-body"
            onHeaderScroll={handleHeaderScroll}
            onBodyScroll={handleBodyScroll}
            header={
              <TokenTableHeader
                timeframe={currentTimeFilter}
                collapseIdentity={collapseIdentity}
                currentSort={currentSort}
                onSortChange={handleSortChange}
              />
            }
            body={
              <>
                {isLoading && !hasScreenshotFallbackRows ? (
                  Array.from({ length: 10 }).map((_, i) => <TokenRowSkeleton key={i} collapseIdentity={collapseIdentity} />)
                ) : isError && !hasScreenshotFallbackRows ? (
                  <ExploreTableMessage title="Failed to load creators" detail={(error as Error)?.message || 'Unknown error'} />
                ) : showSyncingEmptyState ? (
                  <ExploreTableMessage
                    title="Creator list is still syncing"
                    detail="Global stats are available, but the ranked creator rows have not finished loading yet."
                  />
                ) : trimmedSearchQuery.length > 0 && displayCoins.length === 0 && isSearchingDirectMatches ? (
                  <ExploreTableMessage title="Searching creators..." detail="Checking direct handle/profile matches." />
                ) : trimmedSearchQuery.length > 0 && displayCoins.length === 0 && isFetchingNextPage ? (
                  <ExploreTableMessage title="Searching more creators..." detail="Scanning additional pages for matches." />
                ) : displayCoins.length === 0 ? (
                  <ExploreTableMessage title={trimmedSearchQuery ? 'No creators found matching your search' : 'No creators available'} />
                ) : (
                  displayCoins.map((coin, index) => {
                    const coinKey = getCoinKey(coin)
                    const rowId = coin.address ? String(coin.address).toLowerCase() : `row-${index}`
                    const isExpanded = expandedFees === rowId
                    const ethos = ethosByCoinKey.get(coinKey) ?? null
                    return (
                      <TokenRow
                        key={coin.address || index}
                        rank={index + 1}
                        coin={coin}
                        linkPrefix="/explore/creators"
                        timeframe={currentTimeFilter}
                        collapseIdentity={collapseIdentity}
                        migratedCoins={migratedCoins ?? undefined}
                        ethosUserkey={ethos?.userkey ?? null}
                        ethosScore={ethos?.score ?? null}
                        isExpanded={isExpanded}
                        onToggleFees={() => setExpandedFees((prev) => (prev === rowId ? null : rowId))}
                      />
                    )
                  })
                )}

                <ExploreLoadingMoreRows
                  isFetchingNextPage={isFetchingNextPage}
                  renderSkeletonRow={() => <TokenRowSkeleton collapseIdentity={collapseIdentity} />}
                />

                <ExploreLoadMoreButton
                  hasNextPage={Boolean(hasNextPage)}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={() => {
                    void fetchNextPage()
                  }}
                  buttonClassName="px-6 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/8 transition-colors"
                />
              </>
            }
            hasHorizontalOverflow={hasHorizontalOverflow}
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
            onScrollLeft={() => handleArrowClick('left', columnScrollStops)}
            onScrollRight={() => handleArrowClick('right', columnScrollStops)}
            leftAriaLabel="Scroll creators table left"
            rightAriaLabel="Scroll creators table right"
          />
        </>
      }
      footer={!isLoading && displayCoins.length > 0 ? `Showing ${displayCoins.length} creators` : null}
    />
  )
}
