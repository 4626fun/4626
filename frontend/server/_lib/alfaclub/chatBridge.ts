/**
 * AlfaClub Room Chat Bridge
 *
 * Bridges AlfaClub in-app room commands into Keepr's deterministic command
 * executor and posts responses back through AlfaClub's websocket transport.
 *
 * Transport facts (captured from live AlfaClub web client):
 * - Read history: GET /api/websocket/room_history_paginate?roomId=...&limit=...&forward=false
 * - Mark read:   POST /api/websocket/update_read_msg
 * - Send text:   WS frame {"type":"message","value":{"room":"<id>","text":"...","attachments":[]}}
 */

import { executeDeterministicCommand } from '../../agent/core/executeDeterministicCommand.js'
import { matchesCommandFamily } from '../../commands/registry.js'
import { TARGET_CANONICAL_CSW_ADDRESS } from '../../../src/wallet/canonicalWalletPolicy.js'
import { upsertAlfaClubIngestMessages } from './chatIngestStore.js'
import { readAlfaClubChatToken } from './chatTokenStore.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_API_BASE_URL = 'https://api.alfaclub.app'
const DEFAULT_WS_URL = 'wss://ws.alfaclub.app'
const DEFAULT_POLL_INTERVAL_MS = 6_000
const DEFAULT_HISTORY_LIMIT = 20
const DEFAULT_SEND_TIMEOUT_MS = 10_000
const DEFAULT_HTTP_TIMEOUT_MS = 8_000
const DEFAULT_WS_LIVE_FALLBACK_ENABLED = true
const DEFAULT_WS_INGEST_ALL_ROOMS_ENABLED = true
const DEFAULT_TELEGRAM_RELAY_FALLBACK_ENABLED = true
const DEFAULT_WS_CLOSE_DELAY_MS = 75
const MAX_HISTORY_LIMIT = 100
const MAX_SEEN_MESSAGE_IDS = 4_000
const MAX_LIVE_COMMAND_QUEUE = 200
const MAX_TELEGRAM_MESSAGE_CHARS = 3500

type AlfaClubRoomHistoryMessage = {
  id?: string
  date?: number
  sender?: string
  text?: string
}

type AlfaClubRoomHistoryResponse = {
  messages?: AlfaClubRoomHistoryMessage[]
}

type AlfaClubOutboundFrame = {
  type: 'message'
  value: {
    room: string
    text: string
    attachments: unknown[]
  }
}

export type AlfaClubChatBridgeFlags = {
  killSwitch: boolean
  enabled: boolean
  roomId: string | null
  jwt: string | null
  apiBaseUrl: string
  websocketUrl: string
  groupId: string
  pollIntervalMs: number
  historyLimit: number
  sendTimeoutMs: number
  requestTimeoutMs: number
  wsLiveFallbackEnabled: boolean
  wsIngestAllRoomsEnabled: boolean
  telegramRelayEnabled: boolean
  telegramRelayBotToken: string | null
  telegramRelayChatId: string | null
  telegramRelayThreadId: number | null
}

export type AlfaClubCommandMessage = {
  id: string
  date: number
  sender: `0x${string}`
  text: string
}

type BridgeJwtSource = 'db' | 'env' | 'none'

type NormalizedHistoryMessage = {
  id: string
  date: number
  sender: string
  text: string
}

export type AlfaClubChatBridgeSkipReason =
  | 'kill_switch'
  | 'disabled'
  | 'env_missing'
  | 'already_running'

export type AlfaClubChatBridgeTickResult = {
  seeded: boolean
  roomId: string
  fetched: number
  unseen: number
  processed: number
  replied: number
  errors: Array<{ messageId: string; error: string }>
}

export type StartAlfaClubChatBridgeResult = {
  started: boolean
  reason?: AlfaClubChatBridgeSkipReason
  intervalMs: number
  roomId: string | null
  stop: () => void
}

