/**
 * Hermit bot (hermit4626bot) Telegram DM lane.
 *
 * The Hermit ingress is relay-only for the configured group/topic, but private
 * chats with the bot should still get an answer. DM text routes through the
 * same deterministic command stack the AlfaClub bridge uses, scoped to the
 * configured AlfaClub room context (e.g. room 1659 for position monitoring),
 * and the result is sent back to the DM via the Hermit bot token.
 *
 * Env:
 * - TELEGRAM_TO_ALFACLUB_DM_ENABLED — default on; set 0/false/off to disable
 * - TELEGRAM_TO_ALFACLUB_DM_USER_IDS — optional comma allowlist of Telegram user ids
 * - TELEGRAM_TO_ALFACLUB_DM_ROOM_ID — AlfaClub room context override for DMs;
 *   falls back to TELEGRAM_TO_ALFACLUB_ROOM_ID, then the first
 *   ALFACLUB_HERMIT_COMMAND_ROOMS entry, then ALFACLUB_CHAT_ROOM_ID.
 */

declare const process: { env: Record<string, string | undefined> }

import { asTrimmed, splitTelegramMessage } from './utils.js'

export type HermitTelegramDmConfig = {
  enabled: boolean
  /** Empty set = any Telegram user may DM the bot. */
  allowedUserIds: Set<string>
  /** AlfaClub room id used as the command context (`alfaclub:<roomId>`). */
  roomId: string | null
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

function parseBoolDefaultTrue(value: string | undefined): boolean {
  const raw = normalizeEnvScalar(value).toLowerCase()
  if (!raw) return true
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no')
}

function firstNumericToken(raw: string): string | null {
  for (const part of raw.split(',')) {
    const token = part.trim()
    if (/^\d+$/.test(token)) return token
  }
  return null
}

export function readHermitTelegramDmConfig(
  env: Record<string, string | undefined> = process.env,
): HermitTelegramDmConfig {
  const allowedUserIds = new Set(
    normalizeEnvScalar(env.TELEGRAM_TO_ALFACLUB_DM_USER_IDS)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => /^\d+$/.test(part)),
  )

  const roomId =
    firstNumericToken(normalizeEnvScalar(env.TELEGRAM_TO_ALFACLUB_DM_ROOM_ID)) ??
    firstNumericToken(normalizeEnvScalar(env.TELEGRAM_TO_ALFACLUB_ROOM_ID)) ??
    firstNumericToken(normalizeEnvScalar(env.ALFACLUB_HERMIT_COMMAND_ROOMS)) ??
    firstNumericToken(normalizeEnvScalar(env.ALFACLUB_CHAT_ROOM_ID))

  return {
    enabled: parseBoolDefaultTrue(env.TELEGRAM_TO_ALFACLUB_DM_ENABLED),
    allowedUserIds,
    roomId,
  }
}

export function isHermitDmUserAllowed(
  userId: string,
  config: HermitTelegramDmConfig,
): boolean {
  if (config.allowedUserIds.size === 0) return true
  return config.allowedUserIds.has(asTrimmed(userId))
}

/**
 * Map DM text onto the deterministic command surface:
 * - `/start` → `/help` (Telegram convention; the executor has no `/start`)
 * - other `/commands` run as-is (same surface the AlfaClub bridge exposes)
 * - plain text becomes a `/hermit <text>` creative/market-aware draft
 */
export function buildHermitDmCommandText(text: string): string {
  const trimmed = asTrimmed(text)
  if (!trimmed) return ''
  if (/^\/start\b/i.test(trimmed)) return '/help'
  if (trimmed.startsWith('/')) return trimmed
  return `/hermit ${trimmed}`
}

export type HermitTelegramDmResult =
  | { status: 'disabled' }
  | { status: 'not_allowed' }
  | { status: 'empty' }
  | { status: 'replied'; roomId: string | null; ok: boolean }
  | { status: 'failed'; error: string }

export async function handleHermitTelegramDm(params: {
  botToken: string
  chatId: string
  userId: string
  messageId?: number
  text: string
  config?: HermitTelegramDmConfig
}): Promise<HermitTelegramDmResult> {
  const config = params.config ?? readHermitTelegramDmConfig()
  if (!config.enabled) return { status: 'disabled' }
  if (!isHermitDmUserAllowed(params.userId, config)) return { status: 'not_allowed' }

  const commandText = buildHermitDmCommandText(params.text)
  if (!commandText) return { status: 'empty' }

  try {
    const [{ executeDeterministicCommand }, { readAlfaClubChatBridgeFlags }, { resolveSenderWallet }] =
      await Promise.all([
        import('../../../../server/agents/core/executeDeterministicCommand.js'),
        import('../../../../server/_lib/alfaclub/chatBridge.js'),
        import('./env.js'),
      ])

    const flags = readAlfaClubChatBridgeFlags()
    const groupId = flags.groupId || `alfaclub-room-${config.roomId ?? 'unknown'}`
    const executorChatId = config.roomId ? `alfaclub:${config.roomId}` : `telegram:dm:${params.chatId}`

    const result = await executeDeterministicCommand({
      groupId,
      senderWallet: resolveSenderWallet(params.userId),
      text: commandText,
      chatId: executorChatId,
      userId: `tg:${params.userId}`,
      emptyResponseFallback: 'No response generated. Try /help for available commands.',
    })

    const { sendTelegramMessage } = await import('./telegramApi/messaging.js')
    const chunks = splitTelegramMessage(result.responseText)
    let replyToMessageId = params.messageId
    for (const chunk of chunks.length > 0 ? chunks : ['No response generated.']) {
      await sendTelegramMessage({
        botToken: params.botToken,
        chatId: params.chatId,
        text: chunk,
        ...(typeof replyToMessageId === 'number' ? { replyToMessageId } : {}),
      })
      replyToMessageId = undefined
    }
    return { status: 'replied', roomId: config.roomId, ok: result.ok }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { status: 'failed', error: message.slice(0, 220) }
  }
}
