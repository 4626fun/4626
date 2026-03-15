import { useMemo, useState } from 'react'

export type ExploreMetricHistoryPoint = {
  date: string
  creatorCoinsMarketCapUsd: number | null
}

type NormalizedPoint = {
  key: string
  date: string
  value: number | null
}

type ExploreMetricSparklineProps = {
  history: ExploreMetricHistoryPoint[] | null | undefined
  fallbackValue: number | null | undefined
}

function toDayKey(input: string): string | null {
  const ms = Date.parse(input)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}

function formatCompactUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function formatDayLabel(isoDate: string): string {
  const ms = Date.parse(isoDate)
  if (!Number.isFinite(ms)) return isoDate
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function buildSeries(history: ExploreMetricHistoryPoint[] | null | undefined, fallbackValue: number | null | undefined): NormalizedPoint[] {
  const byDay = new Map<string, number | null>()
  for (const point of history ?? []) {
    const key = toDayKey(point.date)
    if (!key) continue
    byDay.set(key, typeof point.creatorCoinsMarketCapUsd === 'number' && Number.isFinite(point.creatorCoinsMarketCapUsd)
      ? point.creatorCoinsMarketCapUsd
      : null)
  }

  const points: NormalizedPoint[] = []
  const now = new Date()
  let carry: number | null = null
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const raw = byDay.has(key) ? byDay.get(key) ?? null : null
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      carry = raw
    }
    points.push({
      key,
      date: new Date(`${key}T00:00:00.000Z`).toISOString(),
      value: carry,
    })
  }

  const hasKnownValue = points.some((p) => typeof p.value === 'number' && Number.isFinite(p.value))
  if (hasKnownValue) return points
  if (typeof fallbackValue === 'number' && Number.isFinite(fallbackValue)) {
    return points.map((p) => ({ ...p, value: fallbackValue }))
  }
  return points
}

export function ExploreMetricSparkline({ history, fallbackValue }: ExploreMetricSparklineProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const points = useMemo(() => buildSeries(history, fallbackValue), [history, fallbackValue])
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const hasData = values.length > 0
  if (!hasData) return null

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = Math.max(maxValue - minValue, maxValue * 0.02, 1)
  const chartWidth = 300
  const chartHeight = 90
  const topPadding = 14
  const bottomPadding = 14
  const usableHeight = chartHeight - topPadding - bottomPadding

  const chartPoints = points.map((point, idx) => {
    const x = points.length > 1 ? (idx / (points.length - 1)) * chartWidth : chartWidth / 2
    const numericValue = typeof point.value === 'number' ? point.value : minValue
    const normalized = (numericValue - minValue) / range
    const y = chartHeight - bottomPadding - normalized * usableHeight
    return { ...point, x, y, numericValue }
  })

  const linePoints = chartPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePoints} ${chartWidth},${chartHeight - bottomPadding} 0,${chartHeight - bottomPadding}`
  const activePoint = hoverIndex != null ? chartPoints[hoverIndex] : null
  const tooltipLeftPercent =
    activePoint && points.length > 1 ? (activePoint.x / chartWidth) * 100 : 0

  return (
    <div className="absolute inset-0">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="explore-mcap-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.24)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.02)" />
          </linearGradient>
        </defs>
        <polygon points={areaPath} fill="url(#explore-mcap-trend-fill)" />
        <polyline
          points={linePoints}
          fill="none"
          stroke="rgba(96, 165, 250, 0.95)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {activePoint ? (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={topPadding - 2}
              y2={chartHeight - bottomPadding + 2}
              stroke="rgba(147, 197, 253, 0.45)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="2.8" fill="rgba(191, 219, 254, 0.95)" />
          </>
        ) : null}

        {chartPoints.map((point, idx) => {
          const halfStep = idx === 0 || idx === chartPoints.length - 1 ? chartWidth / (chartPoints.length * 2) : chartWidth / chartPoints.length
          const x = Math.max(0, point.x - halfStep)
          const width = Math.min(chartWidth - x, halfStep * 2)
          return (
            <rect
              key={point.key}
              x={x}
              y={0}
              width={width}
              height={chartHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseMove={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          )
        })}
      </svg>

      {activePoint ? (
        <div
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-md border border-blue-300/30 bg-blue-950/80 px-2 py-1 text-[10px] text-blue-100 shadow-[0_8px_24px_-14px_rgba(56,189,248,0.9)] backdrop-blur-sm"
          style={{ left: `${tooltipLeftPercent}%` }}
        >
          <div className="font-medium tabular-nums">{formatCompactUsd(activePoint.numericValue)}</div>
          <div className="text-[9px] text-blue-200/80">{formatDayLabel(activePoint.date)}</div>
        </div>
      ) : null}
    </div>
  )
}
