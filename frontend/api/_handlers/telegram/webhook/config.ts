import { z } from 'zod'

import { asTrimmed, parseBoolean, parseOptionalPositiveInteger } from './utils.js'

declare const process: { env: Record<string, string | undefined> }

const RawTelegramWebhookEnvSchema = z
  .object({
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    TELEGRAM_TARGET_CHAT_ID: z.string().optional(),
    TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
    TELEGRAM_ADMIN_USER_IDS: z.string().optional(),
    TELEGRAM_ALLOW_PRIVATE_DMS: z.string().optional(),
    TELEGRAM_ALLOW_ALL_PRIVATE_DMS: z.string().optional(),
    TELEGRAM_ALLOW_ADMIN_DM: z.string().optional(),
    TELEGRAM_AI_FOLLOWUP_ENABLED: z.string().optional(),
    TELEGRAM_STARS_TIPS_ENABLED: z.string().optional(),
    TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS: z.string().optional(),
    TELEGRAM_STARS_PROVIDER_TOKEN: z.string().optional(),
    TELEGRAM_SIGNALS_CHAT_ID: z.string().optional(),
    TELEGRAM_SIGNALS_THREAD_BY_CHAT_JSON: z.string().optional(),
    TELEGRAM_SIGNALS_THREAD_ID: z.string().optional(),
    TELEGRAM_USER_WALLET_MAP_JSON: z.string().optional(),
    TELEGRAM_DEFAULT_SENDER_WALLET: z.string().optional(),
    TELEGRAM_GROUP_ID_MAP_JSON: z.string().optional(),
    TELEGRAM_DEFAULT_GROUP_ID: z.string().optional(),
    TELEGRAM_ETH_USD: z.string().optional(),
    TELEGRAM_BID_ETH_USD: z.string().optional(),
    TELEGRAM_SHARE_USD_FALLBACK: z.string().optional(),
    BASE_RPC_URL: z.string().optional(),
    CDP_PAYMASTER_URL: z.string().optional(),
    CDP_PAYMASTER_AND_BUNDLER_URL: z.string().optional(),
    CDP_PAYMASTER_AND_BUNDLER_ENDPOINT: z.string().optional(),
    PAYMASTER_URL: z.string().optional(),
    BUNDLER_URL: z.string().optional(),
    PRIVY_APP_ID: z.string().optional(),
    PRIVY_APP_SECRET: z.string().optional(),
    TELEGRAM_INLINE_MAX_RESULTS: z.string().optional(),
    TELEGRAM_INLINE_GROWTH_MODE: z.string().optional(),
    TELEGRAM_INLINE_PM_HANDOFF_ENABLED: z.string().optional(),
    TELEGRAM_INLINE_MEDIA_JSON: z.string().optional(),
    TELEGRAM_INLINE_PREPARED_ENABLED: z.string().optional(),
    TELEGRAM_MINI_APP_URL: z.string().optional(),
    TELEGRAM_MENU_BUTTON_MODE: z.string().optional(),
    TELEGRAM_MENU_BUTTON_TEXT: z.string().optional(),
    TELEGRAM_BOT_CONFIG_SECRET: z.string().optional(),
    TELEGRAM_LINK_API_SECRET: z.string().optional(),
    TELEGRAM_MINIAPP_SESSION_ENABLED: z.string().optional(),
    TELEGRAM_MINIAPP_SESSION_CHAT_IDS: z.string().optional(),
    TELEGRAM_MINIAPP_SESSION_USER_IDS: z.string().optional(),
    TELEGRAM_MINIAPP_INITDATA_MAX_AGE_SECONDS: z.string().optional(),
    TELEGRAM_MINIAPP_SESSION_TTL_SECONDS: z.string().optional(),
    TELEGRAM_MINIAPP_REPLAY_TTL_SECONDS: z.string().optional(),
    TELEGRAM_HOLDER_ROOMS_ENABLED: z.string().optional(),
    TELEGRAM_REQUIRE_TRADE_MEMBERSHIP: z.string().optional(),
    TELEGRAM_COPY_TEXT_BUTTONS: z.string().optional(),
  })
  .passthrough()

