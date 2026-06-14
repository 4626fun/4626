import type { ChartOverlayEvent } from './types'

const ALFACLUB_ROOM_URL = 'https://alfaclub.app/rooms/1659/'
const VIRTUALS_AGENT_URL = 'https://degen.virtuals.io/agents/1213'

function formatTime(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function inferExitReason(event: Pick<ChartOverlayEvent, 'action' | 'dir'>): string | null {
  if (event.action === 'liquidated') return 'Liquidation'
  if (event.action !== 'close') return null
  const dir = (event.dir ?? '').toLowerCase()
  if (dir.includes('liquidat') || dir.includes('liq')) return 'Liquidation'
  return 'Manual Close'
}

function tradeActionVerb(action: ChartOverlayEvent['action']): string {
  switch (action) {
    case 'entry':
      return 'Open'
    case 'add':
      return 'Add'
    case 'reduce':
      return 'Reduce'
    case 'close':
      return 'Close'
    case 'liquidated':
      return 'Liquidated'
    case 'flip':
      return 'Flip'
    default:
      return 'Trade'
  }
}

// Action colour: opening/adding exposure is green, reducing/closing is red.
function actionTextClass(action: ChartOverlayEvent['action']): string {
  if (action === 'entry' || action === 'add') return 'text-emerald-300'
  if (action === 'reduce' || action === 'close' || action === 'liquidated') return 'text-rose-300'
  return 'text-zinc-100'
}

function coinFromMarket(market: string | null | undefined): string {
  if (!market) return ''
  return market.split('/')[0] ?? ''
}

function formatSize(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/** Notional (USD) exposure of a fill = |price × size|. */
function notionalUsd(
  price: number | null | undefined,
  size: number | null | undefined,
): number | null {
  if (price == null || size == null || !Number.isFinite(price) || !Number.isFinite(size)) {
    return null
  }
  return Math.abs(price * size)
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })
}

function tradeSourceMeta(source: 'host' | 'counter') {
  if (source === 'counter') {
    return {
      label: 'Inverse trade',
      href: VIRTUALS_AGENT_URL,
      logo: '/protocols/virtuals.svg',
      logoAlt: 'Virtuals',
      chipClass: 'bg-emerald-400/10 text-emerald-200',
      ringClass: 'bg-emerald-900/30 ring-emerald-300/25',
    }
  }
  return {
    label: 'Room trade',
    href: ALFACLUB_ROOM_URL,
    logo: '/protocols/alfaclub.svg',
    logoAlt: 'AlfaClub',
    chipClass: 'bg-sky-400/10 text-sky-200',
    ringClass: 'bg-sky-900/30 ring-sky-300/25',
  }
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
    <div className="rounded-2xl bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="label">Event inspector</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
            onClick={props.onPrevious}
            disabled={!event || props.total < 2}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
            onClick={props.onNext}
            disabled={!event || props.total < 2}
          >
            Next
          </button>
          <button
            type="button"
            className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
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
          {event.kind === 'trade' ? (
            <div className="flex items-center gap-2 text-zinc-100">
              <span className={`font-semibold ${actionTextClass(event.action)}`}>
                {tradeActionVerb(event.action)}
              </span>
              {event.side && (
                <span className="text-[10px] font-medium uppercase text-zinc-400">{event.side}</span>
              )}
              {event.market && <span className="text-zinc-400">{event.market}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-zinc-100">
              {event.senderAvatarUrl ? (
                <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                  <span className="absolute inset-0 bg-zinc-800" />
                  <img
                    src={event.senderAvatarUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </span>
              ) : null}
              <span>
                {event.kind === 'host-chat' ? 'Host message' : 'Room message'}
                {event.senderLabel ? <span className="ml-1.5 text-xs text-zinc-400">· {event.senderLabel}</span> : null}
              </span>
            </div>
          )}
          <div className="text-zinc-300">{formatTime(event.time)}</div>
          {event.price != null && (
            <div className="text-zinc-300">
              Price: <span className="text-zinc-100">${event.price.toFixed(4)}</span>
            </div>
          )}
          {event.kind === 'trade' && event.size != null && (
            <div className="text-zinc-300">
              Size:{' '}
              <span className="text-zinc-100">
                {formatSize(event.size)}
                {coinFromMarket(event.market) ? ` ${coinFromMarket(event.market)}` : ''}
              </span>
            </div>
          )}
          {event.kind === 'trade' && notionalUsd(event.price, event.size) != null && (
            <div className="text-zinc-300">
              Notional:{' '}
              <span className="text-zinc-100">{formatUsd(notionalUsd(event.price, event.size)!)}</span>
            </div>
          )}
          {event.kind === 'trade' && (
            <div className="text-zinc-300">
              Lane:{' '}
              {(() => {
                const source = tradeSourceMeta(event.source)
                return (
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition hover:opacity-90 ${source.chipClass}`}
                  >
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full ring-1 ${source.ringClass}`}
                    >
                      <img src={source.logo} alt={source.logoAlt} className="h-3 w-3 object-contain" loading="lazy" />
                    </span>
                    {source.label}
                    <span aria-hidden>↗</span>
                  </a>
                )
              })()}
            </div>
          )}
          {event.kind === 'trade' &&
            (event.action === 'close' || event.action === 'liquidated') &&
            typeof event.closedPnl === 'number' && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-300">
                  {inferExitReason(event)}
                </span>
                <span className={event.closedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  Realized P/L {event.closedPnl >= 0 ? '+' : ''}${event.closedPnl.toFixed(2)}
                </span>
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
