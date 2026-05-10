/**
 * AlfaClub Room Chat Bridge — control plane.
 *
 * Bridges AlfaClub in-app room commands into Keepr's deterministic command
 * executor and posts responses back through AlfaClub's websocket transport.
 *
 * Transport facts (captured from live AlfaClub web client):
 * - Read history: GET /api/websocket/room_history_paginate?roomId=...&limit=...&forward=false
 * - Mark read:   POST /api/websocket/update_read_msg
 * - Send text:   WS frame {"type":"message","value":{"room":"<id>","text":"...","attachments":[]}}
 *
 * ## Module boundary (read this before adding imports)
 *
 * This file is the AlfaClub control plane. It owns:
 *   - room history polling + websocket ingest,
 *   - read-receipt + outbound send,
 *   - reading the active chat JWT from `chatTokenStore`,
 *   - dispatching matched slash commands into the deterministic executor.
 *
 * It does NOT own:
 *   - creative reply generation (`/hermit`, `/meme`, `/gmeow`) — those are
 *     delegated to the Hermit / Pinata creative lane (`hermit/skillRouter.ts`)
 *     via the deterministic executor's `hermit` family branch. The Pinata
 *     agent itself runs out-of-process; only its API endpoint + bearer
 *     are wired here through `HERMIT_PINATA_*` env.
 *   - Privy session-token rotation — that is the canonical Vercel cron at
 *     `/api/v1/alfaclub/chat-token-refresh`. The bridge reads the rotated
 *     `chat_jwt` row but does not write it.
 */

import { executeDeterministicCommand } from '../../agent/core/executeDeterministicCommand.js'
import { matchesAnyCommandFamily } from '../../commands/registry.js'
import { TARGET_CANONICAL_CSW_ADDRESS } from '../../../src/wallet/canonicalWalletPolicy.js'
import { logger } from '../infra/logger.js'
import WebSocket from 'ws'
import {
  recordBridgeAuthFailure,
  recordBridgeCfChallenge,
  recordBridgeCfChallengeRecovered,
  recordBridgeHistorySuccess,
  recordBridgeSocketBackoff,
  recordBridgeSuppressedSocketAttempt,
} from './authHealthStore.js'
import { upsertAlfaClubIngestMessages } from './chatIngestStore.js'
import { readAlfaClubChatToken } from './chatTokenStore.js'
import { requestImmediatePrivyRefresh } from './privyTokenRefresher.js'

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
const DEFAULT_WS_CLOSE_DELAY_MS = 1_000
const MAX_HISTORY_LIMIT = 100
const MAX_SEEN_MESSAGE_IDS = 4_000
const MAX_LIVE_COMMAND_QUEUE = 200
const MAX_TELEGRAM_MESSAGE_CHARS = 3500
const BAD_JWT_TTL_MS = 30_000
const SOCKET_BACKOFF_INITIAL_MS = 1_000
const SOCKET_BACKOFF_CAP_MS = 60_000
const LOG_ROLLUP_WINDOW_MS = 60_000

type AlfaClubRoomHistoryMessage = {
  id?: string
  date?: number
  sender?: string
  text?: string
  attachments?: unknown
  reply_attachments?: unknown
}

type AlfaClubRoomHistoryResponse = {
  messages?: AlfaClubRoomHistoryMessage[]
}

export type AlfaClubMessageAttachment = {
  url: string
  dims?: [number, number]
  type: string
  filename?: string
  mime_type?: string
  size?: number
  preview?: string
  duration?: number
}

type AlfaClubOutboundFrame = {
  type: 'message'
  value: {
    room: string
    text: string
    attachments: AlfaClubMessageAttachment[]
  }
}

