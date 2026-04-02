import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'

import type { ApiEnvelope } from '@/lib/apiEnvelope'
import { apiFetch } from '@/lib/apiBase'
import { API_ENDPOINTS } from '@/lib/apiEndpoints'
import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreMetricsDashboard } from '@/components/explore/ExploreMetricsDashboard'
import { ExploreLoadMoreButton, ExploreLoadingMoreRows, ExploreTableRowMessage } from '@/components/explore/ExploreUiPrimitives'
import { useWindowInfiniteScrollLoadMore } from '@/hooks/useWindowInfiniteScrollLoadMore'
import {
  formatDateLabel,
  formatShortAddress,
  formatUsd,
  recordExploreQueryRefresh,
  useDebouncedValue,
  useExploreSubnavParams,
} from './exploreShared'

type ExploreVaultItem = {
  vaultAddress: `0x${string}` | null
  chainId: number
  creatorCoinAddress: `0x${string}` | null
  shareTokenAddress: `0x${string}` | null
  groupId: string
  graduatedAt: string | null
  settledAt: string | null
  settlementStage: string | null
  createdAt: string | null
  updatedAt: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  fees24hUsd: number | null
}

type ExploreVaultsPage = {
  items: ExploreVaultItem[]
  count: number
  nextCursor: string | null
}

const PAGE_SIZE = 30
const BASE_CHAIN_ID = 8453
const VAULT_SORT_OPTIONS = [
  { label: '24h volume', value: 'volume' },
  { label: 'Market cap', value: 'marketCap' },
  { label: '24h fees', value: 'fees24h' },
  { label: 'Recently updated', value: 'new' },
] as const
const VAULT_SORT_VALUES = ['volume', 'marketCap', 'fees24h', 'new'] as const
const VAULT_TIME_FILTERS = [
  { label: '24H', value: '1d' },
  { label: '7D', value: '1w' },
  { label: 'All', value: '1y' },
] as const
const VAULT_TIME_FILTER_VALUES = ['1d', '1w', '1y'] as const

function formatMetricUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return formatUsd(value)
}

function getVaultStatus(item: ExploreVaultItem): { label: string; className: string } {
  if (item.settledAt) {
    return { label: 'Settled', className: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' }
  }
  if (item.settlementStage) {
    return {
      label: `Settlement: ${item.settlementStage}`,
      className: 'border-amber-400/30 bg-amber-500/15 text-amber-100',
    }
  }
  if (item.graduatedAt) {
    return { label: 'Graduated', className: 'border-sky-400/30 bg-sky-500/15 text-sky-100' }
  }
  return { label: 'Active', className: 'border-blue-400/30 bg-blue-500/15 text-blue-100' }
}

async function fetchExploreVaultsPage(params: {
  cursor?: string
  sort: string
  time: string
  query: string
  chainId?: number
}): Promise<ExploreVaultsPage> {
  const searchParams = new URLSearchParams()
  searchParams.set('limit', String(PAGE_SIZE))
  searchParams.set('sort', params.sort)
  searchParams.set('time', params.time)
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.chainId != null) searchParams.set('chainId', String(params.chainId))

  const normalizedQuery = params.query.trim()
  if (normalizedQuery) searchParams.set('query', normalizedQuery)

  const res = await apiFetch(`${API_ENDPOINTS.explore.vaults}?${searchParams.toString()}`, { method: 'GET' })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<ExploreVaultsPage> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error((json && typeof json.error === 'string' && json.error) || 'Failed to load vaults')
  }
  return json.data
}

