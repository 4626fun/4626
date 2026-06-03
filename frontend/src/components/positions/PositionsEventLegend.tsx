export function PositionsEventLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
        Entry/Add
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
        Reduce
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
        Close/Flip
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
        Host Message
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
        Room Message
      </span>
    </div>
  )
}
