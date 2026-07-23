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
 * - TELEGRAM_TO_ALFACLUB_DM_ENABLED — default off; set 1/true/on to enable
 * - TELEGRAM_TO_ALFACLUB_DM_USER_IDS — required comma allowlist of Telegram user ids
 * - TELEGRAM_TO_ALFACLUB_DM_ROOM_ID — AlfaClub room context override for DMs;
 *   falls back to TELEGRAM_TO_ALFACLUB_ROOM_ID, then the first
 *   ALFACLUB_HERMIT_COMMAND_ROOMS entry, then ALFACLUB_CHAT_ROOM_ID.
 */

declare const process: { env: Record<string, string | undefined> }

import { ZERO_ADDRESS } from './constants.js'
import { resolveSenderWalletWithSource } from './env.js'
import { asTrimmed, splitTelegramMessage } from './utils.js'

export type HermitTelegramDmConfig = {
  enabled: boolean
  /** Empty set disables the DM lane even when TELEGRAM_TO_ALFACLUB_DM_ENABLED=1. */
  allowedUserIds: Set<string>
  /** Optional AlfaClub room id used only for group context / market awareness. */
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

function parseBoolDefaultFalse(value: string | undefined): boolean {
  const raw = normalizeEnvScalar(value).toLowerCase()
  if (!raw) return false
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
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
    enabled: parseBoolDefaultFalse(env.TELEGRAM_TO_ALFACLUB_DM_ENABLED) && allowedUserIds.size > 0,
    allowedUserIds,
    roomId,
  }
}

export function isHermitDmUserAllowed(
  userId: string,
  config: HermitTelegramDmConfig,
): boolean {
  if (config.allowedUserIds.size === 0) return false
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
    const [{ executeDeterministicCommand }, { readAlfaClubChatBridgeFlags }, { isHermitOperatorOnlyCommand }] =
      await Promise.all([
        import('../../../../server/agents/core/executeDeterministicCommand.js'),
        import('../../../../server/_lib/alfaclub/chatBridge.js'),
        import('../../../../server/_lib/hermit/operatorPolicy.js'),
      ])

    const flags = readAlfaClubChatBridgeFlags()
    const roomId = String(config.roomId ?? '').trim()
    const groupId = flags.groupId || (roomId ? `alfaclub-room-${roomId}` : `alfaclub-room-unknown`)
    // Route DM creative commands through the AlfaClub chatId shape so the Hermit
    // allowlist short-circuit applies; TELEGRAM_TO_ALFACLUB_DM_USER_IDS is the
    // DM gate. Operator-only commands still require a mapped wallet (checked above).
    const executorChatId = roomId ? `alfaclub:${roomId}` : `telegram:dm:${params.chatId}`
    const senderWalletResolution = resolveSenderWalletWithSource(params.userId)
    const senderWallet =
      senderWalletResolution.source === 'user_map'
        ? senderWalletResolution.wallet
        : ZERO_ADDRESS

    if (senderWalletResolution.source !== 'user_map' && isHermitOperatorOnlyCommand(commandText)) {
      const { sendTelegramMessage } = await import('./telegramApi/messaging.js')
      await sendTelegramMessage({
        botToken: params.botToken,
        chatId: params.chatId,
        text: 'This DM command requires a wallet-mapped Telegram user.',
        ...(typeof params.messageId === 'number' ? { replyToMessageId: params.messageId } : {}),
      })
      return { status: 'replied', roomId: config.roomId, ok: false }
    }

    const result = await executeDeterministicCommand({
      groupId,
      senderWallet,
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
