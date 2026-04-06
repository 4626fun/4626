import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Droplets,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Share2,
  TrendingUp,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'

import { PageMeta } from '@/components/seo/PageMeta'
import { ExploreCopyButton, ExploreStatRow } from '@/components/explore/ExploreUiPrimitives'
import { fetchZoraCoin } from '@/lib/zora/client'
import { usePoolHistory } from '@/lib/uniswap/hooks'
import { getPoolSwaps, getPoolsByToken } from '@/lib/uniswap/client'
import type { UniswapPool, UniswapSwap } from '@/lib/uniswap/types'
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
} from '@/features/explore/exploreShared'

type PeriodKey = '1H' | '1D' | '1W' | '1M' | '1Y'
type MetricKey = 'liquidity' | 'volume' | 'fees' | 'price'

const PERIOD_TO_TIMEFRAME: Record<PeriodKey, '1h' | '1d' | '1w' | '1m' | '1y'> = {
  '1H': '1h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1m',
  '1Y': '1y',
}

const PERIODS: PeriodKey[] = ['1H', '1D', '1W', '1M', '1Y']

const METRICS: Array<{ key: MetricKey; label: string; icon: React.ReactNode }> = [
  { key: 'liquidity', label: 'Liquidity', icon: <Droplets className="w-3.5 h-3.5" /> },
  { key: 'volume', label: 'Volume', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: 'fees', label: 'Fees', icon: <Activity className="w-3.5 h-3.5" /> },
  { key: 'price', label: 'Price', icon: <TrendingUp className="w-3.5 h-3.5" /> },
]

function formatTokenPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00'
  if (value < 0.0001) return `$${value.toExponential(2)}`
  if (value < 0.01) return `$${value.toFixed(6)}`
  if (value < 1) return `$${value.toFixed(4)}`
  if (value < 1000) return `$${value.toFixed(2)}`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0.00%'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

