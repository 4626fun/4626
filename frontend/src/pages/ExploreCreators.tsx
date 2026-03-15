import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { PageMeta, META } from '@/components/seo/PageMeta'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreMetricSparkline } from '@/components/explore/ExploreMetricSparkline'
import { TokenRow, TokenTableHeader, TokenRowSkeleton } from '@/components/explore/TokenRow'
import { getExploreColumns } from '@/components/explore/tableColumns'
import { fetchZoraCoin, fetchZoraExplore, fetchZoraProfile, fetchZoraProfileCoins } from '@/lib/zora/client'
import { apiFetch } from '@/lib/apiBase'
import { useMigratedCoins } from '@/hooks/useMigratedCoins'
import type { ZoraCoin, ZoraExploreListType } from '@/lib/zora/types'

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
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
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
    const res = await apiFetch('/api/zora/metrics?scope=creators', { method: 'GET' })
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

function normalizeSearchQuery(query: string): { raw: string; withoutAt: string; withoutBasenameSuffix: string } {
  const raw = query.trim().toLowerCase()
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw
  const withoutBasenameSuffix = withoutAt.endsWith('.base.eth') ? withoutAt.slice(0, -'.base.eth'.length) : withoutAt
  return { raw, withoutAt, withoutBasenameSuffix }
}

