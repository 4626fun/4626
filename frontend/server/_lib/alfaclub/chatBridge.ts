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
 *     delegated to the Hermit creative lane (`hermit/skillRouter.ts`)
 *     via the deterministic executor's `hermit` family branch. The Hermit
 *     agent itself runs out-of-process; only its API endpoint + bearer
 *     are wired here through `HERMIT_AGENT_*` env.
 *   - Privy session-token rotation — that is the canonical Vercel cron at
 *     `/api/v1/alfaclub/chat-token-refresh`. The bridge reads the rotated
 *     `chat_jwt` row but does not write it.
 */

import { matchesAnyCommandFamily } from '../../commands/registry.js'
import { CANONICAL_CSW_ADDRESS } from '../../../src/wallet/canonicalWalletPolicy.js'
import { extractTelegramRelayCommandText } from './telegramChatRef.js'
import { logger } from '../infra/logger.js'
import WebSocket from 'ws'
import {
  recordBridgeAuthFailure,
  recordBridgeCfChallenge,
  recordBridgeCfChallengeRecovered,
  recordBridgeHistorySuccess,
  recordBridgeProxyFallbackDirect,
  recordBridgeSocketBackoff,
  recordBridgeSuppressedSocketAttempt,
} from './authHealthStore.js'
import { upsertAlfaClubIngestMessages, type AlfaClubIngestMessage } from './chatIngestStore.js'
import {
  filterUnrepliedCommandMessageIds,
  recordCommandReply,
} from './commandReplyLedger.js'
import { readAlfaClubChatToken } from './chatTokenStore.js'
import { requestImmediatePrivyRefresh } from './privyTokenRefresher.js'
import { parseTelegramChatRef } from './telegramChatRef.js'
import { isKeeprRailwayAlfaClubSplit } from './keeprAlfaClubSplit.js'
import {
  ALFACLUB_API_COMMON_BROWSER_HEADERS,
  buildAlfaClubApiHeaders,
  readAlfaClubApiAuthFlags,
  resolveAlfaClubApiCallBaseUrl,
  resolveAlfaClubProxySecret,
} from './apiAuth.js'

export { isKeeprRailwayAlfaClubSplit } from './keeprAlfaClubSplit.js'
export { resolveAlfaClubApiCallBaseUrl, resolveAlfaClubOriginHeaders } from './apiAuth.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_WS_URL = 'wss://ws.alfaclub.app'
const DEFAULT_POLL_INTERVAL_MS = 6_000
const DEFAULT_HISTORY_LIMIT = 20
const DEFAULT_CRON_HISTORY_LIMIT = 12
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
const WS_CLOSE_CHURN_WINDOW_MS = 60_000
const WS_BENIGN_ESCALATION_WINDOW_MS = 10 * 60_000
const WS_BENIGN_ESCALATION_ROLLUP_WINDOWS = 5
const WS_CLOSE_CHURN_THRESHOLD = 5
const FIRST_TICK_RECENT_COMMAND_WINDOW_MS = 60_000

type AlfaClubRoomHistoryMessage = {
  id?: string
  date?: number
  sender?: string
  text?: string
  username?: string
  avatar?: string
  isBot?: boolean
  is_edited?: boolean
  edit_deadline?: number
  deleted_at?: number | string | null
  deleted_by?: string | null
  deleted_by_username?: string | null
  reply_id?: string | null
  reply_date?: number | null
  reply_text?: string | null
  reply_sender?: string | null
  reply_username?: string | null
  keys?: number | null
  primary_tag?: string | null
  primary_tag_variant?: string | null
  reactions?: unknown
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
    reply_id?: string
  }
}

/** Best-effort WS reaction — AlfaClub has no public bot-token reaction API. */
type AlfaClubReactionFrame = {
  type: 'reaction'
  value: {
    room: string
    message_id: string
    emoji: string
  }
}