function VaultRowSkeleton({ rowKey }: { rowKey: string }) {
  return (
    <tr key={rowKey} className="border-b border-white/6">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 w-full max-w-[90px] rounded bg-white/7 animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

export function ExploreVaults() {
  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
    sortValues: VAULT_SORT_VALUES,
    defaultSort: 'volume',
    sortAliases: { priceChange: 'fees24h' },
    timeValues: VAULT_TIME_FILTER_VALUES,
    defaultTime: '1d',
    debugScope: 'explore-vaults',
    })
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const debouncedSearchQuery = useDebouncedValue(normalizedSearchQuery, 250)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['explore', 'vaults', currentSort, currentTimeFilter, debouncedSearchQuery],
    queryFn: async ({ pageParam }) => {
      recordExploreQueryRefresh('explore-vaults', debouncedSearchQuery)
      return fetchExploreVaultsPage({
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
        sort: currentSort,
        time: currentTimeFilter,
        query: debouncedSearchQuery,
        chainId: BASE_CHAIN_ID,
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })

  const vaults = useMemo(
    () => data?.pages.flatMap((page) => (Array.isArray(page.items) ? page.items : [])) ?? [],
    [data?.pages],
  )

  useWindowInfiniteScrollLoadMore({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

  return (
    <div className="relative min-h-screen pt-1 sm:pt-2">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-4 sm:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mb-1 sm:mb-2">
            Vaults on Base
          </h1>
          <p className="text-zinc-400 text-[13px] sm:text-sm">
            Discover active, graduated, and settled vaults with live creator coin metrics.
          </p>

          <ExploreMetricsDashboard className="mt-4 sm:mt-6" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <ExploreSubnav
            searchPlaceholder="Search vault, creator coin, or group"
            searchValue={searchQuery}
            onSearch={handleSearchChange}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
            volumeColumnNote="24h volume/fees come from creator coin snapshots; market cap reflects latest sampled value."
            sortOptions={VAULT_SORT_OPTIONS}
            timeFilters={VAULT_TIME_FILTERS}
            disableUniswapTimeGating
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="vault-surface overflow-hidden"
        >
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="sticky top-0 z-20 border-b border-white/8 bg-vault-bg/95 backdrop-blur">
                <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Vault</th>
                  <th className="px-3 py-3 font-medium">Creator Coin</th>
                  <th className="px-3 py-3 font-medium">Share Token</th>
                  <th className="px-3 py-3 font-medium">Market Cap</th>
                  <th className="px-3 py-3 font-medium">24h Volume</th>
                  <th className="px-3 py-3 font-medium">24h Fees</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => <VaultRowSkeleton key={`skeleton-${i}`} rowKey={`skeleton-${i}`} />)
                ) : isError ? (
                  <ExploreTableRowMessage
                    colSpan={9}
                    title="Failed to load vaults"
                    detail={(error as Error)?.message || 'Unknown error'}
                  />
                ) : vaults.length === 0 ? (
                  <ExploreTableRowMessage
                    colSpan={9}
                    title={normalizedSearchQuery ? 'No vaults found for that search' : 'No vaults available yet'}
                  />
                ) : (
                  vaults.map((item, index) => {
                    const status = getVaultStatus(item)
                    const rowKey = item.vaultAddress ?? `${item.groupId}-${index}`
                    const updatedAt = item.updatedAt ?? item.createdAt

                    return (
                      <tr key={rowKey} className="border-b border-white/6 hover:bg-white/3 transition-colors">
                        <td className="px-3 py-3 text-zinc-500 tabular-nums">{index + 1}</td>
                        <td className="px-3 py-3">
                          {item.vaultAddress ? (
                            <div className="flex flex-col gap-0.5">
                              <Link
                                to={`/vault/${item.vaultAddress}`}
                                className="font-mono text-zinc-100 hover:text-white transition-colors"
                              >
                                {formatShortAddress(item.vaultAddress)}
                              </Link>
                              <span className="text-[11px] text-zinc-500">Group {item.groupId || '-'}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono">
                          {item.creatorCoinAddress ? (
                            <Link
                              to={`/explore/creators/base/${item.creatorCoinAddress}`}
                              className="text-zinc-200 hover:text-white transition-colors"
                            >
                              {formatShortAddress(item.creatorCoinAddress)}
                            </Link>
                          ) : (
                            <span className="text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-zinc-300">
                          {item.shareTokenAddress ? formatShortAddress(item.shareTokenAddress) : '-'}
                        </td>
                        <td className="px-3 py-3 text-zinc-100 tabular-nums">{formatMetricUsd(item.marketCapUsd)}</td>
                        <td className="px-3 py-3 text-zinc-100 tabular-nums">{formatMetricUsd(item.volume24hUsd)}</td>
                        <td className="px-3 py-3 text-zinc-100 tabular-nums">{formatMetricUsd(item.fees24hUsd)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-zinc-400">{formatDateLabel(updatedAt ?? undefined)}</td>
                      </tr>
                    )
                  })
                )}

                <ExploreLoadingMoreRows
                  isFetchingNextPage={isFetchingNextPage}
                  renderSkeletonRow={(rowKey) => <VaultRowSkeleton rowKey={rowKey} />}
                />
              </tbody>
            </table>
          </div>

          <ExploreLoadMoreButton
            hasNextPage={Boolean(hasNextPage)}
            isFetchingNextPage={isFetchingNextPage}
            disabled={isLoading || isError}
            onLoadMore={() => {
              void fetchNextPage()
            }}
            label="Load more vaults"
            buttonClassName="px-6 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/7 transition-colors"
          />
        </motion.div>

        {!isLoading && vaults.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-4 text-center text-xs text-zinc-600"
          >
            Showing {vaults.length} vaults
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
