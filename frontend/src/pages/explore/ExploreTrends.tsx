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
import { useExploreTableSparklines } from '@/features/explore/useExploreTableSparklines'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_TRENDS_24H',
  marketCap: 'MOST_VALUABLE_TRENDS',
  priceChange: 'TRENDING_TRENDS',
  new: 'NEW_TRENDS',
}

const PAGE_SIZE = 20
const LIVE_REFETCH_MS = 12_000
const TRENDS_SORT_VALUES = ['volume', 'marketCap', 'priceChange', 'new'] as const
const TRENDS_TIME_FILTER_VALUES = ['1d'] as const
const TRENDS_TIME_FILTERS = [{ label: '1D', value: '1d' }] as const

export function ExploreTrends() {
  const [expandedFees, setExpandedFees] = useState<string | null>(null)

  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
    sortValues: TRENDS_SORT_VALUES,
    defaultSort: 'volume',
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
    isFetching,
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

  const { sparklines: tableSparklines } = useExploreTableSparklines(
    filteredCoins.map((coin) => coin.address),
    filteredCoins,
  )

  useWindowInfiniteScrollLoadMore({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

  const { hasHorizontalOverflow, canScrollLeft, canScrollRight, handleBodyScroll, handleArrowClick } =
    useExploreHorizontalTableSync({
      bodyId: 'explore-trends-body',
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
      tablePendingLabel="Loading trends…"
      subnav={
        <ExploreSubnav
          searchPlaceholder="Search trends"
          searchValue={searchQuery}
          onSearch={handleSearchChange}
          onTimeFilterChange={handleTimeFilterChange}
          onSortChange={handleSortChange}
          currentTimeFilter={currentTimeFilter}
          currentSort={currentSort}
          timeFilters={TRENDS_TIME_FILTERS}
          showTabs={false}
          showSearch={false}
          showMobileSortRow={false}
          volumeColumnNote={getZoraExploreVolumeNote(currentTimeFilter)}
        />
      }
      table={
        <>
          <ExploreTableSurface
            bodyId="explore-trends-body"
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
                        coin={coin}
                        timeframe={currentTimeFilter}
                        migratedCoins={migratedCoins ?? undefined}
                        trend30d={
                          coin.address
                            ? tableSparklines.get(String(coin.address).toLowerCase()) ?? null
                            : null
                        }
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
