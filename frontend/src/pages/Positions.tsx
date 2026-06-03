import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

import { PositionsChartSurface } from '@/components/positions/PositionsChartSurface'
import { PositionsEventInspector } from '@/components/positions/PositionsEventInspector'
import { PositionsEventLegend } from '@/components/positions/PositionsEventLegend'
import type { ChartOverlayEvent, TimelineResponse } from '@/components/positions/types'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/apiBase'

function formatTime(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function nearestCandleClose(ts: number, candles: TimelineResponse['candles']): number | null {
  if (candles.length === 0) return null
  let best = candles[0]!
  let bestDelta = Math.abs(best.time - ts)
  for (let i = 1; i < candles.length; i += 1) {
    const candle = candles[i]!
    const delta = Math.abs(candle.time - ts)
    if (delta < bestDelta) {
      best = candle
      bestDelta = delta
    }
  }
  return best.close
}

async function fetchRoomTimelineBySymbol(
  windowHours: number,
  symbol: string | null,
): Promise<TimelineResponse> {
  const params = new URLSearchParams({
    roomId: '1659',
    windowHours: String(windowHours),
  })
  if (symbol && symbol.trim().length > 0) {
    params.set('symbol', symbol.trim().toUpperCase())
  }
  const res = await apiFetch(`/api/v1/alfaclub/room-timeline?${params.toString()}`, {})
  const json = (await res.json()) as { success?: boolean; data?: TimelineResponse; error?: string }
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }
  return json.data
}

