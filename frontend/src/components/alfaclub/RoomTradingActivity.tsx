import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  describeTradeAction,
  fetchRoomTradingActivity,
  formatSignedUsd,
  formatTradePrice,
  formatTradeTimeAgo,
  formatUsdCompact,
  isRoomTradingActivityEmpty,
  totalClosedTradeStats,
  totalRealizedPnlUsd,
  totalTradeCount,
  type RoomMarketPosition,
  type RoomMarketSummary,
  type RoomTradeEvent,
  type RoomTradingActivityData,
} from '@/lib/alfaclub/roomTradingActivity'
import { cn } from '@/lib/shared/utils'

const RECENT_TRADES_LIMIT = 8
const OTHER_MARKETS_LIMIT = 4

export function RoomTradingActivity({ roomId }: { roomId: string }) {
  const [data, setData] = useState<RoomTradingActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetchRoomTradingActivity(roomId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Failed to load trading activity')
        setData(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // roomId changes remount this component (parent renders it keyed by roomId), so the
    // initial `loading = true` state already covers that case; reloadKey only drives manual refresh.
  }, [roomId, reloadKey])

  const isEmpty = data != null && isRoomTradingActivityEmpty(data)

  return (
    <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-sky-300">
            <Activity className="size-3" aria-hidden />
            Trading activity
          </p>
          <h2 className="mt-2 text-base font-semibold text-zinc-100">PNL &amp; recent trades</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setError(null)
            setReloadKey((key) => key + 1)
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
        >
          <RefreshCw className="size-3" aria-hidden />
          Refresh
        </button>
      </div>

      {loading ? <TradingActivitySkeleton /> : null}

      {!loading && error ? (
        <p className="mt-4 text-xs text-zinc-500">Trading activity is unavailable right now ({error}).</p>
      ) : null}

      {!loading && !error && isEmpty ? (
        <p className="mt-4 text-sm text-zinc-400">
          No recorded trading activity for this room in the last 7 days.
        </p>
      ) : null}

      {!loading && !error && data && !isEmpty ? <TradingActivityBody data={data} /> : null}
    </div>
  )
}

function TradingActivityBody({ data }: { data: RoomTradingActivityData }) {
  const realizedPnlUsd = totalRealizedPnlUsd(data.marketSummaries)
  const { closedCount, winningClosedCount } = totalClosedTradeStats(data.marketSummaries)
  const tradeCount = totalTradeCount(data.marketSummaries)
  const winRatePercent = closedCount > 0 ? Math.round((winningClosedCount / closedCount) * 100) : null
  const recentTrades = [...data.tradeEvents].reverse().slice(0, RECENT_TRADES_LIMIT)
  const otherMarkets = data.marketSummaries
    .filter((summary) => summary.market !== data.defaultMarket && summary.tradeCount > 0)
    .slice(0, OTHER_MARKETS_LIMIT)

  return (
    <div className="mt-4 space-y-5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Realized PNL" value={formatSignedUsd(realizedPnlUsd)} tone={pnlTone(realizedPnlUsd)} />
        <StatCard
          label="Win rate"
          value={winRatePercent != null ? `${winRatePercent}%` : '—'}
          hint={closedCount > 0 ? `${winningClosedCount}/${closedCount} closed` : 'No closes yet'}
        />
        <StatCard label="Trades" value={tradeCount.toLocaleString()} hint="Last 7 days" />
        <StatCard
          label="Open positions"
          value={data.currentPositions.length.toLocaleString()}
          hint={data.currentPositions.length > 0 ? 'Live exposure' : 'Flat'}
        />
      </dl>

      {data.currentPositions.length > 0 ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Open positions</p>
          <div className="mt-2 space-y-1.5">
            {data.currentPositions.map((position) => (
              <PositionRow key={`${position.source}:${position.market}`} position={position} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Recent trades</p>
        {recentTrades.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No individual fills recorded in this window yet.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {recentTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        )}
      </div>

      {otherMarkets.length > 0 ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Other markets traded</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {otherMarkets.map((summary) => (
              <MarketChip key={summary.market} summary={summary} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function pnlTone(value: number): 'positive' | 'negative' | 'neutral' {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}

function toneClassName(tone: 'positive' | 'negative' | 'neutral' | undefined): string {
  if (tone === 'positive') return 'text-emerald-300'
  if (tone === 'negative') return 'text-rose-300'
  return 'text-zinc-100'
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div className="rounded-xl bg-black/30 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={cn('mt-0.5 font-mono text-lg tabular-nums', toneClassName(tone))}>{value}</dd>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p> : null}
    </div>
  )
}

function PositionRow({ position }: { position: RoomMarketPosition }) {
  const pnl = position.unrealizedPnlUsd ?? null
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <SideBadge side={position.side} />
        <span className="truncate font-medium text-zinc-200">{position.coin}</span>
        {position.leverage ? (
          <span className="shrink-0 font-mono text-[10px] text-zinc-500">{position.leverage}x</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono tabular-nums">
        <span className="text-zinc-400">{formatUsdCompact(position.sizeUsd)}</span>
        <span className={cn('font-semibold', toneClassName(pnl != null ? pnlTone(pnl) : 'neutral'))}>
          {formatSignedUsd(pnl)}
        </span>
      </div>
    </div>
  )
}

function TradeRow({ trade }: { trade: RoomTradeEvent }) {
  const isClose = trade.action === 'close' || trade.action === 'liquidated'
  const priceLabel = formatTradePrice(trade.price)
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <SideBadge side={trade.side} />
        <span className="truncate font-medium text-zinc-200">{trade.coin ?? trade.market}</span>
        <span className="shrink-0 text-zinc-500">{describeTradeAction(trade.action)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono tabular-nums text-zinc-400">
        {priceLabel ? <span>{priceLabel}</span> : null}
        {isClose ? (
          <span className={cn('font-semibold', toneClassName(pnlTone(trade.closedPnl)))}>
            {formatSignedUsd(trade.closedPnl)}
          </span>
        ) : null}
        <span className="text-zinc-500">{formatTradeTimeAgo(trade.time)}</span>
      </div>
    </div>
  )
}

function MarketChip({ summary }: { summary: RoomMarketSummary }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-zinc-400 ring-1 ring-white/[0.06]">
      {summary.coin}
      <span className={toneClassName(pnlTone(summary.realizedPnlUsd))}>
        {formatSignedUsd(summary.realizedPnlUsd)}
      </span>
    </span>
  )
}

function SideBadge({ side }: { side: RoomTradeEvent['side'] }) {
  if (side === 'long') {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
        <ArrowUpRight className="size-2.5" aria-hidden />
        Long
      </span>
    )
  }
  if (side === 'short') {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
        <ArrowDownRight className="size-2.5" aria-hidden />
        Short
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">
      —
    </span>
  )
}

function TradingActivitySkeleton() {
  return (
    <div className="mt-4 space-y-2" aria-hidden role="status">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-lg bg-white/[0.03]" />
      ))}
    </div>
  )
}