export type AlfaClubChatBridgeFlags = {
  killSwitch: boolean
  enabled: boolean
  roomId: string | null
  jwt: string | null
  ingestJwt: string | null
  botToken: string | null
  apiBaseUrl: string
  /**
   * Optional proxy origin for AlfaClub HTTP API calls
   * (`/api/websocket/room_history_paginate` + `/api/websocket/update_read_msg`).
   *
   * Why this exists: AlfaClub's API origin is fronted by Cloudflare,
   * which has been observed to 403 (CF error 1010) requests from
   * Vercel's serverless egress IPs even with a fully-spec'd browser
   * fingerprint (see PR #491 + this PR). When that happens, an
   * operator can stand up a tiny relay (Cloudflare Worker, fly.io,
   * Railway service that does NOT enable
   * `ALFACLUB_CHAT_BRIDGE_ENABLED`, etc.) and point the Vercel
   * bridge at it via `ALFACLUB_CHAT_API_PROXY_URL`.
   *
   * Contract for the proxy:
   *   - Accept GET `/api/websocket/room_history_paginate?...` and
   *     POST `/api/websocket/update_read_msg` at the same paths.
   *   - Pass the request through unchanged (same query, same
   *     Authorization header, same body, SAME `Origin`/`Referer`/
   *     `Sec-Fetch-Site` headers) to `https://api.alfaclub.app`.
   *   - Return the upstream response unchanged (status, headers,
   *     JSON body).
   *   - The proxy MUST NOT consume the AlfaClub command/reply path
   *     (no posting back into the room). Vercel remains the
   *     canonical command processor.
   *
   * Routing-vs-fingerprint contract: even when this proxy is set,
   * the bridge keeps the upstream AlfaClub browser-fingerprint
   * triplet (`Origin: https://alfaclub.app`, `Referer:
   * https://alfaclub.app/`, `Sec-Fetch-Site: same-site`) on the
   * outgoing request so the upstream Cloudflare WAF on
   * `api.alfaclub.app` sees the same fingerprint it would on a
   * direct call. The proxy's job is byte-faithful forwarding to
   * the upstream — it MUST NOT strip, rewrite, or override the
   * `Origin`/`Referer`/`Sec-Fetch-Site` headers (doing so would
   * weaken the fingerprint and re-trigger the original 1010 ban).
   *
   * Set as `https://relay.example.com` (origin only). When unset,
   * the bridge calls `apiBaseUrl` directly.
   */
  apiProxyUrl: string | null
  /**
   * Shared secret sent only to the configured proxy. Never forwarded
   * to AlfaClub directly.
   */
  apiProxySecret: string | null
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
  attachments: AlfaClubMessageAttachment[]
  replyAttachments: AlfaClubMessageAttachment[]
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

export type RunAlfaClubChatBridgeTickOnceResult =
  | {
      ok: true
      intervalMs: number
      roomId: string
      data: AlfaClubChatBridgeTickResult
    }
  | {
      ok: false
      reason: AlfaClubChatBridgeSkipReason
      intervalMs: number
      roomId: string | null
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

/**
 * Optional `ALFACLUB_CHAT_API_PROXY_URL` parser. Returns the proxy
 * origin if set and valid, `null` otherwise. HTTPS-only — refusing
 * to send the bot's `Authorization: Bearer <chat_jwt>` to a
 * cleartext relay is a hard rule.
 */
function normalizeApiProxyUrl(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    return `${url.origin}`
  } catch {
    return null
  }
}

function normalizeApiProxySecret(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  return value || null
}

function normalizeAlfaClubBotToken(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  return value || null
}

/**
 * Pick the URL the bridge should hit for an AlfaClub HTTP API call
 * (the *routing* URL — where the request is actually sent).
 *
 * If the operator has configured `ALFACLUB_CHAT_API_PROXY_URL`, use
 * it (proxy must implement the same paths and forward to AlfaClub
 * — see the doc comment on `AlfaClubChatBridgeFlags.apiProxyUrl`).
 * Otherwise fall back to `apiBaseUrl` (typically
 * `https://api.alfaclub.app`).
 *
 * NOTE: The routing URL is intentionally distinct from the
 * *fingerprint* base used to derive `Origin`/`Referer`/`Sec-Fetch-Site`
 * — see `resolveAlfaClubFingerprintBaseUrl`. With a proxy in front of
 * `https://api.alfaclub.app`, the request still represents itself as
 * coming from the alfaclub.app web client; the proxy forwards
 * unchanged, so the upstream Cloudflare WAF must see the same
 * browser-fingerprint headers it would on a direct call.
 *
 * Exported for tests. Production callers always pass the full
 * `flags` object.
 */
export function resolveAlfaClubApiCallBaseUrl(flags: {
  apiBaseUrl: string
  apiProxyUrl: string | null
}): string {
  return flags.apiProxyUrl ?? flags.apiBaseUrl
}

/**
 * Pick the URL whose hostname determines the browser-fingerprint
 * triplet (`Origin`/`Referer`/`Sec-Fetch-Site`) for an AlfaClub HTTP
 * API call.
 *
 * Routing-vs-fingerprint separation: when
 * `ALFACLUB_CHAT_API_PROXY_URL` is configured the bridge sends the
 * HTTP request to the proxy (the routing URL), but the upstream
 * Cloudflare WAF on `api.alfaclub.app` still inspects the
 * `Origin`/`Referer`/`Sec-Fetch-Site` triplet. The proxy contract
 * (see `AlfaClubChatBridgeFlags.apiProxyUrl`) is "forward unchanged"
 * — so the fingerprint must be derived from the upstream AlfaClub
 * API base, not from the proxy origin (which would yield `{}` for
 * an unknown host and weaken the fingerprint).
 *
 * Resolution order:
 *   - `apiBaseUrl` is always the canonical upstream AlfaClub base
 *     (defaults to `https://api.alfaclub.app`); use it as the
 *     fingerprint source.
 *   - When the operator points the bridge at a custom non-AlfaClub
 *     `apiBaseUrl` (staging API, localhost replay) with NO proxy,
 *     `resolveAlfaClubOriginHeaders` will return `{}` for the
 *     unknown host — preserving the safe behavior of not emitting
 *     a contradictory `Origin: https://alfaclub.app` to a host that
 *     has nothing to do with alfaclub.app.
 *
 * Exported for tests.
 */
export function resolveAlfaClubFingerprintBaseUrl(flags: {
  apiBaseUrl: string
  apiProxyUrl: string | null
}): string {
  return flags.apiBaseUrl
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
    ingestJwt: (process.env.ALFACLUB_CHAT_INGEST_JWT ?? '').trim() || null,
    botToken: normalizeAlfaClubBotToken(
      process.env.ALFACLUB_API_KEY ??
        process.env.alfaclub_api_key ??
        process.env.ALFACLUB_BOT_TOKEN,
    ),
    apiBaseUrl: normalizeApiBaseUrl(process.env.ALFACLUB_CHAT_API_BASE_URL),
    apiProxyUrl: normalizeApiProxyUrl(process.env.ALFACLUB_CHAT_API_PROXY_URL),
    apiProxySecret: normalizeApiProxySecret(process.env.ALFACLUB_CHAT_API_PROXY_SECRET),
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
  attachments?: unknown
}): AlfaClubOutboundFrame {
  return {
    type: 'message',
    value: {
      room: params.roomId,
      text: params.text,
      attachments: normalizeAlfaClubAttachments(params.attachments),
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
  return {
    id,
    date,
    sender,
    text,
    attachments: normalizeAlfaClubAttachments(message.attachments),
    replyAttachments: normalizeAlfaClubAttachments(message.reply_attachments),
  }
}

function byChronologicalOrder(a: NormalizedHistoryMessage, b: NormalizedHistoryMessage): number {
  if (a.date === b.date) return a.id.localeCompare(b.id)
  return a.date - b.date
}

function isAlfaClubSlashCommandText(text: string): boolean {
  if (!text.trimStart().startsWith('/')) return false
  return matchesAnyCommandFamily(text, ['alfaclub', 'hermit'])
}

/**
 * Trusted senders allowed to invoke a small set of slash commands without
 * the leading slash. Currently only Manito9v9 → bare `gmeow`. Keep this list
 * tiny and exact; broader keyword triggers belong behind a slash prefix so
 * unrelated chatter that happens to begin with `gmeow`/`meme`/`hermit` does
 * not get routed to the agent.
 */
const BARE_GMEOW_TRUSTED_SENDERS: ReadonlySet<string> = new Set([
  '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
])

function isBareGmeowFromTrustedSender(rawText: string, senderLower: string): boolean {
  if (!BARE_GMEOW_TRUSTED_SENDERS.has(senderLower)) return false
  return rawText.trim().toLowerCase() === 'gmeow'
}

/**
 * Outbound reply texts the bridge MUST NOT send back into an AlfaClub
 * room. Today's only entry is the deterministic-executor's
 * `'Hermit access denied.'` access-denied string from
 * `frontend/server/commands/execute.ts`. Under current main, that
 * string cannot reach this code path for an AlfaClub chatId — the
 * `isAlfaClubChatId` short-circuit added in PR #467 prevents it. We
 * still match defensively because a stale build of this bridge
 * (Railway image pre-#467) running against the same room reaches
 * this code path with the deny string in `responseText` and posts it
 * back as a `keepr4626bot` reply. Suppressing here means the user
 * never sees a misleading "Hermit access denied." even when the
 * surrounding stack is misconfigured — the canonical Vercel-cron
 * bridge keeps serving normally on its next tick.
 *
 * Match is exact-trim + lowercase to be tolerant of upstream
 * formatting drift (e.g. trailing whitespace, casing). The list is
 * intentionally tiny; broader heuristics belong in the executor,
 * not this leaf.
 */
const SUPPRESSED_BRIDGE_REPLY_TEXTS: ReadonlySet<string> = new Set([
  'hermit access denied.',
  'hermit access denied',
])

function shouldSuppressDeterministicReply(responseText: string): boolean {
  const normalized = responseText.trim().toLowerCase()
  if (!normalized) return false
  return SUPPRESSED_BRIDGE_REPLY_TEXTS.has(normalized)
}

/** Exposed for unit tests. */
export const _shouldSuppressDeterministicReplyForTests = shouldSuppressDeterministicReply

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
    if (!isHexAddress(entry.sender)) continue
    if (self && entry.sender === self) continue
    if (entry.sender === TARGET_CANONICAL_CSW_ADDRESS.toLowerCase()) continue
    const trustedBareGmeow = isBareGmeowFromTrustedSender(entry.text, entry.sender)
    if (!trustedBareGmeow && !isAlfaClubSlashCommandText(entry.text)) continue
    commands.push({
      id: entry.id,
      date: entry.date,
      sender: entry.sender,
      text: trustedBareGmeow ? '/gmeow' : entry.text.trim(),
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
  attachments: AlfaClubMessageAttachment[]
  replyAttachments: AlfaClubMessageAttachment[]
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

function getBridgeWebSocketCtor(): BridgeWebSocketCtor | null {
  const nativeCtor = (globalThis as { WebSocket?: BridgeWebSocketCtor }).WebSocket
  if (nativeCtor) return nativeCtor
  return WebSocket as unknown as BridgeWebSocketCtor
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

function normalizeAlfaClubAttachments(value: unknown): AlfaClubMessageAttachment[] {
  if (!Array.isArray(value)) return []
  const out: AlfaClubMessageAttachment[] = []
  for (const entry of value) {
    if (!isJsonRecord(entry)) continue
    const url = typeof entry.url === 'string' ? entry.url.trim() : ''
    const type = typeof entry.type === 'string' ? entry.type.trim() : ''
    if (!url || !type) continue
    const attachment: AlfaClubMessageAttachment = { url, type }
    if (
      Array.isArray(entry.dims) &&
      entry.dims.length >= 2 &&
      Number.isFinite(Number(entry.dims[0])) &&
      Number.isFinite(Number(entry.dims[1]))
    ) {
      attachment.dims = [Number(entry.dims[0]), Number(entry.dims[1])]
    }
    if (typeof entry.filename === 'string') attachment.filename = entry.filename
    if (typeof entry.mime_type === 'string') attachment.mime_type = entry.mime_type
    if (Number.isFinite(Number(entry.size))) attachment.size = Number(entry.size)
    if (typeof entry.preview === 'string') attachment.preview = entry.preview
    if (Number.isFinite(Number(entry.duration))) attachment.duration = Number(entry.duration)
    out.push(attachment)
  }
  return out
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
    if (
      isJsonRecord(node.value) &&
      !('room' in node) &&
      !('sender' in node) &&
      !('address' in node) &&
      !('wallet' in node) &&
      !('senderAddress' in node) &&
      !('text' in node) &&
      !('attachments' in node) &&
      !('reply_attachments' in node) &&
      !('id' in node) &&
      !('messageId' in node)
    ) {
      continue
    }

    const text = pickFirstString([node.text, isJsonRecord(node.value) ? node.value.text : null])
      ?? (typeof node.text === 'string' || (isJsonRecord(node.value) && typeof node.value.text === 'string') ? '' : null)
    const attachments = normalizeAlfaClubAttachments([
      ...normalizeAlfaClubAttachments(node.attachments),
      ...normalizeAlfaClubAttachments(isJsonRecord(node.value) ? node.value.attachments : null),
    ])
    const replyAttachments = normalizeAlfaClubAttachments([
      ...normalizeAlfaClubAttachments(node.reply_attachments),
      ...normalizeAlfaClubAttachments(isJsonRecord(node.value) ? node.value.reply_attachments : null),
    ])
    if (text === null && attachments.length === 0 && replyAttachments.length === 0) continue
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
      text: text ?? '',
      attachments,
      replyAttachments,
      rawPayloadText,
    })
  }

  return out
}

export function extractAlfaClubWsMessagesForTest(payload: unknown): AlfaClubLiveInboundMessage[] {
  return extractWsMessagesFromPayload(payload)
}

function extractAlfaClubActionAttachments(action: unknown): AlfaClubMessageAttachment[] {
  if (!isJsonRecord(action)) return []
  const actionName = typeof action.action === 'string' ? action.action : ''
  if (actionName !== 'hermit.command' && actionName !== 'alfaclub.message.attachments') return []
  return normalizeAlfaClubAttachments(action.attachments)
}

/**
 * AlfaClub's API origin (`api.alfaclub.app`) is fronted by Cloudflare,
 * which blocks "browser-signature-banned" non-browser User-Agents with
 * HTTP 403 (CF error 1010). Production evidence 2026-05-01: the
 * deployed bridge sent only `Authorization` + `Accept`, Cloudflare
 * rejected with 403, the 403 was funnelled through
 * `wsLiveFallbackEnabled` and surfaced as a clean `fetched:0` tick —
 * silently masking the failure for the operator.
 *
 * Origin-agnostic browser-like headers we ALWAYS send. These don't
 * cross-reference a specific host, so they're safe to attach to any
 * AlfaClub API target (production, staging proxy, localhost replay).
 * Nothing here is secret: stable Chromium UA + a standard Accept
 * triple + the universally-applicable Sec-Fetch-Mode/Dest pair the
 * alfaclub.app web client sends.
 */
const ALFACLUB_API_COMMON_BROWSER_HEADERS: Record<string, string> = {
  // Stable Chromium UA. Bumping it is fine; the only constraint is
  // "not the default Node fetch UA", which Cloudflare's
  // browser-integrity check rejects. The major version below
  // matches the `sec-ch-ua` declarations to avoid an inconsistent
  // browser fingerprint.
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  // Most production fetches transparently negotiate gzip/deflate;
  // omitting the header lets Cloudflare downgrade to identity, which
  // is itself a small fingerprint signal. Match the alfaclub.app
  // web client's negotiated set.
  'Accept-Encoding': 'gzip, deflate, br',
  // Client-Hints `sec-ch-ua` triple. Cloudflare's bot-management
  // checks read these for the Chromium-major and platform fields and
  // flag inconsistency between UA + sec-ch-ua as a bot signal. Pin
  // them to match the UA's Chrome/124 + macOS triple above.
  'sec-ch-ua':
    '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  // `Sec-Fetch-Mode` and `Sec-Fetch-Dest` are origin-agnostic and
  // describe the request *kind*, not a relationship to a specific
  // page origin — they're safe to send to any host.
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
}

/**
 * Hosts whose `api.<x>` AlfaClub-family API the bridge knows about.
 * Bumping the list is OK; the production default is `alfaclub.app`.
 *
 * The pattern is: when the API base URL host is `api.<page>` for some
 * `<page>` in this set, the alfaclub.app web client sends:
 *   Origin: https://<page>
 *   Referer: https://<page>/
 *   Sec-Fetch-Site: same-site
 * That's the fingerprint Cloudflare checks for. Mirroring it stays in
 * the WAF allowlist.
 *
 * For anything outside the set (staging proxy, localhost replay,
 * unknown CDN), we omit Origin/Referer/Sec-Fetch-Site rather than
 * sending a contradictory `Origin: https://alfaclub.app` to a host
 * that has nothing to do with alfaclub.app — that fingerprint would
 * itself look fishy and could fail more aggressive WAFs / CORS
 * checks.
 */
const ALFACLUB_KNOWN_PAGE_HOSTS: ReadonlySet<string> = new Set(['alfaclub.app'])

type AlfaClubOriginHeaders = {
  Origin?: string
  Referer?: string
  'Sec-Fetch-Site'?: string
}

/**
 * Resolve the origin/referer/Sec-Fetch-Site triplet for an AlfaClub
 * API request. Returns an empty object for hosts not on the known
 * AlfaClub-family list.
 */
export function resolveAlfaClubOriginHeaders(apiBaseUrl: string): AlfaClubOriginHeaders {
  let parsed: URL
  try {
    parsed = new URL(apiBaseUrl)
  } catch {
    return {}
  }
  const host = parsed.hostname.toLowerCase()
  if (!host) return {}

  // Strip a leading `api.` and check if what's left is a known
  // AlfaClub page host. e.g. `api.alfaclub.app` → `alfaclub.app`.
  const pageHost = host.startsWith('api.') ? host.slice('api.'.length) : host
  if (!ALFACLUB_KNOWN_PAGE_HOSTS.has(pageHost)) return {}

  // The web client always uses HTTPS for `alfaclub.app`. Pin it
  // explicitly so a misconfigured `http://api.alfaclub.app` doesn't
  // produce an `Origin: http://alfaclub.app` that the WAF might
  // flag as a downgrade.
  const origin = `https://${pageHost}`
  return {
    Origin: origin,
    Referer: `${origin}/`,
    // `same-site`: the API host (`api.alfaclub.app`) and the page
    // host (`alfaclub.app`) share the registrable domain. If a
    // future deploy ever routes the API through the page host
    // itself, switch to `same-origin` — but that requires a code
    // change, by design.
    'Sec-Fetch-Site': 'same-site',
  }
}

/**
 * Build the header bag for an authenticated AlfaClub API request.
 * Always returns a fresh object (callers must be free to add their
 * own per-request headers, e.g. `Content-Type` for POST bodies).
 *
 * The browser-fingerprint triplet (Origin/Referer/Sec-Fetch-Site) is
 * derived from `fingerprintBaseUrl`, which is INTENTIONALLY decoupled
 * from the routing URL the request is sent to:
 *
 *   - Direct call to the default AlfaClub API base
 *     (`https://api.alfaclub.app`): fingerprint base = same =
 *     emits `Origin: https://alfaclub.app` etc.
 *   - Direct call to a custom non-AlfaClub base (staging API,
 *     localhost replay): fingerprint base = same unknown host =
 *     omits Origin/Referer/Sec-Fetch-Site (we never emit a
 *     contradictory `Origin: https://alfaclub.app` to a host that
 *     has nothing to do with alfaclub.app).
 *   - Proxy routing
 *     (`ALFACLUB_CHAT_API_PROXY_URL=https://relay.example.com`)
 *     with the default upstream AlfaClub base: routing URL =
 *     proxy, fingerprint base = `https://api.alfaclub.app`. The
 *     proxy is documented to forward unchanged to
 *     `api.alfaclub.app`, so the upstream Cloudflare WAF must see
 *     the full browser fingerprint. Pre-fix, `buildAlfaClubApiHeaders`
 *     derived the triplet from the proxy origin (an unknown host),
 *     producing `{}` and weakening the fingerprint — defeating the
 *     point of the proxy escape hatch.
 *
 * The remaining headers (UA, Accept, Accept-Encoding, sec-ch-ua*,
 * Sec-Fetch-Mode, Sec-Fetch-Dest) are origin-agnostic and stay in
 * place regardless of routing/fingerprint base.
 */
function buildAlfaClubApiHeaders(params: {
  jwt: string
  fingerprintBaseUrl: string
  proxySecret?: string | null
}): Record<string, string> {
  const proxySecret = (params.proxySecret ?? '').trim()
  return {
    ...ALFACLUB_API_COMMON_BROWSER_HEADERS,
    ...resolveAlfaClubOriginHeaders(params.fingerprintBaseUrl),
    Authorization: `Bearer ${params.jwt}`,
    ...(proxySecret ? { 'x-proxy-secret': proxySecret } : {}),
  }
}

/** Exposed for unit tests — common (origin-agnostic) headers. */
export const _ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS = ALFACLUB_API_COMMON_BROWSER_HEADERS

/**
 * Strip JWT-shaped substrings, Bearer headers, and long opaque
 * base64url runs from a string before it gets logged or surfaced in
 * `tick.errors[]`. Same shape as the auth-health-store redactor; we
 * duplicate the small implementation here to keep the bridge module
 * self-contained.
 */
function redactForDiagnostics(input: string): string {
  if (!input) return ''
  let out = String(input)
  out = out.replace(
    /\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g,
    '<redacted-jwt>',
  )
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1<redacted>')
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<redacted-opaque>')
  return out
}

/**
 * Extract a tiny, sanitized diagnostic suffix from a non-2xx
 * response. The suffix is appended to the `room_history_failed:<status>`
 * error message so an operator polling
 * `/api/v1/alfaclub/chat-bridge-run` sees enough to distinguish:
 *
 *   - Cloudflare browser-signature ban (HTML body, `cf-ray`, optional
 *     `cf-cache-status`, `cf-mitigated`, `Cf-Error-Code: 1010`).
 *   - AlfaClub structured JSON `{ "error": "...", "code": "..." }`.
 *   - Bare HTML / unknown shape (capture only first 120 chars,
 *     redacted, single-line).
 *
 * Always returns a short string ≤ 200 chars. Never includes the
 * original Authorization header or any JWT material. Header values
 * are length-bounded (cf-ray ids are ~16 chars).
 */
async function extractRoomHistoryErrorDetail(response: Response): Promise<string> {
  const parts: string[] = []
  // Cloudflare-mitigation headers, if present. cf-ray is the
  // request-id Cloudflare attaches to every response and is the
  // single most useful field for cross-checking with their dashboard.
  const cfRay = response.headers.get('cf-ray')
  if (cfRay) parts.push(`cf-ray=${cfRay.slice(0, 32)}`)
  const cfMitigated = response.headers.get('cf-mitigated')
  if (cfMitigated) parts.push(`cf-mitigated=${cfMitigated.slice(0, 24)}`)
  const cfErrorCode = response.headers.get('cf-error-code')
  if (cfErrorCode) parts.push(`cf-error-code=${cfErrorCode.slice(0, 8)}`)
  const contentType = response.headers.get('content-type')
  if (contentType) parts.push(`content-type=${contentType.split(';')[0]?.slice(0, 40) ?? ''}`)

  let bodyText = ''
  try {
    bodyText = (await response.text()).trim()
  } catch {
    bodyText = ''
  }

  if (bodyText) {
    // JSON-ish body: try to pluck `code` and `error`/`message` fields
    // by regex (avoids parse-failure branches; the body may be
    // truncated/garbled).
    const codeMatch = /"code"\s*:\s*"([A-Za-z0-9_.-]{1,64})"/.exec(bodyText)
    if (codeMatch?.[1]) parts.push(`code=${codeMatch[1]}`)
    const errorMatch = /"error"\s*:\s*"([^"]{1,80})"/.exec(bodyText)
    if (errorMatch?.[1]) {
      parts.push(`error="${redactForDiagnostics(errorMatch[1]).slice(0, 80)}"`)
    } else {
      const messageMatch = /"message"\s*:\s*"([^"]{1,80})"/.exec(bodyText)
      if (messageMatch?.[1]) {
        parts.push(`message="${redactForDiagnostics(messageMatch[1]).slice(0, 80)}"`)
      }
    }

    // Cloudflare-style HTML body: scan for the textual error code marker.
    if (/Cloudflare/i.test(bodyText) || /cf-error-code/i.test(bodyText)) {
      parts.push('cloudflare=true')
      const htmlErrorCode = /Error\s*(\d{3,4})/i.exec(bodyText)
      if (htmlErrorCode?.[1]) parts.push(`html-error-code=${htmlErrorCode[1]}`)
    }

    // Final fallback: short body excerpt (single-line, redacted).
    if (parts.length === 0 || parts.every((p) => !p.startsWith('error=') && !p.startsWith('message='))) {
      const oneLine = bodyText.replace(/\s+/g, ' ').slice(0, 120)
      parts.push(`body="${redactForDiagnostics(oneLine).slice(0, 120)}"`)
    }
  }

  return parts.join(' ').slice(0, 200)
}

