import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { TokenRow, TokenTableHeader, TokenRowSkeleton } from '@/components/explore/TokenRow'
import { getExploreColumns } from '@/components/explore/tableColumns'
import { fetchZoraExplore } from '@/lib/zora/client'
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

  const listType = SORT_TO_LIST_TYPE[currentSort] || 'TOP_VOLUME_24H'
  
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

  // Filter coins based on search query
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return allCoins
    const query = searchQuery.toLowerCase()
    return allCoins.filter((coin) => {
      const name = (coin.name || '').toLowerCase()
      const symbol = (coin.symbol || '').toLowerCase()
      const address = (coin.address || '').toLowerCase()
      const payout = (coin.payoutRecipientAddress || '').toLowerCase()
      const creator = (coin.creatorAddress || '').toLowerCase()
      return (
        name.includes(query) ||
        symbol.includes(query) ||
        address.includes(query) ||
        payout.includes(query) ||
        creator.includes(query)
      )
    })
  }, [allCoins, searchQuery])

  const exactMetrics = metricsQuery.data?.exact === true
  const syncStatus = metricsQuery.data?.syncStatus ?? 'running'
  const syncMeta = metricsQuery.data?.sync ?? null
  const metricsTotals = exactMetrics ? metricsQuery.data?.totals ?? null : null
  const creatorsTotalDisplay = metricsTotals?.creatorsTotal ?? null
  const creatorsNew24hDisplay = metricsTotals?.creatorsNew24h ?? null
  const marketCapDisplay = metricsTotals?.creatorCoinsMarketCapUsd ?? null
  const volume24hDisplay = metricsTotals?.creatorCoinsVolume24hUsd ?? null
  const fees24hDisplay = metricsTotals?.creatorCoinsFees24hUsd ?? null
  const canonicalUpdatedAt = syncMeta?.lastFullSyncAt ?? null
  const updatedTimeDisplay = canonicalUpdatedAt
    ? new Date(canonicalUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null
  const syncingLabel =
    syncStatus === 'running'
      ? 'Syncing canonical totals...'
      : syncStatus === 'error'
        ? 'Canonical sync error. Retrying soon...'
        : 'Canonical backfill pending...'

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
    'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-zinc-900/75 backdrop-blur-md text-zinc-100 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.95)] transition-all duration-200 hover:-translate-y-[1px] hover:border-white/35 hover:bg-zinc-800/85 hover:text-white hover:shadow-[0_14px_26px_-14px_rgba(0,0,0,0.95)] active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'

  return (
    <div className="relative pb-0 min-h-screen">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 sm:mb-8"
        >
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mb-1 sm:mb-2">
            Top Creators on Base
          </h1>
          <p className="text-zinc-400 text-[13px] sm:text-sm">
            Creator Coins ranked by volume, market cap, and more.
          </p>

          {/* Metrics strip — compact 2x2 on mobile, 4-col on desktop */}
          <div className="mt-4 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-900/30 px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-zinc-500">Creators</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {creatorsTotalDisplay?.toLocaleString() ?? '—'}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                {exactMetrics && creatorsNew24hDisplay != null
                  ? `+${creatorsNew24hDisplay.toLocaleString()} today`
                  : syncingLabel}
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-900/30 px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-zinc-500">TVL</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(marketCapDisplay)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                {exactMetrics ? 'All creators' : syncingLabel}
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-900/30 px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-zinc-500">1D Vol</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(volume24hDisplay)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                {exactMetrics ? 'Across creator coins' : syncingLabel}
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-900/30 px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-zinc-500">1D Fees</div>
              <div className="mt-0.5 sm:mt-1 text-lg sm:text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(fees24hDisplay)}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-[12px] text-zinc-500 hidden sm:block">
                {exactMetrics ? 'Trading fees (global 24H)' : syncingLabel}
              </div>
            </div>
          </div>

          <div className="mt-2 text-right text-[11px] text-zinc-500">
            {exactMetrics && updatedTimeDisplay
              ? `Last canonical sync ${updatedTimeDisplay}`
              : syncingLabel}
          </div>
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
          className="relative rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
        >
          {/* Sticky header - outside horizontal scroll to preserve sticky behavior */}
          <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
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
            <div className="min-w-max divide-y divide-zinc-800/50">
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 10 }).map((_, i) => <TokenRowSkeleton key={i} collapseIdentity={collapseIdentity} />)
              ) : isError ? (
                // Error state
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400 mb-4">Failed to load creators</p>
                  <p className="text-xs text-zinc-600">{(error as Error)?.message || 'Unknown error'}</p>
                </div>
              ) : filteredCoins.length === 0 ? (
                // Empty state
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400">
                    {searchQuery ? 'No creators found matching your search' : 'No creators available'}
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
                <div className="px-6 py-4 border-t border-zinc-800 flex justify-center">
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    className="px-6 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
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