function formatSupply(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function calcCoefficientOfVariation(values: number[]): number | null {
  const cleaned = values.filter((v) => Number.isFinite(v) && v > 0)
  if (cleaned.length < 2) return null
  const mean = cleaned.reduce((a, b) => a + b, 0) / cleaned.length
  if (mean <= 0) return null
  const variance = cleaned.reduce((acc, v) => acc + (v - mean) ** 2, 0) / cleaned.length
  const std = Math.sqrt(variance)
  return (std / mean) * 100
}

function MetricBarsChart({
  points,
  metric,
}: {
  points: Array<{ timestamp: number; tvlUSD: number; volumeUSD: number; feesUSD: number; close?: number }>
  metric: MetricKey
}) {
  const values = useMemo(() => {
    return points.map((p) => {
      if (metric === 'liquidity') return p.tvlUSD
      if (metric === 'volume') return p.volumeUSD
      if (metric === 'fees') return p.feesUSD
      return p.close ?? 0
    })
  }, [points, metric])

  const max = Math.max(1, ...values)

  const formatValue = (v: number): string => {
    if (metric === 'price') return formatTokenPrice(v)
    return formatUsd(v)
  }

  return (
    <div className="h-[320px] rounded-xl border border-white/8 bg-vault-bg p-4">
      <div className="h-full w-full flex items-end gap-[3px]">
        {values.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm">No historical pool data</div>
        ) : (
          values.map((v, idx) => {
            const h = Math.max(2, (v / max) * 100)
            const older = idx < values.length / 2
            const color =
              metric === 'liquidity'
                ? older
                  ? 'bg-amber-500/55'
                  : 'bg-sky-500/70'
                : metric === 'volume'
                  ? older
                    ? 'bg-fuchsia-500/40'
                    : 'bg-fuchsia-400/70'
                  : metric === 'fees'
                    ? older
                      ? 'bg-emerald-500/40'
                      : 'bg-emerald-400/70'
                    : older
                      ? 'bg-zinc-500/40'
                      : 'bg-zinc-300/70'

            return (
              <div
                key={`${points[idx]?.timestamp ?? idx}-${idx}`}
                className={`rounded-t-[3px] ${color} hover:opacity-100 opacity-90 transition-opacity`}
                style={{ height: `${h}%`, width: `${100 / values.length}%` }}
                title={`${formatTimestamp(points[idx]?.timestamp ?? 0)}\n${formatValue(v)}`}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function LinkRow({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-xl bg-white/4 hover:bg-white/8 transition-colors group"
    >
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-zinc-500">{label}</div>
        <div className="text-sm text-white truncate">{value}</div>
      </div>
      <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
    </a>
  )
}

export function ExploreContentDetail() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const contentCoinAddressRaw = String(params.contentCoinAddress ?? '').trim()

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('1D')
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('liquidity')

  const contentCoinAddress = isAddress(contentCoinAddressRaw) ? getAddress(contentCoinAddressRaw) : null
  const timeframe = PERIOD_TO_TIMEFRAME[selectedPeriod]

  const { data: coin, isLoading: coinLoading } = useQuery({
    queryKey: ['coin', contentCoinAddress],
    queryFn: async () => {
      if (!contentCoinAddress) return null
      return fetchZoraCoin(contentCoinAddress as `0x${string}`, 8453)
    },
    enabled: Boolean(contentCoinAddress),
    staleTime: 30_000,
  })

  const { data: pools = [], isLoading: poolsLoading } = useQuery({
    queryKey: ['uniswap', 'poolsByToken', contentCoinAddress],
    queryFn: async () => {
      if (!contentCoinAddress) return []
      return getPoolsByToken(contentCoinAddress)
    },
    enabled: Boolean(contentCoinAddress),
    staleTime: 60_000,
  })

  const { data: history, isLoading: historyLoading } = usePoolHistory(contentCoinAddress ?? undefined, timeframe, {
    enabled: Boolean(contentCoinAddress),
  })

  const primaryPool = useMemo<UniswapPool | null>(() => {
    if (!pools || pools.length === 0) return null
    return [...pools].sort((a, b) => parseNumber(b.totalValueLockedUSD) - parseNumber(a.totalValueLockedUSD))[0]
  }, [pools])

  const { data: swaps = [], isLoading: swapsLoading } = useQuery({
    queryKey: ['uniswap', 'poolSwaps', primaryPool?.id],
    queryFn: async () => {
      if (!primaryPool?.id) return []
      return getPoolSwaps(primaryPool.id, 25)
    },
    enabled: Boolean(primaryPool?.id),
    staleTime: 30_000,
  })

  const activityRows = useMemo(() => {
    const contentAddressLower = contentCoinAddress?.toLowerCase() ?? ''
    return (swaps ?? []).map((swap: UniswapSwap) => {
      const amount0 = parseNumber(swap.amount0)
      const amount1 = parseNumber(swap.amount1)
      const amountUsd = parseNumber(swap.amountUSD)
      const contentInToken0 = swap.token0.id.toLowerCase() === contentAddressLower
      const contentAmount = contentInToken0 ? amount0 : amount1
      const side = contentAmount < 0 ? 'Buy' : contentAmount > 0 ? 'Sell' : 'Swap'
      const wallet = swap.origin || swap.sender
      const ts = parseNumber(swap.timestamp || swap.transaction?.timestamp || 0)
      return {
        id: swap.id,
        timestamp: ts,
        side,
        amountUsd,
        amount0,
        amount1,
        token0Symbol: swap.token0.symbol || 'TOKEN0',
        token1Symbol: swap.token1.symbol || 'TOKEN1',
        wallet,
        txHash: swap.transaction?.id ?? '',
      }
    })
  }, [swaps, contentCoinAddress])

  if (!chain || !isSupportedExploreChain(chain)) {
    return <Navigate replace to="/explore/content" />
  }

  if (!contentCoinAddress) {
    return <Navigate replace to="/explore/content" />
  }

  const shortAddress = (addr: string) => formatShortAddress(addr, '')

  const symbol = coin?.symbol || 'CONTENT'
  const name = coin?.name || 'Content Coin'
  const mediaUrl = toDisplayAssetUrl(coin?.mediaContent?.previewImage?.medium || coin?.mediaContent?.originalUri)
  const creatorHandle = coin?.creatorProfile?.handle
  const description = coin?.description?.trim() || 'A content coin deployed on Zora and traded with 4626 liquidity routing.'
  const holdersCount = parseNumber(coin?.uniqueHolders)
  const totalSupplyCount = parseNumber(coin?.totalSupply)
  const marketCapUsd = parseNumber(coin?.marketCap)
  const createdLabel = formatDateLabel(coin?.createdAt)
  const canonicalPath = `/explore/content/${chain.toLowerCase()}/${contentCoinAddress}`

  const pairLabel = primaryPool ? `${primaryPool.token0.symbol} / ${primaryPool.token1.symbol}` : `${symbol} / ZORA`
  const token0Price = parseNumber(primaryPool?.token0Price)
  const token1Price = parseNumber(primaryPool?.token1Price)
  const tvlUsd = history?.tvlUSD ?? parseNumber(primaryPool?.totalValueLockedUSD) ?? parseNumber(coin?.marketCap)
  const volumeUsd = history?.volumeUSD ?? parseNumber(coin?.volume24h)
  const feesUsd = history?.feesUSD
  const priceUsd = parseNumber(coin?.tokenPrice?.priceInUsdc)
  const priceDelta = history?.priceChangePercent ?? parseNumber(coin?.marketCapDelta24h)

  const points = history?.dataPoints ?? []

  const liquidityCV = calcCoefficientOfVariation(points.map((p) => p.tvlUSD))
  const priceCV = calcCoefficientOfVariation(points.map((p) => p.close ?? 0))

  const loading = coinLoading || poolsLoading

  return (
    <div className="relative min-h-screen bg-black">
      <PageMeta
        title={`${name} (${symbol})`}
        description={description}
        canonicalPath={canonicalPath}
        ogImage={mediaUrl}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <Link
            to="/explore/content"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Content Pools
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="mb-6 rounded-3xl border border-white/8 bg-white/4 overflow-hidden">
              <div className="relative px-4 py-6 sm:px-7 sm:py-7">
                {mediaUrl ? (
                  <>
                    <img
                      src={mediaUrl}
                      alt={name}
                      className="absolute inset-0 w-full h-full object-cover opacity-18 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-zinc-900/90 pointer-events-none" />
                  </>
                ) : null}
                <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-fuchsia-500/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <span className="inline-flex items-center rounded-full border border-zinc-700/80 bg-vault-card/70 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                      Zora Content Coin
                    </span>
                    <a
                      href={`https://zora.co/coin/base:${contentCoinAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white"
                    >
                      View on Zora <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center gap-4 mb-5">
                    {mediaUrl ? (
                      <img src={mediaUrl} alt={name} className="w-14 h-14 rounded-2xl object-cover border border-zinc-700/80 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl border border-zinc-700 bg-white/8 flex items-center justify-center text-sm text-zinc-300">
                        {symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-2xl sm:text-4xl text-white font-semibold tracking-tight truncate">{name}</h2>
                      <div className="mt-1 flex items-center gap-2 text-sm text-zinc-300">
                        <span className="text-zinc-200">{symbol}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-xs text-zinc-300 border border-zinc-700/80">
                          {creatorHandle ? `@${creatorHandle}` : 'Unknown creator'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm sm:text-[15px] text-zinc-300/95 leading-relaxed max-w-3xl">{description}</p>

                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-2xl border border-zinc-700/60 bg-vault-card/60/70 p-3">
                      <div className="text-[11px] font-medium text-zinc-500">Market Cap</div>
                      <div className="text-[15px] text-white mt-1.5 tabular-nums">{formatUsd(marketCapUsd)}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-700/60 bg-vault-card/60/70 p-3">
                      <div className="text-[11px] font-medium text-zinc-500">Holders</div>
                      <div className="text-[15px] text-white mt-1.5 tabular-nums">{formatCount(holdersCount)}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-700/60 bg-vault-card/60/70 p-3">
                      <div className="text-[11px] font-medium text-zinc-500">Supply</div>
                      <div className="text-[15px] text-white mt-1.5 tabular-nums">{formatSupply(totalSupplyCount)}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-700/60 bg-vault-card/60/70 p-3">
                      <div className="text-[11px] font-medium text-zinc-500">Created</div>
                      <div className="text-[15px] text-white mt-1.5 tabular-nums">{createdLabel}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[11px] font-medium text-zinc-500 mb-2">Pools</div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    {mediaUrl ? (
                      <img src={mediaUrl} alt={name} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    <h1 className="text-2xl sm:text-3xl text-white font-semibold tracking-tight">{pairLabel}</h1>
                    <span className="text-zinc-500 text-sm">{shortAddress(contentCoinAddress)}</span>
                    <ExploreCopyButton text={contentCoinAddress} />
                  </div>
                  <div className="mt-2 space-y-1 text-zinc-300 text-sm">
                    {token0Price > 0 && token1Price > 0 ? (
                      <>
                        <div>
                          1 {primaryPool?.token0.symbol} = {token0Price.toFixed(6)} {primaryPool?.token1.symbol}
                        </div>
                        <div>
                          1 {primaryPool?.token1.symbol} = {token1Price.toFixed(6)} {primaryPool?.token0.symbol}
                        </div>
                      </>
                    ) : (
                      <div>Liquidity-focused view enabled. Price is shown as secondary due to low-liquidity variance.</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    to={`/swap?token=${contentCoinAddress}`}
                    className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-500 transition-colors flex-1 sm:flex-none"
                  >
                    Swap
                  </Link>
                  <a
                    href={primaryPool?.id ? `https://app.uniswap.org/explore/pools/base/${primaryPool.id}` : `https://app.uniswap.org/explore/tokens/base/${contentCoinAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white bg-white/8 hover:bg-zinc-700 transition-colors flex-1 sm:flex-none"
                  >
                    Add liquidity <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
                  {PERIODS.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                        selectedPeriod === period
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-500 hover:text-white hover:bg-white/8'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMetric(m.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                        selectedMetric === m.key
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-500 hover:text-white hover:bg-white/8'
                      }`}
                    >
                      {m.icon}
                      <span className="hidden sm:inline">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {loading || historyLoading ? (
                <div className="h-[320px] rounded-xl bg-white/4 animate-pulse" />
              ) : (
                <MetricBarsChart points={points} metric={selectedMetric} />
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>Oldest</span>
                <span className="text-zinc-400">{METRICS.find((m) => m.key === selectedMetric)?.label} over {selectedPeriod}</span>
                <span>Latest</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white font-medium">Recent Activity</div>
                  <div className="text-xs text-zinc-500">Latest swaps from the primary pool</div>
                </div>
                <Link
                  to={`/explore/content/${chain.toLowerCase()}/${contentCoinAddress}/transactions`}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Full transactions
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-vault-card/60/70">
                    <tr className="text-left text-zinc-500 text-xs font-medium">
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">USD</th>
                      <th className="px-4 py-3 text-right">{primaryPool?.token0.symbol ?? 'Token0'}</th>
                      <th className="px-4 py-3 text-right">{primaryPool?.token1.symbol ?? 'Token1'}</th>
                      <th className="px-4 py-3 text-right">Wallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swapsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                          Loading swaps...
                        </td>
                      </tr>
                    ) : activityRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                          No swap data available for this pool yet.
                        </td>
                      </tr>
                    ) : (
                      activityRows.map((row) => (
                        <tr key={row.id} className="border-t border-white/8/70">
                          <td className="px-4 py-3 text-zinc-400">{formatTimestamp(row.timestamp)}</td>
                          <td className="px-4 py-3">
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
                          <td className="px-4 py-3 text-right text-white tabular-nums">{formatUsd(row.amountUsd)}</td>
                          <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                            {formatTokenAmount(row.amount0)} {row.token0Symbol}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                            {formatTokenAmount(row.amount1)} {row.token1Symbol}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.txHash ? (
                              <a
                                href={`https://basescan.org/tx/${row.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-300 hover:text-white"
                              >
                                {shortAddress(row.wallet)}
                              </a>
                            ) : (
                              <span className="text-zinc-400">{shortAddress(row.wallet)}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium text-zinc-500">Pool Snapshot</div>
                <button
                  type="button"
                  className="text-zinc-400 hover:text-white transition-colors"
                  title="Share"
                  onClick={async () => {
                    await navigator.clipboard.writeText(window.location.href)
                  }}
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              <ExploreStatRow label="TVL" value={formatUsd(tvlUsd)} />
              <ExploreStatRow label={`Volume (${selectedPeriod})`} value={formatUsd(volumeUsd)} />
              <ExploreStatRow label={`Fees (${selectedPeriod})`} value={formatUsd(feesUsd ?? 0)} note="Based on subgraph pool history." />
              <ExploreStatRow label="Token Price" value={formatTokenPrice(priceUsd)} note="Secondary signal - can be noisy in thin liquidity." />
              <ExploreStatRow
                label="Price Change"
                value={formatPercent(priceDelta)}
                note="Use liquidity + volume for more stable market read."
              />
              <ExploreStatRow
                label="Fee Tier"
                value={primaryPool ? `${(parseNumber(primaryPool.feeTier) / 10_000).toFixed(2)}%` : '-'}
              />
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <div className="text-xs font-medium text-zinc-500 mb-2">Stability</div>
              <div className="text-sm text-zinc-400 leading-relaxed mb-3">
                In low-liquidity markets, spot price can swing hard between CONTENT, CREATOR, ZORA, and ETH paths.
                Liquidity variation is generally a better stability anchor.
              </div>
              <ExploreStatRow label="Liquidity Variance" value={liquidityCV == null ? '-' : `${liquidityCV.toFixed(2)}% CV`} />
              <ExploreStatRow label="Price Variance" value={priceCV == null ? '-' : `${priceCV.toFixed(2)}% CV`} />
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <div className="text-xs font-medium text-zinc-500 mb-3">Links</div>
              <div className="space-y-2">
                <LinkRow href={`https://zora.co/coin/base:${contentCoinAddress}`} label="Zora" value={shortAddress(contentCoinAddress)} />
                <LinkRow href={`https://basescan.org/token/${contentCoinAddress}`} label="Basescan" value={shortAddress(contentCoinAddress)} />
                {primaryPool?.id ? (
                  <LinkRow href={`https://app.uniswap.org/explore/pools/base/${primaryPool.id}`} label="Uniswap Pool" value={shortAddress(primaryPool.id)} />
                ) : null}
              </div>

              <div className="mt-3 pt-3 border-t border-white/8">
                <div className="text-xs text-zinc-500 mb-1">Token</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{name}</span>
                  <span className="text-xs text-zinc-500">{symbol}</span>
                  <ExploreCopyButton text={contentCoinAddress} />
                </div>
                {creatorHandle ? <div className="text-xs text-zinc-500 mt-2">Creator: @{creatorHandle}</div> : null}
              </div>
            </div>

            {mediaUrl ? (
              <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                <img src={mediaUrl} alt={name} className="w-full aspect-video object-cover" />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
                <div className="text-zinc-500 text-sm flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  No media preview available.
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