async function fetchRoomHistory(params: {
  /** URL the HTTP request is actually sent to (proxy or direct API base). */
  apiBaseUrl: string
  /**
   * URL whose hostname determines the browser-fingerprint triplet
   * (Origin/Referer/Sec-Fetch-Site). When `apiBaseUrl` is a proxy
   * origin (set via `ALFACLUB_CHAT_API_PROXY_URL`), pass the
   * upstream AlfaClub API base here so the WAF on the upstream still
   * sees a full browser fingerprint. Defaults to `apiBaseUrl` for
   * callers that don't know about the proxy split.
   */
  fingerprintBaseUrl?: string
  /** Shared secret for the proxy gate. Omit on direct upstream calls. */
  proxySecret?: string | null
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
      headers: buildAlfaClubApiHeaders({
        jwt: params.jwt,
        fingerprintBaseUrl: params.fingerprintBaseUrl ?? params.apiBaseUrl,
        proxySecret: params.proxySecret,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`room_history_failed:timeout:${message}`)
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    // Capture sanitized detail (Cloudflare cf-ray, error code,
    // structured JSON code/message) so the tick.errors[] entry
    // tells the operator WHY the fetch was rejected — not just the
    // bare HTTP status.
    const detail = await extractRoomHistoryErrorDetail(response)
    const suffix = detail ? `:${detail}` : ''
    throw new Error(`room_history_failed:${response.status}${suffix}`)
  }
  const body = (await response.json()) as AlfaClubRoomHistoryResponse
  return Array.isArray(body.messages) ? body.messages : []
}

async function markReadMessage(params: {
  /** URL the HTTP request is actually sent to (proxy or direct API base). */
  apiBaseUrl: string
  /**
   * URL whose hostname determines the browser-fingerprint triplet.
   * Same routing-vs-fingerprint contract as `fetchRoomHistory`.
   * Defaults to `apiBaseUrl`.
   */
  fingerprintBaseUrl?: string
  /** Shared secret for the proxy gate. Omit on direct upstream calls. */
  proxySecret?: string | null
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
        ...buildAlfaClubApiHeaders({
          jwt: params.jwt,
          fingerprintBaseUrl: params.fingerprintBaseUrl ?? params.apiBaseUrl,
          proxySecret: params.proxySecret,
        }),
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

function truncateAlfaClubBotMessage(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= 2_000) return trimmed
  return `${trimmed.slice(0, 1_997)}...`
}

function buildBotMessageIdempotencyKey(params: {
  roomId: string
  messageId: string
}): string {
  const raw = `alfaclub-bridge:${params.roomId}:${params.messageId}`
  return raw.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 128)
}

async function sendRoomMessageViaBotToken(params: {
  apiBaseUrl: string
  botToken: string
  roomId: string
  text: string
  idempotencyKey: string
  timeoutMs: number
}): Promise<void> {
  const url = new URL(`/api/room/${encodeURIComponent(params.roomId)}/message`, params.apiBaseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.botToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        body: truncateAlfaClubBotMessage(params.text),
      }),
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`bot_message_failed:timeout:${message}`)
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    const detail = redactForDiagnostics(bodyText.replace(/\s+/g, ' ').slice(0, 160))
    throw new Error(`bot_message_failed:${response.status}${detail ? `:${detail}` : ''}`)
  }
}

