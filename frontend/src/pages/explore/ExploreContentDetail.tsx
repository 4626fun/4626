import { useCallback, useMemo, useState } from 'react'
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

import { BarChart, LineChart } from '@coinbase/cds-web-visualization/chart'

import { PageMeta } from '@/components/seo/PageMeta'
import { ExploreCopyButton, ExploreStatRow } from '@/components/explore/ExploreUiPrimitives'
import { ExploreUnfurlDebugCopy } from '@/components/explore/ExploreUnfurlDebugCopy'
import { LoadingBlock, LoadingText } from '@/components/ui/LoadingState'
import { fetchZoraCoin } from '@/lib/zora/client'
import { usePoolHistory, type PoolHistoryData } from '@/lib/uniswap/hooks'
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

// Metric -> gradient stops. Uses Base Blue family for liquidity/volume and
// the semantic green for fees to match product-standard dark theming.
const METRIC_COLORS: Record<MetricKey, { primary: string; secondary: string }> = {
  liquidity: { primary: '#38BDF8', secondary: '#0EA5E9' },
  volume: { primary: '#A78BFA', secondary: '#7C3AED' },
  fees: { primary: '#34D399', secondary: '#10B981' },
  price: { primary: '#F4F4F5', secondary: '#A1A1AA' },
}

// Extracts the raw (absolute) value for a given metric from a history point.
function extractMetricValue(point: PoolHistoryPoint, metric: MetricKey): number {
  switch (metric) {
    case 'liquidity':
      return point.tvlUSD
    case 'volume':
      return point.volumeUSD
    case 'fees':
      return point.feesUSD
    case 'price':
      return point.close ?? 0
  }
}

// Formats an absolute metric value for display. Price is sub-dollar so it
// needs the small-number formatter; everything else is USD notional.
function formatMetricValue(metric: MetricKey, value: number): string {
  return metric === 'price' ? formatTokenPrice(value) : formatUsd(value)
}

/**
 * Pick "nice" round tick values spanning the data range for a given target
 * tick count. Uses the standard 1/2/5 × 10^n step family so tick values
 * land on human-readable numbers (e.g. 0, 200K, 400K, 600K for TVL; or
 * 0.094, 0.096, 0.098 for a tight price band).
 *
 * `includeZero` controls whether the domain is anchored at 0. Most series
 * (volume, fees, liquidity) read more naturally when the floor is zero;
 * price bands are better bounded by the data range so the line isn't
 * pinned to the top of the card.
 */
function niceYTicks(
  values: number[],
  count: number = 4,
  { includeZero = true }: { includeZero?: boolean } = {},
): number[] {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return []
  const rawMin = Math.min(...finite)
  const rawMax = Math.max(...finite)
  const min = includeZero ? Math.min(0, rawMin) : rawMin
  const max = Math.max(rawMax, min)
  if (max <= min) return [min]

  const span = max - min
  const roughStep = span / Math.max(1, count)
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(roughStep))))
  const normalized = roughStep / magnitude
  const niceStep =
    magnitude * (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10)
  const niceMin = Math.floor(min / niceStep) * niceStep
  const niceMax = Math.ceil(max / niceStep) * niceStep

  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + niceStep * 0.0001; v += niceStep) {
    ticks.push(Number(v.toFixed(10)))
  }
  return ticks
}

/**
 * Pick up to `count` evenly-spaced label indices from a series so the
 * external X-axis doesn't crowd the card. Always includes the first and
 * last index so the user sees the full time window at a glance.
 */
function pickXTickIndices(totalPoints: number, count: number = 4): number[] {
  if (totalPoints === 0) return []
  if (totalPoints === 1) return [0]
  const n = Math.max(2, Math.min(count, totalPoints))
  const indices: number[] = []
  for (let i = 0; i < n; i++) {
    indices.push(Math.round((i * (totalPoints - 1)) / (n - 1)))
  }
  // Dedup in case two rounded values collided (short series).
  return Array.from(new Set(indices))
}

type PoolHistoryPoint = {
  timestamp: number
  tvlUSD: number
  volumeUSD: number
  feesUSD: number
  close?: number
}

