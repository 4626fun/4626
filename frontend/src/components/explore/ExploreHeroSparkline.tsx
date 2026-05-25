import { useId, useMemo } from 'react'

import {
  buildSparklineLayout,
  extractIndexedMcapSparklineValues,
  layoutToAreaPath,
  layoutToPolyline,
  type ExploreHeroSparklinePoint,
} from '@/components/explore/exploreHeroSparklineUtils'

type ExploreHeroSparklineProps = {
  history: ReadonlyArray<ExploreHeroSparklinePoint>
  width?: number
  height?: number
  stroke?: string
  className?: string
  title?: string
}

export function ExploreHeroSparkline({
  history,
  width = 72,
  height = 28,
  stroke = '#38BDF8',
  className = '',
  title = 'Indexed creator-coin market cap over the last 30 days',
}: ExploreHeroSparklineProps) {
  const gradientId = useId().replace(/:/g, '')
  const layout = useMemo(() => {
    const values = extractIndexedMcapSparklineValues(history)
    return buildSparklineLayout(values, width, height)
  }, [history, width, height])

  if (layout.length < 2) return null

  const polyline = layoutToPolyline(layout)
  const areaPath = layoutToAreaPath(layout, width, height)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
