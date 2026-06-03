export function PositionsEventLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        Open / Add
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        Close / Reduce
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>☠️</span>
        Liquidated
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>💬</span>
        Host msg
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>💬</span>
        Room msg
      </span>
      <span className="text-zinc-500">·</span>
      <span className="text-zinc-500">×N = collapsed on one candle</span>
    </div>
  )
}
