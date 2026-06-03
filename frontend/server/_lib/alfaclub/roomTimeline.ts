import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import {
  getCandleSnapshot,
  getUserFillsByTimeDetailed,
  type HyperliquidCandle,
  type HyperliquidUserFillDetailed,
} from './hyperliquid.js'
import { resolveRoom1659HyperliquidUserForSnapshot } from './room1659Market.js'

export type RoomTimelineChatEvent = {
  id: string
  roomId: string
  senderAddress: string
  senderLabel: string | null
  text: string
  time: number
  isHost: boolean
}

export type RoomTimelineTradeEvent = {
  id: string
  time: number
  coin: string | null
  side: 'long' | 'short' | null
  action: 'entry' | 'add' | 'reduce' | 'close' | 'flip' | 'unknown'
  price: number | null
  size: number | null
  dir: string | null
  closedPnl: number
  fee: number
}

export type RoomTimelineData = {
  roomId: string
  symbol: string
  hostAddress: string | null
  generatedAt: string
  candles: HyperliquidCandle[]
  tradeEvents: RoomTimelineTradeEvent[]
  chatEvents: RoomTimelineChatEvent[]
}

type ChatRow = {
  room_id: string
  message_id: string
  sender_address: string
  message_text: string
  username: string | null
  message_date: string | null
}

function toMs(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function classifyFillAction(fill: HyperliquidUserFillDetailed): RoomTimelineTradeEvent['action'] {
  const dir = (fill.dir ?? '').toLowerCase()
  const startPosition = fill.startPosition
  const size = Math.abs(fill.sz ?? 0)

  if (dir.includes('open') || (startPosition != null && Math.abs(startPosition) < 1e-9 && size > 0)) {
    return 'entry'
  }
  if (dir.includes('close')) return 'close'
  if (dir.includes('flip')) return 'flip'
  if (dir.includes('buy') || dir.includes('sell')) {
    if (startPosition == null) return 'unknown'
    const before = Math.abs(startPosition)
    const after = Math.abs(startPosition + (fill.side === 'long' ? size : fill.side === 'short' ? -size : 0))
    if (after > before) return 'add'
    if (after < before && after > 1e-9) return 'reduce'
    if (after <= 1e-9) return 'close'
  }
  return 'unknown'
}

async function resolveRoomHostAddress(params: {
  roomId: string
  explicitHostAddress?: string | null
}): Promise<string | null> {
  const explicit = (params.explicitHostAddress ?? '').trim().toLowerCase()
  if (/^0x[a-f0-9]{40}$/.test(explicit)) return explicit
  if (params.roomId === '1659') {
    return resolveRoom1659HyperliquidUserForSnapshot(explicit || '0x0000000000000000000000000000000000000000')
  }

  const db = await getDb()
  if (!db) return null
  await ensureAlfaClubVigilanteSchema()
  try {
    const result = await db.sql`
      SELECT sender_address, COUNT(*)::int AS n
      FROM alfaclub.chat_ingest
      WHERE room_id = ${params.roomId}
      GROUP BY sender_address
      ORDER BY n DESC
      LIMIT 1;
    `
    const row = (result.rows ?? [])[0] as { sender_address?: string } | undefined
    const candidate = String(row?.sender_address ?? '').trim().toLowerCase()
    if (/^0x[a-f0-9]{40}$/.test(candidate)) return candidate
  } catch {
    return null
  }
  return null
}

async function readChatEvents(params: {
  roomId: string
  hostAddress: string | null
  startTimeMs: number
  limit: number
}): Promise<RoomTimelineChatEvent[]> {
  const db = await getDb()
  if (!db) return []
  await ensureAlfaClubVigilanteSchema()
  try {
    const result = await db.sql`
      SELECT room_id, message_id, sender_address, message_text, username, message_date
      FROM alfaclub.chat_ingest
      WHERE room_id = ${params.roomId}
        AND message_date IS NOT NULL
        AND message_date >= ${new Date(params.startTimeMs).toISOString()}
      ORDER BY message_date ASC
      LIMIT ${params.limit};
    `
    const rows = (result.rows ?? []) as ChatRow[]
    return rows
      .map((row) => {
        const time = toMs(row.message_date)
        if (time == null) return null
        const sender = String(row.sender_address ?? '').trim().toLowerCase()
        const text = String(row.message_text ?? '').trim()
        if (!sender || !text) return null
        return {
          id: `${row.room_id}:${row.message_id}`,
          roomId: row.room_id,
          senderAddress: sender,
          senderLabel: row.username?.trim() || null,
          text,
          time,
          isHost: Boolean(params.hostAddress && sender === params.hostAddress),
        } satisfies RoomTimelineChatEvent
      })
      .filter((row): row is RoomTimelineChatEvent => Boolean(row))
  } catch {
    return []
  }
}

function mapTradeEvents(fills: HyperliquidUserFillDetailed[] | null): RoomTimelineTradeEvent[] {
  if (!fills || fills.length === 0) return []
  return fills
    .map((fill) => ({
      id: `fill:${fill.time}:${fill.coin ?? 'unknown'}`,
      time: fill.time,
      coin: fill.coin,
      side: fill.side,
      action: classifyFillAction(fill),
      price: fill.px,
      size: fill.sz,
      dir: fill.dir,
      closedPnl: fill.closedPnl,
      fee: fill.fee,
    }))
    .sort((a, b) => a.time - b.time)
}

export async function buildRoomTimelineData(params: {
  roomId: string
  hostAddress?: string | null
  symbol?: string | null
  interval?: string | null
  windowHours?: number | null
}): Promise<RoomTimelineData> {
  const roomId = params.roomId.trim()
  const symbol = (params.symbol ?? 'HYPE').trim().toUpperCase() || 'HYPE'
  const interval = (params.interval ?? '1h').trim() || '1h'
  const windowHours = Math.max(1, Math.min(24 * 14, Math.floor(params.windowHours ?? 72)))
  const endTimeMs = Date.now()
  const startTimeMs = endTimeMs - windowHours * 60 * 60 * 1000

  const hostAddress = await resolveRoomHostAddress({
    roomId,
    explicitHostAddress: params.hostAddress ?? null,
  })
  const hlAddress =
    roomId === '1659'
      ? resolveRoom1659HyperliquidUserForSnapshot(hostAddress ?? '0x0000000000000000000000000000000000000000')
      : hostAddress

  const [candles, fills, chatEvents] = await Promise.all([
    getCandleSnapshot({
      coin: symbol,
      interval,
      startTimeMs,
      endTimeMs,
    }),
    hlAddress ? getUserFillsByTimeDetailed(hlAddress, startTimeMs) : Promise.resolve(null),
    readChatEvents({ roomId, hostAddress, startTimeMs, limit: 500 }),
  ])

  return {
    roomId,
    symbol,
    hostAddress,
    generatedAt: new Date().toISOString(),
    candles: candles ?? [],
    tradeEvents: mapTradeEvents(fills),
    chatEvents,
  }
}

