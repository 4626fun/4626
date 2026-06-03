import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import {
  ALFACLUB_API_COMMON_BROWSER_HEADERS,
  readAlfaClubApiAuthFlags,
  resolveAlfaClubApiCallBaseUrl,
  resolveAlfaClubProxySecret,
} from './apiAuth.js'
import {
  getCandleSnapshot,
  getUserFillsByTimeDetailed,
  type HyperliquidCandle,
  type HyperliquidUserFillDetailed,
} from './hyperliquid.js'
import { resolveRoom1659HyperliquidUserForSnapshot } from './room1659Market.js'

export type RoomTimelineChatEvent = {
  id: string
  messageId: string
  roomId: string
  senderAddress: string
  senderLabel: string | null
  text: string
  time: number
  isHost: boolean
  isFirstFromSender: boolean
  replyId: string | null
  replyText: string | null
  replySender: string | null
  replySenderLabel: string | null
  market: string | null
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
  market: string
}

export type RoomTimelineData = {
  roomId: string
  symbol: string
  hostAddress: string | null
  generatedAt: string
  candles: HyperliquidCandle[]
  tradeEvents: RoomTimelineTradeEvent[]
  chatEvents: RoomTimelineChatEvent[]
  markets: string[]
  defaultMarket: string
}

type ChatRow = {
  room_id: string
  message_id: string
  sender_address: string
  message_text: string
  username: string | null
  message_date: string | null
  reply_id: string | null
  reply_text: string | null
  reply_sender: string | null
  reply_username: string | null
}

type AlfaClubRoomMessage = Record<string, unknown>