export type AlfaClubChatBridgeFlags = {
  killSwitch: boolean
  enabled: boolean
  roomId: string | null
  /**
   * Rooms where hermit4626 creative commands and the core command surface are treated
   * as first-class (polling priority, ops visibility, etc.).
   * Populated from ALFACLUB_HERMIT_COMMAND_ROOMS (comma list) or legacy single ALFACLUB_CHAT_ROOM_ID.
   */
  hermitCommandRoomIds: string[]
  jwt: string | null
  ingestJwt: string | null
  readBotToken: string | null
  botToken: string | null
  apiBaseUrl: string
  wsProxyHttpSendUrl?: string | null
  wsProxySecret?: string | null
  /**
   * Optional proxy origin for AlfaClub HTTP API calls
   * (`/api/websocket/room_history_paginate` +
   * `/api/websocket/update_read_msg` + optional
   * `/api/room/:roomId/message` passthrough).
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
   *   - Command replies still execute on Vercel. Proxies MAY
   *     passthrough `/api/room/:roomId/message`; if not, the bridge
   *     falls back to direct upstream sends when it sees
   *     `path_not_allowed`.
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
  sender: string
  text: string
}

type BridgeJwtSource = 'db' | 'env' | 'none'

type NormalizedHistoryMessage = {
  id: string
  date: number
  sender: string
  text: string
  isBot: boolean
  attachments: AlfaClubMessageAttachment[]
  replyAttachments: AlfaClubMessageAttachment[]
}

type BotTokenRoomHistoryMessage = Record<string, unknown>

type BotTokenRoomHistoryResponse = {
  messages?: BotTokenRoomHistoryMessage[]
}

export type AlfaClubChatBridgeSkipReason =
  | 'kill_switch'
  | 'disabled'
  | 'railway_blocked'
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
  const raw = normalizeEnvScalar(value).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function shouldBlockRailwayBridge(flags: Pick<AlfaClubChatBridgeFlags, 'enabled'>): boolean {
  return flags.enabled && isKeeprRailwayAlfaClubSplit()
}

function parseBoolWithDefault(value: string | undefined, fallback: boolean): boolean {
  const raw = normalizeEnvScalar(value)
  if (!raw) return fallback
  return parseBool(raw)
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const raw = normalizeEnvScalar(value)
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

function parseOptionalPositiveInt(value: string | undefined, max: number): number | null {
  const raw = normalizeEnvScalar(value)
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, max)
}

function normalizeEnvScalar(raw: string | undefined): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim()
  }
  return value
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
  const value = normalizeEnvScalar(raw) || DEFAULT_WS_URL
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
  const roomIdRaw = normalizeEnvScalar(process.env.ALFACLUB_CHAT_ROOM_ID)
  const roomId = /^\d+$/.test(roomIdRaw) ? roomIdRaw : null

  // Support multiple official Hermit command rooms (e.g. 1043 + the new 1659).
  // Preferred: ALFACLUB_HERMIT_COMMAND_ROOMS="1043,1659"
  // Fallback: the legacy single ALFACLUB_CHAT_ROOM_ID (for backward compat).
  const hermitRoomsRaw =
    normalizeEnvScalar(process.env.ALFACLUB_HERMIT_COMMAND_ROOMS) || roomIdRaw
  const hermitCommandRoomIds = hermitRoomsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))

  const groupIdRaw = normalizeEnvScalar(process.env.ALFACLUB_CHAT_GROUP_ID)
  const authFlags = readAlfaClubApiAuthFlags()
  const telegramRelayBotToken =
    normalizeEnvScalar(process.env.HERMIT_TELEGRAM_BOT_TOKEN) ||
    normalizeEnvScalar(process.env.ALFACLUB_TELEGRAM_BOT_TOKEN) ||
    null
  const telegramRelayChatRef = parseTelegramChatRef(
    normalizeEnvScalar(process.env.HERMIT_TELEGRAM_RELAY_CHAT_ID) ||
      normalizeEnvScalar(process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID) ||
      normalizeEnvScalar(process.env.TELEGRAM_TARGET_CHAT_ID) ||
      null,
  )
  const telegramRelayChatId = telegramRelayChatRef.chatId
  const telegramRelayThreadIdFromEnv = parseOptionalPositiveInt(
    process.env.HERMIT_TELEGRAM_RELAY_THREAD_ID ?? process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID,
    2_000_000_000,
  )
  const telegramRelayEnabledFallback = Boolean(telegramRelayBotToken && telegramRelayChatId)

  // If a dedicated read token is not configured, reuse the main bot token for
  // history reads. This keeps the bridge operational when the Privy JWT lane
  // is stale and avoids auth-loop thrash on `room_history_paginate`.
  const readBotToken = authFlags.readBotToken ?? authFlags.botToken

  return {
    killSwitch: parseBool(process.env.ALFACLUB_VIGILANTE_KILL_SWITCH),
    enabled: parseBool(process.env.ALFACLUB_CHAT_BRIDGE_ENABLED),
    roomId,
    hermitCommandRoomIds,
    jwt: authFlags.jwt,
    ingestJwt: normalizeEnvScalar(process.env.ALFACLUB_CHAT_INGEST_JWT) || null,
    readBotToken,
    botToken: authFlags.botToken,
    apiBaseUrl: authFlags.apiBaseUrl,
    apiProxyUrl: authFlags.apiProxyUrl,
    apiProxySecret: authFlags.apiProxySecret,
    websocketUrl: normalizeWsUrl(process.env.ALFACLUB_CHAT_WS_URL),
    wsProxyHttpSendUrl: normalizeEnvScalar(process.env.ALFACLUB_WS_PROXY_HTTP_SEND_URL) || null,
    wsProxySecret: normalizeEnvScalar(process.env.ALFACLUB_WS_PROXY_SECRET) || null,
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
      process.env.HERMIT_TELEGRAM_RELAY_ENABLED ?? process.env.ALFACLUB_TELEGRAM_RELAY_ENABLED,
      DEFAULT_TELEGRAM_RELAY_FALLBACK_ENABLED && telegramRelayEnabledFallback,
    ),
    telegramRelayBotToken,
    telegramRelayChatId,
    telegramRelayThreadId: telegramRelayThreadIdFromEnv ?? telegramRelayChatRef.inferredThreadId,
  }
}

/** Vercel cron ticks cannot keep a live WS between invocations — skip by default. */
export function readAlfaClubCronSkipLiveWebSocket(): boolean {
  const raw = normalizeEnvScalar(process.env.ALFACLUB_BRIDGE_CRON_SKIP_WS).toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return true
}

/**
 * Returns true if the given room is one of the official Hermit command surfaces
 * for hermit4626 (creative commands + core bot surface).
 */
export function isHermitCommandRoom(roomId: string | null | undefined): boolean {
  if (!roomId) return false
  const flags = readAlfaClubChatBridgeFlags()
  return flags.hermitCommandRoomIds.includes(roomId)
}

/** Rooms the Vercel/cron bridge polls each tick (primary + Hermit command surfaces). */
export function resolveAlfaClubBridgePollRoomIds(
  flags: Pick<AlfaClubChatBridgeFlags, 'roomId' | 'hermitCommandRoomIds'>,
): string[] {
  const ids = new Set<string>()
  if (flags.roomId) ids.add(flags.roomId)
  for (const roomId of flags.hermitCommandRoomIds) ids.add(roomId)
  return [...ids]
}

export function canBridgeReplyInRoom(
  flags: Pick<AlfaClubChatBridgeFlags, 'roomId' | 'hermitCommandRoomIds'>,
  roomId: string,
): boolean {
  return resolveAlfaClubBridgePollRoomIds(flags).includes(roomId)
}

function aggregateBridgeTickResults(
  results: AlfaClubChatBridgeTickResult[],
  primaryRoomId: string,
): AlfaClubChatBridgeTickResult {
  if (results.length === 0) {
    return {
      seeded: false,
      roomId: primaryRoomId,
      fetched: 0,
      unseen: 0,
      processed: 0,
      replied: 0,
      errors: [],
    }
  }
  return {
    seeded: results.some((entry) => entry.seeded),
    roomId: primaryRoomId,
    fetched: results.reduce((sum, entry) => sum + entry.fetched, 0),
    unseen: results.reduce((sum, entry) => sum + entry.unseen, 0),
    processed: results.reduce((sum, entry) => sum + entry.processed, 0),
    replied: results.reduce((sum, entry) => sum + entry.replied, 0),
    errors: results.flatMap((entry) => entry.errors),
  }
}

export function readAlfaClubChatBridgeFlagsForCronTick(): AlfaClubChatBridgeFlags {
  const flags = readAlfaClubChatBridgeFlags()
  const cronLimit = parsePositiveInt(
    process.env.ALFACLUB_BRIDGE_CRON_HISTORY_LIMIT,
    DEFAULT_CRON_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT,
  )
  return {
    ...flags,
    historyLimit: Math.min(flags.historyLimit, cronLimit),
  }
}

export function buildAlfaClubOutboundFrame(params: {
  roomId: string
  text: string
  attachments?: unknown
  replyToMessageId?: string
}): AlfaClubOutboundFrame {
  return {
    type: 'message',
    value: {
      room: params.roomId,
      text: params.text,
      attachments: normalizeAlfaClubAttachments(params.attachments),
      ...(params.replyToMessageId ? { reply_id: params.replyToMessageId } : {}),
    },
  }
}

export function buildAlfaClubReactionFrame(params: {
  roomId: string
  messageId: string
  emoji: string
}): AlfaClubReactionFrame {
  return {
    type: 'reaction',
    value: {
      room: params.roomId,
      message_id: params.messageId,
      emoji: params.emoji.trim().slice(0, 16),
    },
  }
}

export function readAlfaClubBridgeReactionsEnabled(): boolean {
  const raw = normalizeEnvScalar(process.env.ALFACLUB_BRIDGE_REACTIONS_ENABLED).toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return true
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
    isBot: message.isBot === true,
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
  return matchesAnyCommandFamily(text, ['alfaclub', 'hermit', 'help'])
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

const UNKNOWN_RELAY_SENDER_WALLET: `0x${string}` = '0x0000000000000000000000000000000000000000'

function isBareGmeowFromTrustedSender(rawText: string, senderLower: string): boolean {
  if (!BARE_GMEOW_TRUSTED_SENDERS.has(senderLower)) return false
  return /^gmeow+\b/.test(rawText.trim().toLowerCase())
}

function normalizeBareArenaCommand(rawText: string): string | null {
  const trimmed = String(rawText ?? '').trim()
  if (!trimmed) return null
  const match = trimmed.match(/^arena(?:\s+(.+))?$/i)
  if (!match) return null
  const suffix = String(match[1] ?? '').trim()
  return suffix.length > 0 ? `/arena ${suffix}` : '/arena'
}

function isTelegramRelayedSlashCommand(rawText: string, extractedCommandText: string): boolean {
  const command = String(extractedCommandText ?? '').trim()
  if (!command.startsWith('/')) return false
  const text = String(rawText ?? '').trim()
  if (!text) return false
  return (
    /\(tg\s+(?:@[\w]+|tg:\d+)\)\s*$/i.test(text) ||
    /^(?:\[[^\]]+\]\s+)?(?:@[\w]+|tg:\d+):\s+\/\S+/i.test(text)
  )
}

/** Whether a history row could trigger the deterministic command executor. */
export function isHistoryMessageCommandCandidate(message: AlfaClubRoomHistoryMessage): boolean {
  const normalized = normalizeHistoryMessage(message)
  if (!normalized || !normalized.text.trim()) return false
  if (normalized.isBot) return false
  const commandText = extractTelegramRelayCommandText(normalized.text)
  const telegramRelayedCommand = isTelegramRelayedSlashCommand(normalized.text, commandText)
  if (!isHexAddress(normalized.sender) && !telegramRelayedCommand) return false
  if (normalized.sender === CANONICAL_CSW_ADDRESS.toLowerCase()) return false
  const trustedBareGmeow = isBareGmeowFromTrustedSender(commandText, normalized.sender)
  const bareArena = normalizeBareArenaCommand(commandText)
  return trustedBareGmeow || Boolean(bareArena) || isAlfaClubSlashCommandText(commandText)
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

function resolveCommandSenderWallet(sender: string): `0x${string}` {
  return isHexAddress(sender) ? (sender as `0x${string}`) : UNKNOWN_RELAY_SENDER_WALLET
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
    if (entry.isBot) continue
    if (!entry.text.trim()) continue
    const commandText = extractTelegramRelayCommandText(entry.text)
    const telegramRelayedCommand = isTelegramRelayedSlashCommand(entry.text, commandText)
    if (!isHexAddress(entry.sender) && !telegramRelayedCommand) continue
    if (self && entry.sender === self) continue
    if (entry.sender === CANONICAL_CSW_ADDRESS.toLowerCase()) continue
    const trustedBareGmeow = isBareGmeowFromTrustedSender(commandText, entry.sender)
    const bareArena = normalizeBareArenaCommand(commandText)
    if (!trustedBareGmeow && !bareArena && !isAlfaClubSlashCommandText(commandText)) continue
    commands.push({
      id: entry.id,
      date: entry.date,
      sender: entry.sender,
      text: trustedBareGmeow ? '/gmeow' : bareArena ? bareArena : commandText.trim(),
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

function extractAlfaClubFollowUpText(action: unknown): string | null {
  if (!isJsonRecord(action)) return null
  if (action.action !== 'hermit.command' && action.action !== 'help.followup') return null
  const followUp = typeof action.alfaclubFollowUpText === 'string' ? action.alfaclubFollowUpText.trim() : ''
  return followUp.length > 0 ? followUp : null
}

function extractAlfaClubReactionEmoji(action: unknown): string | null {
  if (!isJsonRecord(action)) return null
  if (action.action !== 'hermit.command') return null
  const emoji = typeof action.reactionEmoji === 'string' ? action.reactionEmoji.trim() : ''
  return emoji.length > 0 ? emoji : null
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
   * URL whose hostname determines request fingerprint headers.
   * The canonical fingerprint policy lives in `apiAuth.ts`.
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

function resolveBotHistoryMessageId(message: BotTokenRoomHistoryMessage): string {
  const candidates = [message.id, message.messageId, message.message_id, message.uuid]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function resolveBotHistoryMessageDate(message: BotTokenRoomHistoryMessage): number {
  const candidates = [
    message.date,
    message.created_at,
    message.createdAt,
    message.timestamp,
    message.sent_at,
  ]
  for (const candidate of candidates) {
    const numeric =
      typeof candidate === 'number'
        ? candidate
        : typeof candidate === 'string'
          ? Number(candidate)
          : Number.NaN
    if (Number.isFinite(numeric) && numeric > 0) return numeric
  }
  return 0
}

function resolveBotHistoryMessageSender(message: BotTokenRoomHistoryMessage): string {
  const nestedSender =
    message.sender && typeof message.sender === 'object' && !Array.isArray(message.sender)
      ? (message.sender as Record<string, unknown>)
      : null
  const candidates = [
    message.sender,
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

function resolveBotHistoryMessageText(message: BotTokenRoomHistoryMessage): string {
  const candidates = [message.text, message.message, message.body, message.content]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    return candidate
  }
  return ''
}

function mapBotHistoryMessageToBridgeMessage(
  message: BotTokenRoomHistoryMessage,
): AlfaClubRoomHistoryMessage | null {
  const id = resolveBotHistoryMessageId(message)
  const date = resolveBotHistoryMessageDate(message)
  const sender = resolveBotHistoryMessageSender(message)
  if (!id || !Number.isFinite(date) || date <= 0 || !sender) return null
  return {
    ...message,
    id,
    date,
    sender,
    text: resolveBotHistoryMessageText(message),
  } as AlfaClubRoomHistoryMessage
}

async function fetchRoomHistoryViaReadBotToken(params: {
  /** URL the HTTP request is actually sent to (proxy or direct API base). */
  apiBaseUrl: string
  /** Shared secret for the proxy gate. Omit on direct upstream calls. */
  proxySecret?: string | null
  roomId: string
  readBotToken: string
  limit: number
  timeoutMs: number
}): Promise<AlfaClubRoomHistoryMessage[]> {
  // Keep read-token requests on the same browser-like envelope used by
  // JWT lanes (shared constants in `apiAuth.ts`).
  const url = new URL(`/api/room/${encodeURIComponent(params.roomId)}/messages`, params.apiBaseUrl)
  url.searchParams.set('limit', String(params.limit))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...ALFACLUB_API_COMMON_BROWSER_HEADERS,
        Authorization: `Bearer ${params.readBotToken}`,
        ...((params.proxySecret ?? '').trim()
          ? { 'x-proxy-secret': String(params.proxySecret).trim() }
          : {}),
      },
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`room_history_read_bot_failed:timeout:${message}`)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = await extractRoomHistoryErrorDetail(response)
    const suffix = detail ? `:${detail}` : ''
    throw new Error(`room_history_read_bot_failed:${response.status}${suffix}`)
  }

  const body = (await response.json()) as BotTokenRoomHistoryResponse
  if (!Array.isArray(body.messages)) return []
  return body.messages
    .map((message) => mapBotHistoryMessageToBridgeMessage(message))
    .filter((message): message is AlfaClubRoomHistoryMessage => Boolean(message))
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

type BotSendResultSummary = {
  status: number
  messageId: string | null
  roomId: string | null
  authorId: string | null
  replyId: string | null
  deduped: boolean | null
  created: boolean | null
  responseKeys: string[]
  responseBodyHead: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pickStringFromCandidates(
  payload: Record<string, unknown>,
  candidates: readonly string[],
): string | null {
  for (const key of candidates) {
    const value = payload[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return null
}

function pickBooleanFromCandidates(
  payload: Record<string, unknown>,
  candidates: readonly string[],
): boolean | null {
  for (const key of candidates) {
    const value = payload[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

function summarizeBotSendResponse(params: {
  status: number
  parsedBody: unknown
  bodyText: string
}): BotSendResultSummary {
  const payload = asRecord(params.parsedBody)
  const keys = payload ? Object.keys(payload).sort().slice(0, 16) : []
  const messageId = payload
    ? pickStringFromCandidates(payload, ['messageId', 'message_id', 'id'])
    : null
  const roomId = payload
    ? pickStringFromCandidates(payload, ['roomId', 'room_id', 'room'])
    : null
  const authorId = payload
    ? pickStringFromCandidates(payload, ['authorId', 'author_id', 'sender', 'senderId', 'sender_id'])
    : null
  const replyId = payload
    ? pickStringFromCandidates(payload, ['replyId', 'reply_id'])
    : null
  const deduped = payload ? pickBooleanFromCandidates(payload, ['deduped', 'isDeduped']) : null
  const created =
    payload && pickBooleanFromCandidates(payload, ['created', 'isCreated']) !== null
      ? pickBooleanFromCandidates(payload, ['created', 'isCreated'])
      : deduped === null
        ? null
        : !deduped
  const responseBodyHead = params.bodyText
    ? redactForDiagnostics(params.bodyText.replace(/\s+/g, ' ').slice(0, 220))
    : null
  return {
    status: params.status,
    messageId,
    roomId,
    authorId,
    replyId,
    deduped,
    created,
    responseKeys: keys,
    responseBodyHead: responseBodyHead || null,
  }
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
  replyToMessageId?: string
  proxySecret?: string | null
  idempotencyKey: string
  timeoutMs: number
}): Promise<BotSendResultSummary> {
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
        ...((params.proxySecret ?? '').trim()
          ? { 'x-proxy-secret': String(params.proxySecret).trim() }
          : {}),
      },
      body: JSON.stringify({
        body: truncateAlfaClubBotMessage(params.text),
        ...(params.replyToMessageId ? { reply_id: params.replyToMessageId } : {}),
      }),
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`bot_message_failed:timeout:${message}`)
  } finally {
    clearTimeout(timeout)
  }
  const bodyText = await response.text().catch(() => '')
  let parsedBody: unknown = null
  try {
    parsedBody = bodyText ? JSON.parse(bodyText) : null
  } catch {
    parsedBody = null
  }
  if (!response.ok) {
    const detail = redactForDiagnostics(bodyText.replace(/\s+/g, ' ').slice(0, 160))
    throw new Error(`bot_message_failed:${response.status}${detail ? `:${detail}` : ''}`)
  }
  return summarizeBotSendResponse({
    status: response.status,
    parsedBody,
    bodyText,
  })
}

function isProxyPathNotAllowedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message
  return (
    (message.includes('bot_message_failed:404') || message.includes('jwt_message_failed:404')) &&
    message.includes('"error":"path_not_allowed"')
  )
}

function isBotMessageForbiddenError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).trim()
  return (
    message.includes('bot_message_failed:403') ||
    (message.includes('bot_message_failed:404') && message.includes('"error":"forbidden"'))
  )
}

function isJwtMessageAuthError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).trim()
  return (
    message.includes('jwt_message_failed:401') ||
    message.includes('invalid or revoked token')
  )
}

function shouldSkipRawWebSocketSend(flags: AlfaClubChatBridgeFlags): boolean {
  if (flags.wsProxyHttpSendUrl) return false
  return readAlfaClubCronSkipLiveWebSocket()
}

async function sendRoomMessageViaJwtHttp(params: {
  apiBaseUrl: string
  directApiBaseUrl: string
  jwt: string
  roomId: string
  text: string
  replyToMessageId?: string
  proxySecret?: string | null
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
        ...buildAlfaClubApiHeaders({
          jwt: params.jwt,
          fingerprintBaseUrl: params.directApiBaseUrl,
          proxySecret: params.proxySecret,
        }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: truncateAlfaClubBotMessage(params.text),
        ...(params.replyToMessageId ? { reply_id: params.replyToMessageId } : {}),
      }),
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`jwt_message_failed:timeout:${message}`)
  } finally {
    clearTimeout(timeout)
  }
  const bodyText = await response.text().catch(() => '')
  if (!response.ok) {
    const detail = redactForDiagnostics(bodyText.replace(/\s+/g, ' ').slice(0, 160))
    throw new Error(`jwt_message_failed:${response.status}${detail ? `:${detail}` : ''}`)
  }
}

async function sendRoomMessageViaJwtHttpWithProxyFallback(params: {
  apiBaseUrl: string
  directApiBaseUrl: string
  jwt: string
  roomId: string
  text: string
  replyToMessageId?: string
  proxySecret?: string | null
  timeoutMs: number
}): Promise<void> {
  try {
    await sendRoomMessageViaJwtHttp(params)
  } catch (error) {
    const usingProxy = params.apiBaseUrl !== params.directApiBaseUrl
    if (!usingProxy || !isProxyPathNotAllowedError(error)) {
      throw error
    }
    logger.warn('[alfaclub-chat] jwt_reply_proxy_path_not_allowed:retry_direct', {
      roomId: params.roomId,
      apiBaseUrl: params.apiBaseUrl,
      directApiBaseUrl: params.directApiBaseUrl,
    })
    recordBridgeProxyFallbackDirect()
    await sendRoomMessageViaJwtHttp({
      ...params,
      apiBaseUrl: params.directApiBaseUrl,
      proxySecret: null,
    })
  }
}

async function sendRoomMessageViaBotTokenWithProxyFallback(params: {
  apiBaseUrl: string
  directApiBaseUrl: string
  botToken: string
  roomId: string
  text: string
  replyToMessageId?: string
  proxySecret?: string | null
  idempotencyKey: string
  timeoutMs: number
}): Promise<BotSendResultSummary> {
  try {
    return await sendRoomMessageViaBotToken({
      apiBaseUrl: params.apiBaseUrl,
      botToken: params.botToken,
      roomId: params.roomId,
      text: params.text,
      replyToMessageId: params.replyToMessageId,
      proxySecret: params.proxySecret,
      idempotencyKey: params.idempotencyKey,
      timeoutMs: params.timeoutMs,
    })
  } catch (error) {
    const usingProxy = params.apiBaseUrl !== params.directApiBaseUrl
    if (!usingProxy || !isProxyPathNotAllowedError(error)) {
      throw error
    }
    logger.warn('[alfaclub-chat] bot_reply_proxy_path_not_allowed:retry_direct', {
      roomId: params.roomId,
      apiBaseUrl: params.apiBaseUrl,
      directApiBaseUrl: params.directApiBaseUrl,
    })
    recordBridgeProxyFallbackDirect()
    return sendRoomMessageViaBotToken({
      apiBaseUrl: params.directApiBaseUrl,
      botToken: params.botToken,
      roomId: params.roomId,
      text: params.text,
      replyToMessageId: params.replyToMessageId,
      // Direct upstream call must not include proxy auth.
      proxySecret: null,
      idempotencyKey: params.idempotencyKey,
      timeoutMs: params.timeoutMs,
    })
  }
}

async function sendRoomMessageViaWebSocket(params: {
  websocketUrl: string
  wsProxyHttpSendUrl?: string | null
  wsProxySecret?: string | null
  jwt: string
  roomId: string
  text: string
  attachments?: unknown
  replyToMessageId?: string
  timeoutMs: number
}): Promise<'ws_proxy_http' | 'websocket'> {
  if (params.wsProxyHttpSendUrl) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
    try {
      const response = await fetch(params.wsProxyHttpSendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...((params.wsProxySecret ?? '').trim()
            ? { 'x-proxy-secret': String(params.wsProxySecret).trim() }
            : {}),
        },
        body: JSON.stringify({
          websocketUrl: params.websocketUrl,
          jwt: params.jwt,
          frame: buildAlfaClubOutboundFrame({
            roomId: params.roomId,
            text: params.text,
            attachments: params.attachments,
            replyToMessageId: params.replyToMessageId,
          }),
        }),
        signal: controller.signal,
      })
      const bodyText = await response.text().catch(() => '')
      if (!response.ok) {
        const detail = redactForDiagnostics(bodyText.replace(/\s+/g, ' ').slice(0, 160))
        throw new Error(`ws_proxy_send_failed:${response.status}${detail ? `:${detail}` : ''}`)
      }
      return 'ws_proxy_http'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('ws_proxy_send_timeout')
      }
      throw error instanceof Error ? error : new Error(String(error))
    } finally {
      clearTimeout(timeout)
    }
  }
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
      replyToMessageId: params.replyToMessageId,
    }),
  )

  return await new Promise<'websocket'>((resolve, reject) => {
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
      resolve('websocket')
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

async function sendRoomReactionViaWebSocket(params: {
  websocketUrl: string
  wsProxyHttpSendUrl?: string | null
  wsProxySecret?: string | null
  jwt: string
  roomId: string
  messageId: string
  emoji: string
  timeoutMs: number
}): Promise<void> {
  const frame = buildAlfaClubReactionFrame({
    roomId: params.roomId,
    messageId: params.messageId,
    emoji: params.emoji,
  })

  if (params.wsProxyHttpSendUrl) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
    try {
      const response = await fetch(params.wsProxyHttpSendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...((params.wsProxySecret ?? '').trim()
            ? { 'x-proxy-secret': String(params.wsProxySecret).trim() }
            : {}),
        },
        body: JSON.stringify({
          websocketUrl: params.websocketUrl,
          jwt: params.jwt,
          frame,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`ws_proxy_reaction_failed:${response.status}`)
      }
      return
    } finally {
      clearTimeout(timeout)
    }
  }

  const WebSocketCtor = getBridgeWebSocketCtor()
  if (!WebSocketCtor) throw new Error('ws_unavailable')

  const wsUrl = new URL(params.websocketUrl)
  wsUrl.searchParams.set('TOKEN', params.jwt)
  wsUrl.searchParams.set('_k', '0')
  const payload = JSON.stringify(frame)

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
      reject(new Error('ws_reaction_timeout'))
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
        reject(new Error('ws_reaction_closed_before_open'))
        return
      }
      resolve()
    }

    const onError = (): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('ws_reaction_failed'))
    }

    socket.addEventListener('open', onOpen)
    socket.addEventListener('close', onClose)
    socket.addEventListener('error', onError)
  })
}

