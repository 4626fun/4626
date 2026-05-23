import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExplorePageShell } from '@/components/explore/ExplorePageShell'
import { ExploreTableSurface } from '@/components/explore/ExploreTableSurface'
import { TokenRow, TokenTableHeader, TokenRowSkeleton } from '@/components/explore/TokenRow'
import { ExploreLoadMoreButton, ExploreLoadingMoreRows, ExploreTableMessage } from '@/components/explore/ExploreUiPrimitives'
import { useExploreHorizontalTableSync } from '@/components/explore/useExploreHorizontalTableSync'
import { getExploreColumns, getHorizontalScrollStops } from '@/components/explore/tableColumns'
import { fetchZoraCoin, fetchZoraExplore, fetchZoraProfile, fetchZoraProfileCoins } from '@/lib/zora/client'
import { useMigratedCoins } from '@/hooks/useMigratedCoins'
import { useWindowInfiniteScrollLoadMore } from '@/hooks/useWindowInfiniteScrollLoadMore'
import type { ZoraCoin, ZoraExploreListType } from '@/lib/zora/types'
import { getZoraExploreVolumeNote } from '@/lib/zora/exploreVolume'
import { useScreenshotMode, useScreenshotReady } from '@/lib/ui/screenshotMode'
import { buildEthosSocialUserkeyFromZoraProfile, getZoraCreatorProfileIdentifier } from '@/lib/ethos/zoraSocial'
import { fetchEthosScoreForUserkey, type EthosScoreValue } from '@/components/chat/EthosScorePill'
import {
  flattenExplorePagedNodes,
  matchesCoinSearchQuery,
  normalizeCoinSearchQuery,
  recordExploreQueryRefresh,
  useDebouncedValue,
  useExploreSubnavParams,
} from '@/features/explore/exploreShared'
import { shouldShowExploreTableLoading } from '@/features/explore/exploreListNavigation'
import { useExploreCreatorsHeroMetrics } from '@/features/explore/useExploreCreatorsHeroMetrics'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_CREATORS_24H',
  marketCap: 'MOST_VALUABLE_CREATORS',
  // Keep creator-page sorts on creator-scoped lists for consistent candidate pools.
  priceChange: 'TRENDING_CREATORS',
  new: 'NEW_CREATORS',
}

const PAGE_SIZE = 20
const SEARCH_AUTO_FETCH_MAX_PAGES = 30
const REMOTE_SEARCH_MIN_QUERY_LENGTH = 3
const CREATORS_SORT_VALUES = ['volume', 'marketCap', 'priceChange', 'new', 'ethosScore'] as const
const CREATORS_TIME_FILTER_VALUES = ['1d'] as const
const CREATORS_TIME_FILTERS = [{ label: '1D', value: '1d' }] as const
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const CREATOR_SEARCH_MATCH_OPTIONS = {
  includeCreatorAddress: true,
  includePayoutAddress: true,
  includeQueryVariants: true,
  includeHandleBasenameVariant: true,
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
  source: string | null
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return null
  return n
}

function resolveBestEthosScore(...candidates: unknown[]): number | null {
  let best: number | null = null
  for (const candidate of candidates) {
    const parsed = toFiniteNumber(candidate)
    if (parsed == null || parsed <= 0) continue
    if (best == null || parsed > best) best = parsed
  }
  return best
}

function resolveBestEthosValue(
  serverValue: EthosScoreValue | null | undefined,
  queryValue: EthosScoreValue | null | undefined,
): EthosScoreValue | null {
  const serverScore = toFiniteNumber(serverValue?.score)
  const queryScore = toFiniteNumber(queryValue?.score)
  const bestScore = resolveBestEthosScore(serverScore, queryScore)
  if (bestScore == null) return null
  if (queryScore != null && queryScore === bestScore) return queryValue ?? null
  if (serverScore != null && serverScore === bestScore) return serverValue ?? null
  return { score: bestScore, level: queryValue?.level ?? serverValue?.level ?? null }
}

