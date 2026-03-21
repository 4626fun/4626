import { ZERO_ADDRESS } from './constants.js'
import { getBundlerAndPaymasterUrlFromConfig, getTelegramWebhookConfig } from './config.js'
import { asTrimmed, isAddressLike, parseDelimitedSet, parseJsonObject, parseOptionalPositiveInteger } from './utils.js'

export type TelegramInlineMediaAsset = {
  photoUrl?: string
  thumbnailUrl?: string
  videoUrl?: string
  mpeg4GifUrl?: string
  documentUrl?: string
  documentMimeType?: string
  videoMimeType?: string
}

export function parseAdminUserIds(): Set<string> {
  const raw = getTelegramWebhookConfig().adminUserIdsRaw
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[\s,]+/g)
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

export function parseAllowedChatIds(): Set<string> {
  const { allowedChatIdsRaw, targetChatId } = getTelegramWebhookConfig()
  const explicit = allowedChatIdsRaw
  if (explicit) {
    return new Set(
      explicit
        .split(/[\s,]+/g)
        .map((part) => part.trim())
        .filter(Boolean),
    )
  }
  const fallback = targetChatId
  return fallback ? new Set([fallback]) : new Set()
}

export function isTelegramPrivateDmEnabled(): boolean {
  return getTelegramWebhookConfig().allowPrivateDms
}

export function areStarsTipsEnabled(): boolean {
  return getTelegramWebhookConfig().starsTipsEnabled
}

export function isStarsTipsEnabledForChat(chatId: string): boolean {
  if (!areStarsTipsEnabled()) return false
  const allowedRaw = getTelegramWebhookConfig().starsTipsAllowedChatIdsRaw
  if (!allowedRaw) return true
  const allowed = parseDelimitedSet(allowedRaw)
  return allowed.has(chatId)
}

export function resolveSignalsDestination(sourceChatId: string): { chatId: string; messageThreadId?: number } {
  const config = getTelegramWebhookConfig()
  const destinationChatId = config.signalsChatId || sourceChatId
  const byChat = parseJsonObject(config.signalsThreadByChatJsonRaw)
  const mapped =
    byChat[sourceChatId] ??
    byChat[destinationChatId] ??
    byChat[String(sourceChatId)] ??
    byChat[String(destinationChatId)]
  const threadId = parseOptionalPositiveInteger(String(mapped ?? '')) ?? config.signalsThreadId

  return {
    chatId: destinationChatId,
    ...(threadId ? { messageThreadId: threadId } : {}),
  }
}

export function isPrivateChatId(chatId: string): boolean {
  return !chatId.startsWith('-')
}

export function resolveSenderWallet(userId: string): `0x${string}` {
  const config = getTelegramWebhookConfig()
  const userWalletMap = parseJsonObject(config.userWalletMapJsonRaw)
  const mapped = asTrimmed(userWalletMap[userId])
  if (isAddressLike(mapped)) return mapped.toLowerCase() as `0x${string}`

  const fallback = config.defaultSenderWallet
  if (isAddressLike(fallback)) return fallback.toLowerCase() as `0x${string}`

  return ZERO_ADDRESS
}

export function resolveGroupId(chatId: string): string {
  const config = getTelegramWebhookConfig()
  const groupMap = parseJsonObject(config.groupIdMapJsonRaw)
  const mapped = asTrimmed(groupMap[chatId])
  if (mapped) return mapped

  const fallback = config.defaultGroupId
  if (fallback) return fallback

  return `telegram:${chatId}`
}

export function isTelegramAiFollowupEnabled(): boolean {
  return getTelegramWebhookConfig().aiFollowupEnabled
}

export function readEthUsdPrice(): number {
  const config = getTelegramWebhookConfig()
  const direct = Number(config.ethUsdRaw)
  if (Number.isFinite(direct) && direct > 0) return direct
  const fallback = Number(config.bidEthUsdRaw)
  if (Number.isFinite(fallback) && fallback > 0) return fallback
  return 3000
}

