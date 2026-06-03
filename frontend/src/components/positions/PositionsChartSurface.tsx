import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  type MouseEventParams,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts'

import type { ChartOverlayEvent, TimelineCandle } from './types'

function toChartTime(valueMs: number): UTCTimestamp {
  return Math.floor(valueMs / 1000) as UTCTimestamp
}

// Snap an arbitrary chart time (seconds) onto the nearest existing candle time so that
// timeScale.timeToCoordinate() resolves — it returns null for times that are not an
// exact data point on the time scale.
function snapToNearestCandleTime(targetSeconds: number, sortedTimes: UTCTimestamp[]): UTCTimestamp | null {
  if (sortedTimes.length === 0) return null
  let lo = 0
  let hi = sortedTimes.length - 1
  if (targetSeconds <= sortedTimes[0]!) return sortedTimes[0]!
  if (targetSeconds >= sortedTimes[hi]!) return sortedTimes[hi]!
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const value = sortedTimes[mid]! as number
    if (value === targetSeconds) return sortedTimes[mid]!
    if (value < targetSeconds) lo = mid + 1
    else hi = mid - 1
  }
  // lo is the first time greater than target, hi is the last time smaller.
  const lower = sortedTimes[hi]! as number
  const upper = sortedTimes[lo]! as number
  return targetSeconds - lower <= upper - targetSeconds ? sortedTimes[hi]! : sortedTimes[lo]!
}

function markerColor(event: ChartOverlayEvent): string {
  // Match the verb colours: opening/adding exposure is green, reducing/closing is red.
  if (event.action === 'entry' || event.action === 'add') return '#22c55e'
  if (event.action === 'reduce' || event.action === 'close' || event.action === 'liquidated') {
    return '#ef4444'
  }
  return '#e2e8f0'
}

// No directional arrows — clean dots only. Liquidations are flagged with the ☠️ marker text.
function markerShape(_event: ChartOverlayEvent): SeriesMarker<Time>['shape'] {
  return 'circle'
}

function markerPosition(event: ChartOverlayEvent): 'aboveBar' | 'belowBar' {
  // Keep markers off the candle bodies entirely so events read as a separate layer:
  // opens/adds sit below the low, everything else (reduce/close/flip/liquidated) above the high.
  if (event.action === 'entry' || event.action === 'add') return 'belowBar'
  return 'aboveBar'
}

const TRADE_PRIORITY: Record<string, number> = {
  liquidated: 6,
  close: 5,
  flip: 4,
  entry: 3,
  add: 2,
  reduce: 1,
  unknown: 0,
}

function pickPrimaryTrade(group: ChartOverlayEvent[]): ChartOverlayEvent {
  return [...group].sort((a, b) => {
    const ap = TRADE_PRIORITY[a.action ?? 'unknown'] ?? 0
    const bp = TRADE_PRIORITY[b.action ?? 'unknown'] ?? 0
    if (ap !== bp) return bp - ap
    return b.time - a.time
  })[0]!
}