function matchesCreatorSearchQuery(coin: ZoraCoin, query: string): boolean {
  const normalized = normalizeSearchQuery(query)
  if (!normalized.raw) return true

  const name = (coin.name || '').toLowerCase()
  const symbol = (coin.symbol || '').toLowerCase()
  const address = (coin.address || '').toLowerCase()
  const payout = (coin.payoutRecipientAddress || '').toLowerCase()
  const creator = (coin.creatorAddress || '').toLowerCase()
  const creatorHandle = (coin.creatorProfile?.handle || '').toLowerCase()
  const creatorHandleWithoutBasename = creatorHandle.endsWith('.base.eth')
    ? creatorHandle.slice(0, -'.base.eth'.length)
    : creatorHandle

  const candidates = [
    normalized.raw,
    normalized.withoutAt,
    normalized.withoutBasenameSuffix,
  ].filter(Boolean)

  return candidates.some((candidate) =>
    name.includes(candidate) ||
    symbol.includes(candidate) ||
    address.includes(candidate) ||
    payout.includes(candidate) ||
    creator.includes(candidate) ||
    creatorHandle.includes(candidate) ||
    creatorHandleWithoutBasename.includes(candidate),
  )
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

function buildProfileIdentifierCandidates(query: string): string[] {
  const normalized = normalizeSearchQuery(query)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFees, setExpandedFees] = useState<string | null>(null)
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [collapseIdentity, setCollapseIdentity] = useState(false)

  const currentTimeFilter = searchParams.get('time') || '1d'
  const currentSort = searchParams.get('sort') || 'volume'

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
    if (!data?.pages) return []
    const coins: ZoraCoin[] = []
    for (const page of data.pages) {
      if (page?.edges) {
        for (const edge of page.edges) {
          if (edge?.node) {
            coins.push(edge.node)
          }
        }
      }
    }
    return coins
  }, [data])

  const trimmedSearchQuery = searchQuery.trim()

  // Local filtering over currently loaded ranking pages.
  const localFilteredCoins = useMemo(() => {
    if (!trimmedSearchQuery) return allCoins
    return allCoins.filter((coin) => matchesCreatorSearchQuery(coin, trimmedSearchQuery))
  }, [allCoins, trimmedSearchQuery])

  // Fallback search resolves by creator handle/profile/address so creators outside
  // currently fetched ranking pages can still be discovered from the search box.
  const directSearchQuery = useQuery({
    queryKey: ['explore', 'creators', 'direct-search', trimmedSearchQuery.toLowerCase()],
    queryFn: () => resolveCreatorSearchCandidates(trimmedSearchQuery),
    enabled: trimmedSearchQuery.length >= REMOTE_SEARCH_MIN_QUERY_LENGTH && localFilteredCoins.length === 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  })

  const directSearchCoins = useMemo(() => {
    const data = directSearchQuery.data
    if (!Array.isArray(data) || !trimmedSearchQuery) return []
    return data.filter((coin) => matchesCreatorSearchQuery(coin, trimmedSearchQuery))
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
  const creatorsTotalDisplay = coalesceMetricValue(metricsTotals?.creatorsTotal, localMetricsFallback.creatorsTotal)
  const creatorsNew24hDisplay = coalesceMetricValue(metricsTotals?.creatorsNew24h, localMetricsFallback.creatorsNew24h)
  const marketCapDisplay = coalesceMetricValue(metricsTotals?.creatorCoinsMarketCapUsd, localMetricsFallback.creatorCoinsMarketCapUsd)
  const volume24hDisplay = coalesceMetricValue(metricsTotals?.creatorCoinsVolume24hUsd, localMetricsFallback.creatorCoinsVolume24hUsd)
  const fees24hDisplay = coalesceMetricValue(metricsTotals?.creatorCoinsFees24hUsd, localMetricsFallback.creatorCoinsFees24hUsd)
  const creatorsTotalCount = creatorsTotalDisplay ?? 0
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
    filteredCoins.length === 0 &&
    !isLoading &&
    !isError &&
    (creatorsTotalCount > 0 || syncStatus === 'running' || syncStatus === 'error')
  const shouldAutoFetchForSearch =
    trimmedSearchQuery.length > 0 &&
    filteredCoins.length === 0 &&
    !isLoading &&
    !isError &&
    !isSearchingDirectMatches &&
    hasNextPage === true &&
    !isFetchingNextPage &&
    (data?.pages?.length ?? 0) < SEARCH_AUTO_FETCH_MAX_PAGES

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - 500
    ) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (!shouldAutoFetchForSearch) return
    const timer = window.setTimeout(() => {
      fetchNextPage().catch(() => undefined)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [fetchNextPage, shouldAutoFetchForSearch])

  const updateHorizontalControls = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth + 1
    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    const atLeftEdge = el.scrollLeft <= 1
    const atRightEdge = el.scrollLeft >= maxLeft - 1
    const shouldCollapse = overflow && !atLeftEdge && window.innerWidth <= 1024
    setHasHorizontalOverflow(overflow)
    setCanScrollLeft(overflow && !atLeftEdge)
    setCanScrollRight(overflow && !atRightEdge)
    setCollapseIdentity(shouldCollapse)
  }, [])

  useEffect(() => {
    const body = document.getElementById('explore-creators-body')
    if (!body) return

    const updateHint = () => updateHorizontalControls(body)

    updateHint()
    window.addEventListener('resize', updateHint)
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHint)
      observer.observe(body)
    }

    return () => {
      window.removeEventListener('resize', updateHint)
      observer?.disconnect()
    }
  }, [filteredCoins.length, currentTimeFilter, updateHorizontalControls])

  const handleTimeFilterChange = (filter: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('time', filter)
    setSearchParams(newParams, { replace: true })
  }

  const handleSortChange = (sort: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('sort', sort)
    setSearchParams(newParams, { replace: true })
  }

  const columnScrollStops = useMemo(() => {
    const columns = getExploreColumns({ variant: 'creators', timeframe: currentTimeFilter, collapseIdentity })
    const nonStickyWidths = columns.filter((c) => !c.sticky).map((c) => c.widthPx)
    const stops: number[] = [0]
    let acc = 0
    for (const width of nonStickyWidths) {
      acc += width
      stops.push(acc)
    }
    return stops
  }, [currentTimeFilter, collapseIdentity])

  const handleHorizontalArrowClick = (direction: 'left' | 'right') => {
    const body = document.getElementById('explore-creators-body')
    if (!body) return
    const maxLeft = Math.max(0, body.scrollWidth - body.clientWidth)
    const currentLeft = body.scrollLeft

    if (direction === 'right') {
      const nextStop = columnScrollStops.find((stop) => stop > currentLeft + 1) ?? maxLeft
      body.scrollTo({ left: Math.min(maxLeft, nextStop), behavior: 'smooth' })
      return
    }

    let prevStop = 0
    for (let i = columnScrollStops.length - 1; i >= 0; i--) {
      const stop = columnScrollStops[i]
      if (stop < currentLeft - 1) {
        prevStop = stop
        break
      }
    }
    body.scrollTo({ left: Math.max(0, prevStop), behavior: 'smooth' })
  }

  const arrowButtonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/15 backdrop-blur-md text-blue-100 shadow-[0_10px_24px_-16px_rgba(37,99,235,0.9)] transition-all duration-200 hover:-translate-y-[1px] hover:border-blue-200/60 hover:bg-blue-500/25 hover:text-white hover:shadow-[0_14px_26px_-14px_rgba(59,130,246,0.95)] active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/40'

  return (
    <div className="relative min-h-screen pt-1 sm:pt-2">
      <PageMeta title={META.explore.title} description={META.explore.description} canonicalPath="/explore" />
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-4 sm:pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mb-1 sm:mb-2">
            Top Creators on Base
          </h1>
          <p className="text-zinc-400 text-[13px] sm:text-sm">
            Creator Coins ranked by volume, market cap, and more.
          </p>

          {/* Metrics strip — compact 2x2 on mobile, 4-col on desktop */}
          <div className="mt-4 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">{creatorsLabel}</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {creatorsTotalDisplay?.toLocaleString() ?? '—'}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                {creatorsNew24hDisplay != null
                  ? `+${creatorsNew24hDisplay.toLocaleString()} today`
                  : 'Tracking newly created creators'}
              </div>
            </div>

            <div className="vault-surface-elevated vault-hover-lift relative overflow-hidden rounded-xl sm:rounded-2xl border-blue-300/30 bg-blue-950/16 px-3 sm:px-4 py-2.5 sm:py-3">
              <ExploreMetricSparkline history={metricsQuery.data?.history30d} fallbackValue={marketCapDisplay} />
              <div className="relative z-10">
                <div className="text-[10px] sm:text-[11px] font-medium text-zinc-400">{marketLabel}</div>
                <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                  {formatCompactUsd(marketCapDisplay)}
                </div>
                <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                  30-day trend overlay (hover for daily value)
                </div>
              </div>
            </div>

            <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">1D Vol</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(volume24hDisplay)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                24H trade volume across creator coins
              </div>
            </div>

            <div className="vault-surface-muted vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] font-medium text-zinc-500">1D Fees</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(fees24hDisplay)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                24H fees from creator-coin trading
              </div>
            </div>
          </div>

          {metricsStatusLine ? (
            <div className="mt-2 text-right text-[11px] text-zinc-500">{metricsStatusLine}</div>
          ) : null}
        </motion.div>

        {/* Navigation & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <ExploreSubnav
            searchPlaceholder="Search creators"
            onSearch={setSearchQuery}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
          />
        </motion.div>

        {/* Token Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="vault-surface relative overflow-hidden"
        >
          {/* Sticky header - outside horizontal scroll to preserve sticky behavior */}
          <div className="sticky top-0 z-50 border-b border-white/8 bg-vault-bg shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
            <div 
              className="overflow-x-auto scrollbar-hide" 
              id="explore-creators-header"
              data-scrolled="0"
              onScroll={(e) => {
                const body = document.getElementById('explore-creators-body')
                const scrolled = e.currentTarget.scrollLeft > 0
                updateHorizontalControls(e.currentTarget)
                e.currentTarget.dataset.scrolled = scrolled ? '1' : '0'
                if (body) {
                  body.scrollLeft = e.currentTarget.scrollLeft
                  body.dataset.scrolled = scrolled ? '1' : '0'
                }
              }}
            >
              <div className="min-w-max">
                <TokenTableHeader
                  timeframe={currentTimeFilter}
                  collapseIdentity={collapseIdentity}
                  currentSort={currentSort}
                  onSortChange={handleSortChange}
                />
              </div>
            </div>
          </div>

          {hasHorizontalOverflow && canScrollLeft ? (
            <div className="absolute left-2 top-10 z-60">
              <button
                type="button"
                onClick={() => handleHorizontalArrowClick('left')}
                aria-label="Scroll creators table left"
                className={arrowButtonClass}
              >
                <ChevronLeft size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {hasHorizontalOverflow && canScrollRight ? (
            <div className="absolute right-2 top-10 z-60">
              <button
                type="button"
                onClick={() => handleHorizontalArrowClick('right')}
                aria-label="Scroll creators table right"
                className={arrowButtonClass}
              >
                <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {/* Table body with synced horizontal scroll */}
          <div 
            className="overflow-x-auto scrollbar-hide" 
            id="explore-creators-body"
            data-scrolled="0"
            onScroll={(e) => {
              const header = document.getElementById('explore-creators-header')
              const scrolled = e.currentTarget.scrollLeft > 0
              updateHorizontalControls(e.currentTarget)
              if (header) {
                header.scrollLeft = e.currentTarget.scrollLeft
                header.dataset.scrolled = scrolled ? '1' : '0'
              }
              e.currentTarget.dataset.scrolled = scrolled ? '1' : '0'
            }}
          >
            <div className="min-w-max divide-y divide-white/6">
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 10 }).map((_, i) => <TokenRowSkeleton key={i} collapseIdentity={collapseIdentity} />)
              ) : isError ? (
                // Error state
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400 mb-4">Failed to load creators</p>
                  <p className="text-xs text-zinc-600">{(error as Error)?.message || 'Unknown error'}</p>
                </div>
              ) : showSyncingEmptyState ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400">Creator list is still syncing</p>
                  <p className="mt-2 text-xs text-zinc-600">
                    Global stats are available, but the ranked creator rows have not finished loading yet.
                  </p>
                </div>
              ) : trimmedSearchQuery.length > 0 && filteredCoins.length === 0 && isSearchingDirectMatches ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400">Searching creators...</p>
                  <p className="mt-2 text-xs text-zinc-600">Checking direct handle/profile matches.</p>
                </div>
              ) : trimmedSearchQuery.length > 0 && filteredCoins.length === 0 && isFetchingNextPage ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400">Searching more creators...</p>
                  <p className="mt-2 text-xs text-zinc-600">Scanning additional pages for matches.</p>
                </div>
              ) : filteredCoins.length === 0 ? (
                // Empty state
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400">
                    {trimmedSearchQuery ? 'No creators found matching your search' : 'No creators available'}
                  </p>
                </div>
              ) : (
                // Token rows
                filteredCoins.map((coin, index) => {
                  const rowId = coin.address ? String(coin.address).toLowerCase() : `row-${index}`
                  const isExpanded = expandedFees === rowId
                  return (
                    <TokenRow
                      key={coin.address || index}
                      rank={index + 1}
                      coin={coin}
                      linkPrefix="/explore/creators"
                      timeframe={currentTimeFilter}
                      collapseIdentity={collapseIdentity}
                      migratedCoins={migratedCoins ?? undefined}
                      isExpanded={isExpanded}
                      onToggleFees={() => setExpandedFees((prev) => (prev === rowId ? null : rowId))}
                    />
                  )
                })
              )}

              {/* Loading more indicator */}
              {isFetchingNextPage && (
                <>
                  <TokenRowSkeleton collapseIdentity={collapseIdentity} />
                  <TokenRowSkeleton collapseIdentity={collapseIdentity} />
                  <TokenRowSkeleton collapseIdentity={collapseIdentity} />
                </>
              )}

              {/* Load more button (fallback for scroll) */}
              {hasNextPage && !isFetchingNextPage && (
                <div className="px-6 py-4 border-t border-white/8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    className="px-6 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats footer */}
        {!isLoading && filteredCoins.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-4 text-center text-xs text-zinc-600"
          >
            Showing {filteredCoins.length} creators
          </motion.div>
        )}
      </div>
    </div>
  )
}