export function readShareUsdFallback(): number {
  const value = Number(getTelegramWebhookConfig().shareUsdFallbackRaw)
  if (Number.isFinite(value) && value > 0) return value
  return 1
}

export function getBaseRpcUrl(): string {
  const rpc = getTelegramWebhookConfig().baseRpcUrl
  return rpc || 'https://mainnet.base.org'
}

export function getBundlerAndPaymasterUrl(): string {
  return getBundlerAndPaymasterUrlFromConfig()
}

export function readInlineQueryResultCap(): number {
  return getTelegramWebhookConfig().inlineMaxResults
}

export function isTelegramInlineGrowthModeEnabled(): boolean {
  return getTelegramWebhookConfig().inlineGrowthMode
}

export function isTelegramInlinePmHandoffEnabled(): boolean {
  return getTelegramWebhookConfig().inlinePmHandoffEnabled
}

export function isTelegramInlinePreparedEnabled(): boolean {
  return getTelegramWebhookConfig().inlinePreparedEnabled
}

function readInlineMediaUrl(value: unknown): string | undefined {
  const parsed = asTrimmed(value)
  if (!/^https?:\/\/[^\s]+$/i.test(parsed)) return undefined
  return parsed
}

export function readInlineMediaAssetMap(): Record<string, TelegramInlineMediaAsset> {
  const raw = asTrimmed(getTelegramWebhookConfig().inlineMediaJsonRaw)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const output: Record<string, TelegramInlineMediaAsset> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const media = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
      if (!media) continue
      output[key] = {
        ...(readInlineMediaUrl(media.photoUrl) ? { photoUrl: readInlineMediaUrl(media.photoUrl) } : {}),
        ...(readInlineMediaUrl(media.thumbnailUrl) ? { thumbnailUrl: readInlineMediaUrl(media.thumbnailUrl) } : {}),
        ...(readInlineMediaUrl(media.videoUrl) ? { videoUrl: readInlineMediaUrl(media.videoUrl) } : {}),
        ...(readInlineMediaUrl(media.mpeg4GifUrl) ? { mpeg4GifUrl: readInlineMediaUrl(media.mpeg4GifUrl) } : {}),
        ...(readInlineMediaUrl(media.documentUrl) ? { documentUrl: readInlineMediaUrl(media.documentUrl) } : {}),
        ...(asTrimmed(media.documentMimeType) ? { documentMimeType: asTrimmed(media.documentMimeType) } : {}),
        ...(asTrimmed(media.videoMimeType) ? { videoMimeType: asTrimmed(media.videoMimeType) } : {}),
      }
    }
    return output
  } catch {
    return {}
  }
}

export function resolveTelegramMiniAppUrl(): string {
  const configured = getTelegramWebhookConfig().miniAppUrl
  if (configured) return configured
  return 'https://app.4626.fun'
}

export function areHolderRoomsEnabled(): boolean {
  return getTelegramWebhookConfig().holderRoomsEnabled
}

export function readTradeLimitFromEnv(key: string, fallback: number): number {
  const parsed = Number(asTrimmed(process.env[key] ?? ''))
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(1, Math.floor(parsed))
}

export function tradeRateLimitForAction(actionType: 'buy' | 'sell' | 'bid'): { userLimit: number; chatLimit: number } {
  const upper = actionType.toUpperCase()
  const userLimit = readTradeLimitFromEnv(`TELEGRAM_${upper}_USER_LIMIT_PER_MIN`, 4)
  const chatLimit = readTradeLimitFromEnv(`TELEGRAM_${upper}_CHAT_LIMIT_PER_MIN`, 40)
  return { userLimit, chatLimit }
}

export function isTradeMembershipCheckEnabled(): boolean {
  return getTelegramWebhookConfig().requireTradeMembership
}
