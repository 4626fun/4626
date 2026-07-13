import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type RoomTradeAction = 'entry' | 'add' | 'reduce' | 'close' | 'liquidated' | 'flip' | 'unknown'
export type RoomTradeSide = 'long' | 'short' | null

export type RoomTradeEvent = {
  id: string
  time: number
  coin: string | null
  side: RoomTradeSide
  action: RoomTradeAction
  price: number | null
  size: number | null
  closedPnl: number
  market: string
  leverage: number | null
  notionalUsd: number | null
}

export type RoomMarketPosition = {
  market: string
  coin: string
  source: 'host' | 'counter'
  side: RoomTradeSide
  sizeUsd: number | null
  entryPrice: number | null
  unrealizedPnlUsd: number | null
  leverage: number | null
}

export type RoomMarketSummary = {
  market: string
  coin: string
  realizedPnlUsd: number
  tradeCount: number
  closedCount: number
  winningClosedCount: number
  lastActionTime: number | null
  lastAction: RoomTradeAction | null
  currentPosition: RoomMarketPosition | null
}

export type RoomTradingActivityData = {
  roomId: string
  hostAddress: string | null
  defaultMarket: string
  tradeEvents: RoomTradeEvent[]
  currentPositions: RoomMarketPosition[]
  marketSummaries: RoomMarketSummary[]
}

type RawRoomTimelineResponse = {
  success?: boolean
  data?: {
    roomId?: string
    hostAddress?: string | null
    defaultMarket?: string
    tradeEvents?: RoomTradeEvent[]
    currentPositions?: RoomMarketPosition[]
    marketSummaries?: RoomMarketSummary[]
  }
  error?: string
}

/**
 * Recent-trades window for the Overview tab. Wide enough to surface activity for
 * lower-frequency rooms without pulling the full 90-day cap the backend allows.
 */
const OVERVIEW_TRADING_ACTIVITY_WINDOW_HOURS = 168

export async function fetchRoomTradingActivity(
  roomId: string,
  signal: AbortSignal,
): Promise<RoomTradingActivityData> {
  const query = new URLSearchParams({
    roomId,
    windowHours: String(OVERVIEW_TRADING_ACTIVITY_WINDOW_HOURS),
  })
  const response = await apiFetch(`${API_ENDPOINTS.alfaclub.roomTimeline}?${query.toString()}`, {
    method: 'GET',
    signal,
  })
  const payload = (await response.json().catch(() => null)) as RawRoomTimelineResponse | null
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error ?? `room_trading_activity_failed_${response.status}`)
  }
  const data = payload.data
  return {
    roomId: data.roomId ?? roomId,
    hostAddress: data.hostAddress ?? null,
    defaultMarket: data.defaultMarket ?? '',
    tradeEvents: Array.isArray(data.tradeEvents) ? data.tradeEvents : [],
    currentPositions: Array.isArray(data.currentPositions) ? data.currentPositions : [],
    marketSummaries: Array.isArray(data.marketSummaries) ? data.marketSummaries : [],
  }
}

export function isRoomTradingActivityEmpty(data: RoomTradingActivityData): boolean {
  return (
    data.tradeEvents.length === 0 &&
    data.currentPositions.length === 0 &&
    data.marketSummaries.every((summary) => summary.tradeCount === 0)
  )
}

export function totalRealizedPnlUsd(summaries: RoomMarketSummary[]): number {
  return summaries.reduce(
    (sum, summary) => sum + (Number.isFinite(summary.realizedPnlUsd) ? summary.realizedPnlUsd : 0),
    0,
  )
}

export function totalClosedTradeStats(summaries: RoomMarketSummary[]): {
  closedCount: number
  winningClosedCount: number
} {
  return summaries.reduce(
    (totals, summary) => ({
      closedCount: totals.closedCount + summary.closedCount,
      winningClosedCount: totals.winningClosedCount + summary.winningClosedCount,
    }),
    { closedCount: 0, winningClosedCount: 0 },
  )
}

export function totalTradeCount(summaries: RoomMarketSummary[]): number {
  return summaries.reduce((sum, summary) => sum + summary.tradeCount, 0)
}

export function formatSignedUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const magnitude = Math.abs(value)
  const formatted = magnitude.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: magnitude >= 1000 ? 0 : 2,
  })
  return `${sign}${formatted}`
}

export function formatUsdCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value)
}

export function describeTradeAction(action: RoomTradeAction): string {
  switch (action) {
    case 'entry':
      return 'Opened'
    case 'add':
      return 'Added'
    case 'reduce':
      return 'Reduced'
    case 'close':
      return 'Closed'
    case 'liquidated':
      return 'Liquidated'
    case 'flip':
      return 'Flipped'
    case 'unknown':
      return 'Trade'
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

export function formatTradePrice(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price)) return null
  const magnitude = Math.abs(price)
  // Sub-$1 assets (low-priced memecoins/perps) need more precision than the standard 2dp,
  // or fills round down to a meaningless "$0.00".
  const maximumFractionDigits = magnitude >= 1 ? 2 : magnitude >= 0.01 ? 4 : 6
  return `$${price.toLocaleString('en-US', { maximumFractionDigits })}`
}

export function formatTradeTimeAgo(timeMs: number): string {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return '—'
  const minutes = Math.max(0, Math.round((Date.now() - timeMs) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
