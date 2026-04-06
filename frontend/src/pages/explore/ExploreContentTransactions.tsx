import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { PageMeta } from '@/components/seo/PageMeta'
import { getPoolsByToken, getPoolSwaps } from '@/lib/uniswap/client'
import type { UniswapPool } from '@/lib/uniswap/types'
import { fetchZoraCoin } from '@/lib/zora/client'
import {
  formatCount,
  formatDateLabel,
  formatShortAddress,
  formatTimestamp,
  formatTokenAmount,
  formatUsd,
  isSupportedExploreChain,
  parseNumber,
  toDisplayAssetUrl,
  useExploreSubnavParams,
} from '@/features/explore/exploreShared'

const CONTENT_TRANSACTIONS_TIME_FILTERS = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: 'All-time', value: '1y' },
] as const

const CONTENT_TRANSACTIONS_SORT_OPTIONS = [
  { label: 'Newest', value: 'new' },
  { label: 'USD', value: 'volume' },
] as const
const CONTENT_TRANSACTIONS_SORT_VALUES = ['new', 'volume'] as const
const CONTENT_TRANSACTIONS_TIME_FILTER_VALUES = ['1d', '1w', '1y'] as const

function toRowTimestampMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value < 1_000_000_000_000 ? value * 1000 : value
}

