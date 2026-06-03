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
  getClearinghouseState,
  getUserFillsByTimeDetailed,
  type HyperliquidCandle,
  type HyperliquidClearinghouseState,
  type HyperliquidUserFillDetailed,
} from './hyperliquid.js'
import { resolveRoom1659HyperliquidUserForSnapshot } from './room1659Market.js'

export type RoomTimelineChatEvent = {
  id: string
  messageId: string
  roomId: string
  senderAddress: string
  senderLabel: string | null
  senderAvatarUrl: string | null
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
  action: 'entry' | 'add' | 'reduce' | 'close' | 'liquidated' | 'flip' | 'unknown'
  price: number | null
  size: number | null
  dir: string | null
  closedPnl: number
  fee: number
  market: string
}

export type RoomMarketPosition = {
  market: string
  coin: string
  side: 'long' | 'short' | null
  sizeUsd: number | null
  entryPrice: number | null
  unrealizedPnlUsd: number | null
  liquidationPrice: number | null
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
  lastAction: RoomTimelineTradeEvent['action'] | null
  messageCount: number
  currentPosition: RoomMarketPosition | null
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
  currentPositions: RoomMarketPosition[]
  marketSummaries: RoomMarketSummary[]
  roomWideMessageCount: number
}

type ChatRow = {
  room_id: string
  message_id: string
  sender_address: string
  message_text: string
  username: string | null
  avatar_url: string | null
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

  if (dir.includes('liquidat') || dir.includes('liq')) return 'liquidated'
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

/**
 * Resolve the effective host for chat tagging. Prefers the upstream-resolved host address
 * when that wallet actually posted in this window; otherwise falls back to the most active
 * sender (the host in a one-to-many room). This keeps "Host only" working even when the
 * upstream host address — e.g. a Hyperliquid portfolio wallet for room 1659 — differs from
 * the chat sender address.
 */
function pickEffectiveHostAddress(
  senderAddresses: string[],
  resolvedHostAddress: string | null,
): string | null {
  const counts = new Map<string, number>()
  for (const address of senderAddresses) {
    if (!address) continue
    counts.set(address, (counts.get(address) ?? 0) + 1)
  }
  const resolved = (resolvedHostAddress ?? '').trim().toLowerCase()
  if (resolved && counts.has(resolved)) return resolved
  let best: string | null = null
  let bestCount = 0
  for (const [address, count] of counts) {
    if (count > bestCount) {
      best = address
      bestCount = count
    }
  }
  return best
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

function resolveRoomMessageAvatar(message: AlfaClubRoomMessage): string | null {
  const nestedSender =
    message.sender && typeof message.sender === 'object' && !Array.isArray(message.sender)
      ? (message.sender as Record<string, unknown>)
      : null
  const candidates = [
    message.avatar,
    message.avatarUrl,
    message.avatar_url,
    nestedSender?.avatar,
    nestedSender?.avatarUrl,
    nestedSender?.avatar_url,
    nestedSender?.pfp,
    nestedSender?.profilePicture,
  ]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed.length > 0) return trimmed
  }
  return null
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
        senderAvatarUrl: resolveRoomMessageAvatar(message),
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
    const effectiveHost = pickEffectiveHostAddress(
      ordered.map((message) => message.senderAddress),
      params.hostAddress,
    )
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
        senderAvatarUrl: message.senderAvatarUrl,
        text: message.text,
        time: message.time,
        isHost: Boolean(effectiveHost && message.senderAddress === effectiveHost),
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
      SELECT room_id, message_id, sender_address, message_text, username, avatar_url, message_date,
             reply_id, reply_text, reply_sender, reply_username
      FROM alfaclub.chat_ingest
      WHERE room_id = ${params.roomId}
        AND message_date IS NOT NULL
        AND message_date >= ${new Date(params.startTimeMs).toISOString()}
      ORDER BY message_date ASC
      LIMIT ${params.limit};
    `
    const rows = (result.rows ?? []) as ChatRow[]
    const effectiveHost = pickEffectiveHostAddress(
      rows.map((row) => String(row.sender_address ?? '').trim().toLowerCase()),
      params.hostAddress,
    )
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
          senderAvatarUrl: row.avatar_url?.trim() || null,
          text,
          time,
          isHost: Boolean(effectiveHost && sender === effectiveHost),
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

function mapCurrentPositions(
  state: HyperliquidClearinghouseState | null,
  fallbackSymbol: string,
): RoomMarketPosition[] {
  const positions = state?.assetPositions ?? []
  return positions
    .map((pos) => {
      const coin = (pos.coin ?? '').trim()
      if (!coin) return null
      const sizeUsd = pos.positionValue
      const hasExposure = (sizeUsd != null && Math.abs(sizeUsd) > 1e-9) || pos.side != null
      if (!hasExposure) return null
      return {
        market: normalizeMarketFromCoin(coin, fallbackSymbol),
        coin: coin.toUpperCase(),
        side: pos.side ?? null,
        sizeUsd,
        entryPrice: pos.entryPx,
        unrealizedPnlUsd: pos.unrealizedPnl,
        liquidationPrice: pos.liquidationPx,
        leverage: pos.leverage,
      } satisfies RoomMarketPosition
    })
    .filter((position): position is RoomMarketPosition => Boolean(position))
}

function buildMarketSummaries(params: {
  markets: string[]
  tradeEvents: RoomTimelineTradeEvent[]
  chatEvents: RoomTimelineChatEvent[]
  currentPositions: RoomMarketPosition[]
}): RoomMarketSummary[] {
  return params.markets.map((market) => {
    const trades = params.tradeEvents.filter((event) => event.market === market)
    const closed = trades.filter(
      (event) => event.action === 'close' || event.action === 'liquidated',
    )
    const realizedPnlUsd = trades.reduce(
      (sum, event) => sum + (Number.isFinite(event.closedPnl) ? event.closedPnl : 0),
      0,
    )
    const winningClosedCount = closed.filter((event) => event.closedPnl > 0).length
    const last = trades.length > 0 ? trades[trades.length - 1] : null
    const currentPosition =
      params.currentPositions.find((position) => position.market === market) ?? null
    const coin = (market.split('/')[0] ?? market).toUpperCase()
    return {
      market,
      coin,
      realizedPnlUsd,
      tradeCount: trades.length,
      closedCount: closed.length,
      winningClosedCount,
      lastActionTime: last?.time ?? null,
      lastAction: last?.action ?? null,
      messageCount: params.chatEvents.filter((event) => event.market === market).length,
      currentPosition,
    } satisfies RoomMarketSummary
  })
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

  const [candles, fills, clearinghouseState] = await Promise.all([
    getCandleSnapshot({
      coin: symbol,
      interval,
      startTimeMs,
      endTimeMs,
    }),
    hlAddress ? getUserFillsByTimeDetailed(hlAddress, startTimeMs) : Promise.resolve(null),
    hlAddress ? getClearinghouseState(hlAddress) : Promise.resolve(null),
  ])

  const defaultMarket = normalizeMarket(symbol)
  // All markets the room has traded in this window (not just the selected symbol).
  const allTradeEvents = mapTradeEvents(fills, symbol)
  const currentPositions = mapCurrentPositions(clearinghouseState, symbol)

  // Known coins/symbols power chat → market inference. Include every coin the room
  // has touched (historical fills + open positions), not just the selected symbol.
  const knownSymbols = new Set<string>([
    symbol,
    ...allTradeEvents.map((event) => event.coin ?? ''),
    ...currentPositions.map((position) => position.coin),
  ])

  const rawChatEvents = await readChatEvents({
    roomId,
    hostAddress,
    startTimeMs,
    limit: 500,
    knownSymbols,
  })
  // Strict market attribution: a message belongs to the market it references, or is
  // room-wide (null) when it references none. Do NOT force unrelated chatter onto the
  // selected market — that would re-couple markets that should stay decoupled.
  const chatEvents = rawChatEvents
  const roomWideMessageCount = chatEvents.filter((event) => event.market == null).length

  // Chart trade overlays stay scoped to the selected market (candles are per-coin).
  const tradeEvents = allTradeEvents.filter((event) => event.market === defaultMarket)

  // Markets list spans current positions + all historical trades + the selected market,
  // ordered so markets with live exposure and more activity surface first.
  const marketActivity = new Map<string, number>()
  for (const event of allTradeEvents) {
    marketActivity.set(event.market, (marketActivity.get(event.market) ?? 0) + 1)
  }
  for (const event of chatEvents) {
    if (event.market) marketActivity.set(event.market, (marketActivity.get(event.market) ?? 0) + 1)
  }
  const openMarkets = new Set(currentPositions.map((position) => position.market))
  const markets = Array.from(
    new Set<string>([
      defaultMarket,
      ...currentPositions.map((position) => position.market),
      ...allTradeEvents.map((event) => event.market),
    ]),
  ).sort((a, b) => {
    const aOpen = openMarkets.has(a) ? 1 : 0
    const bOpen = openMarkets.has(b) ? 1 : 0
    if (aOpen !== bOpen) return bOpen - aOpen
    return (marketActivity.get(b) ?? 0) - (marketActivity.get(a) ?? 0)
  })

  const marketSummaries = buildMarketSummaries({
    markets,
    tradeEvents: allTradeEvents,
    chatEvents,
    currentPositions,
  })

  return {
    roomId,
    symbol,
    hostAddress,
    generatedAt: new Date().toISOString(),
    candles: candles ?? [],
    tradeEvents,
    chatEvents,
    markets,
    defaultMarket,
    currentPositions,
    marketSummaries,
    roomWideMessageCount,
  }
}

