import { useId, useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts'

export type MetricChartPlotMode = 'line' | 'bar' | 'stacked-bar'

type ChartRow = {
  index: number
  value: number
  token0: number
  token1: number
}

export type MetricChartPlotProps = {
  mode: MetricChartPlotMode
  values: number[]
  yDomain: { min: number; max: number }
  primaryColor: string
  secondaryColor: string
  token0Share?: number | null
  token1Share?: number | null
  onScrub?: (index: number | undefined) => void
}

function handleScrubState(
  state: { activeTooltipIndex?: number | string } | undefined,
  onScrub?: (index: number | undefined) => void,
) {
  if (!onScrub) return
  const raw = state?.activeTooltipIndex
  if (raw == null || raw === '') {
    onScrub(undefined)
    return
  }
  const index = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  onScrub(Number.isFinite(index) ? index : undefined)
}

export function MetricChartPlot({
  mode,
  values,
  yDomain,
  primaryColor,
  secondaryColor,
  token0Share = null,
  token1Share = null,
  onScrub,
}: MetricChartPlotProps) {
  const gradientId = useId().replace(/:/g, '')

  const chartData = useMemo<ChartRow[]>(
    () =>
      values.map((value, index) => ({
        index,
        value,
        token0: value * (token0Share ?? 0),
        token1: value * (token1Share ?? 0),
      })),
    [values, token0Share, token1Share],
  )

  const yAxisDomain: [number, number] = [yDomain.min, yDomain.max]
  const margin = { top: 4, right: 4, bottom: 2, left: 2 }
  const scrubTooltip = <Tooltip cursor={false} content={() => null} />

  if (mode === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={margin}
          onMouseMove={(state) => handleScrubState(state, onScrub)}
          onMouseLeave={() => onScrub?.(undefined)}
        >
          <YAxis hide domain={yAxisDomain} />
          {scrubTooltip}
          <Line
            type="monotone"
            dataKey="value"
            stroke={primaryColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'stacked-bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={margin}
          barCategoryGap="15%"
          onMouseMove={(state) => handleScrubState(state, onScrub)}
          onMouseLeave={() => onScrub?.(undefined)}
        >
          <YAxis hide domain={yAxisDomain} />
          {scrubTooltip}
          <Bar dataKey="token0" stackId="tvl" fill={primaryColor} radius={[3, 3, 0, 0]} isAnimationActive />
          <Bar dataKey="token1" stackId="tvl" fill={secondaryColor} radius={[3, 3, 0, 0]} isAnimationActive />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={margin}
        barCategoryGap="15%"
        onMouseMove={(state) => handleScrubState(state, onScrub)}
        onMouseLeave={() => onScrub?.(undefined)}
      >
        <YAxis hide domain={yAxisDomain} />
        {scrubTooltip}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={secondaryColor} stopOpacity={0.45} />
            <stop offset="100%" stopColor={primaryColor} stopOpacity={0.95} />
          </linearGradient>
        </defs>
        <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive>
          {chartData.map((row) => (
            <Cell key={row.index} fill={`url(#${gradientId})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
