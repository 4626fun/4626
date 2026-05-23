import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { ExplorePageShell } from '@/components/explore/ExplorePageShell'
import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreTableSurface } from '@/components/explore/ExploreTableSurface'
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
} from '@/features/explore/exploreShared'
import { shouldShowExploreTableLoading } from '@/features/explore/exploreListNavigation'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_24H',
  marketCap: 'MOST_VALUABLE',
  priceChange: 'TOP_GAINERS',
  new: 'NEW',
}

const PAGE_SIZE = 20
const CONTENT_SORT_VALUES = ['volume', 'marketCap', 'priceChange', 'new'] as const
const CONTENT_TIME_FILTER_VALUES = ['1d'] as const
const CONTENT_TIME_FILTERS = [{ label: '1D', value: '1d' }] as const

export function ExploreContent() {
  const [expandedFees, setExpandedFees] = useState<string | null>(null)

  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
    sortValues: CONTENT_SORT_VALUES,
    defaultSort: 'volume',
    timeValues: CONTENT_TIME_FILTER_VALUES,
    defaultTime: '1d',
    debugScope: 'explore-content',
    })

  const listType = SORT_TO_LIST_TYPE[currentSort] || 'TOP_VOLUME_24H'
  
  // Fetch migrated coins for accurate fee detection
  const { migratedCoins } = useMigratedCoins()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
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

  const { hasHorizontalOverflow, canScrollLeft, canScrollRight, handleBodyScroll, handleArrowClick } =
    useExploreHorizontalTableSync({
      bodyId: 'explore-content-body',
    })

  const columnScrollStops = useMemo(() => {
    const columns = getExploreColumns({ variant: 'content', timeframe: currentTimeFilter })
    return getHorizontalScrollStops(columns)
  }, [currentTimeFilter])

  const tablePending = shouldShowExploreTableLoading({
    isLoading,
    isFetching,
    hasRows: filteredCoins.length > 0,
  })

  return (
    <ExplorePageShell
      variant="table"
      tablePending={tablePending}
      tablePendingLabel="Loading content…"
      subnav={
        <ExploreSubnav
          searchPlaceholder="Search content"
          searchValue={searchQuery}
          onSearch={handleSearchChange}
          onTimeFilterChange={handleTimeFilterChange}
          onSortChange={handleSortChange}
          currentTimeFilter={currentTimeFilter}
          currentSort={currentSort}
          timeFilters={CONTENT_TIME_FILTERS}
          showTabs={false}
          showSearch={false}
          showMobileSortRow={false}
          volumeColumnNote={getZoraExploreVolumeNote(currentTimeFilter)}
        />
      }
      table={
        <>
          <ExploreTableSurface
            bodyId="explore-content-body"
            onBodyScroll={handleBodyScroll}
            header={<PoolTableHeader timeframe={currentTimeFilter} currentSort={currentSort} onSortChange={handleSortChange} />}
            body={
              <>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => <PoolRowSkeleton key={i} />)
                ) : isError ? (
                  <ExploreTableMessage title="Failed to load content" detail={(error as Error)?.message || 'Unknown error'} />
                ) : filteredCoins.length === 0 ? (
                  <ExploreTableMessage title={searchQuery ? 'No content found matching your search' : 'No content available'} />
                ) : (
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
                  containerClassName="px-6 py-4 border-t border-zinc-800 flex justify-center"
                />
              </>
            }
            hasHorizontalOverflow={hasHorizontalOverflow}
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
            onScrollLeft={() => handleArrowClick('left', columnScrollStops)}
            onScrollRight={() => handleArrowClick('right', columnScrollStops)}
            leftAriaLabel="Scroll content table left"
            rightAriaLabel="Scroll content table right"
          />
        </>
      }
      footer={!isLoading && filteredCoins.length > 0 ? `Showing ${filteredCoins.length} content coins` : null}
    />
  )
}
