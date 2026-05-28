import { useId, useMemo } from 'react'

import {
  buildSparklineLayout,
  extractIndexedMcapSparklineValues,
  layoutToAreaPath,
  layoutToPolyline,
  type ExploreHeroSparklinePoint,
} from '@/components/explore/exploreHeroSparklineUtils'
import { EXPLORE_ACCENT_HEX } from '@/lib/explore/exploreTheme'

const FILL_LAYOUT_WIDTH = 120
const FILL_LAYOUT_HEIGHT = 64

type ExploreHeroSparklineProps = {
  history: ReadonlyArray<ExploreHeroSparklinePoint>
  width?: number
  height?: number
  stroke?: string
  className?: string
  title?: string
  /** Stretch the sparkline to fill its parent (metric card background). */
  fill?: boolean
}

export function ExploreHeroSparkline({
  history,
  width = 72,
  height = 28,
  stroke = EXPLORE_ACCENT_HEX,
  className = '',
  title = 'Indexed creator-coin market cap over the last 30 days',
  fill = false,
}: ExploreHeroSparklineProps) {
  const gradientId = useId().replace(/:/g, '')
  const layoutWidth = fill ? FILL_LAYOUT_WIDTH : width
  const layoutHeight = fill ? FILL_LAYOUT_HEIGHT : height
  const layout = useMemo(() => {
    const values = extractIndexedMcapSparklineValues(history)
    return buildSparklineLayout(values, layoutWidth, layoutHeight, fill ? 4 : 2)
  }, [history, layoutWidth, layoutHeight, fill])

  if (layout.length < 2) return null

  const polyline = layoutToPolyline(layout)
  const areaPath = layoutToAreaPath(layout, layoutWidth, layoutHeight, fill ? 4 : 2)
  const fillClassName = fill ? 'h-full w-full' : ''
  const mergedClassName = [fillClassName, className].filter(Boolean).join(' ')

  return (
    <svg
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      viewBox={`0 0 ${layoutWidth} ${layoutHeight}`}
      preserveAspectRatio={fill ? 'none' : undefined}
      className={mergedClassName}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={fill ? 0.22 : 0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={fill ? 0.02 : 0.02} />
        </linearGradient>
        {fill ? (
          <linearGradient id={`${gradientId}-scrim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#020617" stopOpacity={0.72} />
            <stop offset="45%" stopColor="#020617" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#020617" stopOpacity={0.08} />
          </linearGradient>
        ) : null}
      </defs>
      {fill ? <rect width={layoutWidth} height={layoutHeight} fill={`url(#${gradientId}-scrim)`} /> : null}
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={fill ? 1.5 : 1.75}
        strokeOpacity={fill ? 0.55 : 1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
