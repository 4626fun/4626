import { useMemo, useState } from 'react'
import {
  Area,
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

import {
  curveCost,
  curveDivisor,
  type AlfaRoomTier,
  type RaidPoint,
} from '@/lib/alfaclub/keyDefense'

type CurveRow = {
  keyIndex: number
  cumulativeBackdropUsdc: number
  cumulativeRawSpendUsdc: number
  cumulativeFilledUsdc: number | null
  ownerFilledUsdc: number | null
  nonOwnerFilledUsdc: number | null
  attackNet: number | null
}

export type TradingRoomCurvePreviewProps = {
  selectedTier: AlfaRoomTier
  activeKeyIndex?: number
  raidCurve?: RaidPoint[]
  progressiveStage?: number
  ownerSharePercent?: number
  onActiveKeyChange?: (nextKeyIndex: number) => void
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

function formatUsdLong(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function CurveTooltip({
  active,
  label,
  selectedTier,
  selectedDivisor,
}: {
  active?: boolean
  label?: number
  selectedTier: AlfaRoomTier
  selectedDivisor: number
}) {
  if (!active || label === undefined) return null
  const supply = Math.max(0, Number(label))
  const cumulativeRawUsd = curveCost(0, supply, selectedDivisor)
  const price = curveCost(supply, 1, selectedDivisor)
  const tierName = `${selectedTier.charAt(0).toUpperCase()}${selectedTier.slice(1)}`
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-white">Total Supply: {supply.toLocaleString()} keys</p>
      <p className="mt-1 text-zinc-300">
        {tierName} cumulative raw USD{' '}
        <span className="font-mono text-zinc-100">{formatUsdLong(cumulativeRawUsd)}</span>
      </p>
      <p className="mt-1 text-zinc-300">
        {tierName} current key price{' '}
        <span className="font-mono text-zinc-100">{formatUsdLong(price)}</span>
      </p>
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
  progressiveStage = 1,
  ownerSharePercent = 0,
  onActiveKeyChange,
  maxKeys = 60,
  heightClassName = 'h-44',
  withFrame = true,
}: TradingRoomCurvePreviewProps) {
  const [isDragging, setIsDragging] = useState(false)
  const attackXOffset = activeKeyIndex ?? 0
  const selectedDivisor = curveDivisor('trading', selectedTier)
  const selectedCurveLabel = `${selectedTier.charAt(0).toUpperCase()}${selectedTier.slice(1)} cumulative raw USD`
  const selectedCurveColor =
    selectedTier === 'casual' ? '#38bdf8' : selectedTier === 'club' ? '#60a5fa' : '#a78bfa'
  const ownerShareFraction = Math.max(0, Math.min(1, ownerSharePercent / 100))
  const fillLimitIndex =
    progressiveStage >= 2 && activeKeyIndex !== undefined ? Math.max(0, activeKeyIndex) : -1

  const raidByKeys = useMemo(() => {
    const map = new Map<number, number>()
    for (const point of raidCurve ?? []) {
      map.set(attackXOffset + point.keysBought, point.profitUsdc)
    }
    return map
  }, [attackXOffset, raidCurve])

  const clampedActiveKeyIndex =
    activeKeyIndex === undefined ? undefined : Math.max(0, activeKeyIndex)
  const activePointValue =
    clampedActiveKeyIndex === undefined ? undefined : curveCost(0, clampedActiveKeyIndex, selectedDivisor)
  const hasAttackCurve = (raidCurve?.length ?? 0) > 0

  // Center the selected supply in the viewport. The window may extend past
  // maxKeys on the right so the marker truly sits in the middle.
  const [xMin, xMax] = useMemo((): [number, number] => {
    let min = 0
    let max = maxKeys
    if (clampedActiveKeyIndex !== undefined && clampedActiveKeyIndex >= 5) {
      const halfWindow = Math.max(25, Math.round(maxKeys * 0.45))
      min = Math.max(0, clampedActiveKeyIndex - halfWindow)
      // Mirror the left span on the right so the marker stays dead center.
      max = clampedActiveKeyIndex + (clampedActiveKeyIndex - min)
    }
    if (hasAttackCurve && raidByKeys.size > 0) {
      const attackMaxX = Math.max(...raidByKeys.keys())
      max = Math.max(max, attackMaxX)
    }
    return [min, max]
  }, [clampedActiveKeyIndex, hasAttackCurve, maxKeys, raidByKeys])

  // Only generate rows inside the visible window so Recharts cannot expand
  // the X domain back out to the full data range.
  const data = useMemo<CurveRow[]>(() => {
    const rows: CurveRow[] = []
    for (let i = xMin; i <= xMax; i += 1) {
      rows.push({
        keyIndex: i,
        cumulativeBackdropUsdc: curveCost(0, i, selectedDivisor),
        cumulativeRawSpendUsdc: curveCost(0, i, selectedDivisor),
        cumulativeFilledUsdc: i <= fillLimitIndex ? curveCost(0, i, selectedDivisor) : null,
        ownerFilledUsdc:
          i <= fillLimitIndex ? curveCost(0, i, selectedDivisor) * ownerShareFraction : null,
        nonOwnerFilledUsdc:
          i <= fillLimitIndex ? curveCost(0, i, selectedDivisor) * (1 - ownerShareFraction) : null,
        attackNet: raidByKeys.get(i) ?? null,
      })
    }
    return rows
  }, [fillLimitIndex, ownerShareFraction, raidByKeys, selectedDivisor, xMax, xMin])

  const [yMin, yMax] = useMemo((): [number, number] => {
    const curveMax = Math.max(...data.map((row) => row.cumulativeRawSpendUsdc), 1)
    const floorPad = curveMax * 0.95
    if (!hasAttackCurve) {
      // Lift the baseline so low values are not glued to the bottom axis.
      return [-floorPad, curveMax * 1.2]
    }
    const attackValues = data
      .map((row) => row.attackNet)
      .filter((value): value is number => value !== null)
    const attackMin = attackValues.length > 0 ? Math.min(...attackValues) : 0
    const bottom = Math.min(-floorPad, attackMin * 2)
    const top = Math.max(curveMax * 1.2, 1)
    return [bottom, top]
  }, [data, hasAttackCurve])

  const chartIsInteractive = typeof onActiveKeyChange === 'function'
  const updateKeyIndexFromEvent = (event: unknown) => {
    if (!chartIsInteractive) return
    const activeLabel = (event as { activeLabel?: number | string } | null)?.activeLabel
    if (activeLabel === undefined || activeLabel === null) return
    const numeric = typeof activeLabel === 'number' ? activeLabel : Number(activeLabel)
    if (!Number.isFinite(numeric)) return
    onActiveKeyChange(Math.max(1, Math.round(numeric)))
  }

  return (
    <div
      className={
        withFrame
          ? `mt-3 w-full rounded-2xl bg-black/35 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] ${heightClassName}`
          : `w-full ${heightClassName}`
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 18, left: 0 }}
          onMouseDown={(event) => {
            if (!chartIsInteractive) return
            setIsDragging(true)
            updateKeyIndexFromEvent(event)
          }}
          onMouseMove={(event) => {
            if (!isDragging) return
            updateKeyIndexFromEvent(event)
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
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
              position: 'bottom',
              offset: 8,
              fill: 'rgba(113,113,122,0.9)',
              fontSize: 10,
            }}
            height={44}
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
          <Tooltip
            content={
              <CurveTooltip
                selectedTier={selectedTier}
                selectedDivisor={selectedDivisor}
              />
            }
            cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
          />
          {clampedActiveKeyIndex !== undefined ? (
            <ReferenceLine
              x={clampedActiveKeyIndex}
              stroke="rgba(96,165,250,0.35)"
              strokeDasharray="3 3"
            />
          ) : null}
          <defs>
            <linearGradient id="fullCurveBackdropFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={selectedCurveColor} stopOpacity={0.16} />
              <stop offset="100%" stopColor={selectedCurveColor} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="selectedCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={selectedCurveColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={selectedCurveColor} stopOpacity={0.06} />
            </linearGradient>
            <linearGradient id="ownerCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.08} />
            </linearGradient>
            <linearGradient id="nonOwnerCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.06} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="cumulativeBackdropUsdc"
            name="Full curve to max supply"
            stroke="none"
            fill="url(#fullCurveBackdropFill)"
            dot={false}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />

          <Area
            type="monotone"
            dataKey="ownerFilledUsdc"
            name="Owner share of area"
            stroke="none"
            fill="url(#ownerCurveFill)"
            stackId="ownershipSplit"
            connectNulls={false}
            dot={false}
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
          />

          <Area
            type="monotone"
            dataKey="nonOwnerFilledUsdc"
            name="Non-owner share of area"
            stroke="none"
            fill="url(#nonOwnerCurveFill)"
            stackId="ownershipSplit"
            connectNulls={false}
            dot={false}
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
          />

          <Area
            type="monotone"
            dataKey="cumulativeRawSpendUsdc"
            name={selectedCurveLabel}
            stroke={selectedCurveColor}
            strokeWidth={3}
            fillOpacity={0}
            dot={false}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
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
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
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
        </ComposedChart>
      </ResponsiveContainer>
      {progressiveStage >= 3 ? (
        <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400/90" />
            Owner {ownerSharePercent.toFixed(0)}%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-400/90" />
            Non-owners {(100 - ownerSharePercent).toFixed(0)}%
          </span>
        </div>
      ) : null}
      {chartIsInteractive ? (
        <p className="mt-1 text-[11px] text-zinc-600">
          Drag on the chart to adjust total supply.
        </p>
      ) : null}
    </div>
  )
}

