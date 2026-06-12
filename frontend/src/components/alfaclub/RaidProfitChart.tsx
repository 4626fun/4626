import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { RaidPoint } from '@/lib/alfaclub/keyDefense'

export type RaidProfitChartProps = {
  curve: RaidPoint[]
}

function formatUsdShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

type TooltipPayloadEntry = { payload?: RaidPoint }

function RaidTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const profitable = point.profitUsdc > 0
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-white">{point.keysBought} keys bought</p>
      <p className="mt-1 text-zinc-400">
        Pot size{' '}
        <span className="font-mono text-zinc-200">{formatUsdShort(point.potSizeUsdc)}</span>
      </p>
      <p className="text-zinc-400">
        $ distributed / key{' '}
        <span className="font-mono text-zinc-200">
          {formatUsdShort(point.distributedPerKeyUsdc)}
        </span>
      </p>
      <p className="text-zinc-400">
        $ cost / key{' '}
        <span className="font-mono text-zinc-200">
          {formatUsdShort(point.marginalBuyCostPerKeyUsdc)}
        </span>
      </p>
      <p className="mt-1 text-zinc-400">
        Buyer distribution{' '}
        <span className="font-mono text-zinc-200">{formatUsdShort(point.payoutUsdc)}</span>
      </p>
      <p className="text-zinc-400">
        Round-trip fee drag{' '}
        <span className="font-mono text-zinc-200">{formatUsdShort(point.feeCostUsdc)}</span>
      </p>
      <p className={profitable ? 'text-red-400' : 'text-emerald-400'}>
        Net {profitable ? 'gain' : 'loss'}{' '}
        <span className="font-mono">{formatUsdShort(point.profitUsdc)}</span>
      </p>
    </div>
  )
}

/**
 * Net outcome vs keys bought. Above the zero line the room can be raided
 * at that buy size; below it the path is net negative.
 */
export function RaidProfitChart({ curve }: RaidProfitChartProps) {
  const data = useMemo(() => curve.map((point) => ({ ...point })), [curve])

  const [yMin, yMax] = useMemo((): [number, number] => {
    if (data.length === 0) return [0, 1]
    const values = data.map((point) => point.profitUsdc)
    const rawMin = Math.min(...values, 0)
    const rawMax = Math.max(...values, 0)
    const span = rawMax - rawMin

    // Keep visible headroom so the line never sits on chart edges.
    if (span <= 0.001) {
      const pad = Math.max(Math.abs(rawMax || rawMin) * 0.15, 1)
      return [rawMin - pad, rawMax + pad]
    }

    const pad = Math.max(span * 0.12, 1)
    return [rawMin - pad, rawMax + pad]
  }, [data])

  if (data.length === 0) return null

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="keysBought"
            type="number"
            domain={[0, 'dataMax']}
            allowDecimals={false}
            tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            label={{
              value: 'Keys bought by buyer',
              position: 'insideBottom',
              offset: -2,
              fill: 'rgba(113,113,122,0.9)',
              fontSize: 11,
            }}
            height={36}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={formatUsdShort}
            tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<RaidTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          <ReferenceLine
            y={0}
            stroke="rgba(248,113,113,0.55)"
            strokeDasharray="4 4"
            label={{
              value: 'break-even',
              position: 'insideTopRight',
              fill: 'rgba(248,113,113,0.8)',
              fontSize: 10,
            }}
          />
          <Line
            type="monotone"
            dataKey="profitUsdc"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
