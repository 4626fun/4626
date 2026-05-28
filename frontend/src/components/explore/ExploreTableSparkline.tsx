import { useId, useMemo } from 'react'

import {
  buildSparklineLayout,
  layoutToAreaPath,
  layoutToPolyline,
} from '@/components/explore/exploreHeroSparklineUtils'
import { getSignedPercentToneClass } from '@/components/explore/rowFormatting'
import { EXPLORE_ACCENT_HEX } from '@/lib/explore/exploreTheme'

type ExploreTableSparklineProps = {
  values: ReadonlyArray<number>
  changePercent?: number | null
  width?: number
  height?: number
  className?: string
}

function formatSparklineChangePercent(changePercent: number | null | undefined): string {
  if (changePercent == null || !Number.isFinite(changePercent)) return '—'
  const sign = changePercent > 0 ? '+' : ''
  return `${sign}${changePercent.toFixed(1)}%`
}

export function ExploreTableSparkline({
  values,
  changePercent = null,
  width = 56,
  height = 22,
  className = '',
}: ExploreTableSparklineProps) {
  const gradientId = useId().replace(/:/g, '')
  const layout = useMemo(
    () => buildSparklineLayout(values, width, height, 2),
    [values, width, height],
  )

  if (layout.length < 2) {
    return <span className="text-zinc-600 tabular-nums">—</span>
  }

  const polyline = layoutToPolyline(layout)
  const areaPath = layoutToAreaPath(layout, width, height, 2)
  const changeLabel = formatSparklineChangePercent(changePercent)
  const changeTone = getSignedPercentToneClass(changePercent)

  return (
    <div className={`flex flex-col items-center justify-center gap-0.5 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <title>30-day price trend</title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EXPLORE_ACCENT_HEX} stopOpacity={0.28} />
            <stop offset="100%" stopColor={EXPLORE_ACCENT_HEX} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        <polyline
          points={polyline}
          fill="none"
          stroke={EXPLORE_ACCENT_HEX}
          strokeWidth={1.5}
          strokeOpacity={0.85}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span className={`text-[10px] tabular-nums leading-none ${changeTone}`}>{changeLabel}</span>
    </div>
  )
}
