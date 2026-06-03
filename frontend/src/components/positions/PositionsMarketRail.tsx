import type { MarketSummary } from './types'

function formatUsdCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function sideBadgeClass(side: 'long' | 'short' | null): string {
  if (side === 'long') return 'bg-emerald-400/15 text-emerald-300'
  if (side === 'short') return 'bg-rose-400/15 text-rose-300'
  return 'bg-white/5 text-zinc-400'
}

export function PositionsMarketRail(props: {
  summaries: MarketSummary[]
  selectedMarket: string
  onSelect: (market: string) => void
}) {
  if (props.summaries.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {props.summaries.map((summary) => {
        const isSelected = summary.market === props.selectedMarket
        const position = summary.currentPosition
        const side = position?.side ?? null
        const pnl = summary.realizedPnlUsd
        return (
          <button
            key={summary.market}
            type="button"
            onClick={() => props.onSelect(summary.market)}
            className={`min-w-[150px] shrink-0 rounded-xl border p-3 text-left transition ${
              isSelected
                ? 'border-sky-400/60 bg-sky-400/10'
                : 'border-white/5 bg-white/[0.03] hover:border-sky-400/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-100">{summary.coin}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${sideBadgeClass(side)}`}
              >
                {side ?? 'flat'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Realized</span>
              <span className={pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {pnl >= 0 ? '+' : ''}
                {formatUsdCompact(pnl)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Msgs</span>
              <span className="text-zinc-300">{summary.messageCount}</span>
            </div>
            {position?.unrealizedPnlUsd != null && (
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">uPnL</span>
                <span
                  className={position.unrealizedPnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}
                >
                  {position.unrealizedPnlUsd >= 0 ? '+' : ''}
                  {formatUsdCompact(position.unrealizedPnlUsd)}
                </span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