async function sendRoomMessageViaWebSocket(params: {
  websocketUrl: string
  jwt: string
  roomId: string
  text: string
  attachments?: unknown
  timeoutMs: number
}): Promise<void> {
  const WebSocketCtor = getBridgeWebSocketCtor()
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
      attachments: params.attachments,
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

type RollupTimer = ReturnType<typeof setTimeout> | null

const bridgeAuthState = {
  lastBadJwt: null as string | null,
  lastBadJwtAt: 0,
  lastBadJwtWarnAt: Number.NEGATIVE_INFINITY,
  badJwtTtlMs: BAD_JWT_TTL_MS,
  socketBackoffMs: 0,
  socketBackoffUntil: 0,
  authFailRepeats: 0,
  authFailFirstAt: 0,
  authFailLastLoggedAt: Number.NEGATIVE_INFINITY,
  authFailFlushTimer: null as RollupTimer,
  authFailRoomId: null as string | null,
  authFailJwtSource: null as BridgeJwtSource | null,
  authFailLastError: null as string | null,
  wsErrorRepeats: 0,
  wsErrorFirstAt: 0,
  wsErrorLastLoggedAt: Number.NEGATIVE_INFINITY,
  wsErrorFlushTimer: null as RollupTimer,
  wsErrorRoomId: null as string | null,
  wsErrorLastMessage: null as string | null,
  cfChallengeRepeats: 0,
  cfChallengeFirstAt: 0,
  cfChallengeFirstCfRay: null as string | null,
  cfChallengeFlushTimer: null as RollupTimer,
  cfChallengeRoomId: null as string | null,
  cfChallengeLastCfRay: null as string | null,
  cfChallengeLastHtmlErrorCode: null as string | null,
  cfChallengeSustainedFlagged: false,
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

function isRoomHistoryAuthError(error: unknown): boolean {
  // 401 = no/invalid token; 403 = token authenticated but lacks permission
  // for this room or has been revoked. Both indicate the JWT in use needs
  // to be rotated (DB → env fallback) or, failing that, that we should
  // drop into the websocket live-fallback path until a fresh refresh.
  //
  // Match by `startsWith(...)` so the new sanitized-detail suffix
  // appended by `extractRoomHistoryErrorDetail` (e.g.
  // `room_history_failed:403:cf-ray=...`) does NOT prevent the
  // retry-on-env-jwt and WS-fallback paths from firing.
  const message = (error instanceof Error ? error.message : String(error)).trim()
  return (
    message === 'room_history_failed:401' ||
    message === 'room_history_failed:403' ||
    message.startsWith('room_history_failed:401:') ||
    message.startsWith('room_history_failed:403:')
  )
}

function isCloudflareChallengeError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).trim()
  if (!message.startsWith('room_history_failed:403:')) return false
  return (
    /\bcf-mitigated=challenge\b/.test(message) ||
    /\bcloudflare=true\b/.test(message) ||
    /\bhtml-error-code=10\d{2}\b/.test(message) ||
    /Just a moment/i.test(message)
  )
}

