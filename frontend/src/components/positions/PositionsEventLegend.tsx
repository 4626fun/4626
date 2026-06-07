export function PositionsEventLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        Open / Add
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        Close / Reduce
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden>☠️</span>
        Liquidated
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden>💬</span>
        Messages
      </span>
      <span className="text-zinc-600">·</span>
      <span className="text-zinc-500">×N = collapsed on one candle</span>
      <span className="text-zinc-600">·</span>
      <span className="text-zinc-500">Blue dashed = entry line (per pos lifetime) · Red dashed = liq</span>
    </div>
  )
}