export type TelegramWebhookConfig = {
  botToken: string
  webhookSecret: string
  targetChatId: string
  allowedChatIdsRaw: string
  adminUserIdsRaw: string
  allowPrivateDms: boolean
  allowAdminDm: boolean
  aiFollowupEnabled: boolean
  starsTipsEnabled: boolean
  starsTipsAllowedChatIdsRaw: string
  starsProviderToken: string
  signalsChatId: string
  signalsThreadByChatJsonRaw: string
  signalsThreadId: number | null
  userWalletMapJsonRaw: string
  defaultSenderWallet: string
  groupIdMapJsonRaw: string
  defaultGroupId: string
  ethUsdRaw: string
  bidEthUsdRaw: string
  shareUsdFallbackRaw: string
  baseRpcUrl: string
  paymasterUrlCandidates: string[]
  privyAppId: string
  privyAppSecret: string
  inlineMaxResults: number
  inlineGrowthMode: boolean
  inlinePmHandoffEnabled: boolean
  inlineMediaJsonRaw: string
  inlinePreparedEnabled: boolean
  miniAppUrl: string
  menuButtonMode: 'web_app' | 'commands'
  menuButtonText: string
  botConfigSecret: string
  linkApiSecret: string
  miniAppSessionEnabled: boolean
  miniAppSessionChatIdsRaw: string
  miniAppSessionUserIdsRaw: string
  miniAppInitDataMaxAgeSeconds: number
  miniAppSessionTtlSeconds: number
  miniAppReplayTtlSeconds: number
  holderRoomsEnabled: boolean
  requireTradeMembership: boolean
  copyTextButtons: boolean
}