async function reactToAlfaClubTriggerMessage(params: {
  flags: AlfaClubChatBridgeFlags
  jwt: string
  roomId: string
  messageId: string
  emoji: string
}): Promise<void> {
  if (!readAlfaClubBridgeReactionsEnabled()) return
  const emoji = params.emoji.trim()
  if (!emoji) return
  const jwt = params.jwt.trim()
  if (!jwt) return

  try {
    await sendRoomReactionViaWebSocket({
      websocketUrl: params.flags.websocketUrl,
      wsProxyHttpSendUrl: (params.flags as any).wsProxyHttpSendUrl,
      wsProxySecret: (params.flags as any).wsProxySecret,
      jwt,
      roomId: params.roomId,
      messageId: params.messageId,
      emoji,
      timeoutMs: params.flags.sendTimeoutMs,
    })
    logger.info('[alfaclub-chat] command_reaction_sent', {
      roomId: params.roomId,
      messageId: params.messageId,
      emoji,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    logger.warn('[alfaclub-chat] command_reaction_failed', {
      roomId: params.roomId,
      messageId: params.messageId,
      emoji,
      error: detail.slice(0, 180),
    })
  }
}

async function sendCommandReplyToRoom(params: {
  flags: AlfaClubChatBridgeFlags
  jwt: string
  roomId: string
  text: string
  attachments: AlfaClubMessageAttachment[]
  replyToMessageId: string
  commandMessageId: string
}): Promise<string> {
  const idempotencyKey = buildBotMessageIdempotencyKey({
    roomId: params.roomId,
    messageId: params.commandMessageId,
  })
  const hasAttachments = params.attachments.length > 0

  if (hasAttachments) {
    try {
      const lane = await sendRoomMessageViaWebSocket({
        websocketUrl: params.flags.websocketUrl,
        wsProxyHttpSendUrl: (params.flags as any).wsProxyHttpSendUrl,
        wsProxySecret: (params.flags as any).wsProxySecret,
        jwt: params.jwt,
        roomId: params.roomId,
        text: params.text,
        attachments: params.attachments,
        replyToMessageId: params.replyToMessageId,
        timeoutMs: params.flags.sendTimeoutMs,
      })
      return lane === 'ws_proxy_http' ? 'ws_proxy_http_with_reply_id' : 'websocket_with_reply_id'
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger.warn('[alfaclub-chat] ws_reply_with_attachments_failed', {
        roomId: params.roomId,
        messageId: params.commandMessageId,
        error: detail.slice(0, 180),
      })
    }
  }

  if (params.flags.botToken) {
    try {
      const sendResult = await sendRoomMessageViaBotTokenWithProxyFallback({
        apiBaseUrl: resolveAlfaClubApiCallBaseUrl(params.flags),
        directApiBaseUrl: params.flags.apiBaseUrl,
        botToken: params.flags.botToken,
        roomId: params.roomId,
        text: params.text,
        replyToMessageId: params.replyToMessageId,
        proxySecret: resolveAlfaClubProxySecret(params.flags),
        idempotencyKey,
        timeoutMs: params.flags.sendTimeoutMs,
      })
      if (!hasAttachments) {
        return 'bot_token_with_reply_id'
      }
      logger.warn('[alfaclub-chat] bot_reply_text_only_attachments_dropped', {
        roomId: params.roomId,
        messageId: params.commandMessageId,
        sendResult,
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger.warn('[alfaclub-chat] bot_reply_with_reply_id_failed', {
        roomId: params.roomId,
        messageId: params.commandMessageId,
        error: detail.slice(0, 180),
      })
    }
  }

  const lane = await sendRoomMessageViaWebSocket({
    websocketUrl: params.flags.websocketUrl,
    wsProxyHttpSendUrl: (params.flags as any).wsProxyHttpSendUrl,
    wsProxySecret: (params.flags as any).wsProxySecret,
    jwt: params.jwt,
    roomId: params.roomId,
    text: params.text,
    attachments: params.attachments,
    replyToMessageId: params.replyToMessageId,
    timeoutMs: params.flags.sendTimeoutMs,
  })
  return lane === 'ws_proxy_http' ? 'ws_proxy_http_fallback' : 'websocket_fallback'
}

type BridgeState = {
  seeded: boolean
  seenMessageIds: Set<string>
  liveCommandQueue: AlfaClubCommandMessage[]
  liveFallbackActive: boolean
  liveSocket: BridgeWebSocket | null
  liveSocketJwt: string | null
  liveSocketWebsocketUrl: string | null
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
  liveSocketWebsocketUrl: null,
  liveSocketRoomId: null,
}

type RollupTimer = ReturnType<typeof setTimeout> | null

const bridgeAuthState = {
  lastBadJwt: null as string | null,
  lastBadJwtAt: 0,
  lastBadJwtWarnAt: Number.NEGATIVE_INFINITY,
  privyRefreshKickedThisTick: false,
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
  wsErrorLastCode: null as string | null,
  wsErrorLastErrno: null as string | null,
  wsErrorLastHandshakeStatus: null as number | null,
  wsErrorLastPhase: null as 'handshake' | 'connected' | 'unknown' | null,
  wsErrorLastUpstream: null as string | null,
  wsBenignWindowByRoom: new Map<string, number[]>(),
  wsCloseAtMs: [] as number[],
  wsCloseChurnLastLoggedAt: Number.NEGATIVE_INFINITY,
  cfChallengeRepeats: 0,
  cfChallengeFirstAt: 0,
  cfChallengeFirstCfRay: null as string | null,
  cfChallengeFlushTimer: null as RollupTimer,
  cfChallengeRoomId: null as string | null,
  cfChallengeLastCfRay: null as string | null,
  cfChallengeLastHtmlErrorCode: null as string | null,
  cfChallengeSustainedFlagged: false,
}

function recordBenignWsErrorWindow(params: { roomId: string; now: number }): { windowsInLast10m: number } {
  const previous = bridgeAuthState.wsBenignWindowByRoom.get(params.roomId) ?? []
  const recent = previous.filter((value) => params.now - value <= WS_BENIGN_ESCALATION_WINDOW_MS)
  recent.push(params.now)
  bridgeAuthState.wsBenignWindowByRoom.set(params.roomId, recent)
  return { windowsInLast10m: recent.length }
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

type HistoryErrorKind = 'cf_challenge' | 'auth' | 'timeout' | 'other'

function isRoomHistoryTimeoutError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).trim()
  return message.startsWith('room_history_failed:timeout:')
}

function classifyHistoryError(error: unknown): HistoryErrorKind {
  if (isCloudflareChallengeError(error)) return 'cf_challenge'
  if (isRoomHistoryAuthError(error)) return 'auth'
  if (isRoomHistoryTimeoutError(error)) return 'timeout'
  return 'other'
}

/**
 * Consecutive history-fetch timeouts per room. The always-on Railway bridge
 * polls every few seconds, and the AlfaClub edge stalls roughly one request
 * per minute past the abort timeout (observed 2026-06-10: ~1 of ~17 polls;
 * the next tick always recovers, WS ingest keeps landing). A single timeout
 * is therefore expected steady-state noise, not an incident — log it at
 * info and return an early tick result instead of throwing a tick error.
 * Sustained consecutive timeouts (a real outage of the proxy/upstream)
 * escalate back to warn.
 */
const consecutiveHistoryTimeoutsByRoom = new Map<string, number>()
const HISTORY_TIMEOUT_SUSTAINED_THRESHOLD = 5

function noteHistoryTimeout(roomId: string): number {
  const next = (consecutiveHistoryTimeoutsByRoom.get(roomId) ?? 0) + 1
  consecutiveHistoryTimeoutsByRoom.set(roomId, next)
  return next
}

function clearHistoryTimeouts(roomId: string): void {
  consecutiveHistoryTimeoutsByRoom.delete(roomId)
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
    const benign = isBenignWsError({
      message: bridgeAuthState.wsErrorLastMessage,
      code: bridgeAuthState.wsErrorLastCode,
      errno: bridgeAuthState.wsErrorLastErrno,
    })
    const emit = benign ? logger.info.bind(logger) : logger.warn.bind(logger)
    emit('[alfaclub-chat] ws_error:rollup', {
      roomId: bridgeAuthState.wsErrorRoomId,
      repeats,
      windowStartedAt: bridgeAuthState.wsErrorFirstAt
        ? new Date(bridgeAuthState.wsErrorFirstAt).toISOString()
        : null,
      lastMessage: bridgeAuthState.wsErrorLastMessage,
      code: bridgeAuthState.wsErrorLastCode,
      errno: bridgeAuthState.wsErrorLastErrno,
      handshakeStatus: bridgeAuthState.wsErrorLastHandshakeStatus,
      phase: bridgeAuthState.wsErrorLastPhase,
      upstream: bridgeAuthState.wsErrorLastUpstream,
    })
  }
  bridgeAuthState.wsErrorRepeats = 0
  bridgeAuthState.wsErrorFirstAt = 0
  bridgeAuthState.wsErrorLastLoggedAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.wsErrorRoomId = null
  bridgeAuthState.wsErrorLastMessage = null
  bridgeAuthState.wsErrorLastCode = null
  bridgeAuthState.wsErrorLastErrno = null
  bridgeAuthState.wsErrorLastHandshakeStatus = null
  bridgeAuthState.wsErrorLastPhase = null
  bridgeAuthState.wsErrorLastUpstream = null
}

function warnWsError(params: {
  roomId: string
  message: string
  code?: string | null
  errno?: string | null
  syscall?: string | null
  address?: string | null
  port?: number | null
  handshakeStatus?: number | null
  phase?: 'handshake' | 'connected' | 'unknown'
  upstream?: string | null
  now?: number
}): void {
  const now = params.now ?? Date.now()
  const truncated = params.message.slice(0, 180)
  const normalizedCode = typeof params.code === 'string' ? params.code.trim() : ''
  const normalizedErrno = typeof params.errno === 'string' ? params.errno.trim() : ''
  const benign = isBenignWsError({
    message: truncated,
    code: normalizedCode || null,
    errno: normalizedErrno || null,
  })

  if (
    bridgeAuthState.wsErrorRepeats > 0 &&
    now - bridgeAuthState.wsErrorFirstAt <= LOG_ROLLUP_WINDOW_MS
  ) {
    bridgeAuthState.wsErrorRepeats += 1
    bridgeAuthState.wsErrorLastMessage = truncated
    bridgeAuthState.wsErrorLastCode = normalizedCode || null
    bridgeAuthState.wsErrorLastErrno = normalizedErrno || null
    bridgeAuthState.wsErrorLastHandshakeStatus = params.handshakeStatus ?? null
    bridgeAuthState.wsErrorLastPhase = params.phase ?? 'unknown'
    bridgeAuthState.wsErrorLastUpstream = params.upstream ?? null
    return
  }

  bridgeAuthState.wsErrorFirstAt = now
  bridgeAuthState.wsErrorRepeats = 1
  bridgeAuthState.wsErrorRoomId = params.roomId
  bridgeAuthState.wsErrorLastMessage = truncated
  bridgeAuthState.wsErrorLastCode = normalizedCode || null
  bridgeAuthState.wsErrorLastErrno = normalizedErrno || null
  bridgeAuthState.wsErrorLastHandshakeStatus = params.handshakeStatus ?? null
  bridgeAuthState.wsErrorLastPhase = params.phase ?? 'unknown'
  bridgeAuthState.wsErrorLastUpstream = params.upstream ?? null

  const benignWindowStats = benign
    ? recordBenignWsErrorWindow({ roomId: params.roomId, now })
    : { windowsInLast10m: 0 }
  const benignShouldEscalate = benign && benignWindowStats.windowsInLast10m >= WS_BENIGN_ESCALATION_ROLLUP_WINDOWS
  // Benign ws handshake churn (non-101/network flap) is expected under
  // upstream instability and should not page operators. Keep it at info
  // level, but surface sustained windows via `benignEscalated` metadata.
  const emit = benign ? logger.info.bind(logger) : logger.warn.bind(logger)
  emit('[alfaclub-chat] ws_error', {
    roomId: params.roomId,
    repeats: 1,
    windowStartedAt: new Date(now).toISOString(),
    message: truncated,
    code: normalizedCode || null,
    errno: normalizedErrno || null,
    syscall: params.syscall ?? null,
    address: params.address ?? null,
    port: params.port ?? null,
    handshakeStatus: params.handshakeStatus ?? null,
    phase: params.phase ?? 'unknown',
    upstream: params.upstream ?? null,
    benignEscalated: benignShouldEscalate,
    benignWindowsInLast10m: benignWindowStats.windowsInLast10m,
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

function isBenignWsErrorMessage(message: string | null | undefined): boolean {
  return isBenignWsError({ message })
}

function isBenignWsError(params: {
  message?: string | null
  code?: string | null
  errno?: string | null
}): boolean {
  const normalized = String(params.message ?? '')
    .trim()
    .toLowerCase()
  const code = String(params.code ?? '').trim().toUpperCase()
  const errno = String(params.errno ?? '').trim().toUpperCase()
  if (code === 'ECONNRESET' || code === 'EAI_AGAIN' || code === 'ETIMEDOUT') return true
  if (errno === 'ECONNRESET' || errno === 'EAI_AGAIN' || errno === 'ETIMEDOUT') return true
  if (!normalized) return false
  return (
    normalized.includes('received network error or non-101 status code') ||
    normalized.includes('non-101') ||
    normalized.includes('unexpected server response: 403') ||
    normalized.includes('socket hang up') ||
    normalized.includes('before secure tls connection was established') ||
    normalized.includes('client network socket disconnected before secure tls') ||
    normalized.includes('client network socket disconnected before secure tls connection was established')
  )
}

function parseHandshakeStatusFromMessage(message: string): number | null {
  const direct = /\bunexpected server response:\s*(\d{3})\b/i.exec(message)
  if (direct) return Number(direct[1])
  const htmlError = /\bhtml-error-code=(\d{3})\b/i.exec(message)
  if (htmlError) return Number(htmlError[1])
  return null
}

function extractWsErrorContext(event: unknown): {
  message: string
  code: string | null
  errno: string | null
  syscall: string | null
  address: string | null
  port: number | null
  handshakeStatus: number | null
} {
  const root = event && typeof event === 'object' ? (event as Record<string, unknown>) : null
  const nestedError =
    root?.error && typeof root.error === 'object'
      ? (root.error as Record<string, unknown>)
      : null
  const messageCandidate =
    root?.message ??
    nestedError?.message ??
    (event instanceof Error ? event.message : null) ??
    event
  const message = String(messageCandidate ?? 'unknown')
  const code =
    typeof nestedError?.code === 'string'
      ? nestedError.code
      : typeof root?.code === 'string'
        ? root.code
        : null
  const errno =
    typeof nestedError?.errno === 'string'
      ? nestedError.errno
      : typeof root?.errno === 'string'
        ? root.errno
        : null
  const syscall =
    typeof nestedError?.syscall === 'string'
      ? nestedError.syscall
      : typeof root?.syscall === 'string'
        ? root.syscall
        : null
  const address =
    typeof nestedError?.address === 'string'
      ? nestedError.address
      : typeof root?.address === 'string'
        ? root.address
        : null
  const port =
    typeof nestedError?.port === 'number'
      ? nestedError.port
      : typeof root?.port === 'number'
        ? root.port
        : null
  const handshakeStatus = typeof root?.status === 'number'
    ? root.status
    : typeof nestedError?.status === 'number'
      ? nestedError.status
      : parseHandshakeStatusFromMessage(message)
  return { message, code, errno, syscall, address, port, handshakeStatus }
}

function isBenignWsCloseEvent(params: {
  code: number | null
  reason: string | null | undefined
  now?: number
}): boolean {
  const code = params.code
  const reason = String(params.reason ?? '')
    .trim()
    .toLowerCase()
  const now = params.now ?? Date.now()

  // Most noisy production closes come through as 1006 with an empty reason.
  // Treat this as benign by default so warning channels stay actionable.
  if (code === 1006 && !reason) return true

  const likelyHandshakeClose =
    (code === null || code === 1005 || code === 1006) &&
    (!reason || reason.includes('non-101') || reason.includes('network error'))

  if (!likelyHandshakeClose) return false
  if (!isBenignWsErrorMessage(bridgeAuthState.wsErrorLastMessage)) return false
  if (bridgeAuthState.wsErrorFirstAt <= 0) return false
  return now - bridgeAuthState.wsErrorFirstAt <= LOG_ROLLUP_WINDOW_MS
}

function noteWsCloseEvent(params: {
  roomId: string
  code: number | null
  reason: string
  now?: number
}): void {
  const now = params.now ?? Date.now()
  const windowStart = now - WS_CLOSE_CHURN_WINDOW_MS
  bridgeAuthState.wsCloseAtMs = bridgeAuthState.wsCloseAtMs.filter((value) => value >= windowStart)
  bridgeAuthState.wsCloseAtMs.push(now)

  const closesInWindow = bridgeAuthState.wsCloseAtMs.length
  if (closesInWindow < WS_CLOSE_CHURN_THRESHOLD) return
  if (now - bridgeAuthState.wsCloseChurnLastLoggedAt <= LOG_ROLLUP_WINDOW_MS) return

  bridgeAuthState.wsCloseChurnLastLoggedAt = now
  const benign = isBenignWsCloseEvent({
    code: params.code,
    reason: params.reason,
    now,
  })
  const emit = benign ? logger.info.bind(logger) : logger.warn.bind(logger)
  emit('[alfaclub-chat] ws_close_churn', {
    roomId: params.roomId,
    closesInWindow,
    windowMs: WS_CLOSE_CHURN_WINDOW_MS,
    latestCode: params.code,
    latestReason: params.reason.slice(0, 120),
    socketBackoffMs: bridgeAuthState.socketBackoffMs,
  })
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
  bridgeState.liveSocketWebsocketUrl = null
  bridgeState.liveSocketRoomId = null
}

function shouldReuseLiveCommandSocket(params: {
  jwt: string
  roomId: string
  websocketUrl: string
  flags: AlfaClubChatBridgeFlags
}): boolean {
  if (!bridgeState.liveSocket || bridgeState.liveSocketJwt !== params.jwt) return false
  if (bridgeState.liveSocketWebsocketUrl !== params.websocketUrl) return false
  // AlfaClub WS URL is JWT-scoped, not room-scoped — rotating poll rooms must not churn.
  if (params.flags.wsIngestAllRoomsEnabled) return true
  return bridgeState.liveSocketRoomId === params.roomId
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
  context?: { roomId: string; jwt: string },
): Promise<void> {
  if (messages.length === 0) return
  const inserted = await upsertAlfaClubIngestMessages(
    messages.map((message) => ({
      roomId: message.roomId,
      messageId: message.id,
      senderAddress: message.sender,
      text: message.text,
      dateMs: message.date,
      attachmentsJson: message.attachments,
      replyAttachmentsJson: message.replyAttachments,
      messagePayloadJson: message.rawPayloadText ? (() => {
        try {
          return JSON.parse(message.rawPayloadText)
        } catch {
          return null
        }
      })() : null,
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

  if (shouldReuseLiveCommandSocket(params)) {
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
  const upstream = wsUrl.host || null

  const socket = new WebSocketCtor(wsUrl.toString())
  bridgeState.liveSocket = socket
  bridgeState.liveSocketJwt = params.jwt
  bridgeState.liveSocketWebsocketUrl = params.websocketUrl
  bridgeState.liveSocketRoomId = params.roomId
  let socketOpened = false

  const onOpen = (): void => {
    socketOpened = true
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
    void ingestLiveMessages(inboundMessages, params.flags, {
      roomId: params.roomId,
      jwt: params.jwt,
    }).catch(() => {
      // Fail-open: ingest should never block chat command processing.
    })
    if (!bridgeState.liveFallbackActive) return
    const pollRoomIds = params.flags.wsIngestAllRoomsEnabled
      ? new Set(resolveAlfaClubBridgePollRoomIds(params.flags))
      : new Set([params.roomId])
    const roomMessages = inboundMessages
      .filter((message) => pollRoomIds.has(message.roomId))
      .map((message): AlfaClubRoomHistoryMessage => ({
        id: message.id,
        date: message.date,
        sender: message.sender,
        text: message.text,
      }))
    const commands = collectAlfaClubCommandMessages({
      messages: roomMessages,
      seenMessageIds: bridgeState.seenMessageIds,
      selfAddress: CANONICAL_CSW_ADDRESS,
    })
    pushLiveCommands(commands)
  }

  const onClose = (event?: any): void => {
    applySocketBackoff()
    const closeCode = typeof event?.code === 'number' ? event.code : null
    const closeReason = typeof event?.reason === 'string' ? event.reason.slice(0, 120) : ''
    const benign = isBenignWsCloseEvent({
      code: closeCode,
      reason: closeReason,
    })
    const emit = benign ? logger.info.bind(logger) : logger.warn.bind(logger)
    emit('[alfaclub-chat] ws_close', {
      roomId: params.roomId,
      code: closeCode,
      reason: closeReason,
    })
    noteWsCloseEvent({
      roomId: params.roomId,
      code: closeCode,
      reason: closeReason,
    })
    if (bridgeState.liveSocket !== socket) return
    bridgeState.liveSocket = null
    bridgeState.liveSocketJwt = null
    bridgeState.liveSocketWebsocketUrl = null
    bridgeState.liveSocketRoomId = null
  }

  const onError = (event?: any): void => {
    applySocketBackoff()
    const wsErrorContext = extractWsErrorContext(event)
    warnWsError({
      roomId: params.roomId,
      message: wsErrorContext.message,
      code: wsErrorContext.code,
      errno: wsErrorContext.errno,
      syscall: wsErrorContext.syscall,
      address: wsErrorContext.address,
      port: wsErrorContext.port,
      handshakeStatus: wsErrorContext.handshakeStatus,
      phase: socketOpened ? 'connected' : 'handshake',
      upstream,
    })
    if (bridgeState.liveSocket !== socket) return
    bridgeState.liveSocket = null
    bridgeState.liveSocketJwt = null
    bridgeState.liveSocketWebsocketUrl = null
    bridgeState.liveSocketRoomId = null
  }

  socket.addEventListener('open', onOpen)
  socket.addEventListener('message', onMessage)
  socket.addEventListener('close', onClose)
  socket.addEventListener('error', onError)
}

async function sendAlfaClubCommandTextReply(params: {
  flags: AlfaClubChatBridgeFlags
  roomId: string
  jwt: string
  text: string
  replyToMessageId: string
}): Promise<void> {
  if (params.flags.botToken) {
    const idempotencyKey = buildBotMessageIdempotencyKey({
      roomId: params.roomId,
      messageId: `${params.replyToMessageId}:followup`,
    })
    await sendRoomMessageViaBotTokenWithProxyFallback({
      apiBaseUrl: resolveAlfaClubApiCallBaseUrl(params.flags),
      directApiBaseUrl: params.flags.apiBaseUrl,
      botToken: params.flags.botToken,
      roomId: params.roomId,
      text: params.text,
      replyToMessageId: params.replyToMessageId,
      proxySecret: resolveAlfaClubProxySecret(params.flags),
      idempotencyKey,
      timeoutMs: params.flags.sendTimeoutMs,
    })
    return
  }
  await sendRoomMessageViaWebSocket({
    websocketUrl: params.flags.websocketUrl,
    wsProxyHttpSendUrl: (params.flags as any).wsProxyHttpSendUrl,
    wsProxySecret: (params.flags as any).wsProxySecret,
    jwt: params.jwt,
    roomId: params.roomId,
    text: params.text,
    replyToMessageId: params.replyToMessageId,
    timeoutMs: params.flags.sendTimeoutMs,
  })
}

async function executeCommandBatch(params: {
  commands: AlfaClubCommandMessage[]
  flags: AlfaClubChatBridgeFlags
  roomId: string
  jwt: string
}): Promise<{ processed: number; replied: number; errors: Array<{ messageId: string; error: string }> }> {
  // Safety invariant: only reply inside configured bridge/Hermit command rooms.
  if (!canBridgeReplyInRoom(params.flags, params.roomId)) {
    return { processed: 0, replied: 0, errors: [] }
  }
  const unrepliedIds = await filterUnrepliedCommandMessageIds({
    roomId: params.roomId,
    messageIds: params.commands.map((command) => command.id),
  })
  const commands = params.commands.filter((command) => unrepliedIds.has(command.id))
  if (commands.length === 0) {
    return { processed: 0, replied: 0, errors: [] }
  }
  const errors: Array<{ messageId: string; error: string }> = []
  let replied = 0
  let latestMarkReadDate = 0

  for (const command of commands) {
    const commandHead = command.text.trim().split(/\s+/, 1)[0] ?? command.text.trim()
    logger.info('[alfaclub-chat] command_execute_start', {
      roomId: params.roomId,
      messageId: command.id,
      sender: command.sender,
      command: commandHead,
    })
    try {
      const { executeDeterministicCommand } = await import(
        '../../agents/core/executeDeterministicCommand.js'
      )
      const result = await executeDeterministicCommand({
        groupId: params.flags.groupId,
        senderWallet: resolveCommandSenderWallet(command.sender),
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
      const reactionEmoji = extractAlfaClubReactionEmoji(result.action)
      const lane = await sendCommandReplyToRoom({
        flags: params.flags,
        jwt: params.jwt,
        roomId: params.roomId,
        text: responseText,
        attachments,
        replyToMessageId: command.id,
        commandMessageId: command.id,
      })
      logger.info('[alfaclub-chat] command_reply_sent', {
        roomId: params.roomId,
        messageId: command.id,
        sender: command.sender,
        lane,
        hasAttachments: attachments.length > 0,
      })
      await recordCommandReply({
        roomId: params.roomId,
        messageId: command.id,
        commandHead,
      })
      if (reactionEmoji) {
        await reactToAlfaClubTriggerMessage({
          flags: params.flags,
          jwt: params.jwt,
          roomId: params.roomId,
          messageId: command.id,
          emoji: reactionEmoji,
        })
      }
      replied += 1
      const followUpText = extractAlfaClubFollowUpText(result.action)
      if (followUpText) {
        try {
          await sendAlfaClubCommandTextReply({
            flags: params.flags,
            roomId: params.roomId,
            jwt: params.jwt,
            text: followUpText,
            replyToMessageId: command.id,
          })
          logger.info('[alfaclub-chat] command_followup_sent', {
            roomId: params.roomId,
            messageId: command.id,
            sender: command.sender,
          })
        } catch (followUpError) {
          const detail =
            followUpError instanceof Error ? followUpError.message : String(followUpError)
          logger.warn('[alfaclub-chat] command_followup_failed', {
            roomId: params.roomId,
            messageId: command.id,
            error: detail.slice(0, 180),
          })
        }
      }
      latestMarkReadDate = Math.max(latestMarkReadDate, command.date)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      errors.push({
        messageId: command.id,
        error: detail,
      })
      logger.warn('[alfaclub-chat] command_execute_failed', {
        roomId: params.roomId,
        messageId: command.id,
        sender: command.sender,
        command: commandHead,
        error: detail.slice(0, 220),
      })
    }
  }

  if (latestMarkReadDate > 0) {
    try {
      await markReadMessage({
        apiBaseUrl: resolveAlfaClubApiCallBaseUrl(params.flags),
        fingerprintBaseUrl: resolveAlfaClubFingerprintBaseUrl(params.flags),
        proxySecret: resolveAlfaClubProxySecret(params.flags),
        roomId: params.roomId,
        jwt: params.jwt,
        messageDate: latestMarkReadDate,
        timeoutMs: params.flags.requestTimeoutMs,
      })
    } catch (markReadError) {
      const detail = markReadError instanceof Error ? markReadError.message : String(markReadError)
      logger.warn('[alfaclub-chat] command_batch_mark_read_failed', {
        roomId: params.roomId,
        error: detail.slice(0, 180),
      })
    }
  }

  return {
    processed: commands.length,
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

export type RunBridgeTickOptions = {
  // Continuous in-process bridge mode seeds first and skips historical replay.
  // One-shot cron mode should process newly ingested commands immediately.
  seedHistoryOnlyOnFirstTick?: boolean
  /** Serverless cron: skip WS connect (no cross-invocation session). Default on via readAlfaClubCronSkipLiveWebSocket(). */
  skipLiveWebSocket?: boolean
  /** Cron mode: upsert only slash-command candidates into chat_ingest (less DB write churn). */
  ingestCommandCandidatesOnly?: boolean
  /** When set, poll/execute against this room instead of flags.roomId only. */
  pollRoomId?: string
}

function shouldConnectLiveWebSocket(
  options: RunBridgeTickOptions,
  flags: AlfaClubChatBridgeFlags,
  ingestJwt: string | null,
): boolean {
  if (options.skipLiveWebSocket) return false
  return Boolean(flags.wsIngestAllRoomsEnabled && ingestJwt)
}

async function kickPrivyRefreshOncePerTick(): Promise<void> {
  if (bridgeAuthState.privyRefreshKickedThisTick) return
  bridgeAuthState.privyRefreshKickedThisTick = true
  await requestImmediatePrivyRefresh('bridge_auth_fail').catch(() => {})
}

async function retryRoomHistoryAfterAuthFailure(params: {
  flags: AlfaClubChatBridgeFlags
  roomId: string
  failedJwt: string
  fallbackJwt: string | null
}): Promise<{
  fetchedMessages: AlfaClubRoomHistoryMessage[] | null
  jwt: string | null
  resolvedCommandJwt: { jwt: string | null; source: BridgeJwtSource }
  historyError: unknown | null
}> {
  rememberBadJwt(params.failedJwt)
  await kickPrivyRefreshOncePerTick()
  const recovered = await resolveBridgeJwtWithSource(params.fallbackJwt)
  const jwt = recovered.jwt
  if (!jwt) {
    return {
      fetchedMessages: null,
      jwt: null,
      resolvedCommandJwt: recovered,
      historyError: new Error('room_history_failed:401'),
    }
  }

  try {
    const fetchedMessages = await fetchRoomHistory({
      apiBaseUrl: resolveAlfaClubApiCallBaseUrl(params.flags),
      fingerprintBaseUrl: resolveAlfaClubFingerprintBaseUrl(params.flags),
      proxySecret: resolveAlfaClubProxySecret(params.flags),
      roomId: params.roomId,
      jwt,
      limit: params.flags.historyLimit,
      timeoutMs: params.flags.requestTimeoutMs,
    })
    clearBadJwt()
    logger.info('[alfaclub-chat] room_history_recovered:after_privy_refresh', {
      roomId: params.roomId,
      jwtSource: recovered.source,
    })
    return {
      fetchedMessages,
      jwt,
      resolvedCommandJwt: recovered,
      historyError: null,
    }
  } catch (retryError) {
    return {
      fetchedMessages: null,
      jwt,
      resolvedCommandJwt: recovered,
      historyError: retryError,
    }
  }
}

async function runBridgeTick(
  flags: AlfaClubChatBridgeFlags,
  options: RunBridgeTickOptions = {},
): Promise<AlfaClubChatBridgeTickResult> {
  bridgeAuthState.privyRefreshKickedThisTick = false
  const seedHistoryOnlyOnFirstTick = options.seedHistoryOnlyOnFirstTick ?? true
  const roomId = (options.pollRoomId ?? flags.roomId) as string
  let resolvedCommandJwt = await resolveBridgeJwtWithSource(flags.jwt)
  let commandJwt = resolvedCommandJwt.jwt
  if (commandJwt && isKnownBadJwt(commandJwt)) {
    await kickPrivyRefreshOncePerTick()
    resolvedCommandJwt = await resolveBridgeJwtWithSource(flags.jwt)
    commandJwt = resolvedCommandJwt.jwt
    if (commandJwt && !isKnownBadJwt(commandJwt)) {
      clearBadJwt()
    }
  }
  const explicitIngestJwt = (flags.ingestJwt ?? '').trim() || null
  const ingestJwt = explicitIngestJwt || commandJwt

  if (!commandJwt && !flags.readBotToken) {
    if (shouldConnectLiveWebSocket(options, flags, ingestJwt)) {
      ensureLiveCommandSocket({
        websocketUrl: flags.websocketUrl,
        roomId,
        jwt: ingestJwt as string,
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
  let jwt = commandJwt ?? ''
  let historyErrorJwt = commandJwt ?? ''
  let fetchedMessages: AlfaClubRoomHistoryMessage[] | null = null
  let historyError: unknown = null
  if (flags.readBotToken) {
    try {
      fetchedMessages = await fetchRoomHistoryViaReadBotToken({
        apiBaseUrl: resolveAlfaClubApiCallBaseUrl(flags),
        proxySecret: resolveAlfaClubProxySecret(flags),
        roomId,
        readBotToken: flags.readBotToken,
        limit: flags.historyLimit,
        timeoutMs: flags.requestTimeoutMs,
      })
    } catch (error) {
      if (!jwt) {
        historyError = error
      } else {
        logger.warn('[alfaclub-chat] read_bot_history_failed:fallback_jwt', {
          roomId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (!fetchedMessages && !historyError) {
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
      if (classifyHistoryError(error) === 'auth' && historyErrorJwt) {
        const recovered = await retryRoomHistoryAfterAuthFailure({
          flags,
          roomId,
          failedJwt: historyErrorJwt,
          fallbackJwt,
        })
        if (!recovered.historyError && recovered.fetchedMessages) {
          fetchedMessages = recovered.fetchedMessages
          jwt = recovered.jwt as string
          historyErrorJwt = jwt
          commandJwt = jwt
          resolvedCommandJwt = recovered.resolvedCommandJwt
          historyError = null
        } else {
          historyError = recovered.historyError ?? error
          if (recovered.jwt) {
            jwt = recovered.jwt
            historyErrorJwt = recovered.jwt
            commandJwt = recovered.jwt
            resolvedCommandJwt = recovered.resolvedCommandJwt
          }
        }
      } else {
        historyError = error
      }

      const shouldRetryWithEnv =
        historyError !== null &&
        resolvedCommandJwt.source === 'db' &&
        Boolean(fallbackJwt) &&
        fallbackJwt !== resolvedCommandJwt.jwt &&
        classifyHistoryError(historyError) === 'auth'
      if (historyError === null) {
        // Recovered via awaited Privy refresh above.
      } else if (!shouldRetryWithEnv) {
        // historyError already set from the initial failure or auth-recovery retry.
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

    if (kind === 'timeout') {
      const consecutive = noteHistoryTimeout(roomId)
      const sustained = consecutive >= HISTORY_TIMEOUT_SUSTAINED_THRESHOLD
      const payload = {
        roomId,
        consecutive,
        error: historyError instanceof Error ? historyError.message : String(historyError),
      }
      if (sustained) {
        logger.warn('[alfaclub-chat] room_history_timeout:sustained', payload)
        // Sustained timeouts surface in the tick result so runtime error
        // rollups notice the degradation.
        return earlyTickResult({
          roomId,
          historyError,
          processed: 0,
          replied: 0,
        })
      }
      logger.info('[alfaclub-chat] room_history_timeout:transient', payload)
      // Transient timeout: the next poll tick recovers on its own and WS
      // ingest keeps landing rows. Return a clean result so runtime
      // consumers do not emit per-tick error warnings for routine edge slowness.
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
    await kickPrivyRefreshOncePerTick()
    warnRoomHistoryAuthFallback({
      roomId,
      jwtSource: resolvedCommandJwt.source,
      now,
      error: historyError instanceof Error ? historyError.message : String(historyError),
    })

    bridgeState.liveFallbackActive = true
    if (shouldConnectLiveWebSocket(options, flags, ingestJwt)) {
      ensureLiveCommandSocket({
        websocketUrl: flags.websocketUrl,
        roomId,
        jwt: ingestJwt as string,
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
  clearHistoryTimeouts(roomId)

  // Persist polled history rows to a DB-backed dedupe ledger so one-shot
  // cron invocations can process newly arrived commands without relying on
  // in-memory state surviving between serverless cold starts.
  let newlyIngestedHistoryIds: Set<string> | null = null
  try {
    const ingestSourceMessages = options.ingestCommandCandidatesOnly
      ? fetchedMessages.filter(isHistoryMessageCommandCandidate)
      : fetchedMessages
    const historyIngestRows: AlfaClubIngestMessage[] = ingestSourceMessages.flatMap((message) => {
      const id = String(message.id ?? '').trim()
      const sender = String(message.sender ?? '').trim().toLowerCase()
      if (!id || !isHexAddress(sender)) return []
      const date = Number(message.date)
      const dateMs = Number.isFinite(date) && date > 0 ? Math.floor(date) : null
      const editDeadlineRaw = Number(message.edit_deadline)
      const editDeadlineMs = Number.isFinite(editDeadlineRaw) && editDeadlineRaw > 0
        ? Math.floor(editDeadlineRaw)
        : null
      const replyDateRaw = Number(message.reply_date)
      const replyDateMs = Number.isFinite(replyDateRaw) && replyDateRaw > 0
        ? Math.floor(replyDateRaw)
        : null
      const deletedAtRaw = message.deleted_at
      const deletedAtMs = (() => {
        if (deletedAtRaw == null) return null
        const asNumber = Number(deletedAtRaw)
        if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber)
        const parsed = Date.parse(String(deletedAtRaw))
        return Number.isFinite(parsed) ? parsed : null
      })()
      const payloadJson = message as Record<string, unknown>
      return [
        {
          roomId,
          messageId: id,
          senderAddress: sender,
          text: String(message.text ?? ''),
          dateMs,
          username: typeof message.username === 'string' ? message.username : null,
          avatarUrl: typeof message.avatar === 'string' ? message.avatar : null,
          isBot: typeof message.isBot === 'boolean' ? message.isBot : null,
          isEdited: typeof message.is_edited === 'boolean' ? message.is_edited : null,
          editDeadlineMs,
          deletedAtMs,
          deletedBy: typeof message.deleted_by === 'string' ? message.deleted_by : null,
          deletedByUsername: typeof message.deleted_by_username === 'string' ? message.deleted_by_username : null,
          replyId: typeof message.reply_id === 'string' ? message.reply_id : null,
          replyDateMs,
          replyText: typeof message.reply_text === 'string' ? message.reply_text : null,
          replySender: typeof message.reply_sender === 'string' ? message.reply_sender : null,
          replyUsername: typeof message.reply_username === 'string' ? message.reply_username : null,
          keysCount: typeof message.keys === 'number' ? Math.floor(message.keys) : null,
          primaryTag: typeof message.primary_tag === 'string' ? message.primary_tag : null,
          primaryTagVariant: typeof message.primary_tag_variant === 'string' ? message.primary_tag_variant : null,
          attachmentsJson: message.attachments ?? null,
          replyAttachmentsJson: message.reply_attachments ?? null,
          reactionsJson: message.reactions ?? null,
          messagePayloadJson: payloadJson,
          source: 'history',
          rawPayloadText: (() => {
            try {
              return JSON.stringify(message)
            } catch {
              return null
            }
          })(),
        },
      ]
    })
    const inserted = await upsertAlfaClubIngestMessages(
      historyIngestRows,
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

  if (shouldConnectLiveWebSocket(options, flags, ingestJwt)) {
    ensureLiveCommandSocket({
      websocketUrl: flags.websocketUrl,
      roomId,
      jwt: ingestJwt as string,
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
      const recentCutoffMs = Date.now() - FIRST_TICK_RECENT_COMMAND_WINDOW_MS
      const recentMessages = unseenMessages.filter((message) => {
        const date = Number(message.date)
        return Number.isFinite(date) && date >= recentCutoffMs
      })
      const recentCommands = collectAlfaClubCommandMessages({
        messages: recentMessages,
        seenMessageIds: new Set<string>(),
        selfAddress: CANONICAL_CSW_ADDRESS,
      })
      const recentBatch =
        recentCommands.length > 0
          ? await executeCommandBatch({
              commands: recentCommands,
              flags,
              roomId,
              jwt,
            })
          : { processed: 0, replied: 0, errors: [] as Array<{ messageId: string; error: string }> }
      return {
        seeded: true,
        roomId,
        fetched: fetchedMessages.length,
        unseen: unseenMessages.length,
        processed: recentBatch.processed,
        replied: recentBatch.replied,
        errors: recentBatch.errors,
      }
    }
  }

  // Long-running in-process bridge: `unseenMessages` + `bridgeState.seenMessageIds`
  // prevent replay within the same process.
  // Vercel cron (seedHistoryOnlyOnFirstTick=false): stateless — only execute
  // slash commands for history rows that were *inserted* this tick (not every
  // ON CONFLICT update), otherwise /gmeow is re-run every minute and spams chat.
  const commandSourceMessages = seedHistoryOnlyOnFirstTick
    ? unseenMessages
    : newlyIngestedHistoryIds === null
      ? []
      : unseenMessages.filter((message) =>
          newlyIngestedHistoryIds.has(String(message.id ?? '').trim()),
        )

  const commands = collectAlfaClubCommandMessages({
    messages: commandSourceMessages,
    seenMessageIds: new Set<string>(),
    selfAddress: CANONICAL_CSW_ADDRESS,
  })
  if (commands.length > 0) {
    logger.info('[alfaclub-chat] command_batch_detected', {
      roomId,
      count: commands.length,
      ids: commands.map((entry) => entry.id).slice(0, 8),
      commands: commands.map((entry) => entry.text.trim().split(/\s+/, 1)[0] ?? entry.text.trim()).slice(0, 8),
    })
  }
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
  const flags = readAlfaClubChatBridgeFlagsForCronTick()
  if (flags.killSwitch) {
    return {
      ok: false,
      reason: 'kill_switch',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
    }
  }
  if (shouldBlockRailwayBridge(flags)) {
    return {
      ok: false,
      reason: 'railway_blocked',
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
  const pollRoomIds = resolveAlfaClubBridgePollRoomIds(flags)
  if (pollRoomIds.length === 0) {
    return {
      ok: false,
      reason: 'env_missing',
      intervalMs: flags.pollIntervalMs,
      roomId: flags.roomId,
    }
  }

  const tickOptions: RunBridgeTickOptions = {
    seedHistoryOnlyOnFirstTick: false,
    skipLiveWebSocket: readAlfaClubCronSkipLiveWebSocket(),
    ingestCommandCandidatesOnly: true,
  }
  const roomResults: AlfaClubChatBridgeTickResult[] = []
  for (const pollRoomId of pollRoomIds) {
    roomResults.push(
      await runBridgeTick(flags, {
        ...tickOptions,
        pollRoomId,
      }),
    )
  }
  const primaryRoomId = flags.roomId ?? pollRoomIds[0] ?? ''
  const data = aggregateBridgeTickResults(roomResults, primaryRoomId)
  return {
    ok: true,
    intervalMs: flags.pollIntervalMs,
    roomId: primaryRoomId,
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
  if (shouldBlockRailwayBridge(flags)) {
    logger.warn('[alfaclub-chat] bridge disabled on Railway (Vercel cron is canonical)', {
      flag: 'ALFACLUB_CHAT_BRIDGE_ENABLED',
      overrideFlag: 'ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY',
    })
    return {
      started: false,
      reason: 'railway_blocked',
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
  const pollRoomIds = resolveAlfaClubBridgePollRoomIds(flags)
  if (pollRoomIds.length === 0) {
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
    liveSocketWebsocketUrl: null,
    liveSocketRoomId: null,
  }

  const runTick = async (): Promise<void> => {
    if (activeTickPromise !== null) return
    const tickPromise = (async () => {
      try {
        for (const pollRoomId of pollRoomIds) {
          const result = await runBridgeTick(flags, { pollRoomId })
          opts?.onTick?.(result)
        }
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
  replyToMessageId?: string
  proxySecret?: string | null
  idempotencyKey: string
  timeoutMs: number
}): Promise<BotSendResultSummary> {
  return sendRoomMessageViaBotToken(params)
}

export async function _sendRoomMessageViaBotTokenWithProxyFallbackForTests(params: {
  apiBaseUrl: string
  directApiBaseUrl: string
  botToken: string
  roomId: string
  text: string
  replyToMessageId?: string
  proxySecret?: string | null
  idempotencyKey: string
  timeoutMs: number
}): Promise<BotSendResultSummary> {
  return sendRoomMessageViaBotTokenWithProxyFallback(params)
}

export async function _sendRoomMessageViaWebSocketForTests(params: {
  websocketUrl: string
  wsProxyHttpSendUrl?: string | null
  wsProxySecret?: string | null
  jwt: string
  roomId: string
  text: string
  attachments?: unknown
  replyToMessageId?: string
  timeoutMs: number
}): Promise<'ws_proxy_http' | 'websocket'> {
  return sendRoomMessageViaWebSocket(params)
}

export async function sendAlfaClubRoomText(params: {
  text: string
  roomId?: string | null
  replyToMessageId?: string
  flags?: AlfaClubChatBridgeFlags
  jwt?: string | null
  attachments?: unknown
}): Promise<{ lane: string }> {
  const flags = params.flags ?? readAlfaClubChatBridgeFlags()
  const roomId = (params.roomId ?? flags.roomId ?? '').trim()
  if (!roomId) throw new Error('alfaclub_room_id_missing')
  const text = String(params.text ?? '').trim()
  if (!text) throw new Error('alfaclub_message_empty')

  const jwt = (await resolveBridgeJwt(params.jwt ?? flags.jwt ?? null))?.trim() ?? ''
  const idempotencyKey = buildBotMessageIdempotencyKey({
    roomId,
    messageId: params.replyToMessageId ?? `room-text-${Date.now()}`,
  })

  if (flags.botToken) {
    try {
      await sendRoomMessageViaBotTokenWithProxyFallback({
        apiBaseUrl: resolveAlfaClubApiCallBaseUrl(flags),
        directApiBaseUrl: flags.apiBaseUrl,
        botToken: flags.botToken,
        roomId,
        text,
        replyToMessageId: params.replyToMessageId,
        proxySecret: resolveAlfaClubProxySecret(flags),
        idempotencyKey,
        timeoutMs: flags.sendTimeoutMs,
      })
      return {
        lane: params.replyToMessageId ? 'bot_token_with_reply_id' : 'bot_token_without_reply_id',
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      if (!jwt || !isBotMessageForbiddenError(error)) {
        throw error
      }
      logger.warn('[alfaclub-chat] bot_send_forbidden:fallback_jwt', {
        roomId,
        error: detail.slice(0, 180),
      })
      try {
        await sendRoomMessageViaJwtHttpWithProxyFallback({
          apiBaseUrl: resolveAlfaClubApiCallBaseUrl(flags),
          directApiBaseUrl: flags.apiBaseUrl,
          jwt,
          roomId,
          text,
          replyToMessageId: params.replyToMessageId,
          proxySecret: resolveAlfaClubProxySecret(flags),
          timeoutMs: flags.sendTimeoutMs,
        })
        return {
          lane: params.replyToMessageId
            ? 'jwt_http_with_reply_id_after_bot_forbidden'
            : 'jwt_http_without_reply_id_after_bot_forbidden',
        }
      } catch (jwtHttpError) {
        let lastJwtHttpError: unknown = jwtHttpError
        logger.warn('[alfaclub-chat] jwt_http_send_failed:fallback_ws', {
          roomId,
          error: (jwtHttpError instanceof Error ? jwtHttpError.message : String(jwtHttpError)).slice(
            0,
            180,
          ),
        })
        if (isJwtMessageAuthError(jwtHttpError)) {
          await requestImmediatePrivyRefresh('bridge_auth_fail').catch(() => {})
          const refreshedJwt =
            (await resolveBridgeJwt(params.jwt ?? flags.jwt ?? null))?.trim() ?? ''
          if (refreshedJwt && refreshedJwt !== jwt) {
            try {
              await sendRoomMessageViaJwtHttpWithProxyFallback({
                apiBaseUrl: resolveAlfaClubApiCallBaseUrl(flags),
                directApiBaseUrl: flags.apiBaseUrl,
                jwt: refreshedJwt,
                roomId,
                text,
                replyToMessageId: params.replyToMessageId,
                proxySecret: resolveAlfaClubProxySecret(flags),
                timeoutMs: flags.sendTimeoutMs,
              })
              return {
                lane: params.replyToMessageId
                  ? 'jwt_http_with_reply_id_after_refresh'
                  : 'jwt_http_without_reply_id_after_refresh',
              }
            } catch (retryError) {
              lastJwtHttpError = retryError
              logger.warn('[alfaclub-chat] jwt_http_send_failed:after_refresh', {
                roomId,
                error: (retryError instanceof Error ? retryError.message : String(retryError)).slice(
                  0,
                  180,
                ),
              })
            }
          }
        }
        if (shouldSkipRawWebSocketSend(flags)) {
          throw lastJwtHttpError instanceof Error
            ? lastJwtHttpError
            : new Error(String(lastJwtHttpError))
        }
      }
    }
  }

  if (!jwt) throw new Error('alfaclub_jwt_missing')
  const wsLane = await sendRoomMessageViaWebSocket({
    websocketUrl: flags.websocketUrl,
    wsProxyHttpSendUrl: flags.wsProxyHttpSendUrl,
    wsProxySecret: flags.wsProxySecret,
    jwt,
    roomId,
    text,
    attachments: params.attachments,
    replyToMessageId: params.replyToMessageId,
    timeoutMs: flags.sendTimeoutMs,
  })
  const jwtLane = wsLane === 'ws_proxy_http' ? 'ws_proxy_http_primary' : 'websocket_primary'
  return {
    lane: flags.botToken ? `${jwtLane}_after_bot_forbidden` : jwtLane,
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
    liveSocketWebsocketUrl: null,
    liveSocketRoomId: null,
  }
  consecutiveHistoryTimeoutsByRoom.clear()
  bridgeAuthState.lastBadJwt = null
  bridgeAuthState.lastBadJwtAt = 0
  bridgeAuthState.lastBadJwtWarnAt = Number.NEGATIVE_INFINITY
  bridgeAuthState.privyRefreshKickedThisTick = false
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
  bridgeAuthState.wsErrorLastCode = null
  bridgeAuthState.wsErrorLastErrno = null
  bridgeAuthState.wsErrorLastHandshakeStatus = null
  bridgeAuthState.wsErrorLastPhase = null
  bridgeAuthState.wsErrorLastUpstream = null
  bridgeAuthState.wsBenignWindowByRoom.clear()
  bridgeAuthState.wsCloseAtMs = []
  bridgeAuthState.wsCloseChurnLastLoggedAt = Number.NEGATIVE_INFINITY
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
  options: RunBridgeTickOptions = {},
): Promise<AlfaClubChatBridgeTickResult> {
  return runBridgeTick(flags, options)
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
