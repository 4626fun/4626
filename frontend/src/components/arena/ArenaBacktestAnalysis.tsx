import { motion } from 'framer-motion'
import { Activity, BarChart3, ShieldCheck, TrendingUp, Zap } from 'lucide-react'
import { useState } from 'react'
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { BacktestSweepRow } from '@/lib/alfaclub/backtestSweep'
import {
  formatBacktestSeriesTime,
  type BacktestRebalanceEvent,
  type BacktestSeriesPayload,
} from '@/lib/alfaclub/backtestSeries'

type ChartRow = {
  t: number
  label: string
  mark: number
  equity: number
  longHealth: number
  shortHealth: number
  rebalance?: boolean
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

function formatNum(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
}

function MetricCard(props: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'positive' | 'negative' | 'accent'
  icon: React.ReactNode
}) {
  const toneClass =
    props.tone === 'positive'
      ? 'text-emerald-300'
      : props.tone === 'negative'
        ? 'text-red-300'
        : props.tone === 'accent'
          ? 'text-sky-300'
          : 'text-zinc-100'

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-gradient-to-br from-zinc-950/80 to-black/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{props.label}</div>
          <div className={`mt-1 text-xl font-medium tabular-nums ${toneClass}`}>{props.value}</div>
          {props.hint ? <div className="mt-1 text-xs text-zinc-500">{props.hint}</div> : null}
        </div>
        <div className="rounded-lg bg-zinc-900/80 p-2 text-zinc-400">{props.icon}</div>
      </div>
    </div>
  )
}

type ArenaBacktestAnalysisProps = {
  row: BacktestSweepRow
  series: BacktestSeriesPayload | null | undefined
  seriesLoading: boolean
  seriesError: Error | null
  sweepFile?: string | null
  /** Run-form total capital when series summary is not loaded yet. */
  initialCapitalHint?: number
}