function toMs(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function normalizeMarket(coinOrSymbol: string): string {
  return `${coinOrSymbol.trim().toUpperCase()}/USDC`
}

function normalizeMarketFromCoin(coin: string | null | undefined, fallbackSymbol: string): string {
  const normalized = (coin ?? '').trim().toUpperCase()
  return normalizeMarket(normalized || fallbackSymbol)
}

function inferChatMarket(text: string, symbols: Set<string>): string | null {
  const normalizedText = text.toUpperCase()
  for (const symbol of symbols) {
    if (!symbol) continue
    const token = symbol.toUpperCase()
    const matcher = new RegExp(`\\b${token}\\b`)
    if (matcher.test(normalizedText)) return normalizeMarket(token)
  }
  return null
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

function parseNumberCandidate(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function resolveRoomMessageId(message: AlfaClubRoomMessage): string {
  const candidates = [message.id, message.messageId, message.message_id, message.uuid]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function resolveRoomMessageSender(message: AlfaClubRoomMessage): string {
  const nestedSender =
    message.sender && typeof message.sender === 'object' && !Array.isArray(message.sender)
      ? (message.sender as Record<string, unknown>)
      : null
  const candidates = [
    message.senderAddress,
    message.sender_address,
    message.walletAddress,
    message.wallet_address,
    nestedSender?.walletAddress,
    nestedSender?.wallet_address,
    nestedSender?.id,
  ]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim().toLowerCase()
    if (trimmed) return trimmed
  }
  return ''
}

function resolveRoomMessageText(message: AlfaClubRoomMessage): string {
  const candidates = [message.text, message.message, message.body, message.content]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function resolveRoomMessageDateMs(message: AlfaClubRoomMessage): number {
  const candidates = [
    message.date,
    message.created_at,
    message.createdAt,
    message.timestamp,
    message.sent_at,
  ]
  for (const candidate of candidates) {
    const n = parseNumberCandidate(candidate)
    if (n > 0) return n
  }
  return 0
}

async function readChatEventsViaReadApi(params: {
  roomId: string
  hostAddress: string | null
  startTimeMs: number
  limit: number
  knownSymbols: Set<string>
}): Promise<RoomTimelineChatEvent[] | null> {
  const flags = readAlfaClubApiAuthFlags()
  const readToken = flags.readBotToken || flags.botToken
  if (!readToken) return null
  const apiBaseUrl = resolveAlfaClubApiCallBaseUrl(flags)
  const proxySecret = resolveAlfaClubProxySecret(flags)
  const url = new URL(`/api/room/${encodeURIComponent(params.roomId)}/messages`, apiBaseUrl)
  url.searchParams.set('limit', String(params.limit))
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...ALFACLUB_API_COMMON_BROWSER_HEADERS,
        Authorization: `Bearer ${readToken}`,
        ...((proxySecret ?? '').trim() ? { 'x-proxy-secret': String(proxySecret).trim() } : {}),
      },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { messages?: AlfaClubRoomMessage[] } | AlfaClubRoomMessage[]
    const source = Array.isArray(body) ? body : Array.isArray(body.messages) ? body.messages : []
    const ordered = source
      .map((message) => ({
        id: resolveRoomMessageId(message),
        messageId: resolveRoomMessageId(message),
        senderAddress: resolveRoomMessageSender(message),
        senderLabel:
          typeof message.username === 'string' && message.username.trim().length > 0
            ? message.username.trim()
            : null,
        text: resolveRoomMessageText(message),
        time: resolveRoomMessageDateMs(message),
        replyId:
          typeof message.reply_id === 'string' && message.reply_id.trim().length > 0
            ? message.reply_id.trim()
            : null,
        replyText:
          typeof message.reply_text === 'string' && message.reply_text.trim().length > 0
            ? message.reply_text.trim()
            : null,
        replySender:
          typeof message.reply_sender === 'string' && message.reply_sender.trim().length > 0
            ? message.reply_sender.trim().toLowerCase()
            : null,
        replySenderLabel:
          typeof message.reply_username === 'string' && message.reply_username.trim().length > 0
            ? message.reply_username.trim()
            : null,
      }))
      .filter(
        (message) =>
          message.id &&
          message.senderAddress &&
          message.text &&
          Number.isFinite(message.time) &&
          message.time > 0 &&
          message.time >= params.startTimeMs,
      )
      .sort((a, b) => a.time - b.time)
    const firstSeenBySender = new Set<string>()
    return ordered.map((message) => {
      const isFirstFromSender = !firstSeenBySender.has(message.senderAddress)
      if (isFirstFromSender) firstSeenBySender.add(message.senderAddress)
      return {
        id: `${params.roomId}:${message.id}`,
        messageId: message.messageId,
        roomId: params.roomId,
        senderAddress: message.senderAddress,
        senderLabel: message.senderLabel,
        text: message.text,
        time: message.time,
        isHost: Boolean(params.hostAddress && message.senderAddress === params.hostAddress),
        isFirstFromSender,
        replyId: message.replyId,
        replyText: message.replyText,
        replySender: message.replySender,
        replySenderLabel: message.replySenderLabel,
        market: inferChatMarket(message.text, params.knownSymbols),
      }
    })
  } catch {
    return null
  }
}

async function readChatEvents(params: {
  roomId: string
  hostAddress: string | null
  startTimeMs: number
  limit: number
  knownSymbols: Set<string>
}): Promise<RoomTimelineChatEvent[]> {
  const apiEvents = await readChatEventsViaReadApi(params)
  if (apiEvents) return apiEvents
  const db = await getDb()
  if (!db) return []
  await ensureAlfaClubVigilanteSchema()
  try {
    const result = await db.sql`
      SELECT room_id, message_id, sender_address, message_text, username, message_date,
             reply_id, reply_text, reply_sender, reply_username
      FROM alfaclub.chat_ingest
      WHERE room_id = ${params.roomId}
        AND message_date IS NOT NULL
        AND message_date >= ${new Date(params.startTimeMs).toISOString()}
      ORDER BY message_date ASC
      LIMIT ${params.limit};
    `
    const rows = (result.rows ?? []) as ChatRow[]
    const firstSeenBySender = new Set<string>()
    return rows
      .map((row) => {
        const time = toMs(row.message_date)
        if (time == null) return null
        const sender = String(row.sender_address ?? '').trim().toLowerCase()
        const text = String(row.message_text ?? '').trim()
        if (!sender || !text) return null
        const isFirstFromSender = !firstSeenBySender.has(sender)
        if (isFirstFromSender) firstSeenBySender.add(sender)
        return {
          id: `${row.room_id}:${row.message_id}`,
          messageId: row.message_id,
          roomId: row.room_id,
          senderAddress: sender,
          senderLabel: row.username?.trim() || null,
          text,
          time,
          isHost: Boolean(params.hostAddress && sender === params.hostAddress),
          isFirstFromSender,
          replyId: row.reply_id?.trim() || null,
          replyText: row.reply_text?.trim() || null,
          replySender: row.reply_sender?.trim().toLowerCase() || null,
          replySenderLabel: row.reply_username?.trim() || null,
          market: inferChatMarket(text, params.knownSymbols),
        } satisfies RoomTimelineChatEvent
      })
      .filter((row): row is RoomTimelineChatEvent => Boolean(row))
  } catch {
    return []
  }
}

function mapTradeEvents(
  fills: HyperliquidUserFillDetailed[] | null,
  fallbackSymbol: string,
): RoomTimelineTradeEvent[] {
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
      market: normalizeMarketFromCoin(fill.coin, fallbackSymbol),
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

  const [candles, fills] = await Promise.all([
    getCandleSnapshot({
      coin: symbol,
      interval,
      startTimeMs,
      endTimeMs,
    }),
    hlAddress ? getUserFillsByTimeDetailed(hlAddress, startTimeMs) : Promise.resolve(null),
  ])
  const tradeEvents = mapTradeEvents(fills, symbol)
  const knownSymbols = new Set<string>([symbol, ...tradeEvents.map((event) => event.coin ?? '')])
  const chatEvents = await readChatEvents({
    roomId,
    hostAddress,
    startTimeMs,
    limit: 500,
    knownSymbols,
  })
  const markets = Array.from(
    new Set<string>([normalizeMarket(symbol), ...tradeEvents.map((event) => event.market)]),
  )

  return {
    roomId,
    symbol,
    hostAddress,
    generatedAt: new Date().toISOString(),
    candles: candles ?? [],
    tradeEvents,
    chatEvents,
    markets,
    defaultMarket: normalizeMarket(symbol),
  }
}