/**
 * Combined multi-series chart. Overlays liquidity / volume / fees / price
 * on a single LineChart, normalized to percent-change-from-start so the
 * wildly-different magnitudes share one Y axis. Each metric is independently
 * toggleable via the chip row above the chart, and a live readout surfaces
 * the absolute value + delta for every active metric at the hovered bucket.
 */
/**
 * Per-metric chart with viz tuned to the metric's semantics:
 *   - Price     \u2192 smooth LineChart (continuous spot movement)
 *   - Volume    \u2192 BarChart (per-bucket USD notional)
 *   - Fees      \u2192 BarChart of *cumulative* fees (monotonically growing)
 *   - Liquidity \u2192 stacked BarChart split by the pool's two tokens
 *
 * Every metric shares the same scrubber readout so the bucket under the
 * cursor (or the latest bucket when idle) is always legible.
 */
function MetricChart({
  points,
  metric,
  pool,
  period,
}: {
  points: PoolHistoryPoint[]
  metric: MetricKey
  pool: PoolHistoryData['pool']
  period: string
}) {
  const labels = useMemo(() => points.map((p) => formatTimestamp(p.timestamp)), [points])

  // Per-bucket raw values for the active metric. Fees gets transformed into
  // a cumulative running sum so each bar represents total fees accrued up
  // to and including that bucket.
  const values = useMemo(() => {
    const raw = points.map((p) => extractMetricValue(p, metric))
    if (metric === 'fees') {
      let running = 0
      return raw.map((v) => (running += Number.isFinite(v) ? v : 0))
    }
    return raw
  }, [points, metric])

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const handleScrub = useCallback<(index: number | undefined) => void>((index) => {
    setHoverIndex(typeof index === 'number' && Number.isFinite(index) ? index : null)
  }, [])

  if (points.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-white/8 bg-vault-bg text-sm text-zinc-600">
        No historical pool data
      </div>
    )
  }

  const palette = METRIC_COLORS[metric]
  const label = METRICS.find((m) => m.key === metric)?.label ?? metric
  const readoutIndex =
    hoverIndex != null && hoverIndex >= 0 && hoverIndex < points.length
      ? hoverIndex
      : points.length - 1
  const readoutValue = values[readoutIndex] ?? 0
  const readoutTimestamp = labels[readoutIndex] ?? ''

  // Liquidity decomposition: approximate historical per-token TVL by
  // applying the *current* pool's token0/token1 USD shares to each
  // bucket's `tvlUSD`. The approximation drifts whenever the pool's
  // composition has shifted, but still gives users a clear read on which
  // side of the pair the pool is weighted toward.
  const composition = metric === 'liquidity' && pool ? pool : null
  const token0Share = composition?.token0UsdShare ?? null
  const token1Share = composition?.token1UsdShare ?? null
  const hasStackedLiquidity =
    composition != null &&
    typeof token0Share === 'number' &&
    typeof token1Share === 'number' &&
    token0Share + token1Share > 0

  // Zero chart insets: we draw our own axes *outside* the card, so CDS's
  // internal axis margins would just waste pixels. Bars and lines fill the
  // full card. A small right inset is kept so the last bar's rounded corner
  // doesn't clip the card edge.
  const chartInset = { top: 4, left: 2, right: 4, bottom: 2 }

  // Bespoke Y-axis ticks and the domain they span. For stacked liquidity
  // we compute ticks off the *total* tvlUSD (not each stack individually)
  // so the Y ticks match what the eye sees for the full bar. Price is the
  // only metric that doesn't anchor to zero — it usually trades in a
  // narrow band well above 0 and pinning the floor to 0 would flatten
  // all variation.
  const yTicks = niceYTicks(values, 4, { includeZero: metric !== 'price' })
  const yTickDomain =
    yTicks.length > 0
      ? { min: yTicks[0]!, max: yTicks[yTicks.length - 1]! }
      : { min: 0, max: 1 }

  // X-axis ticks: 4 evenly-spaced labels (first, 1/3, 2/3, last).
  const xTickIndices = pickXTickIndices(labels.length, 4)

  const showLiquidityBreakdown = metric === 'liquidity' && hasStackedLiquidity

  return (
    <div>
      {/* Top row — chart card on the left, bespoke vertical Y-axis on the
          right. The Y-axis column mirrors the card's flex-col layout with
          invisible placeholders for the readout (and optional liquidity
          breakdown) so the ticks naturally align with the plot area
          regardless of which metric is active. */}
      <div className="grid grid-cols-[1fr_auto] items-stretch gap-2">
        <div className="flex h-[420px] flex-col rounded-xl border border-white/8 bg-vault-bg p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: palette.primary }}
                aria-hidden="true"
              />
              <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                {label}
                {metric === 'fees' ? ' (cumulative)' : ''}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-sm font-semibold text-white">
                {formatMetricValue(metric, readoutValue)}
              </span>
              <span className="text-[10px] tabular-nums text-zinc-500">{readoutTimestamp}</span>
            </div>
          </div>

          {/* Per-token breakdown readout for the liquidity view. */}
          {showLiquidityBreakdown && composition ? (
            <div className="mt-2 grid grid-cols-2 gap-3 text-[11px] tabular-nums">
              <LiquidityShareReadout
                symbol={composition.token0Symbol}
                usd={readoutValue * (token0Share ?? 0)}
                share={token0Share ?? 0}
                color={palette.primary}
              />
              <LiquidityShareReadout
                symbol={composition.token1Symbol}
                usd={readoutValue * (token1Share ?? 0)}
                share={token1Share ?? 0}
                color={palette.secondary}
              />
            </div>
          ) : null}

          <div className="mt-3 min-h-0 w-full flex-1">
              {metric === 'price' ? (
              <LineChart
                height="100%"
                width="100%"
                animate
                curve="monotone"
                strokeWidth={2}
                inset={chartInset}
                enableScrubbing
                onScrubberPositionChange={handleScrub}
                series={[
                  {
                    id: 'price',
                    label,
                    data: values,
                    color: palette.primary,
                    stroke: palette.primary,
                    strokeWidth: 2,
                    strokeOpacity: 1,
                    opacity: 1,
                  },
                ]}
                showXAxis={false}
                showYAxis={false}
                yAxis={{ domain: yTickDomain }}
                legend={false}
              />
            ) : metric === 'liquidity' && hasStackedLiquidity ? (
              <BarChart
                height="100%"
                width="100%"
                animate
                stacked
                barPadding={0.15}
                borderRadius={3}
                inset={chartInset}
                enableScrubbing
                onScrubberPositionChange={handleScrub}
                series={[
                  {
                    id: 'tvl0',
                    label: composition?.token0Symbol ?? 'Token 0',
                    data: values.map((v) => v * (token0Share ?? 0)),
                    color: palette.primary,
                    stackId: 'tvl',
                  },
                  {
                    id: 'tvl1',
                    label: composition?.token1Symbol ?? 'Token 1',
                    data: values.map((v) => v * (token1Share ?? 0)),
                    color: palette.secondary,
                    stackId: 'tvl',
                  },
                ]}
                showXAxis={false}
                showYAxis={false}
                yAxis={{ domain: yTickDomain }}
                legend={false}
              />
            ) : (
              <BarChart
                height="100%"
                width="100%"
                animate
                barPadding={0.15}
                borderRadius={3}
                inset={chartInset}
                enableScrubbing
                onScrubberPositionChange={handleScrub}
                series={[
                  {
                    id: metric,
                    label,
                    data: values,
                    color: palette.primary,
                    // Gradient stops must be in STRICTLY ascending offset
                    // order per CDS. Reversing, or letting a degenerate
                    // domain (min === max — e.g. all-zero volume/fees
                    // series) through, spams "Gradient: stop offsets must
                    // be in ascending order" on every render, which backs
                    // up the browser. The nudge on `max` keeps the stops
                    // strictly ordered even when the series is flat.
                    gradient: {
                      axis: 'y',
                      stops: (domain) => {
                        const min = domain.min
                        const max = domain.max > domain.min ? domain.max : domain.min + 1
                        return [
                          { offset: min, color: palette.secondary, opacity: 0.45 },
                          { offset: max, color: palette.primary, opacity: 0.95 },
                        ]
                      },
                    },
                  },
                ]}
                showXAxis={false}
                showYAxis={false}
                yAxis={{ domain: yTickDomain }}
                legend={false}
              />
            )}
          </div>
        </div>

        {/* Vertical Y-axis column. Mirrors the card's flex-col structure
            (with invisible placeholders for the readout + optional liquidity
            breakdown) so the tick labels line up with the plot area
            top-to-bottom. Ticks are rendered high\u2192low since Y increases
            upward on the chart. */}
        {yTicks.length > 1 ? (
          <div className="flex h-[420px] min-w-[56px] flex-col px-1 py-4 text-right">
            <div
              className="invisible flex items-baseline justify-between gap-3"
              aria-hidden="true"
            >
              <span className="text-[11px]">{label}</span>
              <span className="text-sm">.</span>
            </div>
            {showLiquidityBreakdown ? (
              <div
                className="invisible mt-2 grid grid-cols-2 gap-3 text-[11px]"
                aria-hidden="true"
              >
                <span>placeholder</span>
                <span>placeholder</span>
              </div>
            ) : null}
            <div className="mt-3 flex flex-1 flex-col justify-between text-[10px] tabular-nums text-zinc-500">
              {[...yTicks].reverse().map((t, i) => (
                <span key={`${t}-${i}`}>{formatMetricValue(metric, t)}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* External X-axis — time labels at the bottom of the component,
          OUTSIDE the card boundary. */}
      {xTickIndices.length > 0 ? (
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] tabular-nums text-zinc-500">
          {xTickIndices.map((i) => (
            <span key={i}>{labels[i]}</span>
          ))}
        </div>
      ) : null}

      {/* Subtle caveat copy for the liquidity approximation. */}
      {metric === 'liquidity' && hasStackedLiquidity ? (
        <div className="mt-2 text-[10px] text-zinc-600">
          Composition based on the pool's current token split, applied across {period}.
        </div>
      ) : null}
    </div>
  )
}

function LiquidityShareReadout({
  symbol,
  usd,
  share,
  color,
}: {
  symbol: string | null
  usd: number
  share: number
  color: string
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="truncate text-zinc-500">{symbol ?? '\u2014'}</span>
      <span className="ml-auto text-white">{formatUsd(usd)}</span>
      <span className="text-zinc-500">{(share * 100).toFixed(1)}%</span>
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
  // Single-metric view — each metric renders in its own specialised viz
  // (line for price, bars for volume, cumulative bars for fees, stacked
  // token-composition bars for liquidity). Defaults to `price` because
  // that is the metric traders check first.
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('price')

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
    return [...pools].sort((a, b) => parseNumber(b.totalValueLockedUSD) - parseNumber(a.totalValueLockedUSD))[0] ?? null
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
  const socialPreviewPath = `/explore/content/${chain.toLowerCase()}/${contentCoinAddress.toLowerCase()}`

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
                  {METRICS.map((m) => {
                    const on = selectedMetric === m.key
                    const color = METRIC_COLORS[m.key].primary
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSelectedMetric(m.key)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border ${
                          on
                            ? 'border-white/10 bg-white/[0.06] text-white'
                            : 'border-white/5 bg-transparent text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]'
                        }`}
                        style={on ? { boxShadow: `inset 0 0 0 1px ${color}40` } : undefined}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: on ? color : 'transparent',
                            border: `1px solid ${on ? color : 'rgba(255,255,255,0.15)'}`,
                          }}
                          aria-hidden="true"
                        />
                        {m.icon}
                        <span className="hidden sm:inline">{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {loading || historyLoading ? (
                <LoadingBlock intent="processing" minHeightClassName="h-[420px]" className="rounded-xl bg-white/4" />
              ) : (
                <MetricChart
                  points={points}
                  metric={selectedMetric}
                  pool={history?.pool ?? null}
                  period={selectedPeriod}
                />
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>Oldest</span>
                <span className="text-zinc-400">
                  {METRICS.find((m) => m.key === selectedMetric)?.label}
                  {selectedMetric === 'fees' ? ' (cumulative)' : ''} over {selectedPeriod}
                </span>
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
                          <LoadingText intent="processing" labelOverride="Loading swaps..." />
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
                <div className="flex items-center gap-2">
                  <ExploreUnfurlDebugCopy path={socialPreviewPath} className="px-2.5 py-0.5" />
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