function parseBool(value: string | undefined): boolean {
  const raw = (value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function parseBoolWithDefault(value: string | undefined, fallback: boolean): boolean {
  const raw = (value ?? '').trim()
  if (!raw) return fallback
  return parseBool(raw)
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const raw = (value ?? '').trim()
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

function parseOptionalPositiveInt(value: string | undefined, max: number): number | null {
  const raw = (value ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, max)
}

function normalizeApiBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim() || DEFAULT_API_BASE_URL
  try {
    const url = new URL(value)
    return `${url.origin}`
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

function normalizeWsUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim() || DEFAULT_WS_URL
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname || ''}`
  } catch {
    return DEFAULT_WS_URL
  }
}

function isHexAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function readAlfaClubChatBridgeFlags(): AlfaClubChatBridgeFlags {
  const roomIdRaw = (process.env.ALFACLUB_CHAT_ROOM_ID ?? '').trim()
  const roomId = /^\d+$/.test(roomIdRaw) ? roomIdRaw : null
  const groupIdRaw = (process.env.ALFACLUB_CHAT_GROUP_ID ?? '').trim()
  const telegramRelayBotToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim() || null
  const telegramRelayChatId =
    (process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID ?? '').trim() ||
    (process.env.TELEGRAM_TARGET_CHAT_ID ?? '').trim() ||
    null
  const telegramRelayEnabledFallback = Boolean(telegramRelayBotToken && telegramRelayChatId)

  return {
    killSwitch: parseBool(process.env.ALFACLUB_VIGILANTE_KILL_SWITCH),
    enabled: parseBool(process.env.ALFACLUB_CHAT_BRIDGE_ENABLED),
    roomId,
    jwt: (process.env.ALFACLUB_CHAT_JWT ?? '').trim() || null,
    apiBaseUrl: normalizeApiBaseUrl(process.env.ALFACLUB_CHAT_API_BASE_URL),
    websocketUrl: normalizeWsUrl(process.env.ALFACLUB_CHAT_WS_URL),
    groupId: groupIdRaw || `alfaclub-room-${roomId ?? 'unknown'}`,
    pollIntervalMs: parsePositiveInt(
      process.env.ALFACLUB_CHAT_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
      60_000,
    ),
    historyLimit: parsePositiveInt(
      process.env.ALFACLUB_CHAT_HISTORY_LIMIT,
      DEFAULT_HISTORY_LIMIT,
      MAX_HISTORY_LIMIT,
    ),
    sendTimeoutMs: parsePositiveInt(
      process.env.ALFACLUB_CHAT_SEND_TIMEOUT_MS,
      DEFAULT_SEND_TIMEOUT_MS,
      60_000,
    ),
    requestTimeoutMs: parsePositiveInt(
      process.env.ALFACLUB_CHAT_HTTP_TIMEOUT_MS,
      DEFAULT_HTTP_TIMEOUT_MS,
      60_000,
    ),
    wsLiveFallbackEnabled: parseBoolWithDefault(
      process.env.ALFACLUB_CHAT_WS_LIVE_FALLBACK_ENABLED,
      DEFAULT_WS_LIVE_FALLBACK_ENABLED,
    ),
    wsIngestAllRoomsEnabled: parseBoolWithDefault(
      process.env.ALFACLUB_CHAT_WS_INGEST_ALL_ROOMS_ENABLED,
      DEFAULT_WS_INGEST_ALL_ROOMS_ENABLED,
    ),
    telegramRelayEnabled: parseBoolWithDefault(
      process.env.ALFACLUB_TELEGRAM_RELAY_ENABLED,
      DEFAULT_TELEGRAM_RELAY_FALLBACK_ENABLED && telegramRelayEnabledFallback,
    ),
    telegramRelayBotToken,
    telegramRelayChatId,
    telegramRelayThreadId: parseOptionalPositiveInt(
      process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID,
      2_000_000_000,
    ),
  }
}

export function buildAlfaClubOutboundFrame(params: {
  roomId: string
  text: string
}): AlfaClubOutboundFrame {
  return {
    type: 'message',
    value: {
      room: params.roomId,
      text: params.text,
      attachments: [],
    },
  }
}

function normalizeHistoryMessage(message: AlfaClubRoomHistoryMessage): NormalizedHistoryMessage | null {
  const id = String(message.id ?? '').trim()
  if (!id) return null
  const date = Number(message.date)
  if (!Number.isFinite(date) || date <= 0) return null
  const sender = String(message.sender ?? '').trim().toLowerCase()
  const text = String(message.text ?? '')
  return { id, date, sender, text }
}

function byChronologicalOrder(a: NormalizedHistoryMessage, b: NormalizedHistoryMessage): number {
  if (a.date === b.date) return a.id.localeCompare(b.id)
  return a.date - b.date
}

function isAlfaClubCommandText(text: string): boolean {
  return matchesCommandFamily(text, 'alfaclub')
}

export function collectAlfaClubCommandMessages(params: {
  messages: AlfaClubRoomHistoryMessage[]
  seenMessageIds: ReadonlySet<string>
  selfAddress?: string
}): AlfaClubCommandMessage[] {
  const self = String(params.selfAddress ?? '').trim().toLowerCase()
  const normalized = params.messages
    .map(normalizeHistoryMessage)
    .filter((entry): entry is NormalizedHistoryMessage => Boolean(entry))
    .sort(byChronologicalOrder)

  const commands: AlfaClubCommandMessage[] = []
  for (const entry of normalized) {
    if (params.seenMessageIds.has(entry.id)) continue
    if (!entry.text.trim()) continue
    if (!isAlfaClubCommandText(entry.text)) continue
    if (!isHexAddress(entry.sender)) continue
    if (self && entry.sender === self) continue
    if (entry.sender === TARGET_CANONICAL_CSW_ADDRESS.toLowerCase()) continue
    commands.push({
      id: entry.id,
      date: entry.date,
      sender: entry.sender,
      text: entry.text.trim(),
    })
  }
  return commands
}

type BridgeWebSocketEvent = {
  data?: unknown
}

type BridgeWebSocket = {
  addEventListener: (event: string, listener: (event?: BridgeWebSocketEvent) => void) => void
  removeEventListener: (event: string, listener: (event?: BridgeWebSocketEvent) => void) => void
  send: (data: string) => void
  close: () => void
}

type BridgeWebSocketCtor = new (url: string) => BridgeWebSocket

type JsonRecord = Record<string, unknown>
type AlfaClubLiveInboundMessage = {
  roomId: string
  id: string
  date: number
  sender: string
  text: string
  rawPayloadText: string | null
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return null
}

function pickFirstDateMs(values: unknown[]): number {
  for (const value of values) {
    const asNumber = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(asNumber) || asNumber <= 0) continue
    // Some websocket payloads use seconds while history API uses ms.
    return asNumber < 10_000_000_000 ? Math.floor(asNumber * 1000) : Math.floor(asNumber)
  }
  return Date.now()
}

function extractWsMessagesFromPayload(payload: unknown): AlfaClubLiveInboundMessage[] {
  const queue: unknown[] = [payload]
  const out: AlfaClubLiveInboundMessage[] = []
  let syntheticCounter = 0

  while (queue.length > 0 && out.length < 50) {
    const node = queue.shift()
    if (!node) continue
    if (Array.isArray(node)) {
      for (const entry of node) queue.push(entry)
      continue
    }
    if (!isJsonRecord(node)) continue

    if (Array.isArray(node.messages)) queue.push(node.messages)
    if (isJsonRecord(node.message)) queue.push(node.message)
    if (isJsonRecord(node.value)) queue.push(node.value)
    if (Array.isArray(node.value)) queue.push(node.value)

    const text = pickFirstString([node.text, isJsonRecord(node.value) ? node.value.text : null])
    if (!text) continue
    const room = pickFirstString([node.room, isJsonRecord(node.value) ? node.value.room : null])
    if (!room) continue

    const sender = pickFirstString([
      node.sender,
      node.address,
      node.wallet,
      node.senderAddress,
      isJsonRecord(node.value) ? node.value.sender : null,
      isJsonRecord(node.value) ? node.value.address : null,
      isJsonRecord(node.value) ? node.value.wallet : null,
      isJsonRecord(node.user) ? node.user.address : null,
      isJsonRecord(node.value) && isJsonRecord(node.value.user) ? node.value.user.address : null,
    ])
    if (!sender) continue

    const messageId =
      pickFirstString([
        node.id,
        node.messageId,
        isJsonRecord(node.value) ? node.value.id : null,
        isJsonRecord(node.value) ? node.value.messageId : null,
      ]) ?? `ws-live-${Date.now()}-${syntheticCounter++}`

    const date = pickFirstDateMs([
      node.date,
      node.timestamp,
      node.createdAt,
      node.sentAt,
      isJsonRecord(node.value) ? node.value.date : null,
      isJsonRecord(node.value) ? node.value.timestamp : null,
      isJsonRecord(node.value) ? node.value.createdAt : null,
      isJsonRecord(node.value) ? node.value.sentAt : null,
    ])
    let rawPayloadText: string | null = null
    try {
      rawPayloadText = JSON.stringify(node)
    } catch {
      rawPayloadText = null
    }

    out.push({
      roomId: room,
      id: messageId,
      date,
      sender,
      text,
      rawPayloadText,
    })
  }

  return out
}

async function fetchRoomHistory(params: {
  apiBaseUrl: string
  roomId: string
  jwt: string
  limit: number
  timeoutMs: number
}): Promise<AlfaClubRoomHistoryMessage[]> {
  const url = new URL('/api/websocket/room_history_paginate', params.apiBaseUrl)
  url.searchParams.set('roomId', params.roomId)
  url.searchParams.set('limit', String(params.limit))
  url.searchParams.set('forward', 'false')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.jwt}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`room_history_failed:timeout:${message}`)
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    throw new Error(`room_history_failed:${response.status}`)
  }
  const body = (await response.json()) as AlfaClubRoomHistoryResponse
  return Array.isArray(body.messages) ? body.messages : []
}

async function markReadMessage(params: {
  apiBaseUrl: string
  roomId: string
  jwt: string
  messageDate: number
  timeoutMs: number
}): Promise<void> {
  const url = new URL('/api/websocket/update_read_msg', params.apiBaseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomId: params.roomId,
        messageDate: String(Math.floor(params.messageDate)),
      }),
      signal: controller.signal,
    })
  } catch {
    // Read receipts are best-effort only.
  } finally {
    clearTimeout(timeout)
  }
}

async function sendRoomMessageViaWebSocket(params: {
  websocketUrl: string
  jwt: string
  roomId: string
  text: string
  timeoutMs: number
}): Promise<void> {
  const WebSocketCtor = (globalThis as { WebSocket?: BridgeWebSocketCtor }).WebSocket
  if (!WebSocketCtor) {
    throw new Error('ws_unavailable')
  }
  const wsUrl = new URL(params.websocketUrl)
  wsUrl.searchParams.set('TOKEN', params.jwt)
  wsUrl.searchParams.set('_k', '0')

  const payload = JSON.stringify(
    buildAlfaClubOutboundFrame({
      roomId: params.roomId,
      text: params.text,
    }),
  )

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let opened = false
    const socket = new WebSocketCtor(wsUrl.toString())

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch {}
      reject(new Error('ws_send_timeout'))
    }, params.timeoutMs)

    const cleanup = (): void => {
      clearTimeout(timer)
      socket.removeEventListener('open', onOpen)
      socket.removeEventListener('close', onClose)
      socket.removeEventListener('error', onError)
    }

    const onOpen = (): void => {
      opened = true
      try {
        socket.send(payload)
      } catch (error) {
        if (settled) return
        settled = true
        cleanup()
        reject(error instanceof Error ? error : new Error(String(error)))
        return
      }
      setTimeout(() => {
        try {
          socket.close()
        } catch {}
      }, DEFAULT_WS_CLOSE_DELAY_MS)
    }

    const onClose = (): void => {
      if (settled) return
      settled = true
      cleanup()
      if (!opened) {
        reject(new Error('ws_closed_before_open'))
        return
      }
      resolve()
    }

    const onError = (): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('ws_send_failed'))
    }

    socket.addEventListener('open', onOpen)
    socket.addEventListener('close', onClose)
    socket.addEventListener('error', onError)
  })
}

type BridgeState = {
  seeded: boolean
  seenMessageIds: Set<string>
  liveCommandQueue: AlfaClubCommandMessage[]
  liveFallbackActive: boolean
  liveSocket: BridgeWebSocket | null
  liveSocketJwt: string | null
  liveSocketRoomId: string | null
}

let activeHandle: ReturnType<typeof setInterval> | null = null
let activeTickPromise: Promise<void> | null = null
let bridgeState: BridgeState = {
  seeded: false,
  seenMessageIds: new Set<string>(),
  liveCommandQueue: [],
  liveFallbackActive: false,
  liveSocket: null,
  liveSocketJwt: null,
  liveSocketRoomId: null,
}

function isFutureIsoTimestamp(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return true
  const ts = Date.parse(value)
  if (!Number.isFinite(ts)) return true
  return ts > Date.now()
}

async function resolveBridgeJwt(fallbackJwt: string | null): Promise<string | null> {
  const envJwt = (fallbackJwt ?? '').trim() || null
  let resolved: string | null = envJwt
  try {
    const persisted = await readAlfaClubChatToken()
    if (
      persisted?.jwt &&
      persisted.jwt.trim() &&
      isFutureIsoTimestamp(persisted.expiresAt)
    ) {
      resolved = persisted.jwt.trim()
    }
  } catch {
    // Fail-open to env fallback.
  }
  return resolved
}

async function resolveBridgeJwtWithSource(
  fallbackJwt: string | null,
): Promise<{ jwt: string | null; source: BridgeJwtSource }> {
  const envJwt = (fallbackJwt ?? '').trim() || null
  const resolved = await resolveBridgeJwt(fallbackJwt)
  if (!resolved) return { jwt: null, source: 'none' }
  if (envJwt && resolved === envJwt) return { jwt: resolved, source: 'env' }
  return { jwt: resolved, source: 'db' }
}

function isRoomHistory401(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.trim() === 'room_history_failed:401'
}

function rememberSeenMessageId(id: string): void {
  if (bridgeState.seenMessageIds.has(id)) return
  bridgeState.seenMessageIds.add(id)
  while (bridgeState.seenMessageIds.size > MAX_SEEN_MESSAGE_IDS) {
    const oldest = bridgeState.seenMessageIds.values().next().value
    if (!oldest) break
    bridgeState.seenMessageIds.delete(oldest)
  }
}

function pushLiveCommands(commands: AlfaClubCommandMessage[]): void {
  if (commands.length === 0) return
  bridgeState.liveFallbackActive = true
  for (const command of commands) {
    if (bridgeState.seenMessageIds.has(command.id)) continue
    rememberSeenMessageId(command.id)
    bridgeState.liveCommandQueue.push(command)
  }
  while (bridgeState.liveCommandQueue.length > MAX_LIVE_COMMAND_QUEUE) {
    bridgeState.liveCommandQueue.shift()
  }
}

function drainLiveCommands(): AlfaClubCommandMessage[] {
  if (bridgeState.liveCommandQueue.length === 0) return []
  const drained = bridgeState.liveCommandQueue
  bridgeState.liveCommandQueue = []
  return drained
}

function closeLiveSocket(): void {
  if (bridgeState.liveSocket) {
    try {
      bridgeState.liveSocket.close()
    } catch {}
  }
  bridgeState.liveSocket = null
  bridgeState.liveSocketJwt = null
  bridgeState.liveSocketRoomId = null
}

function decodeWsEventData(data: unknown): string | null {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) {
    try {
      return new TextDecoder().decode(new Uint8Array(data))
    } catch {
      return null
    }
  }
  if (ArrayBuffer.isView(data)) {
    try {
      return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    } catch {
      return null
    }
  }
  return null
}

function compactSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateTelegramText(value: string, maxChars = MAX_TELEGRAM_MESSAGE_CHARS): string {
  const compact = compactSingleLine(value)
  if (compact.length <= maxChars) return compact
  return `${compact.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

function buildTelegramRelayText(message: AlfaClubLiveInboundMessage): string {
  const sender = message.sender.trim().toLowerCase()
  const body = truncateTelegramText(message.text || '')
  const fallback = body || '(no text)'
  return [`[AlfaClub] room ${message.roomId}`, `from ${sender}`, fallback].join('\n')
}

async function sendTelegramRelayMessage(params: {
  botToken: string
  chatId: string
  messageThreadId: number | null
  text: string
  timeoutMs: number
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendMessage`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
        disable_web_page_preview: true,
        ...(params.messageThreadId ? { message_thread_id: params.messageThreadId } : {}),
      }),
      signal: controller.signal,
    })
  } catch {
    // Fail-open to preserve bridge progress.
  } finally {
    clearTimeout(timeout)
  }
}

async function ingestLiveMessages(
  messages: AlfaClubLiveInboundMessage[],
  flags: AlfaClubChatBridgeFlags,
): Promise<void> {
  if (messages.length === 0) return
  const inserted = await upsertAlfaClubIngestMessages(
    messages.map((message) => ({
      roomId: message.roomId,
      messageId: message.id,
      senderAddress: message.sender,
      text: message.text,
      dateMs: message.date,
      source: 'ws-live',
      rawPayloadText: message.rawPayloadText,
    })),
  )
  if (!flags.telegramRelayEnabled) return
  if (!flags.telegramRelayBotToken || !flags.telegramRelayChatId) return

  for (const message of inserted) {
    await sendTelegramRelayMessage({
      botToken: flags.telegramRelayBotToken,
      chatId: flags.telegramRelayChatId,
      messageThreadId: flags.telegramRelayThreadId,
      text: buildTelegramRelayText({
        roomId: message.roomId,
        id: message.messageId,
        date: message.dateMs ?? Date.now(),
        sender: message.senderAddress,
        text: message.text,
        rawPayloadText: message.rawPayloadText ?? null,
      }),
      timeoutMs: flags.sendTimeoutMs,
    })
  }
}

function ensureLiveCommandSocket(params: {
  websocketUrl: string
  roomId: string
  jwt: string
  flags: AlfaClubChatBridgeFlags
}): void {
  if (
    bridgeState.liveSocket &&
    bridgeState.liveSocketJwt === params.jwt &&
    bridgeState.liveSocketRoomId === params.roomId
  ) {
    return
  }

  const WebSocketCtor = (globalThis as { WebSocket?: BridgeWebSocketCtor }).WebSocket
  if (!WebSocketCtor) return

  closeLiveSocket()

  const wsUrl = new URL(params.websocketUrl)
  wsUrl.searchParams.set('TOKEN', params.jwt)
  wsUrl.searchParams.set('_k', '0')

  const socket = new WebSocketCtor(wsUrl.toString())
  bridgeState.liveSocket = socket
  bridgeState.liveSocketJwt = params.jwt
  bridgeState.liveSocketRoomId = params.roomId

  const onMessage = (event?: BridgeWebSocketEvent): void => {
    if (!event) return
    const data = decodeWsEventData(event.data)
    if (!data) return
    let parsed: unknown = null
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    const inboundMessages = extractWsMessagesFromPayload(parsed)
    void ingestLiveMessages(inboundMessages, params.flags).catch(() => {
      // Fail-open: ingest should never block chat command processing.
    })
    if (!bridgeState.liveFallbackActive) return
    const roomMessages = inboundMessages
      .filter((message) => message.roomId === params.roomId)
      .map((message): AlfaClubRoomHistoryMessage => ({
        id: message.id,
        date: message.date,
        sender: message.sender,
        text: message.text,
      }))
    const commands = collectAlfaClubCommandMessages({
      messages: roomMessages,
      seenMessageIds: bridgeState.seenMessageIds,
      selfAddress: TARGET_CANONICAL_CSW_ADDRESS,
    })
    pushLiveCommands(commands)
  }

  const onCloseOrError = (): void => {
    if (bridgeState.liveSocket !== socket) return
    bridgeState.liveSocket = null
    bridgeState.liveSocketJwt = null
    bridgeState.liveSocketRoomId = null
  }

  socket.addEventListener('message', onMessage)
  socket.addEventListener('close', onCloseOrError)
  socket.addEventListener('error', onCloseOrError)
}

async function executeCommandBatch(params: {
  commands: AlfaClubCommandMessage[]
  flags: AlfaClubChatBridgeFlags
  roomId: string
  jwt: string
}): Promise<{ processed: number; replied: number; errors: Array<{ messageId: string; error: string }> }> {
  // Safety invariant: this bridge only posts replies into its configured room.
  if (params.flags.roomId && params.roomId !== params.flags.roomId) {
    return { processed: 0, replied: 0, errors: [] }
  }
  const errors: Array<{ messageId: string; error: string }> = []
  let replied = 0

  for (const command of params.commands) {
    try {
      const result = await executeDeterministicCommand({
        groupId: params.flags.groupId,
        senderWallet: command.sender,
        text: command.text,
        chatId: `alfaclub:${params.roomId}`,
        userId: command.sender,
        emptyResponseFallback: 'No response generated.',
      })
      const responseText = String(result.responseText ?? '').trim()
      if (!responseText) continue
      await sendRoomMessageViaWebSocket({
        websocketUrl: params.flags.websocketUrl,
        jwt: params.jwt,
        roomId: params.roomId,
        text: responseText,
        timeoutMs: params.flags.sendTimeoutMs,
      })
      replied += 1
      await markReadMessage({
        apiBaseUrl: params.flags.apiBaseUrl,
        roomId: params.roomId,
        jwt: params.jwt,
        messageDate: command.date,
        timeoutMs: params.flags.requestTimeoutMs,
      })
    } catch (error) {
      errors.push({
        messageId: command.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    processed: params.commands.length,
    replied,
    errors,
  }
}

async function runBridgeTick(
  flags: AlfaClubChatBridgeFlags,
): Promise<AlfaClubChatBridgeTickResult> {
  const roomId = flags.roomId as string
  const resolvedJwt = await resolveBridgeJwtWithSource(flags.jwt)
  if (!resolvedJwt.jwt) {
    return {
      seeded: false,
      roomId,
      fetched: 0,
      unseen: 0,
      processed: 0,
      replied: 0,
      errors: [],
    }
  }
  let jwt = resolvedJwt.jwt
  if (flags.wsIngestAllRoomsEnabled) {
    ensureLiveCommandSocket({
      websocketUrl: flags.websocketUrl,
      roomId,
      jwt,
      flags,
    })
  }
  let fetchedMessages: AlfaClubRoomHistoryMessage[] | null = null
  let historyError: unknown = null
  try {
    fetchedMessages = await fetchRoomHistory({
      apiBaseUrl: flags.apiBaseUrl,
      roomId,
      jwt,
      limit: flags.historyLimit,
      timeoutMs: flags.requestTimeoutMs,
    })
  } catch (error) {
    const fallbackJwt = (flags.jwt ?? '').trim() || null
    const shouldRetryWithEnv =
      resolvedJwt.source === 'db' &&
      Boolean(fallbackJwt) &&
      fallbackJwt !== resolvedJwt.jwt &&
      isRoomHistory401(error)
    if (!shouldRetryWithEnv) {
      historyError = error
    } else {
      try {
        fetchedMessages = await fetchRoomHistory({
          apiBaseUrl: flags.apiBaseUrl,
          roomId,
          jwt: fallbackJwt as string,
          limit: flags.historyLimit,
          timeoutMs: flags.requestTimeoutMs,
        })
        jwt = fallbackJwt as string
      } catch (fallbackError) {
        historyError = fallbackError
      }
    }
  }

  if (historyError) {
    const canUseLiveFallback = flags.wsLiveFallbackEnabled && isRoomHistory401(historyError)
    if (!canUseLiveFallback) throw historyError

    bridgeState.liveFallbackActive = true
    ensureLiveCommandSocket({
      websocketUrl: flags.websocketUrl,
      roomId,
      jwt,
      flags,
    })
    bridgeState.seeded = true
    const liveCommands = drainLiveCommands()
    const liveBatch = await executeCommandBatch({
      commands: liveCommands,
      flags,
      roomId,
      jwt,
    })
    return {
      seeded: false,
      roomId,
      fetched: 0,
      unseen: liveCommands.length,
      processed: liveBatch.processed,
      replied: liveBatch.replied,
      errors: liveBatch.errors,
    }
  }

  if (!fetchedMessages) {
    throw new Error('room_history_failed:unknown')
  }

  // History read succeeded, so pause live fallback mode if it was enabled.
  if (bridgeState.liveFallbackActive) {
    bridgeState.liveFallbackActive = false
    bridgeState.liveCommandQueue = []
    if (!flags.wsIngestAllRoomsEnabled) {
      closeLiveSocket()
    }
  }

  const unseenMessages = fetchedMessages.filter((message) => {
    const id = String(message.id ?? '').trim()
    return id && !bridgeState.seenMessageIds.has(id)
  })

  for (const message of unseenMessages) {
    const id = String(message.id ?? '').trim()
    if (id) rememberSeenMessageId(id)
  }

  // First tick seeds the dedupe window and intentionally avoids replaying
  // historical commands sent before the bridge started.
  if (!bridgeState.seeded) {
    bridgeState.seeded = true
    return {
      seeded: true,
      roomId,
      fetched: fetchedMessages.length,
      unseen: unseenMessages.length,
      processed: 0,
      replied: 0,
      errors: [],
    }
  }

  const commands = collectAlfaClubCommandMessages({
    messages: unseenMessages,
    seenMessageIds: new Set<string>(),
    selfAddress: TARGET_CANONICAL_CSW_ADDRESS,
  })
  const batch = await executeCommandBatch({
    commands,
    flags,
    roomId,
    jwt,
  })

  return {
    seeded: false,
    roomId,
    fetched: fetchedMessages.length,
    unseen: unseenMessages.length,
    processed: batch.processed,
    replied: batch.replied,
    errors: batch.errors,
  }
}

export function startAlfaClubChatBridge(opts?: {
  onTick?: (result: AlfaClubChatBridgeTickResult) => void
  onError?: (error: unknown) => void
}): StartAlfaClubChatBridgeResult {
  const flags = readAlfaClubChatBridgeFlags()
  const stop = (): void => {
    if (activeHandle !== null) {
      clearInterval(activeHandle)
      activeHandle = null
    }
    closeLiveSocket()
    bridgeState.liveCommandQueue = []
    bridgeState.liveFallbackActive = false
  }

  if (activeHandle !== null) {
    return {
      started: false,
      reason: 'already_running',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
      stop,
    }
  }
  if (flags.killSwitch) {
    return {
      started: false,
      reason: 'kill_switch',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
      stop,
    }
  }
  if (!flags.enabled) {
    return {
      started: false,
      reason: 'disabled',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
      stop,
    }
  }
  if (!flags.roomId) {
    return {
      started: false,
      reason: 'env_missing',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
      stop,
    }
  }

  bridgeState = {
    seeded: false,
    seenMessageIds: new Set<string>(),
    liveCommandQueue: [],
    liveFallbackActive: false,
    liveSocket: null,
    liveSocketJwt: null,
    liveSocketRoomId: null,
  }

  const runTick = async (): Promise<void> => {
    if (activeTickPromise !== null) return
    const tickPromise = (async () => {
      try {
        const result = await runBridgeTick(flags)
        opts?.onTick?.(result)
      } catch (error) {
        opts?.onError?.(error)
      }
    })()
    activeTickPromise = tickPromise
    try {
      await tickPromise
    } finally {
      activeTickPromise = null
    }
  }

  activeHandle = setInterval(() => {
    void runTick()
  }, flags.pollIntervalMs)

  if (typeof (activeHandle as { unref?: () => void }).unref === 'function') {
    ;(activeHandle as { unref: () => void }).unref()
  }

  // Prime immediately to seed dedupe + catch fresh commands without waiting
  // for the first interval tick.
  void runTick()

  return {
    started: true,
    intervalMs: flags.pollIntervalMs,
    roomId: flags.roomId,
    stop,
  }
}

export function _resetAlfaClubChatBridgeStateForTests(): void {
  if (activeHandle !== null) clearInterval(activeHandle)
  activeHandle = null
  activeTickPromise = null
  closeLiveSocket()
  bridgeState = {
    seeded: false,
    seenMessageIds: new Set<string>(),
    liveCommandQueue: [],
    liveFallbackActive: false,
    liveSocket: null,
    liveSocketJwt: null,
    liveSocketRoomId: null,
  }
}
