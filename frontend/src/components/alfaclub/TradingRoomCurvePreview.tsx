import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { curveCost, curveDivisor, type AlfaRoomTier, type RaidPoint } from '@/lib/alfaclub/keyDefense'

type CurveRow = {
  keyIndex: number
  cumulativeRawSpendUsdc: number
  attackNet: number | null
}

export type TradingRoomCurvePreviewProps = {
  selectedTier: AlfaRoomTier
  activeKeyIndex?: number
  raidCurve?: RaidPoint[]
  maxKeys?: number
  heightClassName?: string
  withFrame?: boolean
}

function formatUsdShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  if (value >= 1) return `$${value.toFixed(0)}`
  if (value >= 0.01) return `$${value.toFixed(2)}`
  return `$${value.toFixed(4)}`
}

function CurveTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: number
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-white">X keys: {label ?? 0}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-1 text-zinc-300">
          <span style={{ color: entry.color }}>{entry.name}</span>{' '}
          <span className="font-mono">{formatUsdShort(entry.value ?? 0)}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Trading-room curve surface:
 * - Selected tier only (filled cumulative raw spend curve)
 * - Optional attack-net overlay aligned to current supply (x starts at supply)
 */
export function TradingRoomCurvePreview({
  selectedTier,
  activeKeyIndex,
  raidCurve,
  maxKeys = 60,
  heightClassName = 'h-44',
  withFrame = true,
}: TradingRoomCurvePreviewProps) {
  const attackXOffset = activeKeyIndex ?? 0
  const selectedDivisor = curveDivisor('trading', selectedTier)
  const selectedCurveLabel = `${selectedTier.charAt(0).toUpperCase()}${selectedTier.slice(1)} cumulative raw USD`
  const selectedCurveColor =
    selectedTier === 'casual' ? '#60a5fa' : selectedTier === 'club' ? '#a1a1aa' : '#f87171'

  const raidByKeys = useMemo(() => {
    const map = new Map<number, number>()
    for (const point of raidCurve ?? []) {
      map.set(attackXOffset + point.keysBought, point.profitUsdc)
    }
    return map
  }, [attackXOffset, raidCurve])

  const data = useMemo<CurveRow[]>(() => {
    const rows: CurveRow[] = []
    for (let i = 0; i <= maxKeys; i += 1) {
      rows.push({
        keyIndex: i,
        cumulativeRawSpendUsdc: curveCost(0, i, selectedDivisor),
        attackNet: raidByKeys.get(i) ?? null,
      })
    }
    return rows
  }, [maxKeys, raidByKeys, selectedDivisor])

  const clampedActiveKeyIndex =
    activeKeyIndex === undefined ? undefined : Math.max(0, Math.min(activeKeyIndex, maxKeys))
  const activePointValue =
    clampedActiveKeyIndex === undefined ? undefined : curveCost(0, clampedActiveKeyIndex, selectedDivisor)
  const hasAttackCurve = (raidCurve?.length ?? 0) > 0

  const [xMin, xMax] = useMemo((): [number, number] => {
    if (clampedActiveKeyIndex === undefined) return [0, maxKeys]
    const halfWindow = 30
    const min = Math.max(0, clampedActiveKeyIndex - halfWindow)
    const max = Math.min(maxKeys, clampedActiveKeyIndex + halfWindow)
    return max - min < 20
      ? [Math.max(0, clampedActiveKeyIndex - 10), Math.min(maxKeys, clampedActiveKeyIndex + 10)]
      : [min, max]
  }, [clampedActiveKeyIndex, maxKeys])

  const [yMin, yMax] = useMemo((): [number, number] => {
    const values: number[] = []
    for (const row of data) {
      values.push(row.cumulativeRawSpendUsdc)
      if (row.attackNet !== null) values.push(row.attackNet)
    }
    const rawMin = Math.min(...values)
    const rawMax = Math.max(...values)
    const span = Math.max(1, rawMax - rawMin)
    const pad = Math.max(span * 0.08, 1)
    return [rawMin - pad, rawMax + pad]
  }, [data])

  return (
    <div
      className={
        withFrame
          ? `mt-3 w-full rounded-2xl bg-black/35 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] ${heightClassName}`
          : `w-full ${heightClassName}`
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="keyIndex"
            type="number"
            domain={[xMin, xMax]}
            allowDecimals={false}
            tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            label={{
              value: 'Keys acquired (x)',
              position: 'insideBottom',
              offset: -2,
              fill: 'rgba(113,113,122,0.9)',
              fontSize: 10,
            }}
            height={28}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={formatUsdShort}
            tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          {hasAttackCurve ? (
            <ReferenceLine y={0} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" />
          ) : null}
          <Tooltip content={<CurveTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          {clampedActiveKeyIndex !== undefined ? (
            <ReferenceLine
              x={clampedActiveKeyIndex}
              stroke="rgba(96,165,250,0.35)"
              strokeDasharray="3 3"
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="cumulativeRawSpendUsdc"
            name={selectedCurveLabel}
            stroke={selectedCurveColor}
            strokeWidth={2.4}
            fill={selectedCurveColor}
            fillOpacity={0.12}
            dot={false}
            isAnimationActive={false}
          />
          {hasAttackCurve ? (
            <Line
              type="monotone"
              dataKey="attackNet"
              name="Attack net USD"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
          {clampedActiveKeyIndex !== undefined && activePointValue !== undefined ? (
            <ReferenceDot
              x={clampedActiveKeyIndex}
              y={activePointValue}
              r={4}
              fill="rgb(59 130 246)"
              stroke="rgb(255 255 255 / 0.9)"
              strokeWidth={1.5}
              ifOverflow="visible"
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