function tradeActionVerb(event: ChartOverlayEvent): string {
  switch (event.action) {
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

function tradeExitReason(event: ChartOverlayEvent): string {
  if (event.action === 'liquidated' || (event.dir ?? '').toLowerCase().includes('liq')) {
    return 'Liquidation'
  }
  return 'Manual close'
}

function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function senderDisplayName(event: ChartOverlayEvent): string {
  return event.senderLabel || event.senderAddress || 'room user'
}

function senderInitial(event: ChartOverlayEvent): string {
  return (event.senderLabel ?? event.senderAddress ?? '?').slice(0, 1).toUpperCase()
}

type AvatarOverlay = {
  id: string
  event: ChartOverlayEvent
  group: ChartOverlayEvent[]
  count: number
  x: number
  y: number
  isHost: boolean
}

export function PositionsChartSurface(props: {
  candles: TimelineCandle[]
  events: ChartOverlayEvent[]
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
  onHoverEvent?: (id: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const markersApiRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null)
  const eventByIdRef = useRef<Map<string, ChartOverlayEvent>>(new Map())
  const onSelectEventRef = useRef(props.onSelectEvent)
  const onHoverEventRef = useRef(props.onHoverEvent)
  const recomputeOverlaysRef = useRef<() => void>(() => {})
  const eventsRef = useRef<ChartOverlayEvent[]>(props.events)
  const candleStepRef = useRef(0)
  // Sorted candle times (seconds) — used to snap arbitrary chat timestamps onto a real
  // data point, because timeScale.timeToCoordinate() returns null for off-grid times.
  const candleTimesRef = useRef<UTCTimestamp[]>([])

  const [crosshairInfo, setCrosshairInfo] = useState<{ time: number; price: number | null } | null>(null)
  const [hoveredTrade, setHoveredTrade] = useState<{ event: ChartOverlayEvent; x: number; y: number } | null>(
    null,
  )
  const [hoveredChat, setHoveredChat] = useState<{
    event: ChartOverlayEvent
    group: ChartOverlayEvent[]
    count: number
    x: number
    y: number
  } | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const [chatAvatars, setChatAvatars] = useState<AvatarOverlay[]>([])
  // Visitor-adjustable spacing between events and the candles (px offset for chat avatars,
  // and a proportional vertical price-scale margin so trade markers also clear the candles).
  const [eventSpread, setEventSpread] = useState(34)
  const eventSpreadRef = useRef(eventSpread)
  eventSpreadRef.current = eventSpread
  const hasFittedInitialRangeRef = useRef(false)

  onSelectEventRef.current = props.onSelectEvent
  onHoverEventRef.current = props.onHoverEvent
  eventsRef.current = props.events

  const candleData = useMemo(
    () =>
      props.candles.map((candle) => ({
        time: toChartTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    [props.candles],
  )

  // Median candle spacing (ms) — used to collapse events that land on the same candle.
  const candleStepMs = useMemo(() => {
    if (candleData.length < 2) return 0
    const diffs: number[] = []
    for (let i = 1; i < candleData.length; i += 1) {
      diffs.push(((candleData[i]!.time as number) - (candleData[i - 1]!.time as number)) * 1000)
    }
    diffs.sort((a, b) => a - b)
    return diffs[Math.floor(diffs.length / 2)] ?? 0
  }, [candleData])
  candleStepRef.current = candleStepMs

  const candleBucket = (timeMs: number): number =>
    candleStepMs > 0 ? Math.round(timeMs / candleStepMs) : timeMs

  // Trade markers: one clean dot per candle. Multiple trades on a candle collapse into
  // the highest-priority action with a ×N count.
  const markerData = useMemo<SeriesMarker<Time>[]>(() => {
    const buckets = new Map<number, ChartOverlayEvent[]>()
    for (const event of props.events) {
      if (event.kind !== 'trade') continue
      const key = candleBucket(event.time)
      const arr = buckets.get(key)
      if (arr) arr.push(event)
      else buckets.set(key, [event])
    }
    const markers: SeriesMarker<Time>[] = []
    for (const group of buckets.values()) {
      const primary = pickPrimaryTrade(group)
      const isSelected = group.some((event) => event.id === props.selectedEventId)
      const countSuffix = group.length > 1 ? `×${group.length}` : ''
      const text =
        primary.action === 'liquidated'
          ? `☠️${countSuffix ? ` ${countSuffix}` : ''}`
          : countSuffix
      markers.push({
        id: primary.id,
        time: toChartTime(primary.time),
        shape: markerShape(primary),
        position: markerPosition(primary),
        color: isSelected ? '#f8fafc' : markerColor(primary),
        size: isSelected ? 2 : 1,
        text,
      })
    }
    return markers.sort((a, b) => (a.time as number) - (b.time as number))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.events, candleStepMs, props.selectedEventId])

  // Candle bucket -> representative trade, so crosshair hover can resolve the key event on
  // a candle without needing a pixel-perfect hit on the marker dot.
  const tradeByBucket = useMemo(() => {
    const groups = new Map<number, ChartOverlayEvent[]>()
    for (const event of props.events) {
      if (event.kind !== 'trade') continue
      const key = candleBucket(event.time)
      const arr = groups.get(key)
      if (arr) arr.push(event)
      else groups.set(key, [event])
    }
    const map = new Map<number, ChartOverlayEvent>()
    for (const [key, group] of groups) map.set(key, pickPrimaryTrade(group))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.events, candleStepMs])
  const tradeByBucketRef = useRef(tradeByBucket)
  tradeByBucketRef.current = tradeByBucket

  // Recompute chat avatar coordinates from the chart. Called after paint (visible-range
  // change + rAF), never synchronously after setData where the time scale is not laid out.
  recomputeOverlaysRef.current = () => {
    const chart = chartRef.current
    const series = candleSeriesRef.current
    if (!chart || !series) {
      setChatAvatars([])
      return
    }
    const timeScale = chart.timeScale()
    const step = candleStepRef.current
    const bucketOf = (timeMs: number) => (step > 0 ? Math.round(timeMs / step) : timeMs)
    const buckets = new Map<string, ChartOverlayEvent[]>()
    for (const event of eventsRef.current) {
      if ((event.kind !== 'chat' && event.kind !== 'host-chat') || event.price == null) continue
      const key = `${event.kind === 'host-chat' ? 'h' : 'r'}:${bucketOf(event.time)}`
      const arr = buckets.get(key)
      if (arr) arr.push(event)
      else buckets.set(key, [event])
    }
    const candleTimes = candleTimesRef.current
    const next: AvatarOverlay[] = []
    for (const group of buckets.values()) {
      group.sort((a, b) => a.time - b.time)
      const primary = group[group.length - 1]!
      const snapped = snapToNearestCandleTime(toChartTime(primary.time), candleTimes)
      if (snapped == null) continue
      const x = timeScale.timeToCoordinate(snapped)
      const baseY = series.priceToCoordinate(primary.price as number)
      if (x == null || baseY == null) continue
      const isHost = primary.kind === 'host-chat'
      next.push({
        id: `chat-${primary.id}`,
        event: primary,
        group,
        count: group.length,
        x,
        y: isHost ? baseY - eventSpreadRef.current : baseY + eventSpreadRef.current,
        isHost,
      })
    }
    setChatAvatars(next)
  }

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#a1a1aa',
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.12)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.12)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(96,165,250,0.5)' },
        horzLine: { color: 'rgba(96,165,250,0.5)' },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    })
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
      priceLineColor: '#60a5fa',
      lastValueVisible: true,
    })
    const markersApi = createSeriesMarkers(candleSeries, [], { zOrder: 'top' })

    const handleClick = (param: { hoveredObjectId?: unknown }) => {
      const objectId = param.hoveredObjectId
      if (!objectId || typeof objectId !== 'string') return
      const event = eventByIdRef.current.get(objectId)
      if (event) onSelectEventRef.current(event.id)
    }

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const point = param.point
      if (!point || param.time == null) {
        setCrosshairInfo(null)
        setHoveredTrade(null)
        onHoverEventRef.current?.(null)
        return
      }
      const hoveredTimeSeconds = typeof param.time === 'number' ? param.time : null
      const hoveredTimeMs = hoveredTimeSeconds != null ? hoveredTimeSeconds * 1000 : null

      // Price under the cursor (candle close).
      const mainData = param.seriesData.get(candleSeries)
      let price: number | null = null
      if (mainData && typeof mainData === 'object' && 'close' in mainData) {
        const candidate = Number(mainData.close)
        if (Number.isFinite(candidate)) price = candidate
      }

      // Resolve the key trade on this candle by bucket (reliable), preferring an exact
      // marker hit when one is reported.
      const markerId =
        typeof param.hoveredObjectId === 'string' ? (param.hoveredObjectId as string) : null
      const markerEvent = markerId ? eventByIdRef.current.get(markerId) ?? null : null
      const step = candleStepRef.current
      const bucketTrade =
        hoveredTimeMs != null
          ? tradeByBucketRef.current.get(step > 0 ? Math.round(hoveredTimeMs / step) : hoveredTimeMs) ??
            null
          : null
      const resolvedTrade = (markerEvent?.kind === 'trade' ? markerEvent : null) ?? bucketTrade

      setCrosshairInfo(hoveredTimeMs != null ? { time: hoveredTimeMs, price } : null)
      setHoveredTrade(resolvedTrade ? { event: resolvedTrade, x: point.x, y: point.y } : null)
      onHoverEventRef.current?.(resolvedTrade?.id ?? null)
    }

    const handleVisibleRangeChange = () => {
      recomputeOverlaysRef.current()
    }

    chart.subscribeClick(handleClick as never)
    chart.subscribeCrosshairMove(handleCrosshairMove)
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange)
    setChartReady(true)
    chartRef.current = chart
    candleSeriesRef.current = candleSeries as ISeriesApi<'Candlestick'>
    markersApiRef.current = markersApi
    return () => {
      chart.unsubscribeClick(handleClick as never)
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange)
      chart.remove()
      setChartReady(false)
      chartRef.current = null
      candleSeriesRef.current = null
      markersApiRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!candleSeriesRef.current || !markersApiRef.current) return
    candleSeriesRef.current.setData(candleData)
    markersApiRef.current.setMarkers(markerData)
    candleTimesRef.current = candleData.map((candle) => candle.time)
    eventByIdRef.current = new Map(props.events.map((event) => [event.id, event]))
    // Reposition overlays after the chart paints — coordinate APIs are not valid
    // synchronously right after setData.
    const raf = requestAnimationFrame(() => recomputeOverlaysRef.current())
    return () => cancelAnimationFrame(raf)
  }, [candleData, markerData, props.events, chartReady])

  useEffect(() => {
    if (!chartRef.current || candleData.length <= 2) return
    if (hasFittedInitialRangeRef.current) return
    chartRef.current.timeScale().fitContent()
    hasFittedInitialRangeRef.current = true
  }, [candleData])

  // Apply the visitor-chosen spacing: scale the candle cluster's vertical margins so
  // above/below markers clear the candles, then reposition the chat avatars.
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    const margin = Math.min(0.34, Math.max(0.08, 0.08 + eventSpread / 220))
    series.priceScale().applyOptions({ scaleMargins: { top: margin, bottom: margin } })
    const raf = requestAnimationFrame(() => recomputeOverlaysRef.current())
    return () => cancelAnimationFrame(raf)
  }, [eventSpread, chartReady])

  useEffect(() => {
    if (!props.selectedEventId) return
    const selected = eventByIdRef.current.get(props.selectedEventId)
    if (!selected) return
    const time = toChartTime(selected.time)
    chartRef.current?.timeScale().setVisibleRange({
      from: (time - 8 * 60 * 60) as UTCTimestamp,
      to: (time + 8 * 60 * 60) as UTCTimestamp,
    })
  }, [props.selectedEventId])

  return (
    <div className="relative h-[82vh] min-h-[600px] w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Visitor control: spacing between events and candles */}
      <div className="pointer-events-auto absolute right-14 top-3 z-30 flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950/80 px-2.5 py-1.5 text-[11px] text-zinc-300 backdrop-blur-sm">
        <span className="text-zinc-500">Event spacing</span>
        <input
          type="range"
          min={8}
          max={80}
          step={2}
          value={eventSpread}
          onChange={(e) => setEventSpread(Number(e.target.value))}
          className="h-1 w-24 cursor-pointer accent-sky-400"
          aria-label="Adjust spacing between events and candles"
        />
      </div>

      {/* Chat avatars (collapsed per candle) */}
      {chatAvatars.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-[2px] transition hover:scale-110 ${
            avatar.event.id === props.selectedEventId
              ? 'bg-zinc-100'
              : avatar.isHost
                ? 'bg-sky-400/80'
                : 'bg-violet-400/70'
          }`}
          style={{ left: `${avatar.x}px`, top: `${avatar.y}px` }}
          onMouseEnter={() => {
            setHoveredTrade(null)
            setHoveredChat({
              event: avatar.event,
              group: avatar.group,
              count: avatar.count,
              x: avatar.x,
              y: avatar.y,
            })
            onHoverEventRef.current?.(avatar.event.id)
          }}
          onMouseLeave={() => {
            setHoveredChat(null)
            onHoverEventRef.current?.(null)
          }}
          onClick={() => onSelectEventRef.current(avatar.event.id)}
          aria-label={`Message from ${senderDisplayName(avatar.event)}`}
        >
          <span className="relative block h-6 w-6 overflow-hidden rounded-full bg-zinc-800">
            <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-200">
              {senderInitial(avatar.event)}
            </span>
            {avatar.event.senderAvatarUrl && (
              <img
                src={avatar.event.senderAvatarUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
          </span>
          {avatar.count > 1 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-950 px-1 text-[9px] font-semibold text-zinc-100 ring-1 ring-white/20">
              +{avatar.count - 1}
            </span>
          )}
        </button>
      ))}

      {/* Chat hover card: message + price / position / P&L at that moment */}
      {hoveredChat && (
        <div
          className="pointer-events-none absolute z-30 w-[320px] max-w-[78vw] rounded-2xl border border-white/20 bg-zinc-950/96 p-3 shadow-2xl backdrop-blur-sm"
          style={{
            left: `${Math.min(
              Math.max(hoveredChat.x + 18, 12),
              (containerRef.current?.clientWidth ?? 9999) - 340,
            )}px`,
            top: `${Math.min(
              Math.max(hoveredChat.y - 176, 12),
              (containerRef.current?.clientHeight ?? 9999) - 220,
            )}px`,
          }}
        >
          {hoveredChat.count <= 1 ? (
            <>
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                  <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-zinc-200">
                    {senderInitial(hoveredChat.event)}
                  </span>
                  {hoveredChat.event.senderAvatarUrl && (
                    <img
                      src={hoveredChat.event.senderAvatarUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-100">
                    {senderDisplayName(hoveredChat.event)}
                    {hoveredChat.event.kind === 'host-chat' && (
                      <span className="ml-1 rounded bg-sky-400/15 px-1 text-[9px] font-semibold uppercase text-sky-300">
                        host
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-500">
                    {new Date(hoveredChat.event.time).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
              {hoveredChat.event.text && (
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-100">
                  {hoveredChat.event.text}
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[11px]">
                <div className="text-zinc-500">Price</div>
                <div className="text-right text-zinc-100">
                  {hoveredChat.event.price != null ? `$${hoveredChat.event.price.toFixed(4)}` : 'n/a'}
                </div>
                <div className="text-zinc-500">Position</div>
                <div className="text-right text-zinc-100">
                  {hoveredChat.event.contextAtTime?.side
                    ? `${hoveredChat.event.contextAtTime.side.toUpperCase()} ${hoveredChat.event.contextAtTime.size.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
                    : 'Flat'}
                </div>
                <div className="text-zinc-500">P/L now</div>
                <div className="text-right">
                  {hoveredChat.event.contextAtTime?.unrealizedPnl != null ? (
                    <span
                      className={
                        hoveredChat.event.contextAtTime.unrealizedPnl >= 0
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }
                    >
                      {hoveredChat.event.contextAtTime.unrealizedPnl >= 0 ? '+' : ''}
                      {formatUsd(hoveredChat.event.contextAtTime.unrealizedPnl)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-100">
                  {hoveredChat.count} messages this candle
                </span>
                <span className="text-zinc-500">
                  {new Date(hoveredChat.event.time).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {hoveredChat.event.price != null ? ` · $${hoveredChat.event.price.toFixed(4)}` : ''}
                </span>
              </div>
              <div className="space-y-1.5">
                {hoveredChat.group.slice(-5).map((message) => (
                  <div
                    key={message.id}
                    className="flex gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2"
                  >
                    <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                      <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-200">
                        {senderInitial(message)}
                      </span>
                      {message.senderAvatarUrl && (
                        <img
                          src={message.senderAvatarUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[11px] font-medium text-zinc-100">
                          {senderDisplayName(message)}
                        </span>
                        {message.kind === 'host-chat' && (
                          <span className="rounded bg-sky-400/15 px-1 text-[8px] font-semibold uppercase text-sky-300">
                            host
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[10px] text-zinc-500">
                          {new Date(message.time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {message.text && (
                        <div className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[12px] leading-snug text-zinc-200">
                          {message.text}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hoveredChat.count > 5 && (
                <div className="mt-2 border-t border-white/10 pt-1 text-[10px] text-zinc-500">
                  +{hoveredChat.count - 5} more — open from the timeline list to read all
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Trade hover card (key events) near the cursor */}
      {hoveredTrade && !hoveredChat && (
        <div
          className="pointer-events-none absolute z-20 w-[230px] rounded-xl border border-white/15 bg-zinc-950/95 p-3 text-[11px] shadow-2xl backdrop-blur-sm"
          style={{
            left: `${Math.min(
              Math.max(hoveredTrade.x + 16, 12),
              (containerRef.current?.clientWidth ?? 9999) - 246,
            )}px`,
            top: `${Math.min(
              Math.max(hoveredTrade.y - 70, 12),
              (containerRef.current?.clientHeight ?? 9999) - 170,
            )}px`,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: markerColor(hoveredTrade.event) }}
            />
            <span className={`font-semibold ${actionTextClass(hoveredTrade.event.action)}`}>
              {tradeActionVerb(hoveredTrade.event)}
            </span>
            {hoveredTrade.event.side && (
              <span className="text-[10px] font-medium uppercase text-zinc-400">
                {hoveredTrade.event.side}
              </span>
            )}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-zinc-500">Time</div>
            <div className="text-right text-zinc-300">
              {new Date(hoveredTrade.event.time).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="text-zinc-500">Price</div>
            <div className="text-right text-zinc-100">
              {hoveredTrade.event.price != null ? `$${hoveredTrade.event.price.toFixed(4)}` : 'n/a'}
            </div>
            {hoveredTrade.event.size != null && (
              <>
                <div className="text-zinc-500">Size</div>
                <div className="text-right text-zinc-100">
                  {formatSize(hoveredTrade.event.size)}
                  {coinFromMarket(hoveredTrade.event.market)
                    ? ` ${coinFromMarket(hoveredTrade.event.market)}`
                    : ''}
                </div>
              </>
            )}
            {hoveredTrade.event.market && (
              <>
                <div className="text-zinc-500">Market</div>
                <div className="text-right text-zinc-300">{hoveredTrade.event.market}</div>
              </>
            )}
            {(hoveredTrade.event.action === 'close' || hoveredTrade.event.action === 'liquidated') &&
              typeof hoveredTrade.event.closedPnl === 'number' && (
                <>
                  <div className="text-zinc-500">{tradeExitReason(hoveredTrade.event)}</div>
                  <div
                    className={`text-right ${
                      hoveredTrade.event.closedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {hoveredTrade.event.closedPnl >= 0 ? '+' : ''}
                    {formatUsd(hoveredTrade.event.closedPnl)}
                  </div>
                </>
              )}
          </div>
        </div>
      )}

      {/* Always-on crosshair readout (top-left) */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-zinc-950/80 px-2.5 py-1.5 text-[11px] text-zinc-200 backdrop-blur-sm">
        {crosshairInfo ? (
          <div className="space-y-0.5">
            <div>{new Date(crosshairInfo.time).toLocaleString()}</div>
            {crosshairInfo.price != null && <div>${crosshairInfo.price.toFixed(4)}</div>}
          </div>
        ) : (
          <div className="text-zinc-500">Move cursor to inspect</div>
        )}
      </div>
    </div>
  )
}
