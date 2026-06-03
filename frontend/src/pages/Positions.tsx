import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts'

import { apiFetch } from '@/lib/api/apiBase'
import { Button } from '@/components/ui/Button'

type TimelineCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

type TimelineTrade = {
  id: string
  time: number
  coin: string | null
  side: 'long' | 'short' | null
  action: 'entry' | 'add' | 'reduce' | 'close' | 'flip' | 'unknown'
  price: number | null
  size: number | null
  dir: string | null
  closedPnl: number
}

type TimelineChat = {
  id: string
  senderAddress: string
  senderLabel: string | null
  text: string
  time: number
  isHost: boolean
}

type TimelineResponse = {
  roomId: string
  symbol: string
  hostAddress: string | null
  generatedAt: string
  candles: TimelineCandle[]
  tradeEvents: TimelineTrade[]
  chatEvents: TimelineChat[]
}

type ChartPoint = {
  id: string
  t: number
  price: number
  label: string
  kind: 'trade' | 'host-chat' | 'chat'
  action?: string
  text?: string
  senderLabel?: string | null
  senderAddress?: string
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function fetchRoomTimeline(): Promise<TimelineResponse> {
  const res = await apiFetch('/api/v1/alfaclub/room-timeline?roomId=1659&windowHours=168', {})
  const json = (await res.json()) as { success?: boolean; data?: TimelineResponse; error?: string }
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }
  return json.data
}

function nearestCandlePrice(ts: number, candles: TimelineCandle[]): number {
  if (candles.length === 0) return 0
  const first = candles[0]
  if (!first) return 0
  let best = first
  let bestDelta = Math.abs(first.time - ts)
  for (const candle of candles.slice(1)) {
    const delta = Math.abs(candle.time - ts)
    if (delta < bestDelta) {
      best = candle
      bestDelta = delta
    }
  }
  return best.close
}

export function Positions() {
  const [expandAllChats, setExpandAllChats] = useState(false)
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['alfaclub-room-timeline', '1659'],
    queryFn: fetchRoomTimeline,
    staleTime: 30_000,
  })

  const candles = useMemo(() => data?.candles ?? [], [data?.candles])
  const chartSeries = useMemo(
    () =>
      candles.map((candle) => ({
        t: candle.time,
        close: candle.close,
      })),
    [candles],
  )

  const tradeMarkers = useMemo<ChartPoint[]>(
    () =>
      (data?.tradeEvents ?? [])
        .filter((event) => event.price != null)
        .map((event) => ({
          id: event.id,
          t: event.time,
          price: event.price ?? nearestCandlePrice(event.time, candles),
          label: `${event.action.toUpperCase()} ${event.coin ?? 'HL'}`,
          kind: 'trade',
          action: event.action,
        })),
    [candles, data?.tradeEvents],
  )

  const hostChatMarkers = useMemo<ChartPoint[]>(
    () =>
      (data?.chatEvents ?? [])
        .filter((event) => event.isHost)
        .map((event) => ({
          id: event.id,
          t: event.time,
          price: nearestCandlePrice(event.time, candles),
          label: 'Host chat',
          kind: 'host-chat',
          text: event.text,
          senderLabel: event.senderLabel,
          senderAddress: event.senderAddress,
        })),
    [candles, data?.chatEvents],
  )

  const allChatMarkers = useMemo<ChartPoint[]>(
    () =>
      (data?.chatEvents ?? []).map((event) => ({
        id: event.id,
        t: event.time,
        price: nearestCandlePrice(event.time, candles),
        label: event.isHost ? 'Host chat' : 'Chat',
        kind: event.isHost ? 'host-chat' : 'chat',
        text: event.text,
        senderLabel: event.senderLabel,
        senderAddress: event.senderAddress,
      })),
    [candles, data?.chatEvents],
  )

  const visibleChatMarkers = expandAllChats ? allChatMarkers : hostChatMarkers

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <span className="label">Room Timeline</span>
            <h1 className="headline text-4xl sm:text-6xl mt-4">Hyperliquid + Chat Markers</h1>
            <p className="text-zinc-400 text-sm font-light mt-3">
              Room 1659 chart with trade actions (entry/add/reduce/close) and chat markers you can hover.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant={expandAllChats ? 'secondary' : 'primary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setExpandAllChats((v) => !v)}
              >
                {expandAllChats ? 'Show host chats only' : 'Expand all chats'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? 'Refreshing…' : 'Refresh timeline'}
              </Button>
            </div>
          </motion.div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-6">
            {isLoading ? (
              <div className="text-sm text-zinc-400">Loading timeline…</div>
            ) : error ? (
              <div className="text-sm text-red-300">
                Failed to load timeline: {error instanceof Error ? error.message : 'unknown error'}
              </div>
            ) : chartSeries.length === 0 ? (
              <div className="text-sm text-zinc-400">No candle data yet for this room timeline window.</div>
            ) : (
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartSeries} margin={{ top: 12, right: 20, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => formatTime(Number(value))}
                      stroke="#a1a1aa"
                    />
                    <YAxis
                      type="number"
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                      stroke="#a1a1aa"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null
                        const point = payload[0]?.payload as ChartPoint | { close?: number } | undefined
                        return (
                          <div className="rounded-md border border-white/10 bg-zinc-950/95 p-3 text-xs text-zinc-100 shadow-xl max-w-[320px]">
                            <div className="font-medium">{formatTime(Number(label))}</div>
                            {'close' in (point ?? {}) && (
                              <div className="text-zinc-300 mt-1">Price: ${(point as { close: number }).close.toFixed(2)}</div>
                            )}
                            {point && 'kind' in point && (
                              <>
                                <div className="mt-1 text-zinc-200">
                                  {point.kind === 'trade'
                                    ? `Trade: ${point.action ?? 'unknown'}`
                                    : point.kind === 'host-chat'
                                      ? 'Host chat'
                                      : 'Chat'}
                                </div>
                                {point.text && <div className="mt-1 text-zinc-300 whitespace-pre-wrap">{point.text}</div>}
                                {point.senderLabel && (
                                  <div className="mt-1 text-zinc-400">
                                    by {point.senderLabel}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={false}
                      name={`${data?.symbol ?? 'HYPE'} price`}
                    />
                    <Scatter data={tradeMarkers} dataKey="price" fill="#22c55e" name="Trade actions" />
                    <Scatter
                      data={visibleChatMarkers}
                      dataKey="price"
                      fill={expandAllChats ? '#a78bfa' : '#f59e0b'}
                      name={expandAllChats ? 'All chats' : 'Host chats'}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-6">
            <div className="label">Chat events ({expandAllChats ? 'all' : 'host-only'})</div>
            <div className="mt-3 max-h-[280px] overflow-y-auto space-y-2">
              {(expandAllChats ? allChatMarkers : hostChatMarkers).slice(-120).map((event) => (
                <div key={`${event.id ?? event.t}`} className="rounded-md bg-white/[0.03] border border-white/5 p-2 text-xs">
                  <div className="text-zinc-300">
                    {formatTime(event.t)} · {event.senderLabel || event.senderAddress || 'unknown'}
                  </div>
                  <div className="text-zinc-100 mt-1 whitespace-pre-wrap">{event.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