function resolveBestEthosSource(
  serverValue: EthosScoreValue | null | undefined,
  serverSource: string | null | undefined,
  queryValue: EthosScoreValue | null | undefined,
  querySource: string | null,
): string | null {
  const serverScore = toFiniteNumber(serverValue?.score)
  const queryScore = toFiniteNumber(queryValue?.score)
  const bestScore = resolveBestEthosScore(serverScore, queryScore)
  if (bestScore == null) return null
  if (queryScore != null && queryScore === bestScore) return querySource
  if (serverScore != null && serverScore === bestScore) return serverSource ?? null
  return serverSource ?? querySource
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
  const creator = typeof coin.creatorAddress === 'string' ? coin.creatorAddress.trim().toLowerCase() : ''
  if (/^0x[a-f0-9]{40}$/.test(creator)) return `address:${creator}`
  return null
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

export function ExploreCreators() {
  const [expandedFees, setExpandedFees] = useState<string | null>(null)
  const [collapseIdentity, setCollapseIdentity] = useState(false)
  const screenshotMode = useScreenshotMode()

  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
    sortValues: CREATORS_SORT_VALUES,
    defaultSort: 'volume',
    timeValues: CREATORS_TIME_FILTER_VALUES,
    defaultTime: '1d',
    debugScope: 'explore-creators',
    })

  const [ethosAnchorSort, setEthosAnchorSort] = useState<string>(
    SORT_TO_LIST_TYPE[currentSort] ? currentSort : 'volume',
  )
  const handleCreatorSortChange = useCallback(
    (nextSort: string) => {
      if (nextSort !== 'ethosScore' && SORT_TO_LIST_TYPE[nextSort]) {
        setEthosAnchorSort(nextSort)
      }
      handleSortChange(nextSort)
    },
    [handleSortChange],
  )

  const listSortKey = currentSort === 'ethosScore' ? ethosAnchorSort : currentSort
  const listType = SORT_TO_LIST_TYPE[listSortKey] || 'TOP_VOLUME_CREATORS_24H'
  
  // Fetch migrated coins for accurate fee detection
  const { migratedCoins } = useMigratedCoins()
  const { syncStatus, creatorsTotalCount } = useExploreCreatorsHeroMetrics()

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
    queryKey: ['explore', 'creators', listType, currentSort],
    queryFn: async ({ pageParam }) => {
      const result = await fetchZoraExplore({
        list: listType,
        count: PAGE_SIZE,
        after: pageParam,
        ...(currentSort === 'ethosScore' ? { sort: 'ETHOS_SCORE' as const } : {}),
      })
      return result
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pageInfo?.hasNextPage) return undefined
      return lastPage.pageInfo.endCursor
    },
    staleTime: 120_000,
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

  const useScreenshotFallback = screenshotMode.enabled && !trimmedSearchQuery && filteredCoins.length === 0
  const baseDisplayCoins = useScreenshotFallback ? SCREENSHOT_DEMO_COINS : filteredCoins

  const profileIdentifiers = useMemo(() => {
    return baseDisplayCoins
      .filter((coin) => !(typeof coin.ethosScore === 'number' && Number.isFinite(coin.ethosScore)))
      .filter((coin) => !deriveImmediateEthosUserkey(coin))
      .map((coin) => ({
      coinKey: getCoinKey(coin),
      identifier: getZoraCreatorProfileIdentifier(coin),
      immediateUserkey: deriveImmediateEthosUserkey(coin),
      }))
  }, [baseDisplayCoins])

  const profileQueries = useQueries({
    queries: profileIdentifiers.map(({ coinKey, identifier }) => ({
      queryKey: ['explore', 'creators', 'ethos-profile-userkey', coinKey, identifier],
      queryFn: async () => {
        if (!identifier) return null
        const profile = await fetchZoraProfile(identifier)
        return buildEthosSocialUserkeyFromZoraProfile(profile)
      },
      // Prefer social userkeys when available; wallet-address userkeys are fallback only.
      enabled: Boolean(identifier),
      staleTime: 6 * 60 * 60 * 1000,
      retry: 1,
    })),
  })

  const coinEthosUserkeys = useMemo(() => {
    const out = new Map<string, string>()
    profileIdentifiers.forEach((entry, index) => {
      const userkey = profileQueries[index]?.data ?? entry.immediateUserkey ?? null
      if (userkey) out.set(entry.coinKey, userkey)
    })
    return out
  }, [profileIdentifiers, profileQueries])

  const coinsNeedingClientEthosLookup = useMemo(
    () =>
      baseDisplayCoins.filter(
        (coin) => !(typeof coin.ethosScore === 'number' && Number.isFinite(coin.ethosScore)),
      ),
    [baseDisplayCoins],
  )

  const ethosScoreQueries = useQueries({
    queries: coinsNeedingClientEthosLookup.map((coin) => {
      const coinKey = getCoinKey(coin)
      const userkey = coinEthosUserkeys.get(coinKey) ?? deriveImmediateEthosUserkey(coin)
      return {
        queryKey: ['explore', 'creators', 'ethos-score', coinKey, userkey],
        queryFn: () => fetchEthosScoreForUserkey(userkey!),
        enabled: Boolean(userkey),
        staleTime: 6 * 60 * 60 * 1000,
        retry: 1,
      }
    }),
  })

  const clientEthosScoreByCoinKey = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof fetchEthosScoreForUserkey>> | null>()
    coinsNeedingClientEthosLookup.forEach((coin, index) => {
      map.set(getCoinKey(coin), ethosScoreQueries[index]?.data ?? null)
    })
    return map
  }, [coinsNeedingClientEthosLookup, ethosScoreQueries])

  const ethosByCoinKey = useMemo(() => {
    const out = new Map<string, CreatorEthosRecord>()
    for (const coin of baseDisplayCoins) {
      const key = getCoinKey(coin)
      const hasServerEthosScore = typeof coin.ethosScore === 'number' && Number.isFinite(coin.ethosScore)
      if (!hasServerEthosScore) continue
      out.set(key, {
        coinKey: key,
        userkey: coinEthosUserkeys.get(key) ?? deriveImmediateEthosUserkey(coin),
        score: {
          score: Number(coin.ethosScore),
          level: typeof coin.ethosLevel === 'string' ? coin.ethosLevel : null,
        },
        source: typeof coin.ethosScoreSource === 'string' ? coin.ethosScoreSource : null,
      })
    }
    for (const coin of coinsNeedingClientEthosLookup) {
      const coinKey = getCoinKey(coin)
      const userkey = coinEthosUserkeys.get(coinKey) ?? deriveImmediateEthosUserkey(coin)
      if (!userkey) continue
      const queryScore = clientEthosScoreByCoinKey.get(coinKey) ?? null
      const existing = out.get(coinKey)
      if (!existing) {
        out.set(coinKey, {
          coinKey,
          userkey,
          score: queryScore,
          source: queryScore ? 'chat_bulk_userkey' : null,
        })
        continue
      }
      out.set(coinKey, {
        coinKey,
        userkey: existing.userkey ?? userkey,
        score: resolveBestEthosValue(existing.score, queryScore),
        source: resolveBestEthosSource(existing.score, existing.source, queryScore, 'chat_bulk_userkey'),
      })
    }
    return out
  }, [baseDisplayCoins, clientEthosScoreByCoinKey, coinEthosUserkeys, coinsNeedingClientEthosLookup])

  const displayCoins = baseDisplayCoins

  const hasScreenshotFallbackRows = useScreenshotFallback && displayCoins.length > 0
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

  const { hasHorizontalOverflow, canScrollLeft, canScrollRight, handleBodyScroll, handleArrowClick } =
    useExploreHorizontalTableSync({
      bodyId: 'explore-creators-body',
      onControlsChange: onHorizontalControlsChange,
    })

  const columnScrollStops = useMemo(() => {
    const columns = getExploreColumns({ variant: 'creators', timeframe: currentTimeFilter, collapseIdentity })
    return getHorizontalScrollStops(columns)
  }, [currentTimeFilter, collapseIdentity])

  const tablePending = shouldShowExploreTableLoading({
    isLoading,
    isFetching,
    hasRows: displayCoins.length > 0,
  })

  return (
    <ExplorePageShell
      variant="table"
      tablePending={tablePending}
      tablePendingLabel="Loading creators…"
      subnav={
        <ExploreSubnav
          searchPlaceholder="Search creators"
          searchValue={searchQuery}
          onSearch={handleSearchChange}
          onTimeFilterChange={handleTimeFilterChange}
          onSortChange={handleCreatorSortChange}
          currentTimeFilter={currentTimeFilter}
          currentSort={currentSort}
          timeFilters={CREATORS_TIME_FILTERS}
          showTabs={false}
          showSearch={false}
          showMobileSortRow={false}
          sortOptions={[
            { label: 'Volume', value: 'volume' },
            { label: 'Market cap', value: 'marketCap' },
            { label: 'Price change', value: 'priceChange' },
            { label: 'Ethos score', value: 'ethosScore' },
            { label: 'Recently added', value: 'new' },
          ]}
          volumeColumnNote={getZoraExploreVolumeNote(currentTimeFilter)}
        />
      }
      table={
        <>
          <ExploreTableSurface
            bodyId="explore-creators-body"
            onBodyScroll={handleBodyScroll}
            header={
              <TokenTableHeader
                timeframe={currentTimeFilter}
                collapseIdentity={collapseIdentity}
                currentSort={currentSort}
                onSortChange={handleCreatorSortChange}
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