export function Positions() {
  const [chatScope, setChatScope] = useState<'host' | 'all' | 'sender'>('all')
  const [selectedSender, setSelectedSender] = useState<string | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<string>('all')
  const [windowHours, setWindowHours] = useState<24 | 72 | 168>(168)
  const [densityMode, setDensityMode] = useState<'all' | 'major'>('all')
  const [showTrades, setShowTrades] = useState(true)
  const [showHostMessages, setShowHostMessages] = useState(true)
  const [showRoomMessages, setShowRoomMessages] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)

  const selectedSymbolForQuery = useMemo(() => {
    if (selectedMarket === 'all') return null
    const [symbol] = selectedMarket.split('/')
    const normalized = (symbol ?? '').trim().toUpperCase()
    return normalized || null
  }, [selectedMarket])

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['alfaclub-room-timeline', '1659', windowHours, selectedSymbolForQuery],
    queryFn: () => fetchRoomTimelineBySymbol(windowHours, selectedSymbolForQuery),
    staleTime: 30_000,
  })

  useEffect(() => {
    const available = new Set(['all', ...(data?.markets ?? [])])
    if (!available.has(selectedMarket)) {
      setSelectedMarket(data?.defaultMarket ?? 'all')
    }
  }, [data?.defaultMarket, data?.markets, selectedMarket])

  const senderOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of data?.chatEvents ?? []) {
      if (!map.has(event.senderAddress)) {
        map.set(event.senderAddress, event.senderLabel || event.senderAddress)
      }
    }
    return [...map.entries()].map(([address, label]) => ({ address, label }))
  }, [data?.chatEvents])

  const filteredChatEvents = useMemo(() => {
    const source = data?.chatEvents ?? []
    const byScope =
      chatScope === 'host'
        ? source.filter((event) => event.isHost)
        : chatScope === 'sender' && selectedSender
          ? source.filter((event) => event.senderAddress === selectedSender)
          : source
    if (selectedMarket === 'all') return byScope
    return byScope.filter((event) => event.market == null || event.market === selectedMarket)
  }, [chatScope, data?.chatEvents, selectedMarket, selectedSender])

  const filteredTradeEvents = useMemo(() => {
    const source = data?.tradeEvents ?? []
    if (selectedMarket === 'all') return source
    return source.filter((event) => event.market === selectedMarket)
  }, [data?.tradeEvents, selectedMarket])

  const allOverlayEvents = useMemo<ChartOverlayEvent[]>(() => {
    const candles = data?.candles ?? []
    const trades = showTrades
      ? filteredTradeEvents.map<ChartOverlayEvent>((event) => ({
          id: event.id,
          time: event.time,
          market: event.market,
          kind: 'trade',
          action: event.action,
          side: event.side,
          price: event.price,
        }))
      : []
    const chats = filteredChatEvents
      .filter((event) => (event.isHost ? showHostMessages : showRoomMessages))
      .map<ChartOverlayEvent>((event) => ({
        id: event.id,
        time: event.time,
        market: event.market,
        kind: event.isHost ? 'host-chat' : 'chat',
        text: event.text,
        senderLabel: event.senderLabel,
        senderAddress: event.senderAddress,
        isFirstFromSender: event.isFirstFromSender,
        price: nearestCandleClose(event.time, candles),
      }))
    const merged = [...trades, ...chats].sort((a, b) => a.time - b.time)
    if (densityMode === 'all') return merged
    const major = merged
      .filter(
        (event) =>
          event.kind === 'trade' || event.kind === 'host-chat' || Boolean(event.isFirstFromSender),
      )
      .sort((a, b) => a.time - b.time)
    const bucketMs = 15 * 60 * 1000
    const clustered: ChartOverlayEvent[] = []
    const seen = new Set<string>()
    for (const event of major) {
      const bucket = Math.floor(event.time / bucketMs)
      const key = `${event.market ?? 'global'}:${event.kind}:${event.action ?? 'none'}:${bucket}`
      if (seen.has(key) && event.id !== selectedEventId) continue
      clustered.push(event)
      seen.add(key)
    }
    return clustered
  }, [
    data?.candles,
    densityMode,
    filteredChatEvents,
    filteredTradeEvents,
    showHostMessages,
    showRoomMessages,
    showTrades,
    selectedEventId,
  ])

  const selectedEventIndex = useMemo(
    () => allOverlayEvents.findIndex((event) => event.id === selectedEventId),
    [allOverlayEvents, selectedEventId],
  )
  const selectedEvent =
    selectedEventIndex >= 0 && selectedEventIndex < allOverlayEvents.length
      ? allOverlayEvents[selectedEventIndex]
      : null

  const displayedEventRows = useMemo(() => allOverlayEvents.slice(-160), [allOverlayEvents])

  const stepEvent = useCallback((delta: -1 | 1) => {
    if (allOverlayEvents.length === 0) return
    if (selectedEventIndex < 0) {
      setSelectedEventId(allOverlayEvents[delta > 0 ? 0 : allOverlayEvents.length - 1]!.id)
      return
    }
    const next = (selectedEventIndex + delta + allOverlayEvents.length) % allOverlayEvents.length
    setSelectedEventId(allOverlayEvents[next]!.id)
  }, [allOverlayEvents, selectedEventIndex])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        stepEvent(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        stepEvent(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stepEvent])

  return (
    <div className="relative pb-24 md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-sky-500/10 to-transparent" />
      <section className="cinematic-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <span className="label">Positions Timeline</span>
            <h1 className="headline text-4xl sm:text-6xl mt-4">Room 1659 Intelligence Surface</h1>
            <p className="text-zinc-400 text-sm font-light mt-3">
              Hyperliquid-style market chart with room 1659 trade lifecycle overlays and chat context.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[24, 72, 168].map((hours) => (
                <Button
                  key={hours}
                  variant={windowHours === hours ? 'primary' : 'secondary'}
                  size="sm"
                  className="btn-compact rounded-full text-xs"
                  onClick={() => setWindowHours(hours as 24 | 72 | 168)}
                >
                  {hours === 24 ? '24h' : hours === 72 ? '3d' : '7d'}
                </Button>
              ))}
              <Button
                variant={densityMode === 'major' ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setDensityMode((mode) => (mode === 'major' ? 'all' : 'major'))}
              >
                {densityMode === 'major' ? 'Major markers' : 'All markers'}
              </Button>
              <Button
                variant={showTrades ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setShowTrades((value) => !value)}
              >
                Trades
              </Button>
              <Button
                variant={showHostMessages ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setShowHostMessages((value) => !value)}
              >
                Host msgs
              </Button>
              <Button
                variant={showRoomMessages ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setShowRoomMessages((value) => !value)}
              >
                Room msgs
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={selectedMarket}
                onChange={(event) => setSelectedMarket(event.target.value)}
              >
                <option value="all">All markets</option>
                {(data?.markets ?? []).map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
              <Button
                variant={chatScope === 'host' ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => {
                  setChatScope('host')
                  setSelectedSender(null)
                }}
              >
                Host chats
              </Button>
              <Button
                variant={chatScope === 'all' ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => {
                  setChatScope('all')
                  setSelectedSender(null)
                }}
              >
                All chats
              </Button>
              <Button
                variant={chatScope === 'sender' ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => {
                  setChatScope('sender')
                  if (!selectedSender && senderOptions.length > 0) {
                    setSelectedSender(senderOptions[0]!.address)
                  }
                }}
              >
                Sender filter
              </Button>
              {chatScope === 'sender' && (
                <select
                  className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                  value={selectedSender ?? ''}
                  onChange={(event) => setSelectedSender(event.target.value || null)}
                >
                  {senderOptions.map((option) => (
                    <option key={option.address} value={option.address}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </motion.div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-6">
            {isLoading ? (
              <div className="text-sm text-zinc-400">Loading room timeline…</div>
            ) : error ? (
              <div className="text-sm text-red-300">
                Failed to load timeline: {error instanceof Error ? error.message : 'unknown error'}
              </div>
            ) : (data?.candles.length ?? 0) === 0 ? (
              <div className="text-sm text-zinc-400">No candle data available in this timeframe.</div>
            ) : (
              <div className="space-y-4">
                <PositionsChartSurface
                  candles={data?.candles ?? []}
                  events={allOverlayEvents}
                  selectedEventId={selectedEventId}
                  onSelectEvent={setSelectedEventId}
                  onHoverEvent={setHoveredEventId}
                />
                <PositionsEventLegend />
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr),minmax(320px,1fr)]">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5">
              <div className="label">Timeline events ({displayedEventRows.length})</div>
              <div className="mt-3 max-h-[360px] overflow-y-auto space-y-2">
                {displayedEventRows.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full text-left rounded-md border p-2 text-xs transition ${
                      selectedEventId === event.id
                        ? 'border-sky-400/60 bg-sky-400/10'
                        : hoveredEventId === event.id
                          ? 'border-violet-400/60 bg-violet-400/10'
                        : 'border-white/5 bg-white/[0.03] hover:border-sky-400/40'
                    }`}
                  >
                    <div className="text-zinc-300">
                      {formatTime(event.time)} · {event.market ?? 'all markets'}
                    </div>
                    <div className="mt-1 text-zinc-100">
                      {event.kind === 'trade'
                        ? `Trade ${event.action ?? 'unknown'}`
                        : event.kind === 'host-chat'
                          ? 'Host message'
                          : 'Room message'}
                    </div>
                    {event.text && <div className="mt-1 text-zinc-300">{event.text.slice(0, 180)}</div>}
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:sticky lg:top-24 h-fit">
              <PositionsEventInspector
                event={selectedEvent ?? null}
                index={Math.max(0, selectedEventIndex)}
                total={allOverlayEvents.length}
                onPrevious={() => stepEvent(-1)}
                onNext={() => stepEvent(1)}
                onClear={() => setSelectedEventId(null)}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

