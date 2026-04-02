import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useInfiniteQuery } from '@tanstack/react-query'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreMetricsDashboard } from '@/components/explore/ExploreMetricsDashboard'
import { PoolRow, PoolTableHeader, PoolRowSkeleton } from '@/components/explore/PoolRow'
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
  volume: 'TOP_VOLUME_24H',
  marketCap: 'MOST_VALUABLE',
  priceChange: 'TOP_GAINERS',
  new: 'NEW',
}

const PAGE_SIZE = 20
const CONTENT_SORT_VALUES = ['volume', 'marketCap', 'priceChange', 'new'] as const
const CONTENT_TIME_FILTER_VALUES = ['1d', '1w', '1y'] as const

export function ExploreContent() {
  const [expandedFees, setExpandedFees] = useState<string | null>(null)

  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
    sortValues: CONTENT_SORT_VALUES,
    defaultSort: 'volume',
    sortAliases: { fees24h: 'priceChange' },
    timeValues: CONTENT_TIME_FILTER_VALUES,
    defaultTime: '1d',
    })

  const listType = SORT_TO_LIST_TYPE[currentSort] || 'TOP_VOLUME_24H'
  
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
    queryKey: ['explore', 'content', listType],
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

  // Flatten all pages into a single array of content coins
  const allCoins = useMemo(() => {
    return flattenExplorePagedNodes(data?.pages, {
      filter: (coin) => coin.coinType === 'CONTENT',
    })
  }, [data?.pages])

  // Filter coins based on search query
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return allCoins
    return allCoins.filter((coin) => matchesCoinSearchQuery(coin, searchQuery))
  }, [allCoins, searchQuery])

  useWindowInfiniteScrollLoadMore({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

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
            Top Content on Base
          </h1>
          <p className="text-zinc-400 text-[13px] sm:text-sm">
            Content Coins ranked by volume, market cap, and more.
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
            searchPlaceholder="Search content"
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
              id="explore-content-header"
              data-scrolled="0"
              onScroll={(e) => {
                const body = document.getElementById('explore-content-body')
                const scrolled = e.currentTarget.scrollLeft > 0
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

          {/* Table body with synced horizontal scroll */}
          <div 
            className="overflow-x-auto scrollbar-hide" 
            id="explore-content-body"
            data-scrolled="0"
            onScroll={(e) => {
              const header = document.getElementById('explore-content-header')
              const scrolled = e.currentTarget.scrollLeft > 0
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
                  <p className="text-zinc-400 mb-4">Failed to load content</p>
                  <p className="text-xs text-zinc-600">{(error as Error)?.message || 'Unknown error'}</p>
                </div>
              ) : filteredCoins.length === 0 ? (
                // Empty state
                <div className="px-6 py-12 text-center">
                  <p className="text-zinc-400">
                    {searchQuery ? 'No content found matching your search' : 'No content available'}
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
            Showing {filteredCoins.length} content coins
          </motion.div>
        )}
      </div>
    </div>
  )
}
