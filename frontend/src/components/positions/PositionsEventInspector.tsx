import type { ChartOverlayEvent } from './types'

function formatTime(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PositionsEventInspector(props: {
  event: ChartOverlayEvent | null
  index: number
  total: number
  onPrevious: () => void
  onNext: () => void
  onClear: () => void
}) {
  const { event } = props
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="label">Event inspector</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
            onClick={props.onPrevious}
            disabled={!event || props.total < 2}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
            onClick={props.onNext}
            disabled={!event || props.total < 2}
          >
            Next
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
            onClick={props.onClear}
            disabled={!event}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-zinc-500">Tip: use ← / → keys to navigate events quickly.</div>
      {!event ? (
        <div className="mt-3 text-xs text-zinc-400">Select an event row to inspect details.</div>
      ) : (
        <div className="mt-3 space-y-1.5 text-xs">
          <div className="text-zinc-100">
            {event.kind === 'trade'
              ? `${event.action ?? 'unknown'} ${event.market ?? ''}`.trim()
              : event.kind === 'host-chat'
                ? 'Host message'
                : 'Room message'}
          </div>
          <div className="text-zinc-300">{formatTime(event.time)}</div>
          {event.price != null && (
            <div className="text-zinc-300">
              Price: <span className="text-zinc-100">${event.price.toFixed(4)}</span>
            </div>
          )}
          {event.senderLabel && (
            <div className="text-zinc-300">
              Sender: <span className="text-zinc-100">{event.senderLabel}</span>
            </div>
          )}
          {event.text && <div className="whitespace-pre-wrap text-zinc-200">{event.text}</div>}
          <div className="text-zinc-500">
            {props.index + 1} / {props.total}
          </div>
        </div>
      )}
    </div>
  )
}
