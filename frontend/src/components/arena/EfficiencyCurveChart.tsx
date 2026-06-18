import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { EfficiencyPoint } from '@/lib/alfaclub/dynamicBuffer'

type EfficiencyCurveChartProps = {
  data: EfficiencyPoint[]
  leverage: number
}

function tooltipFormatter(value: unknown, name: unknown): [string, string] {
  const key = String(name ?? '')
  const numeric = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
  if (key === 'marginalEfficiency') return [`${numeric.toFixed(3)}%`, 'Efficiency']
  if (key === 'health') return [numeric.toFixed(3), 'Health']
  if (key === 'recommendedAdd') return [`$${Math.floor(numeric)}`, 'Suggested add']
  return [numeric.toFixed(2), key]
}

export function EfficiencyCurveChart({ data, leverage }: EfficiencyCurveChartProps) {
  return (
    <div className="w-full h-[420px] rounded-2xl border border-zinc-900/70 bg-zinc-950/50 p-4">
      <h3 className="mb-4 text-center text-lg font-semibold text-zinc-100">
        Marginal efficiency of buffer additions ({leverage}x leverage)
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="drawdownPct"
            type="number"
            domain={[0, 5]}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#3f3f46' }}
            label={{ value: '% Drawdown', position: 'bottom', offset: 4, fill: '#a1a1aa' }}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#3f3f46' }}
            label={{
              value: 'Extra % to liquidation per $100 added',
              angle: -90,
              position: 'insideLeft',
              fill: '#a1a1aa',
            }}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(9,9,11,0.95)',
              border: '1px solid #27272a',
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={tooltipFormatter}
          />

          <Line
            type="natural"
            dataKey="marginalEfficiency"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#1d4ed8', r: 4 }}
            isAnimationActive={false}
          />

          <ReferenceArea
            x1={2.0}
            x2={2.8}
            fill="#eab308"
            fillOpacity={0.12}
            label={{ value: 'Optimal zone', position: 'insideTop', fill: '#fef08a', fontSize: 11 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