type HistoryErrorKind = 'cf_challenge' | 'auth' | 'other'

function classifyHistoryError(error: unknown): HistoryErrorKind {
  if (isCloudflareChallengeError(error)) return 'cf_challenge'
  if (isRoomHistoryAuthError(error)) return 'auth'
  return 'other'
}

function isKnownBadJwt(jwt: string, now = Date.now()): boolean {
  return (
    Boolean(bridgeAuthState.lastBadJwt) &&
    bridgeAuthState.lastBadJwt === jwt &&
    now - bridgeAuthState.lastBadJwtAt <= bridgeAuthState.badJwtTtlMs
  )
}

function rememberBadJwt(jwt: string, now = Date.now()): void {
  bridgeAuthState.lastBadJwt = jwt
  bridgeAuthState.lastBadJwtAt = now
}

function clearBadJwt(): void {
  bridgeAuthState.lastBadJwt = null
  bridgeAuthState.lastBadJwtAt = 0
}

function applySocketBackoff(now = Date.now()): void {
  bridgeAuthState.socketBackoffMs =
    bridgeAuthState.socketBackoffMs > 0
      ? Math.min(bridgeAuthState.socketBackoffMs * 2, SOCKET_BACKOFF_CAP_MS)
      : SOCKET_BACKOFF_INITIAL_MS
  bridgeAuthState.socketBackoffUntil = now + bridgeAuthState.socketBackoffMs
  recordBridgeSocketBackoff(bridgeAuthState.socketBackoffMs)
}

function resetSocketBackoff(): void {
  bridgeAuthState.socketBackoffMs = 0
  bridgeAuthState.socketBackoffUntil = 0
  recordBridgeSocketBackoff(0)
}

function noteSuppressedSocketAttempt(): void {
  recordBridgeSuppressedSocketAttempt()
}

function resolveAlfaClubProxySecret(flags: AlfaClubChatBridgeFlags): string | null {
  return flags.apiProxyUrl ? flags.apiProxySecret : null
}

function flushAuthFailRollup(): void {
  // Fires at windowStart + LOG_ROLLUP_WINDOW_MS. We only emit a summary
  // line when there were additional events after the initial one — the
  // initial event already produced a `repeats: 1` log line at the top of
  // the window. Mutating that earlier payload would be a no-op (the
  // logger has already serialized it), so we emit a *new* line here that
  // carries the true accumulated count.
  const repeats = bridgeAuthState.authFailRepeats
  bridgeAuthState.authFailFlushTimer = null
  if (repeats > 1) {
    logger.warn('[alfaclub-chat] room_history_auth_failed:ws_live_fallback:rollup', {
      roomId: bridgeAuthState.authFailRoomId,
      jwtSource: bridgeAuthState.authFailJwtSource,
      repeats,
      windowStartedAt: bridgeAuthState.authFailFirstAt
        ? new Date(bridgeAuthState.authFailFirstAt).toISOString()
        : null,
      lastError: bridgeAuthState.authFailLastError,
    })
  }
  bridgeAuthState.authFailRepeats = 0
  bridgeAuthState.authFailFirstAt = 0
  bridgeAuthState.authFailLastLoggedAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.authFailRoomId = null
  bridgeAuthState.authFailJwtSource = null
  bridgeAuthState.authFailLastError = null
}

function warnRoomHistoryAuthFallback(params: {
  roomId: string
  jwtSource: BridgeJwtSource
  error: unknown
  now?: number
}): void {
  const now = params.now ?? Date.now()
  const errorMessage =
    params.error instanceof Error ? params.error.message : String(params.error)

  if (
    bridgeAuthState.authFailRepeats > 0 &&
    now - bridgeAuthState.authFailFirstAt <= LOG_ROLLUP_WINDOW_MS
  ) {
    // Inside an active window — accumulate, do NOT mutate the
    // already-serialized first payload. The flush timer set on the first
    // event will emit a single summary line carrying the final count.
    bridgeAuthState.authFailRepeats += 1
    bridgeAuthState.authFailLastError = errorMessage
    return
  }

  // First event of a new window. Log immediately with `repeats: 1` and
  // schedule a one-shot flush.
  bridgeAuthState.authFailFirstAt = now
  bridgeAuthState.authFailRepeats = 1
  bridgeAuthState.authFailRoomId = params.roomId
  bridgeAuthState.authFailJwtSource = params.jwtSource
  bridgeAuthState.authFailLastError = errorMessage

  logger.warn('[alfaclub-chat] room_history_auth_failed:ws_live_fallback', {
    roomId: params.roomId,
    jwtSource: params.jwtSource,
    repeats: 1,
    windowStartedAt: new Date(now).toISOString(),
    error: errorMessage,
  })
  bridgeAuthState.authFailLastLoggedAt = now

  if (bridgeAuthState.authFailFlushTimer) {
    clearTimeout(bridgeAuthState.authFailFlushTimer)
  }
  const timer = setTimeout(flushAuthFailRollup, LOG_ROLLUP_WINDOW_MS)
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    ;(timer as { unref: () => void }).unref()
  }
  bridgeAuthState.authFailFlushTimer = timer
}

function extractCfRayFromMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error)
  const match = /\bcf-ray=([^\s"]{1,64})/i.exec(message)
  return match?.[1]?.slice(0, 64) ?? null
}

function extractHtmlErrorCodeFromMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error)
  const match = /\bhtml-error-code=(10\d{2})\b/i.exec(message)
  return match?.[1] ?? null
}

function flushCfChallengeRollup(): void {
  const repeats = bridgeAuthState.cfChallengeRepeats
  bridgeAuthState.cfChallengeFlushTimer = null
  if (repeats > 1) {
    logger.warn('[alfaclub-chat] room_history_cf_challenge:rollup', {
      roomId: bridgeAuthState.cfChallengeRoomId,
      repeats,
      windowStartedAt: bridgeAuthState.cfChallengeFirstAt
        ? new Date(bridgeAuthState.cfChallengeFirstAt).toISOString()
        : null,
      cfRay: bridgeAuthState.cfChallengeLastCfRay,
      htmlErrorCode: bridgeAuthState.cfChallengeLastHtmlErrorCode,
    })
  }
}

function warnRoomHistoryCfChallenge(params: {
  roomId: string
  error: unknown
  now?: number
}): void {
  const now = params.now ?? Date.now()
  const cfRay = extractCfRayFromMessage(params.error)
  const htmlErrorCode = extractHtmlErrorCodeFromMessage(params.error)

  if (bridgeAuthState.cfChallengeRepeats === 0) {
    bridgeAuthState.cfChallengeFirstAt = now
    bridgeAuthState.cfChallengeFirstCfRay = cfRay
    bridgeAuthState.cfChallengeRoomId = params.roomId
  }

  if (bridgeAuthState.cfChallengeFlushTimer) {
    bridgeAuthState.cfChallengeRepeats += 1
    bridgeAuthState.cfChallengeLastCfRay = cfRay
    bridgeAuthState.cfChallengeLastHtmlErrorCode = htmlErrorCode
  } else {
    bridgeAuthState.cfChallengeRepeats += 1
    bridgeAuthState.cfChallengeRoomId = params.roomId
    bridgeAuthState.cfChallengeLastCfRay = cfRay
    bridgeAuthState.cfChallengeLastHtmlErrorCode = htmlErrorCode

    logger.warn('[alfaclub-chat] room_history_cf_challenge', {
      roomId: params.roomId,
      repeats: bridgeAuthState.cfChallengeRepeats,
      windowStartedAt: new Date(now).toISOString(),
      cfRay,
      htmlErrorCode,
    })

    if (bridgeAuthState.cfChallengeFlushTimer) {
      clearTimeout(bridgeAuthState.cfChallengeFlushTimer)
    }
    const timer = setTimeout(flushCfChallengeRollup, LOG_ROLLUP_WINDOW_MS)
    if (typeof (timer as { unref?: () => void }).unref === 'function') {
      ;(timer as { unref: () => void }).unref()
    }
    bridgeAuthState.cfChallengeFlushTimer = timer
  }

  if (
    !bridgeAuthState.cfChallengeSustainedFlagged &&
    bridgeAuthState.cfChallengeFirstAt > 0 &&
    now - bridgeAuthState.cfChallengeFirstAt > 60_000
  ) {
    bridgeAuthState.cfChallengeSustainedFlagged = true
    logger.warn('[alfaclub-chat] cf_challenge_sustained', {
      roomId: params.roomId,
      firstSeenAt: new Date(bridgeAuthState.cfChallengeFirstAt).toISOString(),
      cfRay: bridgeAuthState.cfChallengeFirstCfRay,
      consecutive: bridgeAuthState.cfChallengeRepeats,
    })
  }
}

