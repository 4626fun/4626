import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { ExplorePageShell } from '@/components/explore/ExplorePageShell'
import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreMetricsDashboard } from '@/components/explore/ExploreMetricsDashboard'
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
    <ExplorePageShell
      title="Top Trends on Base"
      subtitle="Trend Coins ranked by trend velocity, volume, and market cap."
      headerContent={<ExploreMetricsDashboard className="mt-4 sm:mt-6" />}
      subnav={
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
      }
      table={
        <>
          <ExploreTableSurface
            headerId="explore-trends-header"
            bodyId="explore-trends-body"
            onHeaderScroll={handleHeaderScroll}
            onBodyScroll={handleBodyScroll}
            header={<PoolTableHeader timeframe={currentTimeFilter} currentSort={currentSort} onSortChange={handleSortChange} />}
            body={
              <>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => <PoolRowSkeleton key={i} />)
                ) : isError ? (
                  <ExploreTableMessage title="Failed to load trends" detail={(error as Error)?.message || 'Unknown error'} />
                ) : filteredCoins.length === 0 ? (
                  <ExploreTableMessage title={searchQuery ? 'No trends found matching your search' : 'No trends available'} />
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
                />
              </>
            }
            hasHorizontalOverflow={hasHorizontalOverflow}
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
            onScrollLeft={() => handleArrowClick('left', columnScrollStops)}
            onScrollRight={() => handleArrowClick('right', columnScrollStops)}
            leftAriaLabel="Scroll trends table left"
            rightAriaLabel="Scroll trends table right"
          />
        </>
      }
      footer={!isLoading && filteredCoins.length > 0 ? `Showing ${filteredCoins.length} trend coins` : null}
    />
  )
}
