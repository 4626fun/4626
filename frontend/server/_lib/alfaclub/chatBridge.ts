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

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_API_BASE_URL = 'https://api.alfaclub.app'
const DEFAULT_WS_URL = 'wss://ws.alfaclub.app'
const DEFAULT_POLL_INTERVAL_MS = 6_000
const DEFAULT_HISTORY_LIMIT = 20
const DEFAULT_SEND_TIMEOUT_MS = 10_000
const DEFAULT_WS_CLOSE_DELAY_MS = 75
const MAX_HISTORY_LIMIT = 100
const MAX_SEEN_MESSAGE_IDS = 4_000

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
}

export type AlfaClubCommandMessage = {
  id: string
  date: number
  sender: `0x${string}`
  text: string
}

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

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const raw = (value ?? '').trim()
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
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

async function fetchRoomHistory(params: {
  apiBaseUrl: string
  roomId: string
  jwt: string
  limit: number
}): Promise<AlfaClubRoomHistoryMessage[]> {
  const url = new URL('/api/websocket/room_history_paginate', params.apiBaseUrl)
  url.searchParams.set('roomId', params.roomId)
  url.searchParams.set('limit', String(params.limit))
  url.searchParams.set('forward', 'false')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.jwt}`,
      Accept: 'application/json',
    },
  })
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
}): Promise<void> {
  const url = new URL('/api/websocket/update_read_msg', params.apiBaseUrl)
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
    })
  } catch {
    // Read receipts are best-effort only.
  }
}

async function sendRoomMessageViaWebSocket(params: {
  websocketUrl: string
  jwt: string
  roomId: string
  text: string
  timeoutMs: number
}): Promise<void> {
  type BrowserLikeWebSocket = {
    addEventListener: (event: string, listener: () => void) => void
    removeEventListener: (event: string, listener: () => void) => void
    send: (data: string) => void
    close: () => void
  }
  type BrowserLikeWebSocketCtor = new (url: string) => BrowserLikeWebSocket
  const WebSocketCtor = (globalThis as { WebSocket?: BrowserLikeWebSocketCtor }).WebSocket
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
}

let activeHandle: ReturnType<typeof setInterval> | null = null
let activeTickPromise: Promise<void> | null = null
let bridgeState: BridgeState = {
  seeded: false,
  seenMessageIds: new Set<string>(),
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

async function runBridgeTick(
  flags: AlfaClubChatBridgeFlags,
): Promise<AlfaClubChatBridgeTickResult> {
  const roomId = flags.roomId as string
  const jwt = flags.jwt as string
  const fetchedMessages = await fetchRoomHistory({
    apiBaseUrl: flags.apiBaseUrl,
    roomId,
    jwt,
    limit: flags.historyLimit,
  })

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

  let replied = 0
  const errors: Array<{ messageId: string; error: string }> = []

  for (const command of commands) {
    try {
      const result = await executeDeterministicCommand({
        groupId: flags.groupId,
        senderWallet: command.sender,
        text: command.text,
        chatId: `alfaclub:${roomId}`,
        userId: command.sender,
        emptyResponseFallback: 'No response generated.',
      })
      const responseText = String(result.responseText ?? '').trim()
      if (!responseText) continue
      await sendRoomMessageViaWebSocket({
        websocketUrl: flags.websocketUrl,
        jwt,
        roomId,
        text: responseText,
        timeoutMs: flags.sendTimeoutMs,
      })
      replied += 1
      await markReadMessage({
        apiBaseUrl: flags.apiBaseUrl,
        roomId,
        jwt,
        messageDate: command.date,
      })
    } catch (error) {
      errors.push({
        messageId: command.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    seeded: false,
    roomId,
    fetched: fetchedMessages.length,
    unseen: unseenMessages.length,
    processed: commands.length,
    replied,
    errors,
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
  if (!flags.roomId || !flags.jwt) {
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
  bridgeState = {
    seeded: false,
    seenMessageIds: new Set<string>(),
  }
}
