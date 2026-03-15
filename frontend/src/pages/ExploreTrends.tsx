import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreMetricsDashboard } from '@/components/explore/ExploreMetricsDashboard'
import { PoolRow, PoolTableHeader, PoolRowSkeleton } from '@/components/explore/PoolRow'
import { getExploreColumns } from '@/components/explore/tableColumns'
import { fetchZoraExplore } from '@/lib/zora/client'
import { useMigratedCoins } from '@/hooks/useMigratedCoins'
import type { ZoraCoin, ZoraExploreListType } from '@/lib/zora/types'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_TRENDS_24H',
  marketCap: 'MOST_VALUABLE_TRENDS',
  priceChange: 'TRENDING_TRENDS',
  new: 'NEW_TRENDS',
}

const PAGE_SIZE = 20
const LIVE_REFETCH_MS = 12_000

export function ExploreTrends() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFees, setExpandedFees] = useState<string | null>(null)
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const currentTimeFilter = searchParams.get('time') || '1d'
  const currentSort = searchParams.get('sort') || 'volume'

  const listType = SORT_TO_LIST_TYPE[currentSort] || 'TOP_VOLUME_TRENDS_24H'

  // Fetch migrated coins for accurate fee detection
  const { migratedCoins } = useMigratedCoins()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['explore', 'trends', listType],
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
    staleTime: LIVE_REFETCH_MS,
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: true,
  })

  const allCoins = useMemo(() => {
    if (!data?.pages) return []
    const coins: ZoraCoin[] = []
    for (const page of data.pages) {
      if (!page?.edges) continue
      for (const edge of page.edges) {
        if (edge?.node) coins.push(edge.node)
      }
    }
    return coins
  }, [data])

  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return allCoins
    const query = searchQuery.toLowerCase()
    return allCoins.filter((coin) => {
      const name = (coin.name || '').toLowerCase()
      const symbol = (coin.symbol || '').toLowerCase()
      const address = (coin.address || '').toLowerCase()
      const creator = (coin.creatorProfile?.handle || '').toLowerCase()
      return name.includes(query) || symbol.includes(query) || address.includes(query) || creator.includes(query)
    })
  }, [allCoins, searchQuery])

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
    setHasHorizontalOverflow(overflow)
    setCanScrollLeft(overflow && !atLeftEdge)
    setCanScrollRight(overflow && !atRightEdge)
  }, [])

  useEffect(() => {
    const body = document.getElementById('explore-trends-body')
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
    const columns = getExploreColumns({ variant: 'content', timeframe: currentTimeFilter })
    const nonStickyWidths = columns.filter((c) => !c.sticky).map((c) => c.widthPx)
    const stops: number[] = [0]
    let acc = 0
    for (const width of nonStickyWidths) {
      acc += width
      stops.push(acc)
    }
    return stops
  }, [currentTimeFilter])

  const handleHorizontalArrowClick = (direction: 'left' | 'right') => {
    const body = document.getElementById('explore-trends-body')
    if (!body) return
    const maxLeft = Math.max(0, body.scrollWidth - body.clientWidth)
    const currentLeft = body.scrollLeft

    if (direction === 'right') {
      const nextStop = columnScrollStops.find((stop) => stop > currentLeft + 1) ?? maxLeft
      body.scrollTo({ left: Math.min(maxLeft, nextStop), behavior: 'smooth' })
      return
    }

    let prevStop = 0
    for (let i = columnScrollStops.length - 1; i >= 0; i -= 1) {
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
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-4 sm:pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mb-1 sm:mb-2">
            Top Trends on Base
          </h1>
          <p className="text-zinc-400 text-[13px] sm:text-sm">
            Trend Coins ranked by trend velocity, volume, and market cap.
          </p>

          <ExploreMetricsDashboard className="mt-4 sm:mt-6" />
        </motion.div>

        {/* Navigation & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <ExploreSubnav
            searchPlaceholder="Search trends"
            onSearch={setSearchQuery}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
          />
        </motion.div>

        {/* Pool Table */}
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
              id="explore-trends-header"
              data-scrolled="0"
              onScroll={(e) => {
                const body = document.getElementById('explore-trends-body')
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
                <PoolTableHeader timeframe={currentTimeFilter} currentSort={currentSort} onSortChange={handleSortChange} />
              </div>
            </div>
          </div>

          {hasHorizontalOverflow && canScrollLeft ? (
            <div className="absolute left-2 top-10 z-60">
              <button
                type="button"
                onClick={() => handleHorizontalArrowClick('left')}
                aria-label="Scroll trends table left"
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
                aria-label="Scroll trends table right"
                className={arrowButtonClass}
              >
                <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {/* Table body with synced horizontal scroll */}
          <div
            className="overflow-x-auto scrollbar-hide"
            id="explore-trends-body"
            data-scrolled="0"
            onScroll={(e) => {
              const header = document.getElementById('explore-trends-header')
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
                Array.from({ length: 10 }).map((_, i) => <PoolRowSkeleton key={i} />)
              ) : isError ? (
                // Error state
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400 mb-4">Failed to load trends</p>
                  <p className="text-xs text-zinc-600">{(error as Error)?.message || 'Unknown error'}</p>
                </div>
              ) : filteredCoins.length === 0 ? (
                // Empty state
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400">
                    {searchQuery ? 'No trends found matching your search' : 'No trends available'}
                  </p>
                </div>
              ) : (
                // Pool rows
                filteredCoins.map((coin, index) => {
                  const rowId = coin.address ? String(coin.address).toLowerCase() : `row-${index}`
                  const isExpanded = expandedFees === rowId
                  return (
                    <PoolRow
                      key={coin.address || index}
                      rank={index + 1}
                      coin={coin}
                      timeframe={currentTimeFilter}
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
                  <PoolRowSkeleton />
                  <PoolRowSkeleton />
                  <PoolRowSkeleton />
                </>
              )}

              {/* Load more button (fallback for scroll) */}
              {hasNextPage && !isFetchingNextPage && (
                <div className="px-6 py-4 border-t border-white/8 flex justify-center">
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
            Showing {filteredCoins.length} trend coins
          </motion.div>
        )}
      </div>
    </div>
  )
}

