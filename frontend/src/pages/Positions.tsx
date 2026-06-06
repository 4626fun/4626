import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

import { PositionsChartSurface } from '@/components/positions/PositionsChartSurface'
import { PositionsEventInspector } from '@/components/positions/PositionsEventInspector'
import { PositionsEventLegend } from '@/components/positions/PositionsEventLegend'
import { PositionsMarketSignal } from '@/components/positions/PositionsMarketSignal'
import { PositionsRoomBook } from '@/components/positions/PositionsRoomBook'
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

type PositionFill = { time: number; side: 'long' | 'short' | null; size: number | null; price: number | null }

/**
 * Reconstructs the running net position (signed size + average entry) from a market's
 * fills, so we can value the room's open exposure at any past timestamp. A long fill
 * (buy) increases the position; a short fill (sell) decreases it. Reduces keep the
 * existing average entry; flips reset it to the fill price. Approximate but truthful —
 * derived only from real fills, not synthesized.
 */
function buildPositionContextResolver(fills: PositionFill[]) {
  const sorted = [...fills].sort((a, b) => a.time - b.time)
  const states: { time: number; net: number; avgEntry: number }[] = []
  let net = 0
  let avgEntry = 0
  for (const fill of sorted) {
    const qty = Math.abs(fill.size ?? 0)
    if (qty > 0) {
      const signed = (fill.side === 'short' ? -1 : 1) * qty
      const px = fill.price ?? avgEntry
      const sameDirection = net === 0 || net > 0 === signed > 0
      if (sameDirection) {
        const newNet = net + signed
        const denom = Math.abs(newNet)
        avgEntry = denom > 0 ? (avgEntry * Math.abs(net) + px * qty) / denom : avgEntry
        net = newNet
      } else {
        const newNet = net + signed
        if (newNet === 0) {
          net = 0
          avgEntry = 0
        } else if (newNet > 0 !== net > 0) {
          net = newNet
          avgEntry = px
        } else {
          net = newNet
        }
      }
    }
    states.push({ time: fill.time, net, avgEntry })
  }
  return (timeMs: number, markPrice: number | null) => {
    let resolved = { net: 0, avgEntry: 0 }
    for (const state of states) {
      if (state.time <= timeMs) resolved = state
      else break
    }
    if (resolved.net === 0) {
      return { side: null, size: 0, avgEntry: null, markPrice, unrealizedPnl: null }
    }
    const side: 'long' | 'short' = resolved.net > 0 ? 'long' : 'short'
    const unrealizedPnl =
      markPrice != null && resolved.avgEntry > 0 ? (markPrice - resolved.avgEntry) * resolved.net : null
    return { side, size: Math.abs(resolved.net), avgEntry: resolved.avgEntry, markPrice, unrealizedPnl }
  }
}

function inferExitReason(event: Pick<ChartOverlayEvent, 'action' | 'dir'>): string | null {
  if (event.action === 'liquidated') return 'Liquidation'
  if (event.action !== 'close') return null
  const dir = (event.dir ?? '').toLowerCase()
  if (dir.includes('liquidat') || dir.includes('liq')) return 'Liquidation'
  return 'Manual Close'
}

// Finer candles when zoomed in, coarser for long windows — keeps us under Hyperliquid's
// ~5000-candle snapshot cap while reducing how many messages collide on a single candle.
type IntervalChoice = 'auto' | '1m' | '5m' | '15m' | '1h'

function autoIntervalForWindow(windowHours: number): string {
  if (windowHours <= 24) return '5m'
  if (windowHours <= 72) return '15m'
  return '1h'
}

// Hyperliquid's candleSnapshot caps at ~5000 points, so finer intervals are only offered
// on shorter windows. Anything past the cap falls back to the auto interval.
function maxCandlesForInterval(interval: string): number {
  switch (interval) {
    case '1m':
      return 1
    case '5m':
      return 5
    case '15m':
      return 15
    case '1h':
      return 60
    default:
      return 60
  }
}

function resolveInterval(choice: IntervalChoice, windowHours: number): string {
  if (choice === 'auto') return autoIntervalForWindow(windowHours)
  const minutes = maxCandlesForInterval(choice)
  const candleCount = (windowHours * 60) / minutes
  // Guard against blowing past Hyperliquid's snapshot cap; degrade gracefully to auto.
  if (candleCount > 5000) return autoIntervalForWindow(windowHours)
  return choice
}

function isIntervalAllowed(choice: IntervalChoice, windowHours: number): boolean {
  if (choice === 'auto') return true
  const minutes = maxCandlesForInterval(choice)
  return (windowHours * 60) / minutes <= 5000
}

