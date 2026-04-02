import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useInfiniteQuery } from '@tanstack/react-query'

import { ExploreHorizontalScrollArrows } from '@/components/explore/ExploreHorizontalScrollArrows'
import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreMetricsDashboard } from '@/components/explore/ExploreMetricsDashboard'
import { PoolRow, PoolTableHeader, PoolRowSkeleton } from '@/components/explore/PoolRow'
import { ExploreLoadMoreButton, ExploreLoadingMoreRows, ExploreTableMessage } from '@/components/explore/ExploreUiPrimitives'
import { useExploreHorizontalTableSync } from '@/components/explore/useExploreHorizontalTableSync'
import { getExploreColumns, getHorizontalScrollStops } from '@/components/explore/tableColumns'
import { fetchZoraExplore } from '@/lib/zora/client'
import { useMigratedCoins } from '@/hooks/useMigratedCoins'
import { useWindowInfiniteScrollLoadMore } from '@/hooks/useWindowInfiniteScrollLoadMore'
import type { ZoraExploreListType } from '@/lib/zora/types'
import { getZoraExploreVolumeNote } from '@/lib/zora/exploreVolume'
import {
  flattenExplorePagedNodes,
  matchesCoinSearchQuery,
  useExploreSubnavParams,
} from './exploreShared'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_TRENDS_24H',
  marketCap: 'MOST_VALUABLE_TRENDS',
  priceChange: 'TRENDING_TRENDS',
  new: 'NEW_TRENDS',
}

const PAGE_SIZE = 20
const LIVE_REFETCH_MS = 12_000
const TRENDS_SORT_VALUES = ['volume', 'marketCap', 'priceChange', 'new'] as const
const TRENDS_TIME_FILTER_VALUES = ['1d', '1w', '1y'] as const

export function ExploreTrends() {
  const [expandedFees, setExpandedFees] = useState<string | null>(null)

  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
    sortValues: TRENDS_SORT_VALUES,
    defaultSort: 'volume',
    sortAliases: { fees24h: 'priceChange' },
    timeValues: TRENDS_TIME_FILTER_VALUES,
    defaultTime: '1d',
    debugScope: 'explore-trends',
    })

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
    return flattenExplorePagedNodes(data?.pages)
  }, [data?.pages])

  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return allCoins
    return allCoins.filter((coin) => matchesCoinSearchQuery(coin, searchQuery))
  }, [allCoins, searchQuery])

  useWindowInfiniteScrollLoadMore({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

  const { hasHorizontalOverflow, canScrollLeft, canScrollRight, handleHeaderScroll, handleBodyScroll, handleArrowClick } =
    useExploreHorizontalTableSync({
      headerId: 'explore-trends-header',
      bodyId: 'explore-trends-body',
    })

  const columnScrollStops = useMemo(() => {
    const columns = getExploreColumns({ variant: 'content', timeframe: currentTimeFilter })
    return getHorizontalScrollStops(columns)
  }, [currentTimeFilter])

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
            searchValue={searchQuery}
            onSearch={handleSearchChange}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
            volumeColumnNote={getZoraExploreVolumeNote(currentTimeFilter)}
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
              onScroll={handleHeaderScroll}
            >
              <div className="min-w-max">
                <PoolTableHeader timeframe={currentTimeFilter} currentSort={currentSort} onSortChange={handleSortChange} />
              </div>
            </div>
          </div>

          <ExploreHorizontalScrollArrows
            hasOverflow={hasHorizontalOverflow}
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
            onScrollLeft={() => handleArrowClick('left', columnScrollStops)}
            onScrollRight={() => handleArrowClick('right', columnScrollStops)}
            leftAriaLabel="Scroll trends table left"
            rightAriaLabel="Scroll trends table right"
          />

          {/* Table body with synced horizontal scroll */}
          <div
            className="overflow-x-auto scrollbar-hide"
            id="explore-trends-body"
            data-scrolled="0"
            onScroll={handleBodyScroll}
          >
            <div className="min-w-max divide-y divide-white/6">
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 10 }).map((_, i) => <PoolRowSkeleton key={i} />)
              ) : isError ? (
                // Error state
                <ExploreTableMessage title="Failed to load trends" detail={(error as Error)?.message || 'Unknown error'} />
              ) : filteredCoins.length === 0 ? (
                // Empty state
                <ExploreTableMessage title={searchQuery ? 'No trends found matching your search' : 'No trends available'} />
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
              <ExploreLoadingMoreRows
                isFetchingNextPage={isFetchingNextPage}
                renderSkeletonRow={() => <PoolRowSkeleton />}
              />

              <ExploreLoadMoreButton
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => {
                  void fetchNextPage()
                }}
              />
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