function buildConfig(raw: z.infer<typeof RawTelegramWebhookEnvSchema>): TelegramWebhookConfig {
  const botToken = asTrimmed(raw.TELEGRAM_BOT_TOKEN ?? '')
  const targetChatId = asTrimmed(raw.TELEGRAM_TARGET_CHAT_ID ?? '')
  const allowedChatIdsRaw = asTrimmed(raw.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
  const allowPrivateDmsExplicit = parseBoolean(raw.TELEGRAM_ALLOW_PRIVATE_DMS, false)
  const allowPrivateDms = allowPrivateDmsExplicit || parseBoolean(raw.TELEGRAM_ALLOW_ALL_PRIVATE_DMS, false)

  const inlineCapRaw = Number(asTrimmed(raw.TELEGRAM_INLINE_MAX_RESULTS ?? ''))
  const inlineMaxResults =
    Number.isFinite(inlineCapRaw) && inlineCapRaw >= 3 && inlineCapRaw <= 20 ? Math.floor(inlineCapRaw) : 8
  const menuButtonModeRaw = asTrimmed(raw.TELEGRAM_MENU_BUTTON_MODE ?? '').toLowerCase()
  const menuButtonMode: 'web_app' | 'commands' = menuButtonModeRaw === 'commands' ? 'commands' : 'web_app'
  const miniAppInitDataMaxAgeSeconds = Math.max(
    30,
    Math.min(60 * 5, parseOptionalPositiveInteger(raw.TELEGRAM_MINIAPP_INITDATA_MAX_AGE_SECONDS ?? '') ?? 60 * 5),
  )
  const miniAppSessionTtlSeconds = Math.max(
    60,
    Math.min(60 * 5, parseOptionalPositiveInteger(raw.TELEGRAM_MINIAPP_SESSION_TTL_SECONDS ?? '') ?? 60 * 5),
  )
  const miniAppReplayTtlSeconds = Math.max(
    60,
    Math.min(
      miniAppSessionTtlSeconds,
      60 * 60,
      parseOptionalPositiveInteger(raw.TELEGRAM_MINIAPP_REPLAY_TTL_SECONDS ?? '') ?? miniAppSessionTtlSeconds,
    ),
  )

  const paymasterUrlCandidates = [
    asTrimmed(raw.CDP_PAYMASTER_URL ?? ''),
    asTrimmed(raw.CDP_PAYMASTER_AND_BUNDLER_URL ?? ''),
    asTrimmed(raw.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? ''),
    asTrimmed(raw.PAYMASTER_URL ?? ''),
    asTrimmed(raw.BUNDLER_URL ?? ''),
  ].filter(Boolean)

  return {
    botToken,
    webhookSecret: asTrimmed(raw.TELEGRAM_WEBHOOK_SECRET ?? ''),
    targetChatId,
    allowedChatIdsRaw,
    adminUserIdsRaw: asTrimmed(raw.TELEGRAM_ADMIN_USER_IDS ?? ''),
    allowPrivateDms,
    allowAdminDm: parseBoolean(raw.TELEGRAM_ALLOW_ADMIN_DM, true),
    aiFollowupEnabled: parseBoolean(raw.TELEGRAM_AI_FOLLOWUP_ENABLED, true),
    starsTipsEnabled: parseBoolean(raw.TELEGRAM_STARS_TIPS_ENABLED, false),
    starsTipsAllowedChatIdsRaw: asTrimmed(raw.TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS ?? ''),
    starsProviderToken: asTrimmed(raw.TELEGRAM_STARS_PROVIDER_TOKEN ?? ''),
    signalsChatId: asTrimmed(raw.TELEGRAM_SIGNALS_CHAT_ID ?? ''),
    signalsThreadByChatJsonRaw: asTrimmed(raw.TELEGRAM_SIGNALS_THREAD_BY_CHAT_JSON ?? ''),
    signalsThreadId: parseOptionalPositiveInteger(raw.TELEGRAM_SIGNALS_THREAD_ID ?? ''),
    userWalletMapJsonRaw: asTrimmed(raw.TELEGRAM_USER_WALLET_MAP_JSON ?? ''),
    defaultSenderWallet: asTrimmed(raw.TELEGRAM_DEFAULT_SENDER_WALLET ?? ''),
    groupIdMapJsonRaw: asTrimmed(raw.TELEGRAM_GROUP_ID_MAP_JSON ?? ''),
    defaultGroupId: asTrimmed(raw.TELEGRAM_DEFAULT_GROUP_ID ?? ''),
    ethUsdRaw: asTrimmed(raw.TELEGRAM_ETH_USD ?? ''),
    bidEthUsdRaw: asTrimmed(raw.TELEGRAM_BID_ETH_USD ?? ''),
    shareUsdFallbackRaw: asTrimmed(raw.TELEGRAM_SHARE_USD_FALLBACK ?? ''),
    baseRpcUrl: asTrimmed(raw.BASE_RPC_URL ?? ''),
    paymasterUrlCandidates,
    privyAppId: asTrimmed(raw.PRIVY_APP_ID ?? ''),
    privyAppSecret: asTrimmed(raw.PRIVY_APP_SECRET ?? ''),
    inlineMaxResults,
    inlineGrowthMode: parseBoolean(raw.TELEGRAM_INLINE_GROWTH_MODE, false),
    inlinePmHandoffEnabled: parseBoolean(raw.TELEGRAM_INLINE_PM_HANDOFF_ENABLED, true),
    inlineMediaJsonRaw: asTrimmed(raw.TELEGRAM_INLINE_MEDIA_JSON ?? ''),
    inlinePreparedEnabled: parseBoolean(raw.TELEGRAM_INLINE_PREPARED_ENABLED, true),
    miniAppUrl: asTrimmed(raw.TELEGRAM_MINI_APP_URL ?? ''),
    menuButtonMode,
    menuButtonText: asTrimmed(raw.TELEGRAM_MENU_BUTTON_TEXT ?? ''),
    botConfigSecret: asTrimmed(raw.TELEGRAM_BOT_CONFIG_SECRET ?? raw.TELEGRAM_LINK_API_SECRET ?? ''),
    linkApiSecret: asTrimmed(raw.TELEGRAM_LINK_API_SECRET ?? raw.TELEGRAM_BOT_CONFIG_SECRET ?? ''),
    miniAppSessionEnabled: parseBoolean(raw.TELEGRAM_MINIAPP_SESSION_ENABLED, true),
    miniAppSessionChatIdsRaw: asTrimmed(raw.TELEGRAM_MINIAPP_SESSION_CHAT_IDS ?? ''),
    miniAppSessionUserIdsRaw: asTrimmed(raw.TELEGRAM_MINIAPP_SESSION_USER_IDS ?? ''),
    miniAppInitDataMaxAgeSeconds,
    miniAppSessionTtlSeconds,
    miniAppReplayTtlSeconds,
    holderRoomsEnabled: parseBoolean(raw.TELEGRAM_HOLDER_ROOMS_ENABLED, false),
    requireTradeMembership: parseBoolean(raw.TELEGRAM_REQUIRE_TRADE_MEMBERSHIP, false),
    copyTextButtons: parseBoolean(raw.TELEGRAM_COPY_TEXT_BUTTONS, true),
  }
}

export function getTelegramWebhookConfig(): TelegramWebhookConfig {
  const parsed = RawTelegramWebhookEnvSchema.parse(process.env)
  return buildConfig(parsed)
}

export function getBundlerAndPaymasterUrlFromConfig(config = getTelegramWebhookConfig()): string {
  const value = config.paymasterUrlCandidates[0] ?? ''
  if (!value) {
    throw new Error(
      'Missing paymaster/bundler URL. Set one of CDP_PAYMASTER_URL, CDP_PAYMASTER_AND_BUNDLER_URL, CDP_PAYMASTER_AND_BUNDLER_ENDPOINT, PAYMASTER_URL, or BUNDLER_URL.',
    )
  }
  return value
}

export function resetTelegramWebhookConfigForTests(): void {
  // no-op; config is parsed fresh on each call.
}
