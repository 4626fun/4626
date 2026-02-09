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

function isSupportedChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
}

const IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'

function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  if (value < 0.01) return `$${value.toFixed(6)}`
  return `$${value.toFixed(2)}`
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString()
}

function formatCreatedAt(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function toDisplayAssetUrl(value?: string): string | undefined {
  const v = value?.trim()
  if (!v) return undefined
  if (v.startsWith('ipfs://')) {
    const path = v.slice('ipfs://'.length).replace(/^ipfs\//, '').replace(/^\/+/, '')
    if (!path) return undefined
    return `${IPFS_GATEWAY}${path}`
  }
  return v
}

function formatAmount(value: number): string {
  const abs = Math.abs(value)
  if (!Number.isFinite(abs) || abs === 0) return '0'
  if (abs < 0.0001) return abs.toExponential(2)
  if (abs < 1) return abs.toFixed(6)
  if (abs < 1000) return abs.toFixed(4)
  return abs.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function shortAddress(addr: string): string {
  if (!addr) return '-'
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function ExploreContentTransactions() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const contentCoinAddressRaw = String(params.contentCoinAddress ?? '').trim()
  const contentCoinAddress = isAddress(contentCoinAddressRaw) ? getAddress(contentCoinAddressRaw) : null

  if (!chain || !isSupportedChain(chain) || !contentCoinAddress) {
    return <Navigate replace to="/explore/transactions" />
  }

  const { data: coin } = useQuery({
    queryKey: ['coin', contentCoinAddress, 'transactionsPage'],
    queryFn: async () => fetchZoraCoin(contentCoinAddress as `0x${string}`, 8453),
    staleTime: 30_000,
  })

  const { data: pools = [], isLoading: poolsLoading } = useQuery({
    queryKey: ['uniswap', 'poolsByToken', contentCoinAddress],
    queryFn: async () => getPoolsByToken(contentCoinAddress),
    staleTime: 60_000,
  })

  const primaryPool = useMemo<UniswapPool | null>(() => {
    if (!pools.length) return null
    return [...pools].sort((a, b) => parseNumber(b.totalValueLockedUSD) - parseNumber(a.totalValueLockedUSD))[0]
  }, [pools])

  const { data: swaps = [], isLoading: swapsLoading } = useQuery({
    queryKey: ['uniswap', 'poolSwaps', primaryPool?.id, 'transactionsPage'],
    queryFn: async () => {
      if (!primaryPool?.id) return []
      return getPoolSwaps(primaryPool.id, 100)
    },
    enabled: Boolean(primaryPool?.id),
    staleTime: 30_000,
  })

  const rows = useMemo(() => {
    const contentAddressLower = contentCoinAddress.toLowerCase()
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

  const name = coin?.name || 'Content Coin'
  const symbol = coin?.symbol || 'CONTENT'
  const description = coin?.description?.trim() || 'Live swap events for this content coin market.'
  const creatorHandle = coin?.creatorProfile?.handle
  const mediaUrl = toDisplayAssetUrl(coin?.mediaContent?.previewImage?.medium || coin?.mediaContent?.originalUri)
  const marketCapUsd = parseNumber(coin?.marketCap)
  const holders = parseNumber(coin?.uniqueHolders)
  const createdLabel = formatCreatedAt(coin?.createdAt)
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

          <div className="mb-8 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
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
                  <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-zinc-300">
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
                    <div className="w-14 h-14 rounded-2xl border border-zinc-700 bg-zinc-800/80 flex items-center justify-center text-sm text-zinc-300">
                      {symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-2xl sm:text-3xl text-white font-semibold tracking-tight truncate">{name}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-zinc-300">
                      <span className="text-zinc-200">{symbol}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="inline-flex items-center rounded-full bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-300 border border-zinc-700/80">
                        {creatorHandle ? `@${creatorHandle}` : 'Unknown creator'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm sm:text-[15px] text-zinc-300/95 leading-relaxed">{description}</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Market Cap</div>
                    <div className="text-[15px] text-white mt-1.5 tabular-nums">{formatUsd(marketCapUsd)}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Holders</div>
                    <div className="text-[15px] text-white mt-1.5 tabular-nums">{formatCount(holders)}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Created</div>
                    <div className="text-[15px] text-white mt-1.5 tabular-nums">{createdLabel}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ExploreSubnav searchPlaceholder="Filter transactions…" />

          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-zinc-800 text-left text-zinc-500 text-xs uppercase tracking-[0.12em]">
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
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-600">
                        No swap transactions found for this content pool yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-b border-zinc-800/70">
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
                          {formatAmount(row.amount0)} {row.token0Symbol}
                        </td>
                        <td className="px-3 py-3 text-right text-zinc-300 tabular-nums">
                          {formatAmount(row.amount1)} {row.token1Symbol}
                        </td>
                        <td className="px-3 py-3 text-right text-zinc-300">{shortAddress(row.wallet)}</td>
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
                className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-xs"
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