function contentTransactionsWindowMs(filter: string): number | null {
  switch (filter) {
    case '1d':
      return 24 * 60 * 60 * 1000
    case '1w':
      return 7 * 24 * 60 * 60 * 1000
    case '1y':
      return 365 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}

export function ExploreContentTransactions() {
  const { currentTimeFilter, currentSort, searchQuery, handleSearchChange, handleTimeFilterChange, handleSortChange } =
    useExploreSubnavParams({
      sortValues: CONTENT_TRANSACTIONS_SORT_VALUES,
      defaultSort: 'new',
      timeValues: CONTENT_TRANSACTIONS_TIME_FILTER_VALUES,
      defaultTime: '1d',
      debugScope: 'explore-content-transactions',
    })

  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const contentCoinAddressRaw = String(params.contentCoinAddress ?? '').trim()
  const contentCoinAddress = isAddress(contentCoinAddressRaw) ? getAddress(contentCoinAddressRaw) : null

  const isValid = Boolean(chain && isSupportedExploreChain(chain) && contentCoinAddress)
  const queryAddress = (contentCoinAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

  const { data: coin } = useQuery({
    queryKey: ['coin', queryAddress, 'transactionsPage'],
    queryFn: async () => fetchZoraCoin(queryAddress, 8453),
    enabled: isValid,
    staleTime: 30_000,
  })

  const { data: pools = [], isLoading: poolsLoading } = useQuery({
    queryKey: ['uniswap', 'poolsByToken', queryAddress],
    queryFn: async () => getPoolsByToken(queryAddress),
    enabled: isValid,
    staleTime: 60_000,
  })

  const primaryPool = useMemo<UniswapPool | null>(() => {
    if (!pools.length) return null
    return [...pools].sort((a, b) => parseNumber(b.totalValueLockedUSD) - parseNumber(a.totalValueLockedUSD))[0]
  }, [pools])

  const { data: swaps = [], isLoading: swapsLoading, dataUpdatedAt: swapsDataUpdatedAt } = useQuery({
    queryKey: ['uniswap', 'poolSwaps', primaryPool?.id, 'transactionsPage'],
    queryFn: async () => {
      if (!primaryPool?.id) return []
      return getPoolSwaps(primaryPool.id, 100)
    },
    enabled: Boolean(primaryPool?.id),
    staleTime: 30_000,
  })

  const rows = useMemo(() => {
    const contentAddressLower = contentCoinAddress?.toLowerCase() ?? ''
    return swaps.map((swap) => {
      const amount0 = parseNumber(swap.amount0)
      const amount1 = parseNumber(swap.amount1)
      const contentInToken0 = swap.token0.id.toLowerCase() === contentAddressLower
      const contentAmount = contentInToken0 ? amount0 : amount1
      return {
        id: swap.id,
        timestamp: parseNumber(swap.timestamp || swap.transaction?.timestamp),
        side: contentAmount < 0 ? 'Buy' : contentAmount > 0 ? 'Sell' : 'Swap',
        amountUsd: parseNumber(swap.amountUSD),
        amount0,
        amount1,
        token0Symbol: swap.token0.symbol || 'TOKEN0',
        token1Symbol: swap.token1.symbol || 'TOKEN1',
        wallet: swap.origin || swap.sender || '',
        txHash: swap.transaction?.id || '',
      }
    })
  }, [swaps, contentCoinAddress])

  const filteredRows = useMemo(() => {
    if (rows.length === 0) return rows
    const windowMs = contentTransactionsWindowMs(currentTimeFilter)
    const cutoffMs = windowMs != null && swapsDataUpdatedAt > 0 ? swapsDataUpdatedAt - windowMs : null
    const trimmedQuery = searchQuery.trim().toLowerCase()

    const scopedRows =
      cutoffMs == null
        ? rows
        : rows.filter((row) => {
            const rowTsMs = toRowTimestampMs(row.timestamp)
            return rowTsMs >= cutoffMs
          })

    const searchFiltered =
      trimmedQuery.length === 0
        ? scopedRows
        : scopedRows.filter((row) => {
            const symbol0 = row.token0Symbol.toLowerCase()
            const symbol1 = row.token1Symbol.toLowerCase()
            const wallet = row.wallet.toLowerCase()
            const txHash = row.txHash.toLowerCase()
            const side = row.side.toLowerCase()
            return (
              symbol0.includes(trimmedQuery) ||
              symbol1.includes(trimmedQuery) ||
              wallet.includes(trimmedQuery) ||
              txHash.includes(trimmedQuery) ||
              side.includes(trimmedQuery)
            )
          })

    if (currentSort === 'volume') {
      return [...searchFiltered].sort((a, b) => b.amountUsd - a.amountUsd)
    }

    return [...searchFiltered].sort((a, b) => toRowTimestampMs(b.timestamp) - toRowTimestampMs(a.timestamp))
  }, [currentSort, currentTimeFilter, rows, searchQuery, swapsDataUpdatedAt])

  if (!isValid || !contentCoinAddress) {
    return <Navigate replace to="/explore/transactions" />
  }

  const name = coin?.name || 'Content Coin'
  const symbol = coin?.symbol || 'CONTENT'
  const description = coin?.description?.trim() || 'Live swap events for this content coin market.'
  const creatorHandle = coin?.creatorProfile?.handle
  const mediaUrl = toDisplayAssetUrl(coin?.mediaContent?.previewImage?.medium || coin?.mediaContent?.originalUri)
  const marketCapUsd = parseNumber(coin?.marketCap)
  const holders = parseNumber(coin?.uniqueHolders)
  const createdLabel = formatDateLabel(coin?.createdAt)
  const canonicalPath = `/explore/content/${chain.toLowerCase()}/${contentCoinAddress}/transactions`

  return (
    <div className="relative pb-24 md:pb-0">
      <PageMeta
        title={`${name} (${symbol}) Transactions`}
        description={description}
        canonicalPath={canonicalPath}
        ogImage={mediaUrl}
      />
      <section className="cinematic-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <span className="label">Transactions</span>
            <h1 className="headline text-3xl sm:text-5xl mt-4">{name}</h1>
            <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{contentCoinAddress}</div>
            {primaryPool ? (
              <div className="mt-3 text-sm text-zinc-400">
                Pool: {primaryPool.token0.symbol} / {primaryPool.token1.symbol}
              </div>
            ) : null}
          </motion.div>

          <div className="mb-8 rounded-3xl border border-white/8 bg-white/4 overflow-hidden">
            <div className="relative p-5 sm:px-7 sm:py-7">
              {mediaUrl ? (
                <>
                  <img src={mediaUrl} alt={name} className="absolute inset-0 w-full h-full object-cover opacity-18 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/75 to-zinc-900/90 pointer-events-none" />
                </>
              ) : null}
              <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-fuchsia-500/15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <span className="inline-flex items-center rounded-full border border-zinc-700 bg-vault-card/60/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                    Zora Content Coin
                  </span>
                  <a
                    href={`https://zora.co/coin/base:${contentCoinAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-300 hover:text-white"
                  >
                    View on Zora
                  </a>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  {mediaUrl ? (
                    <img src={mediaUrl} alt={name} className="w-14 h-14 rounded-2xl object-cover border border-zinc-700/80" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl border border-zinc-700 bg-white/8 flex items-center justify-center text-sm text-zinc-300">
                      {symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-2xl sm:text-3xl text-white font-semibold tracking-tight truncate">{name}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-zinc-300">
                      <span className="text-zinc-200">{symbol}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-xs text-zinc-300 border border-zinc-700/80">
                        {creatorHandle ? `@${creatorHandle}` : 'Unknown creator'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm sm:text-[15px] text-zinc-300/95 leading-relaxed">{description}</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-2xl border border-zinc-700/60 bg-vault-card/60/70 p-3">
                    <div className="text-[11px] font-medium text-zinc-500">Market Cap</div>
                    <div className="text-[15px] text-white mt-1.5 tabular-nums">{formatUsd(marketCapUsd)}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-700/60 bg-vault-card/60/70 p-3">
                    <div className="text-[11px] font-medium text-zinc-500">Holders</div>
                    <div className="text-[15px] text-white mt-1.5 tabular-nums">{formatCount(holders)}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-700/60 bg-vault-card/60/70 p-3">
                    <div className="text-[11px] font-medium text-zinc-500">Created</div>
                    <div className="text-[15px] text-white mt-1.5 tabular-nums">{createdLabel}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ExploreSubnav
            searchPlaceholder="Filter by wallet, symbol, or tx hash"
            searchValue={searchQuery}
            onSearch={handleSearchChange}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
            timeFilters={CONTENT_TRANSACTIONS_TIME_FILTERS}
            sortOptions={CONTENT_TRANSACTIONS_SORT_OPTIONS}
            disableUniswapTimeGating
          />

          <div className="mt-10 rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-white/8 text-left text-zinc-500 text-xs font-medium">
                  <tr>
                    <th className="px-3 py-3">Time</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3 text-right">USD</th>
                    <th className="px-3 py-3 text-right">{primaryPool?.token0.symbol ?? 'Token0'}</th>
                    <th className="px-3 py-3 text-right">{primaryPool?.token1.symbol ?? 'Token1'}</th>
                    <th className="px-3 py-3 text-right">Wallet</th>
                    <th className="px-3 py-3 text-right">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {poolsLoading || swapsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-600">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-600">
                        {searchQuery.trim()
                          ? 'No transactions matched your filters.'
                          : 'No swap transactions found for this content pool yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="border-b border-white/8/70">
                        <td className="px-3 py-3 text-zinc-400">{formatTimestamp(row.timestamp)}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.side === 'Buy'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : row.side === 'Sell'
                                  ? 'bg-rose-500/15 text-rose-300'
                                  : 'bg-zinc-600/25 text-zinc-300'
                            }`}
                          >
                            {row.side}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-white tabular-nums">{formatUsd(row.amountUsd)}</td>
                        <td className="px-3 py-3 text-right text-zinc-300 tabular-nums">
                          {formatTokenAmount(row.amount0)} {row.token0Symbol}
                        </td>
                        <td className="px-3 py-3 text-right text-zinc-300 tabular-nums">
                          {formatTokenAmount(row.amount1)} {row.token1Symbol}
                        </td>
                        <td className="px-3 py-3 text-right text-zinc-300">{formatShortAddress(row.wallet)}</td>
                        <td className="px-3 py-3 text-right">
                          {row.txHash ? (
                            <a
                              href={`https://basescan.org/tx/${row.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-400 hover:text-white"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                to={`/explore/content/base/${contentCoinAddress}`}
                className="btn-primary btn-compact inline-flex items-center justify-center rounded-full text-xs"
              >
                Back to market
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
