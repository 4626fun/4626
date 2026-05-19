/**
 * Relay Telegram group/topic messages into an AlfaClub room via the bot-token API.
 *
 * Env (all optional except enable + room when turning the feature on):
 * - TELEGRAM_TO_ALFACLUB_ENABLED
 * - TELEGRAM_TO_ALFACLUB_CHAT_ID — source supergroup/channel id or t.me/c/… URL
 * - TELEGRAM_TO_ALFACLUB_THREAD_ID — forum topic id (omit for General / all topics)
 * - TELEGRAM_TO_ALFACLUB_ROOM_ID — destination AlfaClub room (defaults to ALFACLUB_CHAT_ROOM_ID)
 * - TELEGRAM_TO_ALFACLUB_PREFIX — prepended to each relayed line
 * - TELEGRAM_TO_ALFACLUB_TEXT_ONLY — when true, skip empty text (no caption-only relays)
 */

import { logger } from '../infra/logger.js'
import { readAlfaClubChatBridgeFlags, sendAlfaClubRoomText } from './chatBridge.js'
import { normalizeTelegramChatIdForMatch, parseTelegramChatRef } from './telegramChatRef.js'

declare const process: { env: Record<string, string | undefined> }

export type TelegramToAlfaclubRelayConfig = {
  enabled: boolean
  sourceChatId: string | null
  sourceThreadId: number | null
  roomId: string | null
  prefix: string
  textOnly: boolean
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

function parseBool(value: string | undefined): boolean {
  const raw = normalizeEnvScalar(value).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function parseOptionalPositiveInt(value: string | undefined, max: number): number | null {
  const raw = normalizeEnvScalar(value)
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, max)
}

export function readTelegramToAlfaclubRelayConfig(
  env: Record<string, string | undefined> = process.env,
): TelegramToAlfaclubRelayConfig {
  const chatRef = parseTelegramChatRef(normalizeEnvScalar(env.TELEGRAM_TO_ALFACLUB_CHAT_ID) || null)
  const threadFromEnv = parseOptionalPositiveInt(env.TELEGRAM_TO_ALFACLUB_THREAD_ID, 2_000_000_000)
  const roomRaw = normalizeEnvScalar(env.TELEGRAM_TO_ALFACLUB_ROOM_ID)
  const fallbackRoom = normalizeEnvScalar(env.ALFACLUB_CHAT_ROOM_ID)
  const roomCandidate = /^\d+$/.test(roomRaw) ? roomRaw : /^\d+$/.test(fallbackRoom) ? fallbackRoom : null

  return {
    enabled: parseBool(env.TELEGRAM_TO_ALFACLUB_ENABLED),
    sourceChatId: chatRef.chatId,
    sourceThreadId: threadFromEnv ?? chatRef.inferredThreadId,
    roomId: roomCandidate,
    prefix: normalizeEnvScalar(env.TELEGRAM_TO_ALFACLUB_PREFIX),
    textOnly: parseBool(env.TELEGRAM_TO_ALFACLUB_TEXT_ONLY),
  }
}

export function matchesTelegramToAlfaclubSource(params: {
  chatId: string
  messageThreadId?: number | null
  config?: TelegramToAlfaclubRelayConfig
}): boolean {
  const config = params.config ?? readTelegramToAlfaclubRelayConfig()
  if (!config.enabled || !config.sourceChatId) return false

  const incomingChatId = normalizeTelegramChatIdForMatch(params.chatId)
  const configuredChatId = normalizeTelegramChatIdForMatch(config.sourceChatId)
  if (incomingChatId !== configuredChatId) return false

  if (config.sourceThreadId == null) return true
  const threadId =
    typeof params.messageThreadId === 'number' && Number.isFinite(params.messageThreadId)
      ? params.messageThreadId
      : null
  return threadId === config.sourceThreadId
}

export function formatTelegramToAlfaclubBody(params: {
  text: string
  username?: string | null
  userId?: string | null
  prefix?: string
}): string {
  const text = String(params.text ?? '').replace(/\s+/g, ' ').trim()
  const prefix = String(params.prefix ?? '').trim()
  const handle = String(params.username ?? '').trim()
  const userId = String(params.userId ?? '').trim()
  const who = handle ? `@${handle.replace(/^@/, '')}` : userId ? `tg:${userId}` : 'telegram'
  const core = text || '(no text)'
  if (prefix) return `${prefix} ${who}: ${core}`.trim()
  return `${who}: ${core}`
}

export type TelegramToAlfaclubRelayResult =
  | { status: 'disabled' }
  | { status: 'skipped'; reason: string }
  | { status: 'relayed'; roomId: string; lane: string }
  | { status: 'failed'; error: string }

/**
 * When the update matches the configured Telegram source, post into AlfaClub and
 * return `relayed` so the webhook can skip duplicate local command handling.
 */
export async function relayTelegramMessageToAlfaClub(params: {
  chatId: string
  messageId?: number
  messageThreadId?: number | null
  text: string
  username?: string | null
  userId?: string | null
  config?: TelegramToAlfaclubRelayConfig
}): Promise<TelegramToAlfaclubRelayResult> {
  const config = params.config ?? readTelegramToAlfaclubRelayConfig()
  if (!config.enabled) return { status: 'disabled' }

  if (!matchesTelegramToAlfaclubSource({
    chatId: params.chatId,
    messageThreadId: params.messageThreadId,
    config,
  })) {
    return { status: 'skipped', reason: 'source_mismatch' }
  }

  const roomId = (config.roomId ?? '').trim()
  if (!roomId) {
    return { status: 'failed', error: 'room_id_missing' }
  }

  const text = String(params.text ?? '').trim()
  if (config.textOnly && !text) {
    return { status: 'skipped', reason: 'text_only_empty' }
  }

  const flags = readAlfaClubChatBridgeFlags()
  if (!flags.botToken) {
    return { status: 'failed', error: 'alfaclub_bot_token_missing' }
  }

  const body = formatTelegramToAlfaclubBody({
    text,
    username: params.username,
    userId: params.userId,
    prefix: config.prefix,
  })

  const dedupeKey =
    typeof params.messageId === 'number' && Number.isFinite(params.messageId)
      ? `telegram:${normalizeTelegramChatIdForMatch(params.chatId)}:${params.messageId}`
      : `telegram:${normalizeTelegramChatIdForMatch(params.chatId)}:${Date.now()}`

  try {
    const send = await sendAlfaClubRoomText({
      text: body,
      roomId,
      replyToMessageId: dedupeKey,
      flags,
    })
    logger.info('[telegram-to-alfaclub] relayed', {
      roomId,
      chatId: params.chatId,
      messageId: params.messageId ?? null,
      lane: send.lane,
    })
    return { status: 'relayed', roomId, lane: send.lane }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('[telegram-to-alfaclub] relay_failed', {
      roomId,
      chatId: params.chatId,
      messageId: params.messageId ?? null,
      error: message.slice(0, 220),
    })
    return { status: 'failed', error: message.slice(0, 220) }
  }
}
