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
import { readScoredProliquidSignalsForRoom } from './proliquidSignals.js'

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
  isBot: boolean
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
  source: 'host' | 'counter'
  side: 'long' | 'short' | null
  action: 'entry' | 'add' | 'reduce' | 'close' | 'liquidated' | 'flip' | 'unknown'
  price: number | null
  size: number | null
  dir: string | null
  closedPnl: number
  fee: number
  market: string
  leverage: number | null
  notionalUsd: number | null
  marginUsd: number | null
}

export type RoomMarketPosition = {
  market: string
  coin: string
  source: 'host' | 'counter'
  ownerAddress: string
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
  is_bot: boolean | null
  message_date: string | null
  reply_id: string | null
  reply_text: string | null
  reply_sender: string | null
  reply_username: string | null
}

type AlfaClubRoomMessage = Record<string, unknown>
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const ROOM_1659_COUNTER_TRADE_BOT_WALLET_DEFAULT =
  '0x74ab91cd845ff0d2006404440af49c3bc8c1df96' as const
type CounterTradeActionTimelineRow = {
  id: number
  sender_address: string
  event_key: string
  reason: string
  counter_side: 'long' | 'short' | null
  counter_notional_usd: string | null
  counter_leverage: string | null
  user_notional_usd: string | null
  raw_event: unknown
  created_time_ms: string
  event_time_ms: number | null
  coin: string | null
}

function parseLeverageFromDir(dir: string | null | undefined): number | null {
  const text = String(dir ?? '')
  const match = text.match(/(\d+(?:\.\d+)?)\s*x|x\s*(\d+(?:\.\d+)?)/i)
  if (!match) return null
  const candidate = match[1] ?? match[2]
  if (!candidate) return null
  const value = Number(candidate)
  return Number.isFinite(value) && value > 0 ? value : null
}

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