function flushWsErrorRollup(): void {
  const repeats = bridgeAuthState.wsErrorRepeats
  bridgeAuthState.wsErrorFlushTimer = null
  if (repeats > 1) {
    logger.warn('[alfaclub-chat] ws_error:rollup', {
      roomId: bridgeAuthState.wsErrorRoomId,
      repeats,
      windowStartedAt: bridgeAuthState.wsErrorFirstAt
        ? new Date(bridgeAuthState.wsErrorFirstAt).toISOString()
        : null,
      lastMessage: bridgeAuthState.wsErrorLastMessage,
    })
  }
  bridgeAuthState.wsErrorRepeats = 0
  bridgeAuthState.wsErrorFirstAt = 0
  bridgeAuthState.wsErrorLastLoggedAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.wsErrorRoomId = null
  bridgeAuthState.wsErrorLastMessage = null
}

function warnWsError(params: { roomId: string; message: string; now?: number }): void {
  const now = params.now ?? Date.now()
  const truncated = params.message.slice(0, 180)

  if (
    bridgeAuthState.wsErrorRepeats > 0 &&
    now - bridgeAuthState.wsErrorFirstAt <= LOG_ROLLUP_WINDOW_MS
  ) {
    bridgeAuthState.wsErrorRepeats += 1
    bridgeAuthState.wsErrorLastMessage = truncated
    return
  }

  bridgeAuthState.wsErrorFirstAt = now
  bridgeAuthState.wsErrorRepeats = 1
  bridgeAuthState.wsErrorRoomId = params.roomId
  bridgeAuthState.wsErrorLastMessage = truncated

  logger.warn('[alfaclub-chat] ws_error', {
    roomId: params.roomId,
    repeats: 1,
    windowStartedAt: new Date(now).toISOString(),
    message: truncated,
  })
  bridgeAuthState.wsErrorLastLoggedAt = now

  if (bridgeAuthState.wsErrorFlushTimer) {
    clearTimeout(bridgeAuthState.wsErrorFlushTimer)
  }
  const timer = setTimeout(flushWsErrorRollup, LOG_ROLLUP_WINDOW_MS)
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    ;(timer as { unref: () => void }).unref()
  }
  bridgeAuthState.wsErrorFlushTimer = timer
}

function resetAuthFailureRollup(): void {
  if (bridgeAuthState.authFailFlushTimer) {
    clearTimeout(bridgeAuthState.authFailFlushTimer)
    bridgeAuthState.authFailFlushTimer = null
  }
  bridgeAuthState.authFailRepeats = 0
  bridgeAuthState.authFailFirstAt = 0
  bridgeAuthState.authFailLastLoggedAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.authFailRoomId = null
  bridgeAuthState.authFailJwtSource = null
  bridgeAuthState.authFailLastError = null
}