async function fetchRoomTimelineBySymbol(
  windowHours: number,
  symbol: string | null,
  interval: string,
): Promise<TimelineResponse> {
  const params = new URLSearchParams({
    roomId: '1659',
    windowHours: String(windowHours),
    interval,
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
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const [windowHours, setWindowHours] = useState<24 | 72 | 168>(168)
  const [intervalChoice, setIntervalChoice] = useState<IntervalChoice>('auto')
  const [densityMode, setDensityMode] = useState<'all' | 'major'>('all')
  const [showTrades, setShowTrades] = useState(true)
  const [hideBots, setHideBots] = useState(true)
  const [hideCommands, setHideCommands] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)

  // Ref for the timeline list scroll container so we can bring the selected row into view.
  const timelineListRef = useRef<HTMLDivElement | null>(null)

  const selectedSymbolForQuery = useMemo(() => {
    const [symbol] = selectedMarket.split('/')
    const normalized = (symbol ?? '').trim().toUpperCase()
    return normalized || null
  }, [selectedMarket])

  const effectiveInterval = useMemo(
    () => resolveInterval(intervalChoice, windowHours),
    [intervalChoice, windowHours],
  )

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['alfaclub-room-timeline', '1659', windowHours, selectedSymbolForQuery, effectiveInterval],
    queryFn: () => fetchRoomTimelineBySymbol(windowHours, selectedSymbolForQuery, effectiveInterval),
    staleTime: 30_000,
  })

  // Resolve the active market during render instead of syncing via an effect.
  // `selectedMarket` is the raw user choice (empty until they pick one); we fall
  // back to the server default whenever the choice is empty or no longer available.
  const effectiveMarket = useMemo(() => {
    const available = data?.markets ?? []
    if (selectedMarket && available.includes(selectedMarket)) return selectedMarket
    return data?.defaultMarket ?? selectedMarket
  }, [data?.defaultMarket, data?.markets, selectedMarket])

  // Bot filter (Hermit etc.) is applied early so that sender options and downstream
  // lists/chart only see human messages when the toggle is active.
  const baseChatEvents = useMemo(() => {
    let evs = data?.chatEvents ?? []
    if (hideBots) {
      // Hide bot messages. We primarily use the isBot flag (populated server-side from
      // AlfaClub ingest/read API). As a robust fallback for Hermit4626 specifically, we
      // also hide anything whose senderLabel contains "hermit" (e.g. "hermit4626", "Hermit").
      // This ensures messages from the Hermit bot are hidden even if the isBot flag is
      // missing on some payloads (historical data, certain read paths, etc.).
      evs = evs.filter((e) => {
        if (e.isBot === true) return false;
        const label = (e.senderLabel || '').toLowerCase();
        if (label.includes('hermit')) return false;
        return true;
      });
    }
    if (hideCommands) {
      // Filter out bot command invocations (e.g. /hermit, /gmeow, /signal, etc.).
      // These are typically the inputs that trigger Hermit rather than organic chat.
      evs = evs.filter((e) => !(e.text || '').trim().startsWith('/'))
    }
    return evs
  }, [data?.chatEvents, hideBots, hideCommands])

  const senderOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of baseChatEvents) {
      if (!map.has(event.senderAddress)) {
        map.set(event.senderAddress, event.senderLabel || event.senderAddress)
      }
    }
    return [...map.entries()].map(([address, label]) => ({ address, label }))
  }, [baseChatEvents])

  const isSelectedSenderVisible = useMemo(
    () => (selectedSender ? baseChatEvents.some((event) => event.senderAddress === selectedSender) : false),
    [baseChatEvents, selectedSender],
  )

  const effectiveChatScope = useMemo<'host' | 'all' | 'sender'>(() => {
    if (chatScope !== 'sender') return chatScope
    return selectedSender && isSelectedSenderVisible ? 'sender' : 'all'
  }, [chatScope, isSelectedSenderVisible, selectedSender])

  const effectiveSelectedSender = effectiveChatScope === 'sender' ? selectedSender : null

  const filteredChatEvents = useMemo(() => {
    const source = baseChatEvents // already has bot filter applied
    const byScope =
      effectiveChatScope === 'host'
        ? source.filter((event) => event.isHost)
        : effectiveChatScope === 'sender' && effectiveSelectedSender
          ? source.filter((event) => event.senderAddress === effectiveSelectedSender)
          : source
    if (!effectiveMarket) return byScope
    // Market-specific messages stay decoupled; room-wide chatter (null market) is
    // general social signal and surfaces on every market.
    return byScope.filter((event) => event.market === effectiveMarket || event.market == null)
  }, [effectiveChatScope, baseChatEvents, effectiveMarket, effectiveSelectedSender])

  const filteredTradeEvents = useMemo(() => {
    const source = data?.tradeEvents ?? []
    if (!effectiveMarket) return source
    return source.filter((event) => event.market === effectiveMarket)
  }, [data?.tradeEvents, effectiveMarket])

  const selectedSummary = useMemo(() => {
    const summaries = data?.marketSummaries ?? []
    return summaries.find((summary) => summary.market === effectiveMarket) ?? summaries[0] ?? null
  }, [data?.marketSummaries, effectiveMarket])

  const lastPrice = useMemo(() => {
    const candles = data?.candles ?? []
    return candles.length > 0 ? candles[candles.length - 1]!.close : null
  }, [data?.candles])

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
          size: event.size,
          closedPnl: event.closedPnl,
          dir: event.dir,
        }))
      : []
    const resolvePositionContext = buildPositionContextResolver(
      filteredTradeEvents.map((event) => ({
        time: event.time,
        side: event.side,
        size: event.size,
        price: event.price,
      })),
    )
    const chats = filteredChatEvents.map<ChartOverlayEvent>((event) => {
      const markPrice = nearestCandleClose(event.time, candles)
      return {
        id: event.id,
        time: event.time,
        market: event.market,
        kind: event.isHost ? 'host-chat' : 'chat',
        text: event.text,
        senderLabel: event.senderLabel,
        senderAvatarUrl: event.senderAvatarUrl,
        senderAddress: event.senderAddress,
        isBot: event.isBot,
        isFirstFromSender: event.isFirstFromSender,
        price: markPrice,
        contextAtTime: resolvePositionContext(event.time, markPrice),
      }
    })
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

  // For the side timeline list we want reverse-chronological order:
  // most recent / current events at the top, older messages as the user scrolls down.
  const timelineListEvents = useMemo(() => {
    const recent = allOverlayEvents.slice(-160)
    return [...recent].reverse()
  }, [allOverlayEvents])

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

  // When selection changes (via click, keyboard arrows, or inspector), scroll the
  // corresponding row into view inside the timeline list (newest-first order).
  useEffect(() => {
    if (!selectedEventId || !timelineListRef.current) return
    const container = timelineListRef.current
    const row = container.querySelector(`[data-event-id="${selectedEventId}"]`) as HTMLElement | null
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedEventId])

  return (
    <div className="relative pb-24 md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-sky-500/10 to-transparent" />
      <section className="cinematic-section !py-6 sm:!py-8 lg:!py-10">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-4"
          >
            <span className="label">Social Trading Signal</span>
            <h1 className="headline text-3xl sm:text-4xl mt-2">SignalScope</h1>
            <p className="text-zinc-400 text-sm font-light mt-2">
              Per-market social signal and historical indicator — live and historical positions
              overlaid with the chatter that called them, mapped to the market they reference.
            </p>
            <a
              href="https://alfaclub.app/rooms/1659/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-400/15"
            >
              Powered by AlfaClub · Room 1659
              <span aria-hidden>↗</span>
            </a>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={effectiveMarket}
                onChange={(event) => setSelectedMarket(event.target.value)}
              >
                {(data?.markets ?? []).map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={String(windowHours)}
                onChange={(event) => setWindowHours(Number(event.target.value) as 24 | 72 | 168)}
              >
                <option value="24">24h</option>
                <option value="72">3d</option>
                <option value="168">7d</option>
              </select>
              <select
                className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={intervalChoice}
                onChange={(event) => setIntervalChoice(event.target.value as IntervalChoice)}
                title="Candle interval — finer intervals spread same-candle messages apart"
              >
                <option value="auto">Auto ({autoIntervalForWindow(windowHours)})</option>
                {isIntervalAllowed('1m', windowHours) && <option value="1m">1m</option>}
                {isIntervalAllowed('5m', windowHours) && <option value="5m">5m</option>}
                {isIntervalAllowed('15m', windowHours) && <option value="15m">15m</option>}
                <option value="1h">1h</option>
              </select>
              <select
                className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={densityMode}
                onChange={(event) => setDensityMode(event.target.value as 'all' | 'major')}
              >
                <option value="all">All events</option>
                <option value="major">Key events only</option>
              </select>
              <select
                className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={effectiveChatScope}
                onChange={(event) => {
                  const scope = event.target.value as 'host' | 'all' | 'sender'
                  setChatScope(scope)
                  if (scope !== 'sender') {
                    setSelectedSender(null)
                  } else if (!selectedSender && senderOptions.length > 0) {
                    setSelectedSender(senderOptions[0]!.address)
                  }
                }}
              >
                <option value="all">All room messages</option>
                <option value="host">Host only</option>
                <option value="sender">Specific sender</option>
              </select>
              {effectiveChatScope === 'sender' && (
                <select
                  className="rounded-full border border-white/10 bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                  value={effectiveSelectedSender ?? ''}
                  onChange={(event) => setSelectedSender(event.target.value || null)}
                >
                  {senderOptions.map((option) => (
                    <option key={option.address} value={option.address}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              <Button
                variant={showTrades ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setShowTrades((value) => !value)}
              >
                Trades
              </Button>
              <Button
                variant={hideBots ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setHideBots((value) => !value)}
                title={hideBots ? 'Hermit bot messages (isBot or sender label containing "hermit") are hidden (click to show)' : 'Click to hide Hermit4626 / other bot messages'}
              >
                Hermit bots
              </Button>
              <Button
                variant={hideCommands ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setHideCommands((value) => !value)}
                title={hideCommands ? 'Bot command messages (starting with /) are hidden (click to show)' : 'Click to hide bot commands (messages starting with / like /hermit)'}
              >
                Commands
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
            <p className="mt-2 text-[11px] text-zinc-500">
              Message scope controls chat overlays; “Trades” toggles position events.
            </p>
          </motion.div>

          {data && !isLoading && !error && (data.marketSummaries?.length ?? 0) > 0 && (
            <div className="mb-3 space-y-3">
              <PositionsRoomBook
                summaries={data.marketSummaries}
                selectedMarket={effectiveMarket}
                onSelect={setSelectedMarket}
              />
              <PositionsMarketSignal
                summary={selectedSummary}
                lastPrice={lastPrice}
                roomWideMessageCount={data.roomWideMessageCount ?? 0}
              />
            </div>
          )}

          {/* Chart + side panel (timeline events & inspector) */}
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:p-4">
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
                    marketLabel={effectiveMarket}
                  />
                  <PositionsEventLegend />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 lg:sticky lg:top-6 self-start lg:h-[72vh] lg:min-h-[520px]">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5 flex flex-col min-h-0 lg:flex-1">
              <div className="label shrink-0">Timeline events ({timelineListEvents.length})</div>
              <div
                ref={timelineListRef}
                className="mt-3 max-h-[48vh] lg:max-h-none lg:flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 [scrollbar-gutter:stable]"
              >
                {timelineListEvents.map((event) => (
                  <button
                    key={event.id}
                    data-event-id={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full text-left rounded-lg border p-2.5 text-xs transition ${
                      selectedEventId === event.id
                        ? 'border-sky-400/60 bg-sky-400/10'
                        : hoveredEventId === event.id
                          ? 'border-violet-400/60 bg-violet-400/10'
                        : 'border-white/5 bg-white/[0.03] hover:border-sky-400/40 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-zinc-300">
                      {event.kind !== 'trade' && event.senderAvatarUrl ? (
                        <span className="relative block h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                          <span
                            className="absolute inset-0"
                            style={{ background: '#27272a' }}
                          />
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
                        {formatTime(event.time)} · {event.market ?? 'all markets'}
                      </span>
                    </div>
                    <div className="mt-1 text-zinc-100">
                      {event.kind === 'trade'
                        ? `Trade ${event.action ?? 'unknown'}`
                        : event.kind === 'host-chat'
                          ? 'Host message'
                          : 'Room message'}
                      {event.kind !== 'trade' && event.senderLabel ? (
                        <span className="ml-1.5 text-[10px] text-zinc-400">· {event.senderLabel}</span>
                      ) : null}
                    </div>
                    {event.kind === 'trade' &&
                      (event.action === 'close' || event.action === 'liquidated') &&
                      typeof event.closedPnl === 'number' && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="rounded-full border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {inferExitReason(event)}
                          </span>
                          <span
                            className={`text-[11px] ${
                              event.closedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            P/L {event.closedPnl >= 0 ? '+' : ''}
                            ${event.closedPnl.toFixed(2)}
                          </span>
                        </div>
                      )}
                    {event.text && <div className="mt-1 text-zinc-300">{event.text.slice(0, 180)}</div>}
                  </button>
                ))}
              </div>
              </div>
              <div className="shrink-0">
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
        </div>
      </section>
    </div>
  )
}