function parseCounterCoinFromEventKey(eventKey: string): string | null {
  const key = String(eventKey ?? '').trim()
  if (!key) return null
  // defense|bot|BTC|defend_reduce|<tickMs>
  if (key.startsWith('defense|')) {
    const parts = key.split('|')
    return (parts[2] ?? '').trim().toUpperCase() || null
  }
  // default fill-derived key: wallet|time|coin|px|sz|dir|startPosition
  const parts = key.split('|')
  return (parts[2] ?? '').trim().toUpperCase() || null
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function parseLeverageFromRawEventPayload(rawEvent: unknown): number | null {
  if (!rawEvent || typeof rawEvent !== 'object') return null
  const record = rawEvent as Record<string, unknown>
  const direct = parsePositiveNumber(record.leverage)
  if (direct != null) return direct
  if (record.leverage && typeof record.leverage === 'object') {
    const nested = parsePositiveNumber((record.leverage as Record<string, unknown>).value)
    if (nested != null) return nested
  }
  return null
}

function parseNotionalFromRawEventPayload(rawEvent: unknown): number | null {
  if (!rawEvent || typeof rawEvent !== 'object') return null
  const record = rawEvent as Record<string, unknown>
  const explicit = parsePositiveNumber(record.notionalUsd)
  if (explicit != null) return explicit
  const px = parsePositiveNumber(record.px)
  const sz = parsePositiveNumber(record.sz)
  if (px != null && sz != null) return Math.abs(px * sz)
  return null
}

function parseDirFromRawEventPayload(rawEvent: unknown): string | null {
  if (!rawEvent || typeof rawEvent !== 'object') return null
  const candidate = (rawEvent as Record<string, unknown>).dir
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
}

function parsePriceFromRawEventPayload(rawEvent: unknown): number | null {
  if (!rawEvent || typeof rawEvent !== 'object') return null
  return parsePositiveNumber((rawEvent as Record<string, unknown>).px)
}

function parseSizeFromRawEventPayload(rawEvent: unknown): number | null {
  if (!rawEvent || typeof rawEvent !== 'object') return null
  return parsePositiveNumber((rawEvent as Record<string, unknown>).sz)
}

function resolveRoom1659CounterTradeBotWallet(): string {
  const configured = String(process.env.ROOM_1659_COUNTER_TRADE_BOT_WALLET ?? '').trim()
  if (EVM_ADDRESS_RE.test(configured)) return configured.toLowerCase()
  return ROOM_1659_COUNTER_TRADE_BOT_WALLET_DEFAULT
}

async function readCounterTradeActionTimeline(params: {
  roomId: string
  startTimeMs: number
  fallbackSymbol: string
}): Promise<RoomTimelineTradeEvent[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      SELECT
        a.id,
        a.sender_address,
        a.event_key,
        a.reason,
        a.counter_side,
        a.counter_notional_usd::text AS counter_notional_usd,
        a.counter_leverage::text AS counter_leverage,
        e.user_notional_usd::text AS user_notional_usd,
        e.raw_event,
        (EXTRACT(EPOCH FROM a.created_at) * 1000)::bigint::text AS created_time_ms,
        e.event_time_ms,
        e.coin
      FROM alfaclub.counter_trade_action_ledger a
      LEFT JOIN alfaclub.counter_trade_event_ledger e
        ON e.room_id = a.room_id
       AND e.sender_address = a.sender_address
       AND e.event_key = a.event_key
      WHERE a.room_id = ${params.roomId}
        AND a.status = 'executed'
        AND a.created_at >= ${new Date(params.startTimeMs).toISOString()}::timestamptz
      ORDER BY a.created_at ASC
      LIMIT 3000;
    `
    const rows = (result.rows ?? []) as CounterTradeActionTimelineRow[]
    const events: RoomTimelineTradeEvent[] = []
    for (const row of rows) {
        const coin =
          (row.coin ?? '').trim().toUpperCase() || parseCounterCoinFromEventKey(row.event_key) || null
        const timeMs =
          Number.isFinite(row.event_time_ms) && (row.event_time_ms ?? 0) > 0
            ? Number(row.event_time_ms)
            : Number(row.created_time_ms)
        if (!Number.isFinite(timeMs) || timeMs <= 0) continue
        const reason = String(row.reason ?? '').trim().toLowerCase()
        const counterNotionalUsd = parsePositiveNumber(row.counter_notional_usd)
        const counterLeverage = parsePositiveNumber(row.counter_leverage)
        const rawEventLeverage = parseLeverageFromRawEventPayload(row.raw_event)
        const rawEventNotionalUsd = parseNotionalFromRawEventPayload(row.raw_event)
        const rawEventPrice = parsePriceFromRawEventPayload(row.raw_event)
        const rawEventSize = parseSizeFromRawEventPayload(row.raw_event)
        const userNotionalUsd = parsePositiveNumber(row.user_notional_usd)
        // Entry mirrors should primarily use the persisted action-ledger values.
        // Fall back to source event payloads only when explicit counter values are absent.
        const notionalUsd =
          counterNotionalUsd ??
          (reason === 'exit_executed' ? null : rawEventNotionalUsd ?? userNotionalUsd)
        // Historical leverage uses explicit per-event fields only:
        // 1) counter_trade_action_ledger.counter_leverage
        // 2) structured leverage inside counter_trade_event_ledger.raw_event
        // 3) last-resort parse from raw event dir text
        const leverage =
          counterLeverage ??
          rawEventLeverage ??
          parseLeverageFromDir(parseDirFromRawEventPayload(row.raw_event))
        const action: RoomTimelineTradeEvent['action'] =
          reason === 'exit_executed'
            ? 'close'
            : reason === 'defense_reduce_executed' || reason === 'harvest_tp_executed'
              ? 'reduce'
              : 'entry'
        events.push({
          id: `counter_action:${row.id}`,
          time: timeMs,
          coin,
          source: 'counter',
          side: row.counter_side ?? null,
          action,
          price: rawEventPrice,
          size: rawEventSize,
          dir: `inverse:${reason || 'executed'}`,
          closedPnl: 0,
          fee: 0,
          market: normalizeMarketFromCoin(coin, params.fallbackSymbol),
          leverage,
          notionalUsd,
          marginUsd: notionalUsd != null && leverage != null ? notionalUsd / leverage : null,
        })
    }
    return events
  } catch {
    return []
  }
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

function resolveRoomMessageIsBot(message: AlfaClubRoomMessage): boolean {
  const nestedSender =
    message.sender && typeof message.sender === 'object' && !Array.isArray(message.sender)
      ? (message.sender as Record<string, unknown>)
      : null
  const candidates = [
    message.isBot,
    message.is_bot,
    message.isbot,
    nestedSender?.isBot,
    nestedSender?.is_bot,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') return candidate
    if (typeof candidate === 'string') {
      const low = candidate.trim().toLowerCase()
      if (low === 'true') return true
      if (low === 'false') return false
    }
  }
  return false
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
        isBot: resolveRoomMessageIsBot(message),
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
        isBot: message.isBot ?? false,
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
      SELECT room_id, message_id, sender_address, message_text, username, avatar_url, is_bot, message_date,
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
          isBot: row.is_bot ?? false,
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

async function readProliquidSignalEvents(params: {
  roomId: string
  startTimeMs: number
  knownSymbols: Set<string>
}): Promise<RoomTimelineChatEvent[]> {
  const rows = await readScoredProliquidSignalsForRoom({
    roomId: params.roomId,
    startTimeMs: params.startTimeMs,
    limit: 200,
  })
  if (rows.length === 0) return []
  return rows.map((row) => {
    const time = Date.parse(row.scored_at ?? row.created_at ?? '') || Date.now()
    const summary = row.score_summary?.trim() || `[ProLiquid][${row.signal_kind}]`
    const body = row.normalized_text?.trim()
    const text = body ? `${summary}\n${body}` : summary
    return {
      id: `proliquid:${row.source_chat_id}:${row.source_message_id}`,
      messageId: `proliquid:${row.source_message_id}`,
      roomId: params.roomId,
      senderAddress: `proliquid:${row.source_chat_id}`.toLowerCase(),
      senderLabel: 'ProLiquid',
      senderAvatarUrl: null,
      text,
      time,
      isHost: false,
      isBot: false,
      isFirstFromSender: false,
      replyId: null,
      replyText: null,
      replySender: null,
      replySenderLabel: null,
      market: inferChatMarket(text, params.knownSymbols),
    } satisfies RoomTimelineChatEvent
  })
}

async function enrichChatSenderProfiles(
  events: RoomTimelineChatEvent[],
): Promise<RoomTimelineChatEvent[]> {
  if (events.length === 0) return events

  const senders = Array.from(
    new Set(events.map((e) => (e.senderAddress || '').trim().toLowerCase()).filter(Boolean)),
  )
  if (senders.length === 0) return events

  const db = await getDb()
  if (!db) return events

  const avatarBySender = new Map<string, string>()
  const labelBySender = new Map<string, string>()

  try {
    // Pull the best-known avatar_url + display_name for these wallets from the chat user directory.
    // This is the canonical place 4626 uses for chat/XMTP participant profile pictures.
    const res = await db.sql`
      SELECT canonical_wallet, avatar_url, display_name
      FROM chat_directory_profiles
      WHERE canonical_wallet = ANY(${senders})
    `
    for (const row of (res.rows ?? []) as Array<{
      canonical_wallet?: string
      avatar_url?: string | null
      display_name?: string | null
    }>) {
      const w = String(row.canonical_wallet || '').trim().toLowerCase()
      if (!w) continue
      const av = row.avatar_url ? String(row.avatar_url).trim() : ''
      if (av) avatarBySender.set(w, av)
      const dn = row.display_name ? String(row.display_name).trim() : ''
      if (dn) labelBySender.set(w, dn)
    }

    // Secondary source: zora_profiles (many wallets that minted or appeared in Zora
    // explore have avatar_image_url or basename_avatar populated by backfills).
    const zres = await db.sql`
      SELECT lower(wallet) AS w,
             COALESCE(NULLIF(TRIM(avatar_image_url), ''), NULLIF(TRIM(basename_avatar), '')) AS av
      FROM zora_profiles
      WHERE lower(wallet) = ANY(${senders})
    `
    for (const row of (zres.rows ?? []) as Array<{ w?: string; av?: string | null }>) {
      const w = String(row.w || '').trim().toLowerCase()
      if (!w) continue
      if (!avatarBySender.has(w)) {
        const av = row.av ? String(row.av).trim() : ''
        if (av) avatarBySender.set(w, av)
      }
    }
  } catch {
    // Non-fatal; fall back to whatever the ingest/read API already provided.
  }

  return events.map((ev) => {
    const addr = (ev.senderAddress || '').trim().toLowerCase()
    const existingAvatar = ev.senderAvatarUrl ? ev.senderAvatarUrl.trim() : ''
    const existingLabel = ev.senderLabel ? ev.senderLabel.trim() : ''

    const enrichedAvatar = existingAvatar || avatarBySender.get(addr) || null
    const enrichedLabel = existingLabel || labelBySender.get(addr) || ev.senderLabel

    if (!enrichedAvatar && !enrichedLabel) return ev

    return {
      ...ev,
      senderAvatarUrl: enrichedAvatar,
      senderLabel: enrichedLabel,
    }
  })
}

function mapTradeEvents(
  fills: HyperliquidUserFillDetailed[] | null,
  fallbackSymbol: string,
  source: 'host' | 'counter',
): RoomTimelineTradeEvent[] {
  if (!fills || fills.length === 0) return []
  return fills
    .map((fill, idx) => {
      const leverage =
        fill.leverage != null && Number.isFinite(fill.leverage) && fill.leverage > 0
          ? fill.leverage
          : parseLeverageFromDir(fill.dir)
      const notionalUsd =
        fill.px != null && fill.sz != null && Number.isFinite(fill.px) && Number.isFinite(fill.sz)
          ? Math.abs(fill.px * fill.sz)
          : null
      return {
      // Include idx to guarantee uniqueness even when multiple fills share the exact same timestamp + coin
      // (common for large orders that walk the book or multiple makers at one tick).
      id: `fill:${source}:${fill.time}:${fill.coin ?? 'unknown'}:${idx}`,
      time: fill.time,
      coin: fill.coin,
      source,
      side: fill.side,
      action: classifyFillAction(fill),
      price: fill.px,
      size: fill.sz,
      dir: fill.dir,
      closedPnl: fill.closedPnl,
      fee: fill.fee,
      market: normalizeMarketFromCoin(fill.coin, fallbackSymbol),
      leverage,
      notionalUsd,
      marginUsd: notionalUsd != null && leverage != null ? notionalUsd / leverage : null,
    }})
    .sort((a, b) => a.time - b.time)
}

function mapCurrentPositions(
  state: HyperliquidClearinghouseState | null,
  fallbackSymbol: string,
  source: 'host' | 'counter',
  ownerAddress: string | null,
): RoomMarketPosition[] {
  const normalizedOwner = String(ownerAddress ?? '').trim().toLowerCase()
  if (!normalizedOwner) return []
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
        source,
        ownerAddress: normalizedOwner,
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

function pickDefaultMarket(params: {
  requestedSymbol: string
  currentPositions: RoomMarketPosition[]
  allTradeEvents: RoomTimelineTradeEvent[]
}): string {
  const open = [...params.currentPositions].sort(
    (a, b) => Math.abs(b.sizeUsd ?? 0) - Math.abs(a.sizeUsd ?? 0),
  )
  if (open.length > 0) return open[0]!.market
  const latestTrade = params.allTradeEvents.length
    ? params.allTradeEvents[params.allTradeEvents.length - 1]
    : null
  if (latestTrade?.market) return latestTrade.market
  return normalizeMarket(params.requestedSymbol)
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
  const MAX_TIMELINE_WINDOW_HOURS = 24 * 90
  const roomId = params.roomId.trim()
  const symbol = (params.symbol ?? 'HYPE').trim().toUpperCase() || 'HYPE'
  const interval = (params.interval ?? '1h').trim() || '1h'
  // Allow true longer-horizon analysis (30/60/90d) while still bounding
  // potentially unbounded callers.
  const windowHours = Math.max(1, Math.min(MAX_TIMELINE_WINDOW_HOURS, Math.floor(params.windowHours ?? 72)))
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
  const counterTradeBotAddress =
    roomId === '1659' ? resolveRoom1659CounterTradeBotWallet() : null

  const [candles, fills, counterFills, counterActionTimeline, clearinghouseState, counterClearinghouseState] =
    await Promise.all([
    getCandleSnapshot({
      coin: symbol,
      interval,
      startTimeMs,
      endTimeMs,
    }),
    hlAddress ? getUserFillsByTimeDetailed(hlAddress, startTimeMs) : Promise.resolve(null),
    counterTradeBotAddress && counterTradeBotAddress !== hlAddress
      ? getUserFillsByTimeDetailed(counterTradeBotAddress, startTimeMs)
      : Promise.resolve(null),
    readCounterTradeActionTimeline({
      roomId,
      startTimeMs,
      fallbackSymbol: symbol,
    }),
      hlAddress ? getClearinghouseState(hlAddress) : Promise.resolve(null),
      counterTradeBotAddress && counterTradeBotAddress !== hlAddress
        ? getClearinghouseState(counterTradeBotAddress)
        : Promise.resolve(null),
    ])
  // All markets the room has traded in this window (not just the selected symbol).
  const allTradeEvents = [
    ...mapTradeEvents(fills, symbol, 'host'),
    ...mapTradeEvents(counterFills, symbol, 'counter'),
    ...counterActionTimeline,
  ].sort((a, b) => a.time - b.time)
  const currentPositions = [
    ...mapCurrentPositions(clearinghouseState, symbol, 'host', hlAddress),
    ...mapCurrentPositions(counterClearinghouseState, symbol, 'counter', counterTradeBotAddress),
  ]
  const defaultMarket = pickDefaultMarket({
    requestedSymbol: symbol,
    currentPositions,
    allTradeEvents,
  })

  // Known coins/symbols power chat → market inference. Include every coin the room
  // has touched (historical fills + open positions), not just the selected symbol.
  const knownSymbols = new Set<string>([
    symbol,
    ...allTradeEvents.map((event) => event.coin ?? ''),
    ...currentPositions.map((position) => position.coin),
  ])

  const [rawChatEvents, proliquidSignalEvents] = await Promise.all([
    readChatEvents({
      roomId,
      hostAddress,
      startTimeMs,
      limit: 500,
      knownSymbols,
    }),
    readProliquidSignalEvents({
      roomId,
      startTimeMs,
      knownSymbols,
    }),
  ])
  const firstSeenBySender = new Set<string>()
  const rawMerged = [...rawChatEvents, ...proliquidSignalEvents]
    .sort((a, b) => a.time - b.time)
    .map((event) => {
      const isFirstFromSender = !firstSeenBySender.has(event.senderAddress)
      if (isFirstFromSender) firstSeenBySender.add(event.senderAddress)
      return {
        ...event,
        isFirstFromSender,
      }
    })

  // Enrich chat events with profile pictures (and labels) from the chat directory when the
  // per-message avatar captured at ingest/read time is missing. This ensures real user
  // avatars render as markers on /positions even for historical messages or senders whose
  // AlfaClub message payloads did not carry a pfp.
  const chatEvents = await enrichChatSenderProfiles(rawMerged)

  // Strict market attribution: a message belongs to the market it references, or is
  // room-wide (null) when it references none. Do NOT force unrelated chatter onto the
  // selected market — that would re-couple markets that should stay decoupled.
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