function resetCfChallengeRollup(): void {
  if (bridgeAuthState.cfChallengeFlushTimer) {
    clearTimeout(bridgeAuthState.cfChallengeFlushTimer)
    bridgeAuthState.cfChallengeFlushTimer = null
  }
  bridgeAuthState.cfChallengeRepeats = 0
  bridgeAuthState.cfChallengeFirstAt = 0
  bridgeAuthState.cfChallengeFirstCfRay = null
  bridgeAuthState.cfChallengeRoomId = null
  bridgeAuthState.cfChallengeLastCfRay = null
  bridgeAuthState.cfChallengeLastHtmlErrorCode = null
  bridgeAuthState.cfChallengeSustainedFlagged = false
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
}): Promise<{ sent: boolean; status?: number; error?: string }> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendMessage`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    const response = await fetch(endpoint, {
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
    if (response.ok) return { sent: true, status: response.status }
    const text = await response.text().catch(() => '')
    return {
      sent: false,
      status: response.status,
      error: text.slice(0, 180),
    }
  } catch (error) {
    // Fail-open to preserve bridge progress.
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    }
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
  if (messages.length > 0) {
    const roomIds = Array.from(new Set(messages.map((message) => message.roomId))).slice(0, 10)
    logger.info('[alfaclub-chat] ws_messages_ingested', {
      received: messages.length,
      inserted: inserted.length,
      roomIds,
    })
  }
  if (!flags.telegramRelayEnabled) return
  if (!flags.telegramRelayBotToken || !flags.telegramRelayChatId) return

  for (const message of inserted) {
    const relay = await sendTelegramRelayMessage({
      botToken: flags.telegramRelayBotToken,
      chatId: flags.telegramRelayChatId,
      messageThreadId: flags.telegramRelayThreadId,
      text: buildTelegramRelayText({
        roomId: message.roomId,
        id: message.messageId,
        date: message.dateMs ?? Date.now(),
        sender: message.senderAddress,
        text: message.text,
        attachments: [],
        replyAttachments: [],
        rawPayloadText: message.rawPayloadText ?? null,
      }),
      timeoutMs: flags.sendTimeoutMs,
    })
    if (relay.sent) {
      logger.info('[alfaclub-chat] telegram_relay_sent', {
        roomId: message.roomId,
        messageId: message.messageId,
        chatId: flags.telegramRelayChatId,
      })
    } else {
      logger.warn('[alfaclub-chat] telegram_relay_failed', {
        roomId: message.roomId,
        messageId: message.messageId,
        chatId: flags.telegramRelayChatId,
        status: relay.status ?? null,
        error: relay.error ?? null,
      })
    }
  }
}

function ensureLiveCommandSocket(params: {
  websocketUrl: string
  roomId: string
  jwt: string
  flags: AlfaClubChatBridgeFlags
}): void {
  const now = Date.now()
  if (isKnownBadJwt(params.jwt, now)) {
    if (bridgeState.liveSocketJwt === params.jwt) {
      closeLiveSocket()
    }
    noteSuppressedSocketAttempt()
    if (
      bridgeAuthState.lastBadJwtWarnAt === Number.NEGATIVE_INFINITY ||
      now - bridgeAuthState.lastBadJwtWarnAt > LOG_ROLLUP_WINDOW_MS
    ) {
      logger.warn('[alfaclub-chat] ws_connect_suppressed:known_bad_jwt', {
        roomId: params.roomId,
        badJwtAgeMs: now - bridgeAuthState.lastBadJwtAt,
      })
      bridgeAuthState.lastBadJwtWarnAt = now
    }
    return
  }

  if (bridgeAuthState.socketBackoffUntil > now) {
    noteSuppressedSocketAttempt()
    return
  }

  if (
    bridgeState.liveSocket &&
    bridgeState.liveSocketJwt === params.jwt &&
    bridgeState.liveSocketRoomId === params.roomId
  ) {
    return
  }

  const WebSocketCtor = getBridgeWebSocketCtor()
  if (!WebSocketCtor) {
    logger.warn('[alfaclub-chat] ws_unavailable', { roomId: params.roomId })
    return
  }

  closeLiveSocket()

  const wsUrl = new URL(params.websocketUrl)
  wsUrl.searchParams.set('TOKEN', params.jwt)
  wsUrl.searchParams.set('_k', '0')

  const socket = new WebSocketCtor(wsUrl.toString())
  bridgeState.liveSocket = socket
  bridgeState.liveSocketJwt = params.jwt
  bridgeState.liveSocketRoomId = params.roomId

  const onOpen = (): void => {
    resetSocketBackoff()
    logger.info('[alfaclub-chat] ws_open', {
      roomId: params.roomId,
      ingestAllRooms: params.flags.wsIngestAllRoomsEnabled,
      liveFallbackActive: bridgeState.liveFallbackActive,
      telegramRelayEnabled: params.flags.telegramRelayEnabled,
    })
  }

  const onMessage = (event?: BridgeWebSocketEvent): void => {
    if (!event) return
    const data = decodeWsEventData(event.data)
    if (!data) return
    let parsed: unknown = null
    try {
      parsed = JSON.parse(data)
    } catch {
      logger.warn('[alfaclub-chat] ws_message_parse_failed', {
        roomId: params.roomId,
        bytes: data.length,
      })
      return
    }
    const inboundMessages = extractWsMessagesFromPayload(parsed)
    if (inboundMessages.length > 0) {
      logger.info('[alfaclub-chat] ws_message_parsed', {
        roomId: params.roomId,
        messages: inboundMessages.length,
        roomIds: Array.from(new Set(inboundMessages.map((message) => message.roomId))).slice(0, 10),
      })
    }
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

  const onClose = (event?: any): void => {
    applySocketBackoff()
    logger.warn('[alfaclub-chat] ws_close', {
      roomId: params.roomId,
      code: typeof event?.code === 'number' ? event.code : null,
      reason: typeof event?.reason === 'string' ? event.reason.slice(0, 120) : '',
    })
    if (bridgeState.liveSocket !== socket) return
    bridgeState.liveSocket = null
    bridgeState.liveSocketJwt = null
    bridgeState.liveSocketRoomId = null
  }

  const onError = (event?: any): void => {
    applySocketBackoff()
    warnWsError({
      roomId: params.roomId,
      message: String(event?.message ?? event?.error?.message ?? event ?? 'unknown').slice(0, 180),
    })
    if (bridgeState.liveSocket !== socket) return
    bridgeState.liveSocket = null
    bridgeState.liveSocketJwt = null
    bridgeState.liveSocketRoomId = null
  }

  socket.addEventListener('open', onOpen)
  socket.addEventListener('message', onMessage)
  socket.addEventListener('close', onClose)
  socket.addEventListener('error', onError)
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
      // Defense-in-depth: under PR #467 a slash command from any room
      // sender cannot land in the deterministic executor's
      // `isHermitUserAllowed` deny branch (the AlfaClub-chatId
      // short-circuit gates the family). But if a stale build of
      // this bridge runs against room 1043 (Railway picked up an
      // old image after PR #467 merged on Vercel), or a future
      // refactor re-tightens the gate, the deny string can leak
      // into chat as a `keepr4626bot` reply. Drop it here so the
      // user never sees it — the bridge will simply not respond,
      // and the Vercel-canonical bridge keeps serving normally.
      if (shouldSuppressDeterministicReply(responseText)) {
        logger.warn('[alfaclub-chat] suppressed_deterministic_reply', {
          roomId: params.roomId,
          messageId: command.id,
          sender: command.sender,
          // The reply text is a fixed catalog string in this branch,
          // safe to log; we do NOT log the original command body to
          // keep the log surface tight.
          replyHead: responseText.slice(0, 64),
        })
        continue
      }
      const attachments = extractAlfaClubActionAttachments(result.action)
      if (params.flags.botToken) {
        await sendRoomMessageViaBotToken({
          apiBaseUrl: params.flags.apiBaseUrl,
          botToken: params.flags.botToken,
          roomId: params.roomId,
          text: responseText,
          idempotencyKey: buildBotMessageIdempotencyKey({
            roomId: params.roomId,
            messageId: command.id,
          }),
          timeoutMs: params.flags.sendTimeoutMs,
        })
      } else {
        await sendRoomMessageViaWebSocket({
          websocketUrl: params.flags.websocketUrl,
          jwt: params.jwt,
          roomId: params.roomId,
          text: responseText,
          attachments,
          timeoutMs: params.flags.sendTimeoutMs,
        })
      }
      replied += 1
      await markReadMessage({
        apiBaseUrl: resolveAlfaClubApiCallBaseUrl(params.flags),
        fingerprintBaseUrl: resolveAlfaClubFingerprintBaseUrl(params.flags),
        proxySecret: resolveAlfaClubProxySecret(params.flags),
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

function earlyTickResult(params: {
  roomId: string
  historyError: unknown
  unseen?: number
  processed: number
  replied: number
  errors?: Array<{ messageId: string; error: string }>
}): AlfaClubChatBridgeTickResult {
  return {
    seeded: false,
    roomId: params.roomId,
    fetched: 0,
    unseen: params.unseen ?? 0,
    processed: params.processed,
    replied: params.replied,
    errors: [
      {
        messageId: 'room-history',
        error:
          params.historyError instanceof Error
            ? params.historyError.message
            : String(params.historyError),
      },
      ...(params.errors ?? []),
    ],
  }
}

type RunBridgeTickOptions = {
  // Continuous in-process bridge mode seeds first and skips historical replay.
  // One-shot cron mode should process newly ingested commands immediately.
  seedHistoryOnlyOnFirstTick?: boolean
}

async function runBridgeTick(
  flags: AlfaClubChatBridgeFlags,
  options: RunBridgeTickOptions = {},
): Promise<AlfaClubChatBridgeTickResult> {
  const seedHistoryOnlyOnFirstTick = options.seedHistoryOnlyOnFirstTick ?? true
  const roomId = flags.roomId as string
  const resolvedCommandJwt = await resolveBridgeJwtWithSource(flags.jwt)
  const commandJwt = resolvedCommandJwt.jwt
  const explicitIngestJwt = (flags.ingestJwt ?? '').trim() || null
  const ingestJwt = explicitIngestJwt || commandJwt

  if (!commandJwt) {
    if (flags.wsIngestAllRoomsEnabled && ingestJwt) {
      ensureLiveCommandSocket({
        websocketUrl: flags.websocketUrl,
        roomId,
        jwt: ingestJwt,
        flags,
      })
    }
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
  let jwt = commandJwt
  let historyErrorJwt = commandJwt
  let fetchedMessages: AlfaClubRoomHistoryMessage[] | null = null
  let historyError: unknown = null
  try {
    fetchedMessages = await fetchRoomHistory({
      apiBaseUrl: resolveAlfaClubApiCallBaseUrl(flags),
      fingerprintBaseUrl: resolveAlfaClubFingerprintBaseUrl(flags),
      proxySecret: resolveAlfaClubProxySecret(flags),
      roomId,
      jwt,
      limit: flags.historyLimit,
      timeoutMs: flags.requestTimeoutMs,
    })
  } catch (error) {
    const fallbackJwt = (flags.jwt ?? '').trim() || null
    const shouldRetryWithEnv =
      resolvedCommandJwt.source === 'db' &&
      Boolean(fallbackJwt) &&
      fallbackJwt !== resolvedCommandJwt.jwt &&
      classifyHistoryError(error) === 'auth'
    if (!shouldRetryWithEnv) {
      historyError = error
    } else {
      logger.warn('[alfaclub-chat] room_history_auth_failed:retry_env', {
        roomId,
        jwtSource: resolvedCommandJwt.source,
        error: error instanceof Error ? error.message : String(error),
      })
      try {
        historyErrorJwt = fallbackJwt as string
        fetchedMessages = await fetchRoomHistory({
          apiBaseUrl: resolveAlfaClubApiCallBaseUrl(flags),
          fingerprintBaseUrl: resolveAlfaClubFingerprintBaseUrl(flags),
          proxySecret: resolveAlfaClubProxySecret(flags),
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
    const kind = classifyHistoryError(historyError)
    if (kind === 'cf_challenge') {
      const now = Date.now()
      warnRoomHistoryCfChallenge({ roomId, now, error: historyError })
      recordBridgeCfChallenge(new Date(now).toISOString(), bridgeAuthState.cfChallengeSustainedFlagged)
      applySocketBackoff(now)
      bridgeState.liveFallbackActive = true
      return earlyTickResult({
        roomId,
        historyError,
        processed: 0,
        replied: 0,
      })
    }

    const canUseLiveFallback = flags.wsLiveFallbackEnabled && kind === 'auth'
    if (!canUseLiveFallback) {
      logger.warn('[alfaclub-chat] room_history_failed:no_fallback', {
        roomId,
        jwtSource: resolvedCommandJwt.source,
        wsLiveFallbackEnabled: flags.wsLiveFallbackEnabled,
        error: historyError instanceof Error ? historyError.message : String(historyError),
      })
      throw historyError
    }

    const now = Date.now()
    rememberBadJwt(historyErrorJwt, now)
    recordBridgeAuthFailure(new Date(now).toISOString())
    bridgeState.liveFallbackActive = true
    void requestImmediatePrivyRefresh('bridge_auth_fail').catch(() => {})
    warnRoomHistoryAuthFallback({
      roomId,
      jwtSource: resolvedCommandJwt.source,
      now,
      error: historyError instanceof Error ? historyError.message : String(historyError),
    })

    bridgeState.liveFallbackActive = true
    if (ingestJwt) {
      ensureLiveCommandSocket({
        websocketUrl: flags.websocketUrl,
        roomId,
        jwt: ingestJwt,
        flags,
      })
    }
    bridgeState.seeded = true
    const liveCommands = drainLiveCommands()
    const liveBatch = await executeCommandBatch({
      commands: liveCommands,
      flags,
      roomId,
      jwt,
    })
    // Surface the original history-fetch error in `errors[]` (alongside
    // any per-command errors from the live-fallback batch) so an
    // operator polling /api/v1/alfaclub/chat-bridge-run can see why
    // `fetched: 0` happened. Pre-fix, a Cloudflare `:403` got logged
    // but the tick response was indistinguishable from a healthy "no
    // new messages" tick. The synthetic `messageId` is `room-history`
    // so the error doesn't collide with real per-command ids.
    return earlyTickResult({
      roomId,
      unseen: liveCommands.length,
      processed: liveBatch.processed,
      replied: liveBatch.replied,
      historyError,
      errors: liveBatch.errors,
    })
  }

  if (!fetchedMessages) {
    throw new Error('room_history_failed:unknown')
  }

  // Persist polled history rows to a DB-backed dedupe ledger so one-shot
  // cron invocations can process newly arrived commands without relying on
  // in-memory state surviving between serverless cold starts.
  let newlyIngestedHistoryIds: Set<string> | null = null
  try {
    const inserted = await upsertAlfaClubIngestMessages(
      fetchedMessages
        .map((message) => {
          const id = String(message.id ?? '').trim()
          const sender = String(message.sender ?? '').trim().toLowerCase()
          if (!id || !isHexAddress(sender)) return null
          const date = Number(message.date)
          const dateMs = Number.isFinite(date) && date > 0 ? Math.floor(date) : null
          return {
            roomId,
            messageId: id,
            senderAddress: sender,
            text: String(message.text ?? ''),
            dateMs,
            source: 'history' as const,
            rawPayloadText: null,
          }
        })
        .filter((entry): entry is {
          roomId: string
          messageId: string
          senderAddress: string
          text: string
          dateMs: number | null
          source: 'history'
          rawPayloadText: null
        } => Boolean(entry)),
    )
    newlyIngestedHistoryIds = new Set(inserted.map((row) => row.messageId))
  } catch {
    newlyIngestedHistoryIds = null
  }

  clearBadJwt()
  resetAuthFailureRollup()
  if (bridgeAuthState.cfChallengeRepeats > 0 || bridgeAuthState.cfChallengeSustainedFlagged) {
    resetCfChallengeRollup()
    recordBridgeCfChallengeRecovered()
  }
  recordBridgeHistorySuccess()

  if (flags.wsIngestAllRoomsEnabled && ingestJwt) {
    ensureLiveCommandSocket({
      websocketUrl: flags.websocketUrl,
      roomId,
      jwt: ingestJwt,
      flags,
    })
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

  // First tick in long-running mode seeds the dedupe window and intentionally
  // avoids replaying historical commands sent before the bridge started.
  // In one-shot cron mode we continue so newly ingested commands are handled
  // on the same invocation.
  if (!bridgeState.seeded) {
    bridgeState.seeded = true
    if (seedHistoryOnlyOnFirstTick) {
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
  }

  const commandSourceMessages =
    !seedHistoryOnlyOnFirstTick &&
    newlyIngestedHistoryIds !== null &&
    newlyIngestedHistoryIds.size > 0
      ? unseenMessages.filter((message) =>
          newlyIngestedHistoryIds?.has(String(message.id ?? '').trim()),
        )
      : unseenMessages

  const commands = collectAlfaClubCommandMessages({
    messages: commandSourceMessages,
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

export async function runAlfaClubChatBridgeTickOnce(): Promise<RunAlfaClubChatBridgeTickOnceResult> {
  const flags = readAlfaClubChatBridgeFlags()
  if (flags.killSwitch) {
    return {
      ok: false,
      reason: 'kill_switch',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
    }
  }
  if (!flags.enabled) {
    return {
      ok: false,
      reason: 'disabled',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
    }
  }
  if (!flags.roomId) {
    return {
      ok: false,
      reason: 'env_missing',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
    }
  }

  const data = await runBridgeTick(flags, { seedHistoryOnlyOnFirstTick: false })
  return {
    ok: true,
    intervalMs: flags.pollIntervalMs,
    roomId: flags.roomId,
    data,
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

export function _isRoomHistoryAuthErrorForTests(error: unknown): boolean {
  return isRoomHistoryAuthError(error)
}

export function _isCloudflareChallengeErrorForTests(error: unknown): boolean {
  return isCloudflareChallengeError(error)
}

export function _classifyHistoryErrorForTests(error: unknown): HistoryErrorKind {
  return classifyHistoryError(error)
}

/** Test seam: exercise `fetchRoomHistory` against an injected fetch. */
export async function _fetchRoomHistoryForTests(params: {
  apiBaseUrl: string
  fingerprintBaseUrl?: string
  proxySecret?: string | null
  roomId: string
  jwt: string
  limit: number
  timeoutMs: number
}): Promise<AlfaClubRoomHistoryMessage[]> {
  return fetchRoomHistory(params)
}

/** Test seam: exercise `markReadMessage` against an injected fetch. */
export async function _markReadMessageForTests(params: {
  apiBaseUrl: string
  fingerprintBaseUrl?: string
  proxySecret?: string | null
  roomId: string
  jwt: string
  messageDate: number
  timeoutMs: number
}): Promise<void> {
  return markReadMessage(params)
}

export async function _sendRoomMessageViaBotTokenForTests(params: {
  apiBaseUrl: string
  botToken: string
  roomId: string
  text: string
  idempotencyKey: string
  timeoutMs: number
}): Promise<void> {
  return sendRoomMessageViaBotToken(params)
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
  bridgeAuthState.lastBadJwt = null
  bridgeAuthState.lastBadJwtAt = 0
  bridgeAuthState.lastBadJwtWarnAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.badJwtTtlMs = BAD_JWT_TTL_MS
  bridgeAuthState.socketBackoffMs = 0
  bridgeAuthState.socketBackoffUntil = 0
  if (bridgeAuthState.authFailFlushTimer) {
    clearTimeout(bridgeAuthState.authFailFlushTimer)
    bridgeAuthState.authFailFlushTimer = null
  }
  bridgeAuthState.authFailRepeats = 0
  bridgeAuthState.authFailFirstAt = 0
  bridgeAuthState.authFailLastLoggedAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.authFailRoomId = null
  bridgeAuthState.authFailJwtSource = null
  bridgeAuthState.authFailLastError = null
  if (bridgeAuthState.wsErrorFlushTimer) {
    clearTimeout(bridgeAuthState.wsErrorFlushTimer)
    bridgeAuthState.wsErrorFlushTimer = null
  }
  bridgeAuthState.wsErrorRepeats = 0
  bridgeAuthState.wsErrorFirstAt = 0
  bridgeAuthState.wsErrorLastLoggedAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.wsErrorRoomId = null
  bridgeAuthState.wsErrorLastMessage = null
  if (bridgeAuthState.cfChallengeFlushTimer) {
    clearTimeout(bridgeAuthState.cfChallengeFlushTimer)
    bridgeAuthState.cfChallengeFlushTimer = null
  }
  bridgeAuthState.cfChallengeRepeats = 0
  bridgeAuthState.cfChallengeFirstAt = 0
  bridgeAuthState.cfChallengeFirstCfRay = null
  bridgeAuthState.cfChallengeRoomId = null
  bridgeAuthState.cfChallengeLastCfRay = null
  bridgeAuthState.cfChallengeLastHtmlErrorCode = null
  bridgeAuthState.cfChallengeSustainedFlagged = false
}

export function _runAlfaClubChatBridgeTickForTests(
  flags: AlfaClubChatBridgeFlags,
): Promise<AlfaClubChatBridgeTickResult> {
  return runBridgeTick(flags)
}

export function _ensureLiveCommandSocketForTests(params: {
  websocketUrl: string
  roomId: string
  jwt: string
  flags: AlfaClubChatBridgeFlags
}): void {
  ensureLiveCommandSocket(params)
}

export function _getBridgeAuthStateForTests(): typeof bridgeAuthState {
  return { ...bridgeAuthState }
}
