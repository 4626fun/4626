import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  type MouseEventParams,
  type IChartApi,
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

function timeToMs(value: Time | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000
  return null
}

function markerColor(event: ChartOverlayEvent): string {
  if (event.kind === 'trade') {
    if (event.action === 'entry' || event.action === 'add') return '#22d3ee'
    if (event.action === 'reduce') return '#c084fc'
    if (event.action === 'close' || event.action === 'flip') return '#f59e0b'
    return '#e2e8f0'
  }
  return event.kind === 'host-chat' ? '#38bdf8' : '#a78bfa'
}

function markerShape(event: ChartOverlayEvent): SeriesMarker<Time>['shape'] {
  if (event.kind !== 'trade') return 'circle'
  if (event.action === 'entry' || event.action === 'add') return 'arrowUp'
  if (event.action === 'close' || event.action === 'flip') return 'arrowDown'
  return 'square'
}

function markerPosition(event: ChartOverlayEvent): 'aboveBar' | 'belowBar' | 'inBar' {
  if (event.kind !== 'trade') return 'inBar'
  if (event.action === 'entry' || event.action === 'add') return 'belowBar'
  if (event.action === 'close' || event.action === 'flip') return 'aboveBar'
  return 'inBar'
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
  const candleSeriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null)
  const markersApiRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null)
  const eventByIdRef = useRef<Map<string, ChartOverlayEvent>>(new Map())
  const onSelectEventRef = useRef(props.onSelectEvent)
  const onHoverEventRef = useRef(props.onHoverEvent)
  const [crosshairInfo, setCrosshairInfo] = useState<{ time: number; price: number | null } | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<ChartOverlayEvent | null>(null)
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number } | null>(null)
  const [visibleRangeMs, setVisibleRangeMs] = useState<{ from: number; to: number } | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const hasFittedInitialRangeRef = useRef(false)
  onSelectEventRef.current = props.onSelectEvent
  onHoverEventRef.current = props.onHoverEvent

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

  const visibleEvents = useMemo(() => {
    if (!visibleRangeMs) return props.events
    const paddingMs = 2 * 60 * 60 * 1000
    const from = visibleRangeMs.from - paddingMs
    const to = visibleRangeMs.to + paddingMs
    return props.events.filter((event) => event.time >= from && event.time <= to)
  }, [props.events, visibleRangeMs])

  const markerData = useMemo<SeriesMarker<Time>[]>(
    () =>
      visibleEvents.map((event) => ({
        id: event.id,
        time: toChartTime(event.time),
        shape: markerShape(event),
        position: markerPosition(event),
        color: event.id === props.selectedEventId ? '#f8fafc' : markerColor(event),
        size: event.id === props.selectedEventId ? 2 : 1,
        text:
          event.id === props.selectedEventId
            ? 'SELECTED'
            : event.kind === 'trade'
              ? (event.action ?? 'trade').toUpperCase()
              : event.kind === 'host-chat'
                ? 'HOST'
                : 'CHAT',
      })),
    [props.selectedEventId, visibleEvents],
  )

  const chartCallouts = useMemo(() => {
    if (!chartReady || !chartRef.current || !candleSeriesRef.current) return []
    const timeScale = chartRef.current.timeScale()
    const candleSeries = candleSeriesRef.current

    const hostMessages = visibleEvents
      .filter((event) => event.kind === 'host-chat' && event.text && event.price != null)
      .slice(-6)
      .map((event) => ({
        id: `host-${event.id}`,
        eventId: event.id,
        text: event.text!.slice(0, 84),
        tone: 'host' as const,
        time: event.time,
        price: event.price as number,
      }))

    const keyTrades = visibleEvents
      .filter(
        (event) =>
          event.kind === 'trade' &&
          event.price != null &&
          (event.action === 'entry' || event.action === 'close' || event.action === 'flip'),
      )
      .slice(-6)
      .map((event) => ({
        id: `trade-${event.id}`,
        eventId: event.id,
        text: `KEY EVENT: ${(event.action ?? 'trade').toUpperCase()}`,
        tone: 'trade' as const,
        time: event.time,
        price: event.price as number,
      }))

    const merged = [...keyTrades, ...hostMessages]
    return merged
      .map((entry, index) => {
        const x = timeScale.timeToCoordinate(toChartTime(entry.time))
        const y = candleSeries.priceToCoordinate(entry.price)
        if (x == null || y == null) return null
        return {
          ...entry,
          x,
          y: Math.max(22, y - (index % 3) * 22),
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  }, [chartReady, visibleEvents])

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
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.12)',
      },
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

    const handleClick = (param: { hoveredObjectId?: unknown; object?: { objectKind?: string } }) => {
      const objectId = param.hoveredObjectId
      if (!objectId || typeof objectId !== 'string') return
      const event = eventByIdRef.current.get(objectId)
      if (!event) return
      onSelectEventRef.current(event.id)
    }

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const point = param.point
      if (!point) {
        setCrosshairInfo(null)
        setHoveredEvent(null)
        setHoveredCoords(null)
        onHoverEventRef.current?.(null)
        return
      }
      const hoveredMarkerId =
        typeof param.hoveredObjectId === 'string' ? (param.hoveredObjectId as string) : null
      let resolvedEvent = hoveredMarkerId ? eventByIdRef.current.get(hoveredMarkerId) ?? null : null

      const hoveredTimeSeconds = typeof param.time === 'number' ? param.time : null
      if (!resolvedEvent && hoveredTimeSeconds != null) {
        const hoveredTimeMs = hoveredTimeSeconds * 1000
        let best: ChartOverlayEvent | null = null
        let bestDelta = Number.POSITIVE_INFINITY
        for (const event of eventByIdRef.current.values()) {
          const delta = Math.abs(event.time - hoveredTimeMs)
          if (delta < bestDelta) {
            best = event
            bestDelta = delta
          }
        }
        resolvedEvent = bestDelta <= 60 * 60 * 1000 ? best : null
      }

      const mainData = param.seriesData.get(candleSeries)
      let price: number | null = null
      if (mainData && typeof mainData === 'object' && 'close' in mainData) {
        const candidate = Number(mainData.close)
        if (Number.isFinite(candidate)) price = candidate
      }
      if (price == null && resolvedEvent?.price != null) {
        price = resolvedEvent.price
      }

      const resolvedTime = resolvedEvent?.time ?? (hoveredTimeSeconds != null ? hoveredTimeSeconds * 1000 : 0)
      if (resolvedTime > 0) {
        setCrosshairInfo({ time: resolvedTime, price })
      } else {
        setCrosshairInfo(null)
      }
      setHoveredCoords({ x: point.x, y: point.y })
      setHoveredEvent(resolvedEvent)
      onHoverEventRef.current?.(resolvedEvent?.id ?? null)
    }

    const handleVisibleRangeChange = (range: { from: Time; to: Time } | null) => {
      if (!range) {
        setVisibleRangeMs(null)
        return
      }
      const from = timeToMs(range.from)
      const to = timeToMs(range.to)
      if (from == null || to == null) {
        setVisibleRangeMs(null)
        return
      }
      setVisibleRangeMs({ from: Math.min(from, to), to: Math.max(from, to) })
    }

    chart.subscribeClick(handleClick as never)
    chart.subscribeCrosshairMove(handleCrosshairMove)
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange)
    setChartReady(true)
    chartRef.current = chart
    candleSeriesRef.current = candleSeries
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
    eventByIdRef.current = new Map(props.events.map((event) => [event.id, event]))
  }, [candleData, markerData, props.events])

  useEffect(() => {
    if (!chartRef.current || candleData.length <= 2) return
    if (hasFittedInitialRangeRef.current) return
    chartRef.current.timeScale().fitContent()
    hasFittedInitialRangeRef.current = true
  }, [candleData])

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
    <div className="relative h-[620px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {chartCallouts.map((callout) => (
        <div
          key={callout.id}
          className="pointer-events-none absolute max-w-[220px] -translate-x-1/2 -translate-y-[120%] rounded-md border border-white/10 bg-zinc-950/90 px-2 py-1 text-left text-[10px] text-zinc-100 shadow-lg backdrop-blur-sm"
          style={{
            left: `${callout.x}px`,
            top: `${callout.y}px`,
            boxShadow:
              callout.tone === 'host'
                ? '0 0 0 1px rgba(56,189,248,0.35), 0 8px 22px rgba(56,189,248,0.18)'
                : '0 0 0 1px rgba(244,244,245,0.25), 0 8px 22px rgba(15,23,42,0.28)',
          }}
          title="Real room timeline event"
        >
          <div className="line-clamp-3 whitespace-pre-wrap">{callout.text}</div>
        </div>
      ))}
      {hoveredEvent &&
        hoveredCoords &&
        hoveredEvent.kind === 'host-chat' &&
        hoveredEvent.text && (
          <div
            className="pointer-events-none absolute z-20 w-[320px] max-w-[78vw] rounded-2xl border border-white/20 bg-zinc-950/96 p-3 shadow-2xl backdrop-blur-sm"
            style={{
              left: `${Math.min(Math.max(hoveredCoords.x + 16, 12), 560)}px`,
              top: `${Math.max(hoveredCoords.y - 176, 12)}px`,
            }}
          >
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15 text-[10px] font-semibold text-sky-200">
                {(hoveredEvent.senderLabel ?? hoveredEvent.senderAddress ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-zinc-100 font-medium">
                  {hoveredEvent.senderLabel || hoveredEvent.senderAddress || 'room user'}
                </div>
                <div className="text-zinc-500">
                  @{(hoveredEvent.senderLabel || hoveredEvent.senderAddress || 'room_user').replace(/\s+/g, '').toLowerCase()} ·{' '}
                  {new Date(hoveredEvent.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-100">
              {hoveredEvent.text}
            </div>
            <div className="mt-2 border-t border-white/10 pt-1 text-[10px] text-zinc-500">
              room 1659 · real host message
            </div>
          </div>
        )}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-zinc-950/80 px-2.5 py-1.5 text-[11px] text-zinc-200 backdrop-blur-sm">
        {crosshairInfo ? (
          <div className="space-y-0.5">
            <div>{new Date(crosshairInfo.time).toLocaleString()}</div>
            {crosshairInfo.price != null && <div>${crosshairInfo.price.toFixed(4)}</div>}
            {hoveredEvent && (
              <div className="text-zinc-400">
                {hoveredEvent.kind === 'trade'
                  ? `${hoveredEvent.action ?? 'trade'} ${hoveredEvent.market ?? ''}`.trim()
                  : hoveredEvent.kind === 'host-chat'
                    ? 'host message'
                    : 'room message'}
              </div>
            )}
          </div>
        ) : (
          <div className="text-zinc-500">Move cursor to inspect</div>
        )}
      </div>
    </div>
  )
}