export function ArenaBacktestAnalysis({
  row,
  series,
  seriesLoading,
  seriesError,
  sweepFile,
  initialCapitalHint,
}: ArenaBacktestAnalysisProps) {
  const [showHealth, setShowHealth] = useState(true)

  const chartData: ChartRow[] = !series?.points?.length
    ? []
    : series.points.map((point) => ({
        ...point,
        label: formatBacktestSeriesTime(point.t),
      }))

  const rebalancePoints = chartData.filter((point) => point.rebalance)

  const rebalanceEvents: BacktestRebalanceEvent[] =
    series?.rebalanceEvents?.length
      ? series.rebalanceEvents
      : rebalancePoints.map((point) => ({
          t: point.t,
          mark: point.mark,
          weakSide: 'long',
          strongSide: 'short',
          weakHealth: Math.min(point.longHealth, point.shortHealth),
          healthGap: Math.abs(point.longHealth - point.shortHealth),
          chunkUsd: 0,
          executionCostUsd: 0,
        }))

  const liquidationCount = series?.summary.liquidationCount ?? row.liquidationCount ?? 0
  const minLegHealth = Math.min(row.minHealthRoom, row.minHealthAgent)
  const showsLegacyNegativeEquity =
    (series?.summary.finalEquity ?? row.finalEquity) < 0 || minLegHealth < 0

  const returnPct =
    series?.summary.returnPct ??
    (initialCapitalHint && initialCapitalHint > 0
      ? (row.finalEquity - initialCapitalHint) / initialCapitalHint
      : 0)
  const initialCapital =
    series?.summary.initialCapital ??
    (initialCapitalHint && initialCapitalHint > 0
      ? initialCapitalHint
      : row.finalEquity / (1 + returnPct || 1))
  const netPnl = (series?.summary.finalEquity ?? row.finalEquity) - initialCapital
  const realizedPnl = series?.summary.realizedPnl ?? row.realizedPnl
  const executionCost = series?.summary.executionCost ?? row.executionCost
  const forcedSkips = series?.summary.forcedSkipsInsufficientBuffer ?? row.forcedSkipsInsufficientBuffer
  const bothLegsFlat = row.finalLongQty <= 1e-8 && row.finalShortQty <= 1e-8
  const peakEquity = chartData.length > 0 ? Math.max(...chartData.map((point) => point.equity)) : null

  const coveragePct = series?.dataQuality.coveragePct
  const barCount = series?.dataQuality.barCount
  const dataSource = series?.dataQuality.source
  const resolvedInterval = series?.interval ?? row.interval
  const isCoarse90d = row.windowHours >= 24 * 90 && resolvedInterval === '1h'
  // Intermediate degradation (1m → 5m / 15m): the 1m cache was insufficient
  // for the full horizon. Surface an explicit callout instead of only showing
  // the resolved interval label (the 1h + 90d case is handled by isCoarse90d).
  // BACKTEST-005.
  const isDegradedInterval = resolvedInterval === '5m' || resolvedInterval === '15m'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-sky-400/90">Best configuration replay</div>
          <h3 className="text-xl text-zinc-100 mt-1">
            {row.symbol} · {row.windowHours}h · {resolvedInterval} · {row.leverage}x
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {barCount != null ? (
            <span className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1 text-zinc-300">
              {formatNum(barCount, 0)} bars
            </span>
          ) : null}
          {coveragePct != null ? (
            <span className="rounded-full border border-emerald-900/60 bg-emerald-950/30 px-3 py-1 text-emerald-200">
              {(coveragePct * 100).toFixed(1)}% coverage
            </span>
          ) : null}
          {dataSource ? (
            <span className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1 text-zinc-400 capitalize">
              {dataSource.replace(/_/g, ' ')}
            </span>
          ) : null}
          {row.commingleViolationCount === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-900/50 bg-emerald-950/20 px-3 py-1 text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Isolated legs
            </span>
          ) : (
            <span className="rounded-full border border-red-900/50 bg-red-950/20 px-3 py-1 text-red-200">
              {row.commingleViolationCount} commingle flags
            </span>
          )}
        </div>
      </div>

      {isCoarse90d ? (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-100/90">
          Full 90-day horizon replays on <span className="font-medium text-amber-50">1h bars</span> until the 1m
          Supabase cache reaches ~92% coverage. Hyperliquid only exposes ~3.5 days of 1m history per request — run
          the daily cache script to accumulate minute bars over time.
        </div>
      ) : null}

      {isDegradedInterval ? (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-100/90">
          This replay used <span className="font-medium text-amber-50">{resolvedInterval} bars</span> because the 1m
          Supabase cache was insufficient for the full horizon — the run degraded from 1m to a coarser resolution.
          Run{' '}
          <code className="rounded bg-amber-950/60 px-1 py-0.5 text-amber-100">cache-backtest-minute-bars.ts</code>{' '}
          to accumulate 1m data and re-run for finer-grained rebalance opportunities.
        </div>
      ) : null}

      {showsLegacyNegativeEquity ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-100/90">
          {liquidationCount > 0 ? (
            <>
              This run hit <span className="font-medium text-red-50">{liquidationCount} isolated liquidation(s)</span>{' '}
              when a leg&apos;s health reached zero — posted margin on that leg was wiped and the position closed. Remaining
              equity is buffer cash on both legs plus any open position mark-to-market.
            </>
          ) : (
            <>
              Negative portfolio equity on older runs usually meant the simulator kept full {row.leverage}x exposure after
              the theoretical liquidation price, so unrealized loss exceeded posted margin. Re-run the backtest to apply
              isolated liquidation (health ≤ 0 closes the leg at margin loss).
            </>
          )}
        </div>
      ) : liquidationCount > 0 ? (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-100/90">
          {liquidationCount} leg liquidation(s) during this window — margin was lost on those legs when health hit zero
          before gradual rebalances could restore balance.
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3 text-xs text-zinc-300 space-y-2">
        <div className="font-medium text-zinc-100">How to read this replay</div>
        <p>
          Portfolio equity = long leg (buffer + margin + unrealized) + short leg (same), with{' '}
          <span className="text-zinc-100">isolated silos</span> — no cash moves between room and agent wallets.
          Rebalances trim the stronger leg into its buffer and add margin on the weaker leg using{' '}
          <span className="text-zinc-100">that leg&apos;s own buffer only</span>, so notionals drift and the book
          is not perfectly delta-neutral after the first rebalance.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 tabular-nums">
          <div>
            <div className="text-zinc-500">Started</div>
            <div className="text-zinc-100">{formatUsd(initialCapital)}</div>
          </div>
          <div>
            <div className="text-zinc-500">Ended</div>
            <div className={netPnl >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {formatUsd(series?.summary.finalEquity ?? row.finalEquity)} ({formatPct(returnPct)})
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Realized P&amp;L · fees</div>
            <div className="text-zinc-100">
              {formatUsd(realizedPnl)} · {formatUsd(executionCost)}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Skipped rebalances</div>
            <div className={forcedSkips > 50 ? 'text-amber-300' : 'text-zinc-100'}>{forcedSkips}</div>
          </div>
        </div>
        {peakEquity != null && peakEquity > initialCapital * 1.02 ? (
          <p className="text-zinc-500">
            Peak equity was {formatUsd(peakEquity)} mid-window — imbalanced legs can show paper gains on a falling
            market before liquidations/fees drag the total down.
          </p>
        ) : null}
        {series?.summary.priceChangePct != null &&
        Math.abs(series.summary.priceChangePct - returnPct) > 0.03 ? (
          <p className="text-zinc-500">
            Underlying moved {formatPct(series.summary.priceChangePct)} while portfolio return was{' '}
            {formatPct(returnPct)} — after rebalances the book is not delta-neutral, so BTC direction alone does not
            predict total equity.
          </p>
        ) : null}
        {bothLegsFlat ? (
          <p className="text-amber-200/90">
            Both legs finished flat (liquidated or fully closed). Ending equity is mostly leftover buffer cash, not
            open perp exposure.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total return"
          value={formatPct(returnPct)}
          hint={`${formatUsd(series?.summary.finalEquity ?? row.finalEquity)} from ${formatUsd(initialCapital)}`}
          tone={returnPct >= 0 ? 'positive' : 'negative'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Rebalances"
          value={String(row.rebalanceCount)}
          hint={`Avg chunk ${formatUsd(row.avgChunkUsd)}`}
          tone="accent"
          icon={<Zap className="h-4 w-4" />}
        />
        <MetricCard
          label="Price move"
          value={formatPct(row.priceChangePct)}
          hint={`${formatUsd(row.startPrice)} → ${formatUsd(row.endPrice)}`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Min leg health"
          value={formatNum(Math.min(row.minHealthRoom, row.minHealthAgent), 3)}
          hint={`Long ${formatNum(row.minHealthRoom, 3)} · Short ${formatNum(row.minHealthAgent, 3)}`}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-zinc-100">Full-horizon replay</h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Equity curve on {resolvedInterval} bars. Amber dots on price mark rebalance bars (
              {rebalanceEvents.length} total).
              {barCount != null ? ` ${formatNum(barCount, 0)} points in replay.` : null}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={showHealth}
              onChange={(event) => setShowHealth(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 text-sky-500"
            />
            Overlay leg health
          </label>
        </div>

        {seriesLoading ? (
          <p className="text-xs text-zinc-500 py-16 text-center">Loading full-horizon series…</p>
        ) : seriesError ? (
          <p className="text-xs text-red-300 py-16 text-center">
            {seriesError.message === 'Not found'
              ? 'Playback series endpoint unavailable — re-run the backtest to load the chart inline.'
              : seriesError.message}
          </p>
        ) : chartData.length === 0 ? (
          <p className="text-xs text-zinc-500 py-16 text-center">
            No playback series for this run yet.
            {sweepFile ? (
              <>
                {' '}
                Expected companion file{' '}
                <code className="text-zinc-300">{sweepFile.replace(/\.csv$/i, '-series.json')}</code> next to the
                sweep CSV.
              </>
            ) : (
              ' Run a backtest to generate the equity replay.'
            )}
          </p>
        ) : (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="label"
                  minTickGap={48}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={{ stroke: '#3f3f46' }}
                />
                <YAxis
                  yAxisId="equity"
                  tick={{ fill: '#93c5fd', fontSize: 10 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickFormatter={(value: number) => formatUsd(value)}
                  width={72}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tick={{ fill: '#fb923c', fontSize: 10 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickFormatter={(value: number) => formatNum(value, 0)}
                  width={64}
                />
                {showHealth ? <YAxis yAxisId="health" orientation="right" hide domain={[0, 'auto']} /> : null}
                <Tooltip
                  contentStyle={{
                    background: 'rgba(9,9,11,0.95)',
                    border: '1px solid #27272a',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(value, name) => {
                    const numeric = typeof value === 'number' ? value : Number(value ?? 0)
                    const key = String(name)
                    if (key === 'equity') return [formatUsd(numeric), 'Portfolio equity']
                    if (key === 'mark') return [formatUsd(numeric), 'Mark price']
                    if (key === 'longHealth' || key === 'shortHealth') return [formatNum(numeric, 3), key]
                    return [formatNum(numeric, 3), key]
                  }}
                />
                <Area
                  yAxisId="equity"
                  type="monotone"
                  dataKey="equity"
                  stroke="#38bdf8"
                  fill="url(#equityFill)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {initialCapital > 0 ? (
                  <ReferenceLine
                    yAxisId="equity"
                    y={initialCapital}
                    stroke="#52525b"
                    strokeDasharray="4 4"
                    label={{
                      value: `Start ${formatUsd(initialCapital)}`,
                      position: 'insideTopLeft',
                      fill: '#71717a',
                      fontSize: 10,
                    }}
                  />
                ) : null}
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="mark"
                  stroke="#fb923c"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {showHealth ? (
                  <>
                    <Line
                      yAxisId="health"
                      type="monotone"
                      dataKey="longHealth"
                      stroke="#22c55e"
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="4 3"
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="health"
                      type="monotone"
                      dataKey="shortHealth"
                      stroke="#f87171"
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="4 3"
                      isAnimationActive={false}
                    />
                  </>
                ) : null}
                {rebalancePoints.map((point) => (
                  <ReferenceDot
                    key={`rb-${point.t}`}
                    x={point.label}
                    y={point.mark}
                    yAxisId="price"
                    r={4}
                    fill="#fbbf24"
                    stroke="#78350f"
                    strokeWidth={1}
                    ifOverflow="discard"
                  />
                ))}
                <Brush dataKey="label" height={28} stroke="#52525b" fill="#18181b" travellerWidth={8} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {rebalanceEvents.length > 0 ? (
        <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/40 p-4">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-zinc-100">Rebalance timeline</h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Triggered when the weaker leg&apos;s health drops below the floor and the health gap exceeds the
              deadband. Each row is one bar where the strong leg trimmed margin to its buffer and the weak leg added
              margin from its own buffer (no cross-wallet transfer).
            </p>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-zinc-800/80">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-zinc-950/95 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Strong trim · weak add</th>
                  <th className="px-3 py-2 text-right font-medium">Mark</th>
                  <th className="px-3 py-2 text-right font-medium">Weak health</th>
                  <th className="px-3 py-2 text-right font-medium">Gap</th>
                  <th className="px-3 py-2 text-right font-medium">Chunk</th>
                  <th className="px-3 py-2 text-right font-medium">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/80 text-zinc-300">
                {rebalanceEvents.map((event, index) => (
                  <tr key={`${event.t}-${index}`} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-zinc-100">
                      {formatBacktestSeriesTime(event.t)}
                    </td>
                    <td className="px-3 py-2 capitalize text-zinc-400">
                      {event.strongSide} trim · {event.weakSide} add
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatUsd(event.mark)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNum(event.weakHealth, 3)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNum(event.healthGap, 3)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {event.chunkUsd > 0 ? formatUsd(event.chunkUsd) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                      {event.executionCostUsd > 0 ? formatUsd(event.executionCostUsd) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : chartData.length > 0 ? (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 py-3 text-xs text-zinc-500">
          No rebalances fired in this window — leg health stayed above the floor or inside the deadband for the full
          horizon.
        </div>
      ) : null}
    </motion.div>
  )
}
