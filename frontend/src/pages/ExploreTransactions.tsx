import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { ExploreMetricsDashboard } from '@/components/explore/ExploreMetricsDashboard'
import { useWindowInfiniteScrollLoadMore } from '@/hooks/useWindowInfiniteScrollLoadMore'
import { fetchZoraExplore } from '@/lib/zora/client'
import type { ZoraCoin } from '@/lib/zora/types'
import {
  getZoraExploreVolumeColumnRaw,
  getZoraExploreVolumeHeaderLabel,
  getZoraExploreVolumeNote,
} from '@/lib/zora/exploreVolume'
import { flattenExplorePagedNodes, formatShortAddress } from './exploreShared'

function formatTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatVolume(volume: string | undefined): string {
  if (!volume) return '$0'
  const num = parseFloat(volume)
  if (isNaN(num)) return '$0'
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function formatChange(delta: string | undefined): { positive: boolean } {
  if (!delta) return { positive: true }
  const num = parseFloat(delta)
  return { positive: num >= 0 }
}

function toTimestamp(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

function activityTimestamp(coin: ZoraCoin): number {
  const raw = coin as unknown as { lastTradedAt?: string; lastTradeAt?: string; tradedAt?: string; createdAt?: string }
  return (
    toTimestamp(raw.lastTradedAt) ||
    toTimestamp(raw.lastTradeAt) ||
    toTimestamp(raw.tradedAt) ||
    toTimestamp(raw.createdAt)
  )
}

function activityDateString(coin: ZoraCoin): string | undefined {
  const raw = coin as unknown as { lastTradedAt?: string; lastTradeAt?: string; tradedAt?: string; createdAt?: string }
  return raw.lastTradedAt ?? raw.lastTradeAt ?? raw.tradedAt ?? raw.createdAt
}

function timeFilterWindowMs(filter: string): number | null {
  switch (filter) {
    case '1h':
      return 60 * 60 * 1000
    case '1d':
      return 24 * 60 * 60 * 1000
    case '1w':
      return 7 * 24 * 60 * 60 * 1000
    case '1m':
      return 30 * 24 * 60 * 60 * 1000
    case '1y':
      return 365 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}

function ActivityRow({ coin, timeframe }: { coin: ZoraCoin; timeframe: string }) {
  const change = formatChange(coin.marketCapDelta24h)
  const isBuy = change.positive // Use price change as proxy for buy/sell indication
  
  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const symbol = coin.symbol || '???'
  const name = coin.name || 'Unknown'
  const volume = formatVolume(getZoraExploreVolumeColumnRaw(coin, timeframe))
  const time = formatTimeAgo(activityDateString(coin))
  const address = coin.address || ''
  const creatorAddress = coin.creatorAddress

  return (
    <Link
      to={`/explore/creators/base/${address}`}
      className="grid grid-cols-[64px_56px_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[80px_minmax(150px,2fr)_minmax(100px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)_50px] gap-4 items-center px-4 py-3 hover:bg-zinc-800/30 transition-colors text-sm"
    >
      {/* Type indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isBuy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          {isBuy ? (
            <ArrowDownLeft className="w-3 h-3 text-green-500" />
          ) : (
            <ArrowUpRight className="w-3 h-3 text-red-500" />
          )}
        </div>
        <span className={`text-sm font-medium hidden sm:inline ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
          {isBuy ? 'Buy' : 'Sell'}
        </span>
      </div>

      {/* Token */}
      <div className="flex items-center gap-3 min-w-0 justify-center sm:justify-start">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-zinc-400">{symbol.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0 flex-1 hidden sm:block">
          <div className="text-sm font-medium text-white truncate">{name}</div>
          <div className="text-xs text-zinc-500 truncate">{symbol}</div>
        </div>
      </div>

      {/* Volume */}
      <div className="flex flex-col items-end">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:hidden">Vol</span>
        <span className="text-sm text-white tabular-nums">{volume}</span>
      </div>

      {/* Time */}
      <div className="flex flex-col items-end">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:hidden">Time</span>
        <span className="text-sm text-zinc-500">{time}</span>
      </div>

      {/* Account */}
      <span className="hidden sm:block text-sm text-zinc-400">{formatShortAddress(creatorAddress)}</span>

      {/* External link */}
      <a
        href={`https://basescan.org/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:block text-zinc-500 hover:text-white transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </Link>
  )
}

function ActivityTableHeader({ timeframe }: { timeframe: string }) {
  const volLabel = getZoraExploreVolumeHeaderLabel(timeframe)
  return (
    <div className="hidden sm:grid grid-cols-[80px_minmax(150px,2fr)_minmax(100px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)_50px] gap-4 items-center px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-white/8 bg-vault-card/50">
      <span>Type</span>
      <span>Token</span>
      <span className="text-center">{volLabel}</span>
      <span className="text-center">Time ↓</span>
      <span>Creator</span>
      <span></span>
    </div>
  )
}

function ActivityRowSkeleton() {
  return (
    <div className="grid grid-cols-[64px_56px_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[80px_minmax(150px,2fr)_minmax(100px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)_50px] gap-4 items-center px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-zinc-800 animate-pulse" />
        <div className="hidden sm:block h-4 w-8 bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="flex items-center gap-3 justify-center sm:justify-start">
        <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
        <div className="space-y-2 flex-1 hidden sm:block">
          <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse" />
      <div className="hidden sm:block h-4 w-20 bg-zinc-800 rounded animate-pulse" />
      <div className="hidden sm:block h-4 w-4 bg-zinc-800 rounded animate-pulse" />
    </div>
  )
}

const PAGE_SIZE = 20

export function ExploreTransactions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')

  const currentTimeFilter = searchParams.get('time') || '1d'
  const currentSort = searchParams.get('sort') || 'volume'

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['explore', 'transactions', 'LAST_TRADED'],
    queryFn: async ({ pageParam }) => {
      const result = await fetchZoraExplore({
        list: 'LAST_TRADED',
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
    staleTime: 15_000, // Refresh more frequently for activity
  })

  // Flatten all pages into a single array
  const allActivity = useMemo(() => {
    const items = flattenExplorePagedNodes(data?.pages)
    return [...items].sort((a, b) => activityTimestamp(b) - activityTimestamp(a))
  }, [data?.pages])

  // Filter based on search query
  const filteredActivity = useMemo(() => {
    const windowMs = timeFilterWindowMs(currentTimeFilter)
    const newestActivityMs = allActivity.length > 0 ? activityTimestamp(allActivity[0]) : 0
    const cutoff = windowMs != null && newestActivityMs > 0 ? newestActivityMs - windowMs : null
    const timeScoped = cutoff != null
      ? allActivity.filter((coin) => activityTimestamp(coin) >= cutoff)
      : allActivity

    if (!searchQuery.trim()) return timeScoped
    const query = searchQuery.toLowerCase()
    return timeScoped.filter((coin) => {
      const name = (coin.name || '').toLowerCase()
      const symbol = (coin.symbol || '').toLowerCase()
      const address = (coin.address || '').toLowerCase()
      return name.includes(query) || symbol.includes(query) || address.includes(query)
    })
  }, [allActivity, currentTimeFilter, searchQuery])

  useWindowInfiniteScrollLoadMore({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  })

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

  return (
    <div className="relative pb-24 md:pb-0 min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-medium text-white mb-2">
            Recent activity
          </h1>
          <p className="text-zinc-400 text-sm">
            Recently traded coins across the Zora ecosystem.
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
            searchPlaceholder="Filter by token"
            onSearch={setSearchQuery}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
            volumeColumnNote={getZoraExploreVolumeNote(currentTimeFilter)}
          />
        </motion.div>

        {/* Activity Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="vault-surface overflow-hidden"
        >
          {/* Sticky header */}
          <div className="hidden sm:block sticky top-24 z-50 border-b border-white/8 bg-vault-bg shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
            <ActivityTableHeader timeframe={currentTimeFilter} />
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/6">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 10 }).map((_, i) => <ActivityRowSkeleton key={i} />)
            ) : isError ? (
              // Error state
              <div className="px-6 py-12 text-center">
                <p className="text-zinc-400 mb-4">Failed to load activity</p>
                <p className="text-xs text-zinc-600">{(error as Error)?.message || 'Unknown error'}</p>
              </div>
            ) : filteredActivity.length === 0 ? (
              // Empty state
              <div className="px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <ArrowUpRight className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-zinc-400 text-sm mb-2">
                  {searchQuery ? 'No activity found matching your search' : 'No recent activity'}
                </p>
              </div>
            ) : (
              // Activity rows
              filteredActivity.map((coin, index) => (
                <ActivityRow key={`${coin.address}-${index}`} coin={coin} timeframe={currentTimeFilter} />
              ))
            )}

            {/* Loading more indicator */}
            {isFetchingNextPage && (
              <>
                <ActivityRowSkeleton />
                <ActivityRowSkeleton />
                <ActivityRowSkeleton />
              </>
            )}
          </div>

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
        </motion.div>

        {/* Info footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-4 text-center text-xs text-zinc-600"
        >
          Showing {filteredActivity.length} recently traded tokens on Base
        </motion.div>
      </div>
    </div>
  )
}
