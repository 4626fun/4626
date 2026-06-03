import type { MarketSummary } from './types'

function formatUsdCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

/**
 * Compact "position book" for the room: every market with a live position (open) and every
 * market it has traded but is now flat (had). Clicking a pill selects that market.
 */
export function PositionsRoomBook(props: {
  summaries: MarketSummary[]
  selectedMarket: string
  onSelect: (market: string) => void
}) {
  if (props.summaries.length === 0) return null

  const open = props.summaries.filter((s) => s.currentPosition?.side != null)
  const flat = props.summaries.filter((s) => s.currentPosition?.side == null && s.tradeCount > 0)

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="label">Room positions</span>
        <span className="text-[11px] text-zinc-500">
          {open.length} open · {flat.length} traded (flat)
        </span>
      </div>

      <div className="mt-2.5 flex flex-col gap-2">
        {/* Open positions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-zinc-500">Open</span>
          {open.length === 0 ? (
            <span className="text-[11px] text-zinc-500">No live exposure.</span>
          ) : (
            open.map((s) => {
              const side = s.currentPosition?.side ?? null
              const upnl = s.currentPosition?.unrealizedPnlUsd ?? null
              const isSelected = s.market === props.selectedMarket
              return (
                <button
                  key={s.market}
                  type="button"
                  onClick={() => props.onSelect(s.market)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                    isSelected
                      ? 'border-sky-400/60 bg-sky-400/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-sky-400/40'
                  }`}
                >
                  <span className="font-semibold text-zinc-100">{s.coin}</span>
                  <span
                    className={`font-semibold uppercase ${
                      side === 'long' ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {side}
                  </span>
                  {upnl != null && (
                    <span className={upnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      {upnl >= 0 ? '+' : ''}
                      {formatUsdCompact(upnl)}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Historically traded, now flat */}
        {flat.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] uppercase tracking-wide text-zinc-500">Traded</span>
            {flat.map((s) => {
              const isSelected = s.market === props.selectedMarket
              return (
                <button
                  key={s.market}
                  type="button"
                  onClick={() => props.onSelect(s.market)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                    isSelected
                      ? 'border-sky-400/60 bg-sky-400/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-sky-400/40'
                  }`}
                >
                  <span className="font-medium text-zinc-300">{s.coin}</span>
                  <span className={s.realizedPnlUsd >= 0 ? 'text-emerald-300/80' : 'text-rose-300/80'}>
                    {s.realizedPnlUsd >= 0 ? '+' : ''}
                    {formatUsdCompact(s.realizedPnlUsd)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
