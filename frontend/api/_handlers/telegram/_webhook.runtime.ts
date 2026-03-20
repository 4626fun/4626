// Compatibility runtime while webhook modules are fully extracted.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PrivyClient } from '@privy-io/server-auth'
import { createPublicClient, encodeFunctionData, erc20Abi, formatUnits, getAddress, http, parseEther, type Address } from 'viem'
import { base } from 'viem/chains'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { checkSharesEligibility } from '../../../server/_lib/keeprGating.js'
import { ensureKeeprSchema } from '../../../server/_lib/keeprSchema.js'
import { getDb } from '../../../server/_lib/postgres.js'
import {
  isCoinbaseSmartWalletHelperError,
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from '../../../server/_lib/privyCoinbaseSmartWallet.js'
import {
  consumeTelegramActionToken,
  createTelegramLinkStartToken,
  createTelegramActionToken,
  consumeTelegramTradePercentPrompt,
  getTelegramTradePercentPrompt,
  clearTelegramTradePercentPrompt,
  ensureTelegramTradingSchema,
  getTelegramChatTradePolicy,
  getHolderRoomPolicyByVault,
  getTelegramLinkByUserId,
  getTelegramPortfolioSummary,
  listHolderRoomPolicies,
  logTelegramActionAudit,
  logTelegramFunnelEvent,
  isTelegramFunnelEventsEnabledForChat,
  listTelegramAuctions,
  listTelegramScopedVaults,
  listTelegramSignals,
  listTelegramUserBids,
  readTelegramOnboardingSession,
  revokeTelegramLink,
  tryInsertTelegramPrivateDmWelcomeSent,
  upsertTelegramOnboardingSession,
  upsertTelegramTradePercentPrompt,
  upsertHolderRoomMember,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { checkRateLimit, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { handleKeeprCommand } from '../../../server/keepr/commands.js'
import { handleTwitterCommand } from '../../../server/twitter/commands.js'
import { getTelegramWebhookConfig } from './webhook/config.js'
import {
  areHolderRoomsEnabled as areHolderRoomsEnabledShared,
  areStarsTipsEnabled as areStarsTipsEnabledShared,
  getBaseRpcUrl as getBaseRpcUrlShared,
  getBundlerAndPaymasterUrl as getBundlerAndPaymasterUrlShared,
  isPrivateChatId as isPrivateChatIdShared,
  isStarsTipsEnabledForChat as isStarsTipsEnabledForChatShared,
  isTelegramAiFollowupEnabled as isTelegramAiFollowupEnabledShared,
  isTelegramInlineGrowthModeEnabled as isTelegramInlineGrowthModeEnabledShared,
  isTelegramInlinePmHandoffEnabled as isTelegramInlinePmHandoffEnabledShared,
  isTelegramPrivateDmEnabled as isTelegramPrivateDmEnabledShared,
  isTradeMembershipCheckEnabled as isTradeMembershipCheckEnabledShared,
  parseAdminUserIds as parseAdminUserIdsShared,
  parseAllowedChatIds as parseAllowedChatIdsShared,
  readEthUsdPrice as readEthUsdPriceShared,
  readInlineMediaAssetMap as readInlineMediaAssetMapShared,
  readInlineQueryResultCap as readInlineQueryResultCapShared,
  readShareUsdFallback as readShareUsdFallbackShared,
  resolveGroupId as resolveGroupIdShared,
  resolveSenderWallet as resolveSenderWalletShared,
  resolveSignalsDestination as resolveSignalsDestinationShared,
  resolveTelegramMiniAppUrl as resolveTelegramMiniAppUrlShared,
} from './webhook/env.js'
import {
  buildMiniAppLaunchButton as buildMiniAppLaunchButtonShared,
  buildTelegramMiniAppUrl as buildTelegramMiniAppUrlShared,
} from './webhook/miniApp.js'
import {
  resolveHelpCallbackCommand as resolveHelpCallbackCommandShared,
  resolveImmediateCallbackToast as resolveImmediateCallbackToastShared,
  resolveNavigationCallbackToast as resolveNavigationCallbackToastShared,
} from './webhook/parsers/callbackMenu.js'
import { isTelegramNativeCommand as isTelegramNativeCommandShared, normalizeTelegramCommand as normalizeTelegramCommandShared, shouldAutoRouteToAi as shouldAutoRouteToAiShared } from './webhook/parsers/command.js'
import { parseDeployCallbackData as parseDeployCallbackDataShared, parseTelegramDeployIntent as parseTelegramDeployIntentShared } from './webhook/parsers/deploy.js'
import { parseHolderRoomIdentifier as parseHolderRoomIdentifierShared } from './webhook/parsers/holderRooms.js'
import { parseTipCallbackData as parseTipCallbackDataShared, parseTipInvoicePayload as parseTipInvoicePayloadShared } from './webhook/parsers/tips.js'
import {
  buildInlineQueryAnswer,
  classifyInlineQuery,
  type InlineMediaAsset,
  type InlineQueryAnswer,
  type InlineQueryClass,
} from './webhook/parsers/inline.js'
import {
  commandHasArguments as commandHasArgumentsShared,
  parseTelegramTradeIntent as parseTelegramTradeIntentShared,
  parseTradeCallbackData as parseTradeCallbackDataShared,
  parseTradeFlowCallbackData as parseTradeFlowCallbackDataShared,
  resolveTradeTarget as resolveTradeTargetShared,
} from './webhook/parsers/trade.js'
import { reduceTradeFlowState, TRADE_FLOW_IDLE_STATE } from './webhook/trade/fsm.js'
import type { TradeFlowState } from './webhook/trade/types.js'
import { createTelegramHolderRoomInviteLink as createTelegramHolderRoomInviteLinkShared, readTelegramChatMemberStatus as readTelegramChatMemberStatusShared } from './webhook/telegramApi/chats.js'
import { answerTelegramCallbackQuery as answerTelegramCallbackQueryShared, answerTelegramPreCheckoutQuery as answerTelegramPreCheckoutQueryShared } from './webhook/telegramApi/interactions.js'
import { answerTelegramInlineQuery as answerTelegramInlineQueryShared } from './webhook/telegramApi/inline.js'
import { deleteTelegramMessage as deleteTelegramMessageShared, editTelegramMessage as editTelegramMessageShared, replaceTelegramMenuMessage as replaceTelegramMenuMessageShared, sendTelegramMessage as sendTelegramMessageShared } from './webhook/telegramApi/messaging.js'
import { sendTelegramStarsInvoice as sendTelegramStarsInvoiceShared } from './webhook/telegramApi/payments.js'
import { isTelegramContextAllowed } from './webhook/services/access.js'
import { emitTelegramFunnelEvent as emitTelegramFunnelEventShared } from './webhook/services/funnel.js'
import { buildDeployCommandFromIntent as buildDeployCommandFromIntentShared, formatDeployTokenFailure as formatDeployTokenFailureShared } from './webhook/services/deploy.js'
import { checkTelegramTradeRateLimit as checkTelegramTradeRateLimitShared } from './webhook/services/trade.js'
import {
  collectPrivyWalletRows as collectPrivyWalletRowsShared,
  extractPrivyWalletAddressCandidate as extractPrivyWalletAddressCandidateShared,
  extractPrivyWalletIdCandidate as extractPrivyWalletIdCandidateShared,
} from './webhook/services/privyWallet.js'
import { normalizeCallbackQuery } from './webhook/updates/callbackQuery.js'
import { extractUpdateMessage as extractUpdateMessageShared, normalizeMessageContext } from './webhook/updates/message.js'
import { handleChosenInlineResultUpdate } from './webhook/updates/chosenInlineResult.js'
import { handleInlineQueryUpdate } from './webhook/updates/inlineQuery.js'
import { handlePreCheckoutUpdate } from './webhook/updates/preCheckout.js'
import { handleSuccessfulPaymentUpdate } from './webhook/updates/successfulPayment.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const TELEGRAM_MENU_LABELS = {
  connect: '■ Connect',
  wallet: '■ Wallet',
  trade: 'Trade',
  explore: 'Explore',
  help: 'Help',
  vaults: 'Vaults',
  auctions: 'Auctions',
  signals: 'Signals',
  buy: 'Buy',
  sell: 'Sell',
  bid: 'Bid',
  back: 'Back',
} as const

function sanitizeTelegramLabel(label: string): string {
  return label.replace(/\uFE0F/g, '')
}

function menuLabel(key: keyof typeof TELEGRAM_MENU_LABELS): string {
  return sanitizeTelegramLabel(TELEGRAM_MENU_LABELS[key])
}

type TelegramFrom = {
  id?: number | string
  is_bot?: boolean
  username?: string
}

type TelegramChat = {
  id?: number | string
}

type TelegramMessage = {
  message_id?: number
  text?: string
  caption?: string
  from?: TelegramFrom
  chat?: TelegramChat
  reply_to_message?: TelegramMessage
  successful_payment?: TelegramSuccessfulPayment
}

type TelegramInlineQuery = {
  id?: string | number
  query?: string
  offset?: string
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
  from?: TelegramFrom
}

type TelegramChosenInlineResult = {
  result_id?: string
  from?: TelegramFrom
  inline_message_id?: string
  query?: string
}

type TelegramCallbackQuery = {
  id?: string | number
  data?: string
  from?: TelegramFrom
  message?: TelegramMessage
}

type TelegramSuccessfulPayment = {
  currency?: string
  total_amount?: number
  invoice_payload?: string
  telegram_payment_charge_id?: string
  provider_payment_charge_id?: string
}

type TelegramPreCheckoutQuery = {
  id?: string | number
  from?: TelegramFrom
  currency?: string
  total_amount?: number
  invoice_payload?: string
}

type TelegramUpdate = {
  update_id?: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  inline_query?: TelegramInlineQuery
  chosen_inline_result?: TelegramChosenInlineResult
  callback_query?: TelegramCallbackQuery
  pre_checkout_query?: TelegramPreCheckoutQuery
}

type TelegramWebhookOk = {
  ok: true
  ignored?: boolean
  updateId?: number | null
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function emitTelegramFunnelEvent(params: {
  db: Awaited<ReturnType<typeof getDb>> | null | undefined
  telegramUserId?: string | number | bigint | null
  chatId?: string | null
  eventName: string
  actionType?: string | null
  context?: Record<string, unknown> | null
}) {
  emitTelegramFunnelEventShared(params)
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  const raw = asTrimmed(value).toLowerCase()
  if (!raw) return defaultValue
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return defaultValue
}

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

function toCanonicalWalletOrNull(value: unknown): `0x${string}` | null {
  const normalized = asTrimmed(value).toLowerCase()
  if (!isAddressLike(normalized)) return null
  return normalized as `0x${string}`
}

function parseJsonObject(raw: string | undefined): Record<string, unknown> {
  const source = asTrimmed(raw ?? '')
  if (!source) return {}
  try {
    const parsed = JSON.parse(source) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function parseAdminUserIds(): Set<string> {
  return parseAdminUserIdsShared()
}

function parseAllowedChatIds(): Set<string> {
  return parseAllowedChatIdsShared()
}

function isTelegramPrivateDmEnabled(): boolean {
  return isTelegramPrivateDmEnabledShared()
}

function parseOptionalPositiveInteger(value: unknown): number | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function parseDelimitedSet(value: string): Set<string> {
  return new Set(
    value
      .split(/[\s,]+/g)
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

function parseTipStars(raw: unknown): number | null {
  const parsed = parseOptionalPositiveInteger(raw)
  if (!parsed || parsed <= 0) return null
  return parsed
}

function parseTipCallbackData(rawData: string): { stars: number; context: string } | null {
  return parseTipCallbackDataShared(rawData)
}

function parseTipInvoicePayload(rawPayload: unknown): { stars: number; context: string } | null {
  return parseTipInvoicePayloadShared(rawPayload)
}

function areStarsTipsEnabled(): boolean {
  return areStarsTipsEnabledShared()
}

function isStarsTipsEnabledForChat(chatId: string): boolean {
  return isStarsTipsEnabledForChatShared(chatId)
}

function resolveSignalsDestination(sourceChatId: string): { chatId: string; messageThreadId?: number } {
  return resolveSignalsDestinationShared(sourceChatId)
}

function isPrivateChatId(chatId: string): boolean {
  return isPrivateChatIdShared(chatId)
}

function resolveSenderWallet(userId: string): `0x${string}` {
  return resolveSenderWalletShared(userId)
}

function resolveGroupId(chatId: string): string {
  return resolveGroupIdShared(chatId)
}

function resolveCommandExecutionContext(params: {
  chatId: string
  userId: string
  isAdmin: boolean
}): {
  groupId: string
  senderWallet: `0x${string}`
} {
  if (isPrivateChatId(params.chatId) && !params.isAdmin) {
    // Prevent private-DM fallback defaults from inheriting privileged group/sender context.
    return {
      groupId: `telegram:${params.chatId}`,
      senderWallet: ZERO_ADDRESS as `0x${string}`,
    }
  }
  return {
    groupId: resolveGroupId(params.chatId),
    senderWallet: resolveSenderWallet(params.userId),
  }
}

function extractUpdateMessage(update: TelegramUpdate): TelegramMessage | null {
  return extractUpdateMessageShared(update)
}

function splitTelegramMessage(text: string, maxLen = 3500): string[] {
  const value = asTrimmed(text)
  if (!value) return []
  if (value.length <= maxLen) return [value]

  const parts: string[] = []
  let cursor = 0
  while (cursor < value.length) {
    const end = Math.min(cursor + maxLen, value.length)
    parts.push(value.slice(cursor, end))
    cursor = end
  }
  return parts
}

function isTwitterCommand(rawText: string): boolean {
  const lower = asTrimmed(rawText).toLowerCase()
  return /^(\/x|x)(\s|$)/.test(lower) || /^(\/tweet|tweet)(\s|$)/.test(lower)
}

function isInlineLauncherCommand(rawText: string): boolean {
  const lower = asTrimmed(rawText).toLowerCase()
  return /^(\/inline|inline|\/shortcuts|shortcuts)(\s|$)/.test(lower)
}

function isHelpCommand(rawText: string): boolean {
  const text = asTrimmed(rawText)
  return /^\/?help(?:\s+\S+)?\s*$/i.test(text) || /^\/?keepr\s+help(?:\s+\S+)?\s*$/i.test(text)
}

function isHelpCategoryCommand(rawText: string): boolean {
  const text = asTrimmed(rawText)
  return /^\/?help\s+\S+\s*$/i.test(text) || /^\/?keepr\s+help\s+\S+\s*$/i.test(text)
}

function isArenaHelpCommand(rawText: string): boolean {
  const text = asTrimmed(rawText)
  return (
    /^\/?help\s+arena\s*$/i.test(text) ||
    /^\/?keepr\s+help\s+arena\s*$/i.test(text) ||
    /^\/?arena\s+(help|menu)\s*$/i.test(text)
  )
}

const TELEGRAM_NATIVE_COMMANDS = new Set([
  'start',
  'link',
  'linked',
  'unlink',
  'zora',
  'deploy',
  'join',
  'rooms',
  'eligibility',
  'wallet',
  'vaults',
  'list',
  'auctions',
  'mybids',
  'signals',
  'buy',
  'sell',
  'bid',
  'tip',
])

const TELEGRAM_COMMAND_HEADS = [
  'start',
  'help',
  'keepr',
  'link',
  'linked',
  'unlink',
  'zora',
  'deploy',
  'join',
  'rooms',
  'eligibility',
  'wallet',
  'vaults',
  'list',
  'auctions',
  'mybids',
  'signals',
  'buy',
  'sell',
  'bid',
  'tip',
  'inline',
  'shortcuts',
  'x',
  'tweet',
  'ai',
  'mkt',
  'coin',
  'arena',
] as const
const TELEGRAM_COMMAND_HEADS_PATTERN = TELEGRAM_COMMAND_HEADS.join('|')

type TelegramCommandResponse = {
  text: string
  replyMarkup?: Record<string, unknown>
  signalText?: string
  signalReplyMarkup?: Record<string, unknown>
  callbackToast?: string
}

function wrapCommandListingsWithBackticks(text: string): string {
  const splitCommandSuffix = (command: string): { commandPart: string; suffix: string } => {
    const separators = [' — ', ' – ', ' - ', ' | ', ' -> ']
    let hitIndex = -1
    for (const separator of separators) {
      const idx = command.indexOf(separator)
      if (idx > 0 && (hitIndex < 0 || idx < hitIndex)) {
        hitIndex = idx
      }
    }
    if (hitIndex <= 0) return { commandPart: command, suffix: '' }
    return {
      commandPart: command.slice(0, hitIndex).trimEnd(),
      suffix: command.slice(hitIndex),
    }
  }

  const formatCommandForBackticks = (rawCommand: string): string => {
    const command = asTrimmed(rawCommand)
    if (!command || command.includes('`')) return command
    const { commandPart, suffix } = splitCommandSuffix(command)
    const tokens = commandPart.split(/\s+/g).filter(Boolean)
    if (tokens.length === 0) return command

    const hasPlaceholder = tokens.some((token) => /^<[^>]+>$/.test(token) || /^\$<[^>]+>$/.test(token))
    if (!hasPlaceholder) return `\`${commandPart}\`${suffix}`

    const head: string[] = []
    for (const token of tokens) {
      if (head.length === 0) {
        head.push(token)
        continue
      }
      if (/^<[^>]+>$/.test(token) || /^\$<[^>]+>$/.test(token)) break
      if (/^--/.test(token)) break
      if (/^0x[a-fA-F0-9]{6,}$/.test(token)) break
      if (/^\d+(?:\.\d+)?$/.test(token)) break
      if (/^\$\d+(?:\.\d+)?$/.test(token)) break
      if (head.length >= 2) break
      head.push(token)
    }

    const remainder = tokens.slice(head.length).join(' ')
    if (head.length === 0) return `\`${commandPart}\`${suffix}`
    const formatted = remainder ? `\`${head.join(' ')}\` ${remainder}` : `\`${head.join(' ')}\``
    return `${formatted}${suffix}`
  }

  const bulletCommandPattern = new RegExp(`^(\\s*[-*]\\s*)(\\/(?:${TELEGRAM_COMMAND_HEADS_PATTERN})\\b.*)$`, 'i')
  const commandAfterColonPattern = new RegExp(`^(.*?:\\s+)(\\/(?:${TELEGRAM_COMMAND_HEADS_PATTERN})\\b.*)$`, 'i')
  const inlineCommandPattern = new RegExp(
    `(^|\\s)(\\/(?:${TELEGRAM_COMMAND_HEADS_PATTERN})\\b(?:\\s+[a-z0-9_<>$:./-]+(?:\\s+[a-z0-9_<>$:./-]+)*)?)`,
    'gi',
  )

  return text
    .split('\n')
    .map((line) => {
      if (!line || line.includes('`')) return line
      const bulletMatch = line.match(bulletCommandPattern)
      if (bulletMatch) {
        return `${bulletMatch[1]}${formatCommandForBackticks(bulletMatch[2])}`
      }
      const colonMatch = line.match(commandAfterColonPattern)
      if (colonMatch) {
        return `${colonMatch[1]}${formatCommandForBackticks(colonMatch[2])}`
      }
      return line.replace(inlineCommandPattern, (_full, prefix: string, cmd: string) => {
        return `${prefix}${formatCommandForBackticks(String(cmd))}`
      })
    })
    .join('\n')
}

const TELEGRAM_COMMAND_MICRO_HINTS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\/coin\s+create\s+<name>\s+<symbol>\s+<(?:uri|url)>/i,
    hint: 'name: 1-24 chars, symbol: 2-6 chars, url: https://...',
  },
  {
    pattern: /\/mkt\s+quote\s+<symbol>/i,
    hint: 'symbol: ticker, e.g. BTC',
  },
  {
    pattern: /\/buy\b/i,
    hint: 'interactive: pick vault, choose size, then Accept',
  },
  {
    pattern: /\/sell\b/i,
    hint: 'interactive: pick vault, choose size, then Accept',
  },
  {
    pattern: /\/bid\b/i,
    hint: 'interactive: pick vault, choose ETH %, then Accept',
  },
  {
    pattern: /\/join\s+<vault\|ticker>/i,
    hint: 'vault|ticker: scoped vault address or symbol',
  },
  {
    pattern: /\/eligibility\s+<vault\|ticker>/i,
    hint: 'checks holder-room threshold for a scoped vault',
  },
]

function appendCommandMicroHints(text: string): string {
  const lines = text.split('\n')
  const nextLines = lines.slice(1)
  const output: string[] = []
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx] ?? ''
    output.push(line)
    if (!line) continue
    const nextLine = nextLines[idx] ?? ''
    if (nextLine.includes('↳')) continue
    for (const rule of TELEGRAM_COMMAND_MICRO_HINTS) {
      if (rule.pattern.test(line)) {
        output.push(`  ↳ ${rule.hint}`)
        break
      }
    }
  }
  return output.join('\n')
}

type ParsedTelegramTradeIntent =
  | {
      actionType: 'buy' | 'sell'
      identifier: string
      amountInput: string
      amount: number
      amountUnit: 'ETH' | 'SHARE'
    }
  | {
      actionType: 'bid'
      identifier: string
      amountInput: string
      amount: number
      amountUnit: 'USD'
    }

type InteractiveTradeAction = 'buy' | 'sell' | 'bid'

type DeployWizardType = 'trend' | 'content' | 'creator'

type DeployCurrencyInput = 'ETH' | 'ZORA' | 'CREATOR_COIN' | 'CONTENT_COIN'

type CommandCoinCurrency = 'ETH' | 'ZORA' | 'CREATOR_COIN'

type ParsedTelegramDeployIntent =
  | { kind: 'menu' }
  | { kind: 'zora' }
  | { kind: 'usage'; text: string }
  | { kind: 'trend'; ticker: string }
  | {
      kind: 'coin'
      coinType: Exclude<DeployWizardType, 'trend'>
      name: string
      symbol: string
      metadataUri: string
      currencyInput: DeployCurrencyInput
      commandCurrency: CommandCoinCurrency
    }

const DEPLOY_CURRENCY_VALUES: DeployCurrencyInput[] = ['ETH', 'ZORA', 'CREATOR_COIN', 'CONTENT_COIN']

const SUPPORTED_METADATA_URI_PREFIXES = ['https://', 'http://', 'ipfs://', 'ar://', 'data:'] as const

function tokenizeTelegramCommand(rawText: string): string[] {
  const raw = asTrimmed(rawText)
  const tokenized: string[] = []
  const regex = /"([^"]+)"|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    tokenized.push(asTrimmed(match[1] ?? match[2] ?? ''))
  }
  return tokenized.filter(Boolean)
}

function isDeployCurrencyInput(raw: string): raw is DeployCurrencyInput {
  const token = asTrimmed(raw).toUpperCase()
  return DEPLOY_CURRENCY_VALUES.includes(token as DeployCurrencyInput)
}

function mapDeployCurrencyToCommandCurrency(input: DeployCurrencyInput): CommandCoinCurrency {
  if (input === 'ETH') return 'ETH'
  if (input === 'ZORA') return 'ZORA'
  // CONTENT_COIN is a Telegram label that maps to Zora's CREATOR_COIN mode.
  return 'CREATOR_COIN'
}

function defaultDeployCurrency(coinType: Exclude<DeployWizardType, 'trend'>): DeployCurrencyInput {
  if (coinType === 'creator') return 'CREATOR_COIN'
  return 'CONTENT_COIN'
}

function normalizeDeploySymbol(raw: string): string {
  return asTrimmed(raw).toUpperCase()
}

function isSupportedMetadataUri(raw: string): boolean {
  const uri = asTrimmed(raw)
  if (!uri) return false
  return SUPPORTED_METADATA_URI_PREFIXES.some((prefix) => uri.startsWith(prefix))
}

function buildDefaultCoinMetadataUri(params: {
  coinType: Exclude<DeployWizardType, 'trend'>
  name: string
  symbol: string
}): string {
  const payload = {
    name: params.name,
    symbol: params.symbol,
    description: `${params.name} (${params.symbol}) launched via 4626 Telegram ${params.coinType} deploy wizard.`,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  return `data:application/json;base64,${encoded}`
}

function formatDeployUsageText(reason?: string): string {
  const lines = [
    'Deploy Wizard',
    '',
    reason ? `- ${reason}` : '- usage:',
    '- `/deploy`',
    '- `/deploy trend` <TICKER>',
    '- `/deploy content` "<NAME>" <SYMBOL> [metadataUri] [ETH|ZORA|CREATOR_COIN|CONTENT_COIN]',
    '- `/deploy creator` "<NAME>" <SYMBOL> [metadataUri] [ETH|ZORA|CREATOR_COIN|CONTENT_COIN]',
    '- `/zora`',
    '',
    'Examples:',
    '- `/deploy trend` BASEAI',
    '- `/deploy content` "Base Daily Recap" BDR',
    '- `/deploy creator` "Akita Creator Pass" AKITA https://example.com/meta.json CREATOR_COIN',
  ]
  return lines.join('\n')
}

function parseTelegramDeployIntent(rawText: string): ParsedTelegramDeployIntent | null {
  return parseTelegramDeployIntentShared(rawText)
}

type CcaAuctionQuote = {
  auctionAddress: `0x${string}`
  ccaStrategyAddress: `0x${string}`
  clearingPriceQ96: bigint
  maxPriceQ96: bigint
  tokenDecimals: number
  tokenSymbol: string
  clearingPriceWeiPerToken: bigint
  maxPriceWeiPerToken: bigint
  amountWei: bigint
  amountEth: number
  usdIntent: number
}

type PrivyWalletOwnerContext = {
  walletId: string
  ownerAddress: `0x${string}`
}

const CCA_LAUNCH_STRATEGY_ABI = [
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'auctionToken',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

const ERC20_VIEW_ABI = [
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
] as const

const CCA_AUCTION_ABI = [
  {
    name: 'submitBid',
    type: 'function',
    inputs: [
      { name: 'maxPrice', type: 'uint256' },
      { name: 'amount', type: 'uint128' },
      { name: 'owner', type: 'address' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'bidId', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const

const UINT128_MAX = (1n << 128n) - 1n
const Q96 = 2n ** 96n

function getCommandHead(rawText: string): string {
  const token = asTrimmed(rawText).split(/\s+/g)[0] ?? ''
  return token.replace(/^\//, '').toLowerCase()
}

function isLikelyCommandText(rawText: string): boolean {
  return TELEGRAM_COMMAND_HEADS.includes(getCommandHead(rawText) as (typeof TELEGRAM_COMMAND_HEADS)[number])
}

function isTelegramAiFollowupEnabled(): boolean {
  return isTelegramAiFollowupEnabledShared()
}

function shouldAutoRouteToAi(params: { chatId: string; text: string; message: TelegramMessage }): boolean {
  return shouldAutoRouteToAiShared({
    ...params,
    aiFollowupEnabled: isTelegramAiFollowupEnabled(),
    isPrivateChatId,
  })
}

function isTelegramNativeCommand(rawText: string): boolean {
  return isTelegramNativeCommandShared(rawText)
}

function normalizeTelegramCommand(rawText: string): string {
  return normalizeTelegramCommandShared(rawText)
}

function formatAmount(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function readEthUsdPrice(): number {
  return readEthUsdPriceShared()
}

function readShareUsdFallback(): number {
  return readShareUsdFallbackShared()
}

function getBaseRpcUrl(): string {
  return getBaseRpcUrlShared()
}

function getBundlerAndPaymasterUrl(): string {
  return getBundlerAndPaymasterUrlShared()
}

function applyBps(value: bigint, bps: bigint): bigint {
  if (value <= 0n || bps <= 0n) return 0n
  return (value * bps) / 10_000n
}

function q96ToCurrencyPerTokenBaseUnits(priceQ96: bigint, tokenDecimals: number): bigint {
  if (priceQ96 <= 0n) return 0n
  const scale = 10n ** BigInt(Math.max(0, tokenDecimals))
  return (priceQ96 * scale) / Q96
}

function formatEthPerToken(weiPerToken: bigint, tokenSymbol: string): string {
  const eth = Number(formatUnits(weiPerToken, 18))
  return `${formatAmount(eth, 8)} ETH/${tokenSymbol}`
}

function toBigIntStrict(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) return BigInt(value.trim())
  return 0n
}

function parseTelegramTradeIntent(rawText: string): ParsedTelegramTradeIntent | null {
  return parseTelegramTradeIntentShared(rawText)
}

function commandHasArguments(rawText: string, head: InteractiveTradeAction): boolean {
  return commandHasArgumentsShared(rawText, head)
}

function resolveTradeTarget(
  scopedVaults: Awaited<ReturnType<typeof listTelegramScopedVaults>>,
  identifier: string,
): (Awaited<ReturnType<typeof listTelegramScopedVaults>>)[number] | null {
  return resolveTradeTargetShared(scopedVaults as any, identifier) as any
}

function parseTradeFlowCallbackData(rawData: string):
  | { kind: 'vault'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | { kind: 'percent'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}`; percentBps: number }
  | { kind: 'custom'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | null {
  return parseTradeFlowCallbackDataShared(rawData)
}

function parseTradeCallbackData(rawData: string):
  | { kind: 'accept' | 'decline'; token: string }
  | { kind: 'edit'; actionType: 'buy' | 'sell' | 'bid' }
  | null {
  return parseTradeCallbackDataShared(rawData)
}

function parseDeployCallbackData(rawData: string):
  | { kind: 'type'; deployType: DeployWizardType | 'zora' }
  | { kind: 'confirm' | 'decline'; token: string }
  | null {
  return parseDeployCallbackDataShared(rawData)
}

function getPrivyServerAuth(): { appId: string; appSecret: string } {
  const config = getTelegramWebhookConfig()
  const appId = config.privyAppId
  const appSecret = config.privyAppSecret
  if (!appId || !appSecret) {
    throw new Error('privy_server_auth_not_configured')
  }
  return { appId, appSecret }
}

function extractPrivyWalletIdCandidate(raw: any): string | null {
  return extractPrivyWalletIdCandidateShared(raw)
}

function extractPrivyWalletAddressCandidate(raw: any): `0x${string}` | null {
  return extractPrivyWalletAddressCandidateShared(raw)
}

function collectPrivyWalletRows(user: any): any[] {
  return collectPrivyWalletRowsShared(user)
}

function resolvePrivyWalletOwnerContextFromUser(params: {
  user: any
  canonicalCswAddress: `0x${string}`
}): PrivyWalletOwnerContext | null {
  const rows = collectPrivyWalletRows(params.user)
  let fallback: PrivyWalletOwnerContext | null = null

  for (const row of rows) {
    const walletId = extractPrivyWalletIdCandidate(row)
    const walletAddress = extractPrivyWalletAddressCandidate(row)
    if (!walletId || !walletAddress) continue
    if (walletAddress.toLowerCase() === params.canonicalCswAddress.toLowerCase()) continue
    const chainType = asTrimmed(row?.chainType ?? row?.chain_type ?? row?.chain ?? row?.network).toLowerCase()
    if (chainType.includes('solana')) continue
    const clientType = asTrimmed(
      row?.walletClientType ??
        row?.wallet_client_type ??
        row?.walletType ??
        row?.wallet_type ??
        row?.connectorType ??
        row?.connector_type ??
        row?.provider,
    ).toLowerCase()
    const type = asTrimmed(row?.type).toLowerCase()
    const isEmbedded =
      clientType.includes('privy') ||
      clientType.includes('embedded') ||
      type.includes('embedded_wallet') ||
      type.includes('embedded')
    if (isEmbedded) {
      return { walletId, ownerAddress: walletAddress }
    }
    if (!fallback) fallback = { walletId, ownerAddress: walletAddress }
  }
  return fallback
}

async function resolvePrivyWalletOwnerContextByPrivyUserId(params: {
  privyUserId: string
  canonicalCswAddress: string
}): Promise<PrivyWalletOwnerContext> {
  const auth = getPrivyServerAuth()
  const client = new PrivyClient(auth.appId, auth.appSecret)
  const user = await client.getUserById(params.privyUserId)
  const canonical = getAddress(params.canonicalCswAddress)
  const resolved = resolvePrivyWalletOwnerContextFromUser({
    user: user as any,
    canonicalCswAddress: canonical as `0x${string}`,
  })
  if (!resolved) {
    throw new Error('privy_embedded_wallet_not_found')
  }
  return resolved
}

async function readCcaAuctionQuote(params: {
  ccaStrategyAddress: `0x${string}`
  usdIntent: number
}): Promise<CcaAuctionQuote> {
  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl(), { timeout: 20_000 }),
  }) as any
  const status = (await client.readContract({
    address: getAddress(params.ccaStrategyAddress as Address),
    abi: CCA_LAUNCH_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
  })) as [Address, boolean, boolean, bigint, bigint]
  const auctionAddress = status?.[0] ? getAddress(status[0]) : (ZERO_ADDRESS as Address)
  const isActive = Boolean(status?.[1] ?? false)
  const isGraduated = Boolean(status?.[2] ?? false)
  const clearingPriceQ96 = toBigIntStrict(status?.[3] ?? 0n)
  if (!isAddressLike(auctionAddress) || auctionAddress.toLowerCase() === ZERO_ADDRESS || !isActive || isGraduated) {
    throw new Error('cca_auction_not_active')
  }
  if (clearingPriceQ96 <= 0n) {
    throw new Error('cca_clearing_price_unavailable')
  }

  let tokenDecimals = 18
  let tokenSymbol = 'TOKEN'
  try {
    const auctionTokenAddress = (await client.readContract({
      address: getAddress(params.ccaStrategyAddress as Address),
      abi: CCA_LAUNCH_STRATEGY_ABI,
      functionName: 'auctionToken',
    })) as Address
    if (isAddressLike(auctionTokenAddress) && auctionTokenAddress.toLowerCase() !== ZERO_ADDRESS) {
      const [decimalsRaw, symbolRaw] = (await Promise.all([
        client
          .readContract({
            address: getAddress(auctionTokenAddress as Address),
            abi: ERC20_VIEW_ABI,
            functionName: 'decimals',
          })
          .catch(() => 18),
        client
          .readContract({
            address: getAddress(auctionTokenAddress as Address),
            abi: ERC20_VIEW_ABI,
            functionName: 'symbol',
          })
          .catch(() => 'TOKEN'),
      ])) as [number | bigint, string]
      const parsedDecimals = Number(decimalsRaw)
      tokenDecimals = Number.isFinite(parsedDecimals) && parsedDecimals >= 0 ? parsedDecimals : 18
      tokenSymbol = asTrimmed(symbolRaw) || 'TOKEN'
    }
  } catch {
    // Non-blocking; quote remains valid even if token metadata fails.
  }

  const ethUsd = readEthUsdPrice()
  const amountEth = params.usdIntent / ethUsd
  if (!Number.isFinite(amountEth) || amountEth <= 0) {
    throw new Error('bid_amount_invalid')
  }
  const amountEthText = formatAmount(amountEth, 8)
  const amountWei = parseEther(amountEthText)
  if (amountWei <= 0n || amountWei > UINT128_MAX) {
    throw new Error('bid_amount_out_of_bounds')
  }
  const maxPriceQ96 = applyBps(clearingPriceQ96, 12_000n)
  const clearingPriceWeiPerToken = q96ToCurrencyPerTokenBaseUnits(clearingPriceQ96, tokenDecimals)
  const maxPriceWeiPerToken = q96ToCurrencyPerTokenBaseUnits(maxPriceQ96, tokenDecimals)
  return {
    auctionAddress: auctionAddress.toLowerCase() as `0x${string}`,
    ccaStrategyAddress: getAddress(params.ccaStrategyAddress as Address).toLowerCase() as `0x${string}`,
    clearingPriceQ96,
    maxPriceQ96,
    tokenDecimals,
    tokenSymbol,
    clearingPriceWeiPerToken,
    maxPriceWeiPerToken,
    amountWei,
    amountEth,
    usdIntent: params.usdIntent,
  }
}

function buildTradePreviewReplyMarkup(params: {
  token: string
}): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Accept', callback_data: `trade:accept:${params.token}` },
        { text: 'Decline', callback_data: `trade:decline:${params.token}` },
      ],
    ],
  }
}

function formatTradePreviewText(params: {
  actionType: 'buy' | 'sell' | 'bid'
  targetLabel: string
  amountInput: string
  amountEth: number
  usdEstimate: number
  bidContext?: {
    auctionAddress: string
    tokenSymbol: string
    clearingPriceWeiPerToken: bigint
    maxPriceWeiPerToken: bigint
  } | null
}): string {
  if (params.actionType === 'buy') {
    return [
      `Step 3/3 • Preview: BUY ${params.targetLabel}`,
      '',
      `Intent: ${params.amountInput} ETH`,
      `USD estimate: ~$${formatAmount(params.usdEstimate, 2)}`,
      '',
      `Confirm Buy ${formatAmount(params.amountEth, 4)} ETH`,
      'Token expires in 90s.',
    ].join('\n')
  }
  if (params.actionType === 'sell') {
    return [
      `Step 3/3 • Preview: SELL ${params.targetLabel}`,
      '',
      `Intent: ${params.amountInput} SHARE`,
      `USD estimate: ~$${formatAmount(params.usdEstimate, 2)}`,
      '',
      `Confirm Sell ${formatAmount(Number(params.amountInput), 4)} SHARE`,
      'Token expires in 90s.',
    ].join('\n')
  }
  const bidLines = [
    `Step 3/3 • Preview: BID ${params.targetLabel}`,
    '',
    `Intent: $${params.amountInput} USD`,
    `Estimated bid: ${formatAmount(params.amountEth, 4)} ETH`,
  ]
  if (params.bidContext) {
    bidLines.push(`Auction: ${truncateAddress(params.bidContext.auctionAddress)} (live CCA)`)
    bidLines.push(`Clearing: ${formatEthPerToken(params.bidContext.clearingPriceWeiPerToken, params.bidContext.tokenSymbol)}`)
    bidLines.push(`Max price cap: ${formatEthPerToken(params.bidContext.maxPriceWeiPerToken, params.bidContext.tokenSymbol)} (+20%)`)
  }
  bidLines.push('')
  bidLines.push(`Confirm Bid ${formatAmount(params.amountEth, 4)} ETH`)
  bidLines.push('Re-quote at confirm; safety breaker at >3% drift.')
  bidLines.push('Token expires in 90s.')
  return bidLines.join('\n')
}

function tradeEditHint(actionType: 'buy' | 'sell' | 'bid'): string {
  if (actionType === 'buy') return 'Start again with /buy'
  if (actionType === 'sell') return 'Start again with /sell'
  return 'Start again with /bid'
}

function readInlineQueryResultCap(): number {
  return readInlineQueryResultCapShared()
}

function isTelegramInlineGrowthModeEnabled(): boolean {
  return isTelegramInlineGrowthModeEnabledShared()
}

function isTelegramInlinePmHandoffEnabled(): boolean {
  return isTelegramInlinePmHandoffEnabledShared()
}

function readInlineMediaAssetMap(): Record<string, InlineMediaAsset> {
  return readInlineMediaAssetMapShared()
}

async function buildInlineQueryResults(params: {
  rawQuery: string
  queryOffset: string
  userId: string
  chatId: string
}): Promise<InlineQueryAnswer> {
  const userId = asTrimmed(params.userId)
  const chatId = asTrimmed(params.chatId)
  let link: Awaited<ReturnType<typeof getTelegramLinkByUserId>> | null = null
  let scopedVaults: Awaited<ReturnType<typeof listTelegramScopedVaults>> = []
  const db = await getDb().catch(() => null)
  if (db && userId) {
    try {
      await ensureTelegramTradingSchema(db as any)
      link = await getTelegramLinkByUserId({
        db: db as any,
        telegramUserId: userId,
      })
      if (chatId) {
        scopedVaults = await listTelegramScopedVaults({
          db: db as any,
          chatId,
          limit: 3,
        })
      }
    } catch {
      link = null
      scopedVaults = []
    }
  }
  return buildInlineQueryAnswer({
    rawQuery: params.rawQuery,
    queryOffset: params.queryOffset,
    userId,
    chatId,
    isLinked: Boolean(link && link.linkStatus === 'active'),
    scopedVaults,
    inlineResultCap: readInlineQueryResultCap(),
    growthMode: isTelegramInlineGrowthModeEnabled(),
    enablePmHandoff: isTelegramInlinePmHandoffEnabled(),
    mediaByKey: readInlineMediaAssetMap(),
  })
}

function buildInlineLauncherReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [{ text: 'Draft X post', switch_inline_query_current_chat: 'x post your update here' }],
      [
        { text: 'Ask AI', switch_inline_query_current_chat: 'ai What should I do next?' },
        { text: 'Vault status', switch_inline_query_current_chat: 'keepr status' },
      ],
      [{ text: 'Market quote', switch_inline_query_current_chat: 'mkt quote BTC' }],
      [
        { text: 'Arena Play', switch_inline_query_current_chat: 'arena play' },
        { text: 'Arena State', switch_inline_query_current_chat: 'arena state' },
      ],
      [
        { text: 'Arena Find', switch_inline_query_current_chat: 'arena find' },
        { text: 'Arena Result', switch_inline_query_current_chat: 'arena result' },
      ],
      [
        { text: 'Arena Tune', switch_inline_query_current_chat: 'arena tune template' },
        { text: 'Arena Control', switch_inline_query_current_chat: 'arena control template' },
      ],
      [{ text: 'Back', callback_data: 'menu:start' }],
    ],
  }
}

function buildHelpCategoryReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Core', callback_data: 'help:core' },
        { text: 'Coin', callback_data: 'help:coin' },
        { text: 'Market', callback_data: 'help:market' },
      ],
      [
        { text: 'Social', callback_data: 'help:social' },
        { text: 'Ops', callback_data: 'help:ops' },
        { text: 'Bankr', callback_data: 'help:bankr' },
      ],
      [
        { text: menuLabel('wallet'), callback_data: 'help:wallet' },
        { text: 'Arena', callback_data: 'help:arena' },
        { text: 'Help', callback_data: 'help:all' },
      ],
      [{ text: menuLabel('back'), callback_data: 'menu:start' }],
    ],
  }
}

function buildArenaHelpShortcutReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Find Match', callback_data: 'help:arena_find' },
        { text: 'Play (Auto Watch)', callback_data: 'help:arena_play' },
      ],
      [
        { text: 'State', callback_data: 'help:arena_state' },
        { text: 'Latest Result', callback_data: 'help:arena_result' },
      ],
      [
        { text: 'Watch On', callback_data: 'help:arena_watch_on' },
        { text: 'Watch Status', callback_data: 'help:arena_watch_status' },
      ],
      [
        { text: 'Tune Template', callback_data: 'help:arena_tune' },
        { text: 'Rules Template', callback_data: 'help:arena_rules' },
      ],
      [
        { text: 'Zones Template', callback_data: 'help:arena_zones' },
        { text: 'Control Template', callback_data: 'help:arena_control' },
      ],
      [{ text: 'Help Topics', callback_data: 'menu:topics' }],
      [{ text: menuLabel('back'), callback_data: 'menu:start' }],
    ],
  }
}

function resolveTelegramMiniAppUrl(): string {
  return resolveTelegramMiniAppUrlShared()
}

function buildTelegramMiniAppUrl(params: {
  baseUrl: string
  pathname?: string
  query?: Record<string, string>
}): string {
  return buildTelegramMiniAppUrlShared(params)
}

function resolveTelegramBaseAppInviteUrl(): string {
  const raw = asTrimmed(process.env.TELEGRAM_BASE_APP_INVITE_URL ?? '')
  return raw || 'https://base.app/invite/4626/T9Y9BZYK'
}

/** Telegram HTML parse_mode: escape & and " inside href="..." */
function escapeTelegramHtmlHrefAttribute(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function buildTelegramLinkFlowResponse(params: {
  chatId: string
  telegramUserId: string
  telegramUsername?: string | null
  linkButtonText: string
  /** Legacy name: has = link existing CSW, need = create new (Base app first). */
  zoraOnboardingBranch?: 'has' | 'need'
}): TelegramCommandResponse {
  if (!isPrivateChatId(params.chatId)) {
    return {
      text: [
        'Link your 4626 account (one time)',
        '',
        'For security, linking is only available in a private chat with this bot.',
        'Linking creates your 4626 Privy session and connects your Coinbase Smart Wallet.',
        'Open a DM with the bot and enter:',
        '- /start',
        '- /link',
        'After linking, return here and tap Check Link Status.',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [[{ text: 'Check Link Status', callback_data: 'menu:linked' }]],
      },
    }
  }

  const miniAppUrl = resolveTelegramMiniAppUrl()
  let linkToken: { token: string; expiresAt: string } | null = null
  try {
    linkToken = createTelegramLinkStartToken({
      telegramUserId: params.telegramUserId,
      chatId: params.chatId,
      ttlSeconds: 60 * 15,
    })
  } catch {
    linkToken = null
  }
  void (async () => {
    if (!isTelegramFunnelEventsEnabledForChat(params.chatId)) return
    const db = await getDb()
    if (!db) return
    await ensureTelegramTradingSchema(db as any)
    await logTelegramFunnelEvent({
      db: db as any,
      telegramUserId: params.telegramUserId,
      chatId: params.chatId,
      eventName: 'link_start',
      actionType: 'link',
      context: {
        source: 'telegram_command',
        hasToken: Boolean(linkToken),
        hasUsername: Boolean(asTrimmed(params.telegramUsername ?? '')),
      },
    })
  })().catch(() => {})
  const linkQuery: Record<string, string> = {
    tgMiniApp: '1',
    tgEntry: 'link',
    chatAction: 'link-account',
    tgChatId: params.chatId,
  }
  if (params.zoraOnboardingBranch) {
    linkQuery.tgZoraBranch = params.zoraOnboardingBranch
    linkQuery.tgCswIntent = params.zoraOnboardingBranch
  }
  if (linkToken?.token) {
    linkQuery.tgLinkToken = linkToken.token
  }
  const username = asTrimmed(params.telegramUsername ?? '')
  if (username) {
    linkQuery.tgUsername = username
  }
  const linkUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/swap',
    query: linkQuery,
  })
  const openMiniAppButton = buildMiniAppLaunchButton({
    chatId: params.chatId,
    text: 'Open Mini App',
    url: linkUrl,
  })
  const linkHtmlHref = escapeTelegramHtmlHrefAttribute(linkUrl)
  const baseInviteUrl = resolveTelegramBaseAppInviteUrl()
  const linkBodyLines =
    params.zoraOnboardingBranch === 'need'
      ? [
          '<b>Base app | 4626.fun</b>',
          '',
          'Need a Coinbase Smart Wallet? Install the Base app first, then finish setup here.',
          '',
          '1) Tap Get Base app.',
          '2) Tap Open Mini App.',
          '3) Authenticate with Privy.',
          '4) Create or connect your Coinbase Smart Wallet (canonical account for Telegram).',
          '',
          '4626 never holds your keys — you approve actions in your wallet.',
          'Telegram setup is separate from full app access — team approval may still apply for trading.',
        ]
      : params.zoraOnboardingBranch === 'has'
        ? [
            '<b>Link | 4626.fun</b>',
            '',
            'Use your in-app Privy wallet: add it as an owner on your Coinbase Smart Wallet, then confirm in the Mini App.',
            '',
            '4626 never holds your keys — you approve actions in your wallet.',
            '',
            '1) Tap Open Mini App.',
            '2) Sign in with Privy.',
            '3) Complete the owner step on your CSW (canonical account).',
            '',
            'Telegram setup is separate from full app access — team approval may still apply for trading.',
          ]
        : [
            'Link your 4626 account (one time)',
            '',
            '1) Tap Open Mini App.',
            '2) Authenticate with Privy.',
            '3) Connect your Coinbase Smart Wallet (canonical account).',
            '',
            '4626 never holds your keys — you approve actions in your wallet.',
          ]
  const createBranchKeyboard: Array<Array<Record<string, unknown>>> =
    params.zoraOnboardingBranch === 'need'
      ? [
          [{ text: 'Get Base app', url: baseInviteUrl }],
          [openMiniAppButton],
          [
            { text: 'Check Link Status', callback_data: 'menu:linked' },
            { text: params.linkButtonText, callback_data: 'menu:connect' },
          ],
        ]
      : [
          [openMiniAppButton],
          [
            { text: 'Check Link Status', callback_data: 'menu:linked' },
            { text: params.linkButtonText, callback_data: 'menu:connect' },
          ],
        ]
  return {
    text: [
      ...linkBodyLines,
      ...(linkToken ? ['', 'Link expires in ~15 minutes.'] : []),
      '',
      `If the button fails: <a href="${linkHtmlHref}">Open Mini App</a>`,
      'Then tap Check Link Status.',
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: createBranchKeyboard,
    },
  }
}

function buildMiniAppLaunchButton(params: {
  chatId: string
  text: string
  url: string
}): Record<string, unknown> {
  return buildMiniAppLaunchButtonShared(params)
}

function isDefaultHelpCommand(rawText: string): boolean {
  return isHelpCommand(rawText) && !isHelpCategoryCommand(rawText)
}

function buildOnboardingWelcomeText(): string {
  return [
    '<b>Welcome to 4626.fun on Telegram</b>',
    '',
    'Tap <b>Start</b> to begin setup.',
    '',
    'Trade with your Coinbase Smart Wallet from Telegram — link once, then buy, sell, bid, and manage your wallet from chats.',
  ].join('\n')
}

function buildOnboardingWelcomeReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [[{ text: 'Start', callback_data: 'onboard:begin' }]],
  }
}

function buildCswForkText(): string {
  return [
    '<b>Coinbase Smart Wallet | 4626.fun</b>',
    '',
    'Link an existing Coinbase Smart Wallet, or create a new one after installing the Base app.',
    '',
    'Tap a button to continue.',
  ].join('\n')
}

function buildCswForkReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Link existing CSW', callback_data: 'onboard:csw:link' },
        { text: 'Create new CSW', callback_data: 'onboard:csw:create' },
      ],
    ],
  }
}

function buildUnlinkedGroupStartLandingText(): string {
  return [
    '<b>4626 on Telegram</b>',
    '',
    '<blockquote>Open a private chat with this bot for setup. Groups stay discovery-first.</blockquote>',
    '',
    '<u>In your DM with this bot</u>',
    '<code>/start</code> — home (tap <b>Start</b> to begin onboarding)',
    '<code>/link</code> — continue wallet linking after onboarding',
    '<code>/linked</code> — verify link + owner status',
    '',
    'After /linked shows ready, use /buy, /sell, /bid, and /wallet.',
  ].join('\n')
}

function buildStartLandingText(params: { isLinked: boolean }): string {
  if (params.isLinked) {
    return [
      '<b>4626 on Telegram</b>',
      '',
      `<blockquote>Connected and ready. Convert attention into onchain action: ${menuLabel('trade')} -> ${menuLabel('wallet')} -> Repeat.</blockquote>`,
      '',
      '<u>Fast path</u>',
      '<code>/buy</code> — guided buy flow',
      '<code>/sell</code> — guided sell flow',
      '<code>/bid</code> — guided bid flow',
      '<code>/wallet</code> — wallet, positions, and recent actions',
    ].join('\n')
  }
  return buildUnlinkedGroupStartLandingText()
}

function buildStartAndLinkNudgeText(): string {
  return buildOnboardingWelcomeText()
}

function buildStartAndLinkNudgeReplyMarkup(): Record<string, unknown> {
  return buildOnboardingWelcomeReplyMarkup()
}

function buildFocusedHelpText(): string {
  return [
    '<b>4626 Command Guide</b>',
    '',
    `<blockquote>Core loop: ${menuLabel('connect')} -> ${menuLabel('trade')} -> ${menuLabel('wallet')} -> Repeat.</blockquote>`,
    '',
    '<u>Core commands</u>',
    '<code>/start</code> — onboarding entry (private DM: tap Start, then follow prompts). Setup ≠ operator-approved app access.',
    '<code>/link</code> — continue Mini App linking (after onboarding Start, or to refresh)',
    '<code>/linked</code> — check link status',
    '<code>/buy</code> — guided buy flow',
    '<code>/sell</code> — guided sell flow',
    '<code>/bid</code> — guided bid flow',
    '<code>/wallet</code> — wallet, positions, and actions',
    '<code>/signals</code> — recent trade feed',
    '<code>/vaults</code> — browse vaults',
    '<code>/arena help</code> — Clash of Claw controls',
    '',
    '<u>Need more?</u>',
    '<code>/help coin|market|social|ops|bankr|wallet|arena</code> — focused guides',
    '<code>/help all</code> — complete command catalog',
  ].join('\n')
}

function buildHelpReplyMarkup(params: { chatId: string; isLinked: boolean }): Record<string, unknown> {
  const miniAppUrl = resolveTelegramMiniAppUrl()
  const walletAppUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/swap',
    query: {
      tgMiniApp: '1',
      tgEntry: 'wallet',
    },
  })
  const tradeAppUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/swap',
    query: {
      tgMiniApp: '1',
      tgEntry: 'trade',
    },
  })
  const keyboard: Array<Array<Record<string, unknown>>> = params.isLinked
    ? [
        [buildMiniAppLaunchButton({ chatId: params.chatId, text: menuLabel('wallet'), url: walletAppUrl })],
        [
          { text: menuLabel('trade'), callback_data: 'menu:trade' },
          { text: menuLabel('explore'), callback_data: 'menu:explore' },
          { text: menuLabel('help'), callback_data: 'menu:topics' },
        ],
        [{ text: 'Check Link Status', callback_data: 'menu:linked' }],
        [buildMiniAppLaunchButton({ chatId: params.chatId, text: 'Open Mini App', url: tradeAppUrl })],
      ]
    : [
        [{ text: menuLabel('connect'), callback_data: 'menu:connect' }],
        [
          { text: menuLabel('explore'), callback_data: 'menu:explore' },
          { text: menuLabel('help'), callback_data: 'menu:topics' },
        ],
        [{ text: 'Check Link Status', callback_data: 'menu:linked' }],
        [buildMiniAppLaunchButton({ chatId: params.chatId, text: 'Open Mini App', url: tradeAppUrl })],
      ]

  return {
    inline_keyboard: keyboard,
  }
}

function buildExploreReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: menuLabel('vaults'), callback_data: 'menu:vaults' },
        { text: menuLabel('auctions'), callback_data: 'menu:auctions' },
        { text: menuLabel('signals'), callback_data: 'menu:signals' },
      ],
      [{ text: menuLabel('back'), callback_data: 'menu:start' }],
    ],
  }
}

function buildTradeMenuReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: menuLabel('buy'), callback_data: 'menu:buy' },
        { text: menuLabel('sell'), callback_data: 'menu:sell' },
        { text: menuLabel('bid'), callback_data: 'menu:bid' },
      ],
      [
        { text: menuLabel('wallet'), callback_data: 'menu:wallet' },
        { text: menuLabel('explore'), callback_data: 'menu:explore' },
      ],
      [{ text: menuLabel('back'), callback_data: 'menu:start' }],
    ],
  }
}

function buildMoreToolsReplyMarkup(chatId: string): Record<string, unknown> {
  const miniAppUrl = resolveTelegramMiniAppUrl()
  const statusAppUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/swap',
    query: {
      tgMiniApp: '1',
      tgEntry: 'vault-status',
      chatAction: 'vault-status',
      chatName: 'akita',
    },
  })
  const aiAppUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/swap',
    query: {
      tgMiniApp: '1',
      tgEntry: 'ai',
      chatAction: 'ai-assistant',
      chatName: 'akita',
    },
  })

  return {
    inline_keyboard: [
      [
        { text: 'Vaults', callback_data: 'menu:vaults' },
        { text: 'Auctions', callback_data: 'menu:auctions' },
        { text: 'My Bids', callback_data: 'menu:mybids' },
      ],
      [
        { text: 'Rooms', callback_data: 'menu:rooms' },
        { text: 'Deploy', callback_data: 'menu:deploy' },
        { text: 'Zora', callback_data: 'menu:zora' },
      ],
      [
        { text: 'Draft X Post', switch_inline_query_current_chat: 'x post your update here' },
        { text: 'Help Topics', callback_data: 'menu:topics' },
      ],
      [
        buildMiniAppLaunchButton({ chatId, text: 'Mini App: Vault', url: statusAppUrl }),
        buildMiniAppLaunchButton({ chatId, text: 'Mini App: Ask AI', url: aiAppUrl }),
      ],
      [{ text: 'Back to Main', callback_data: 'menu:start' }],
    ],
  }
}

function resolveHelpCallbackCommand(rawData: string): string | null {
  return resolveHelpCallbackCommandShared(rawData)
}

function resolveNavigationCallbackToast(rawData: string, mappedCommand: string | null): string {
  return resolveNavigationCallbackToastShared(rawData, mappedCommand)
}

function resolveStaticMenuCallbackResponse(params: {
  callbackData: string
  chatId: string
  isLinked: boolean
}): TelegramCommandResponse | null {
  const token = asTrimmed(params.callbackData).toLowerCase()
  if (token === 'menu:start') {
    if (params.isLinked) {
      return {
        text: buildStartLandingText({ isLinked: true }),
        replyMarkup: buildHelpReplyMarkup({ chatId: params.chatId, isLinked: true }),
      }
    }
    if (!isPrivateChatId(params.chatId)) {
      return {
        text: buildUnlinkedGroupStartLandingText(),
        replyMarkup: buildHelpReplyMarkup({ chatId: params.chatId, isLinked: false }),
      }
    }
    return {
      text: buildOnboardingWelcomeText(),
      replyMarkup: buildOnboardingWelcomeReplyMarkup(),
    }
  }
  if (token === 'menu:explore') {
    return {
      text: [menuLabel('explore'), '', 'Pick where you want to scan next.'].join('\n'),
      replyMarkup: buildExploreReplyMarkup(),
    }
  }
  if (token === 'menu:trade') {
    if (!params.isLinked) {
      return {
        text: [`Trade requires ${menuLabel('connect')} first.`, '', `Tap ${menuLabel('connect')} to link Telegram and wallet.`].join('\n'),
        replyMarkup: buildHelpReplyMarkup({ chatId: params.chatId, isLinked: false }),
      }
    }
    return {
      text: [menuLabel('trade'), '', 'Pick an action to start the guided flow.'].join('\n'),
      replyMarkup: buildTradeMenuReplyMarkup(),
    }
  }
  if (token === 'menu:more') {
    return {
      text: ['More Tools', '', '- advanced actions and discovery tools'].join('\n'),
      replyMarkup: buildMoreToolsReplyMarkup(params.chatId),
    }
  }
  if (token === 'menu:topics') {
    return {
      text: [`${menuLabel('help')} Topics`, '', 'Pick a focused command guide.'].join('\n'),
      replyMarkup: buildHelpCategoryReplyMarkup(),
    }
  }
  return null
}

function resolveImmediateCallbackToast(params: {
  parsedTradeFlowCallback: ReturnType<typeof parseTradeFlowCallbackData>
  parsedTradeCallback: ReturnType<typeof parseTradeCallbackData>
  parsedDeployCallback: ReturnType<typeof parseDeployCallbackData>
  callbackData: string
  mappedCommand: string | null
}): string {
  return resolveImmediateCallbackToastShared(params as any)
}

function shouldUseTelegramMarkdown(text: string): boolean {
  const backtickCount = (text.match(/`/g) ?? []).length
  if (backtickCount >= 2 && backtickCount % 2 === 0) return true
  return /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/i.test(text)
}

async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  text: string
  replyToMessageId?: number
  messageThreadId?: number
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  return sendTelegramMessageShared(params)
}

async function editTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<boolean> {
  return editTelegramMessageShared(params)
}

async function deleteTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
}): Promise<void> {
  return deleteTelegramMessageShared(params)
}

async function replaceTelegramMenuMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  return replaceTelegramMenuMessageShared(params)
}

async function answerTelegramInlineQuery(params: {
  botToken: string
  inlineQueryId: string
  query: string
  queryOffset: string
  chatType: string
  userId: string
  chatId: string
}): Promise<void> {
  const queryOffset = asTrimmed(params.queryOffset)
  const chatType = asTrimmed(params.chatType).toLowerCase()
  const inlineAnswer = await buildInlineQueryResults({
    rawQuery: params.query,
    queryOffset,
    userId: params.userId,
    chatId: params.chatId,
  })
  await answerTelegramInlineQueryShared({
    botToken: params.botToken,
    inlineQueryId: params.inlineQueryId,
    results: inlineAnswer.results,
    cacheTime: 5,
    isPersonal: true,
    ...(inlineAnswer.nextOffset ? { nextOffset: inlineAnswer.nextOffset } : {}),
    ...(inlineAnswer.button ? { button: inlineAnswer.button } : {}),
    ...(inlineAnswer.switchPmText ? { switchPmText: inlineAnswer.switchPmText } : {}),
    ...(inlineAnswer.switchPmParameter ? { switchPmParameter: inlineAnswer.switchPmParameter } : {}),
  })

  const db = await getDb().catch(() => null)
  if (!db) return
  await ensureTelegramTradingSchema(db as any).catch(() => {})
  emitTelegramFunnelEvent({
    db: db as any,
    telegramUserId: asTrimmed(params.userId),
    chatId: asTrimmed(params.chatId),
    eventName: 'inline_query_answered',
    actionType: 'inline',
    context: {
      source: 'inline',
      query: asTrimmed(params.query) || null,
      queryClass: inlineAnswer.queryClass,
      queryOffset: queryOffset || '',
      chatType: chatType || null,
      resultCount: inlineAnswer.results.length,
      totalResults: inlineAnswer.totalResults,
      nextOffset: inlineAnswer.nextOffset || '',
      pmHandoffEnabled: Boolean(inlineAnswer.switchPmParameter),
    },
  })
  if (inlineAnswer.switchPmParameter) {
    emitTelegramFunnelEvent({
      db: db as any,
      telegramUserId: asTrimmed(params.userId),
      chatId: asTrimmed(params.chatId),
      eventName: 'inline_pm_handoff',
      actionType: 'inline',
      context: {
        source: 'inline',
        queryClass: inlineAnswer.queryClass,
        switchPmParameter: inlineAnswer.switchPmParameter,
      },
    })
  }
}

async function answerTelegramCallbackQuery(params: {
  botToken: string
  callbackQueryId: string
  text?: string
  showAlert?: boolean
}): Promise<void> {
  return answerTelegramCallbackQueryShared(params)
}

async function answerTelegramPreCheckoutQuery(params: {
  botToken: string
  preCheckoutQueryId: string
  ok: boolean
  errorMessage?: string
}): Promise<void> {
  return answerTelegramPreCheckoutQueryShared(params)
}

async function sendTelegramStarsInvoice(params: {
  botToken: string
  chatId: string
  userId: string
  stars: number
  context: string
}): Promise<void> {
  return sendTelegramStarsInvoiceShared(params)
}

function truncateAddress(value: string): string {
  const v = asTrimmed(value)
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return v
  return `${v.slice(0, 6)}…${v.slice(-4)}`
}

async function isTelegramUserLinked(params: {
  telegramUserId: string
  db?: Awaited<ReturnType<typeof getDb>> | null
}): Promise<boolean> {
  const db = params.db ?? (await getDb())
  if (!db) return false
  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.telegramUserId })
  return Boolean(link && link.linkStatus === 'active' && link.ownerVerified)
}

async function handleTelegramOnboardingCallback(params: {
  callbackDataLower: string
  chatId: string
  userId: string
  telegramUsername?: string | null
}): Promise<{ response: TelegramCommandResponse; callbackToast: string } | null> {
  if (!params.callbackDataLower.startsWith('onboard:')) return null
  if (!isPrivateChatId(params.chatId)) {
    return {
      response: {
        text: [
          'Onboarding',
          '',
          'Open a private chat with this bot and send /start to begin (tap Start when it appears).',
        ].join('\n'),
      },
      callbackToast: 'Use a private chat',
    }
  }

  const db = await getDb()
  if (!db) {
    return {
      response: {
        text: ['Onboarding paused', '', '- database unavailable — retry in a few seconds'].join('\n'),
      },
      callbackToast: 'Unavailable',
    }
  }
  await ensureTelegramTradingSchema(db as any)

  const isLinked = await isTelegramUserLinked({ telegramUserId: params.userId, db })
  if (isLinked) {
    return {
      response: {
        text: buildStartLandingText({ isLinked: true }),
        replyMarkup: buildHelpReplyMarkup({ chatId: params.chatId, isLinked: true }),
      },
      callbackToast: 'Already connected',
    }
  }

  const token = params.callbackDataLower

  if (token === 'onboard:begin') {
    await upsertTelegramOnboardingSession({ db: db as any, telegramUserId: params.userId, step: 'csw_fork' })
    return {
      response: {
        text: buildCswForkText(),
        replyMarkup: buildCswForkReplyMarkup(),
      },
      callbackToast: 'Next step',
    }
  }

  const isLinkExisting = token === 'onboard:csw:link' || token === 'onboard:zora:yes'
  const isCreateNew = token === 'onboard:csw:create' || token === 'onboard:zora:no'
  if (isLinkExisting || isCreateNew) {
    const session = await readTelegramOnboardingSession({ db: db as any, telegramUserId: params.userId })
    if (!session || session.step !== 'csw_fork') {
      await upsertTelegramOnboardingSession({ db: db as any, telegramUserId: params.userId, step: 'welcome' })
      return {
        response: {
          text: buildOnboardingWelcomeText(),
          replyMarkup: buildOnboardingWelcomeReplyMarkup(),
        },
        callbackToast: 'Tap Start first',
      }
    }
    const branch: 'has' | 'need' = isLinkExisting ? 'has' : 'need'
    await upsertTelegramOnboardingSession({
      db: db as any,
      telegramUserId: params.userId,
      step: branch === 'has' ? 'branch_link' : 'branch_create',
    })
    return {
      response: buildTelegramLinkFlowResponse({
        chatId: params.chatId,
        telegramUserId: params.userId,
        telegramUsername: params.telegramUsername ?? null,
        linkButtonText: 'Refresh Connect',
        zoraOnboardingBranch: branch,
      }),
      callbackToast: 'Open Mini App',
    }
  }

  return null
}

function formatLinkStatusText(link: Awaited<ReturnType<typeof getTelegramLinkByUserId>>): string {
  if (!link) {
    return [
      'Link Status',
      '',
      '- linked: no',
      '- next: send /start in a private DM, tap Start, then continue in the Mini App (or /link after that step). Setup links Telegram + wallet; full app access may still require team approval.',
    ].join('\n')
  }
  return [
    'Link Status',
    '',
    `- linked: ${link.linkStatus === 'active' ? 'yes' : 'no'}`,
    `- status: ${link.linkStatus}`,
    `- ownerVerified: ${String(link.ownerVerified)}`,
    `- profileId: ${String(link.profileId)}`,
    `- canonicalCSW: ${link.canonicalCswAddress}`,
    `- linkedAt: ${link.linkedAt ?? 'n/a'}`,
  ].join('\n')
}

function formatWalletText(summary: Awaited<ReturnType<typeof getTelegramPortfolioSummary>>): string {
  if (!summary) {
    return [
      'Wallet',
      '',
      '- linked: no',
      '- next: finish onboarding (/start → Start in DM), then /wallet again',
    ].join('\n')
  }

  const lines = [
    'Wallet',
    '',
    `- linked: yes (${summary.link.linkStatus})`,
    `- canonicalCSW: ${truncateAddress(summary.link.canonicalCswAddress)}`,
    `- buys: ${summary.buyCount}`,
    `- sells: ${summary.sellCount}`,
    `- bids: ${summary.bidCount}`,
    `- successfulActions: ${summary.successfulActions}`,
  ]
  if (summary.recentActions.length > 0) {
    lines.push('', 'Recent:')
    for (const row of summary.recentActions) {
      lines.push(`- ${row.actionType} ${row.status}${row.txHash ? ` (${truncateAddress(row.txHash)})` : ''}`)
    }
  } else {
    lines.push('', 'Recent: none yet')
  }
  return lines.join('\n')
}

function formatVaultsText(vaults: Awaited<ReturnType<typeof listTelegramScopedVaults>>): string {
  if (vaults.length === 0) {
    return [
      'Vaults',
      '',
      '- no scoped vaults found for this chat',
    ].join('\n')
  }

  const lines = ['Vaults', '']
  for (const vault of vaults.slice(0, 8)) {
    const status = vault.isSettled ? 'settled' : 'active'
    lines.push(
      `- ${truncateAddress(vault.vaultAddress)} | coin ${truncateAddress(vault.creatorCoinAddress)} | ${status}`,
    )
  }
  return lines.join('\n')
}

function formatAuctionsText(auctions: Awaited<ReturnType<typeof listTelegramAuctions>>): string {
  if (auctions.length === 0) {
    return [
      'Auctions',
      '',
      '- no CCA auctions configured in scope',
    ].join('\n')
  }

  const lines = ['Auctions', '']
  for (const row of auctions.slice(0, 8)) {
    const status = row.isSettled ? 'settled' : 'available'
    lines.push(`- ${truncateAddress(row.vaultAddress)} -> ${truncateAddress(row.ccaStrategyAddress)} (${status})`)
  }
  return lines.join('\n')
}

function formatSignalsText(title: string, rows: Awaited<ReturnType<typeof listTelegramSignals>>): string {
  if (rows.length === 0) {
    return [title, '', '- no recent signals'].join('\n')
  }
  const lines = [title, '']
  for (const row of rows.slice(0, 8)) {
    lines.push(`- ${row.actionType} ${row.status}${row.txHash ? ` (${truncateAddress(row.txHash)})` : ''}`)
  }
  return lines.join('\n')
}

function areHolderRoomsEnabled(): boolean {
  return areHolderRoomsEnabledShared()
}

function parseHolderRoomIdentifier(rawText: string, head: 'join' | 'eligibility'): string {
  return parseHolderRoomIdentifierShared(rawText, head)
}

function formatHolderRoomUsageText(): string {
  return [
    'Holder Rooms',
    '',
    '- usage: `/join` <vault|ticker>',
    '- usage: `/eligibility` <vault|ticker>',
    '- list active rooms: `/rooms`',
  ].join('\n')
}

function formatHolderRoomsText(policies: Awaited<ReturnType<typeof listHolderRoomPolicies>>): string {
  if (policies.length === 0) {
    return [
      'Holder Rooms',
      '',
      '- no holder rooms configured for this chat',
      '- usage: `/join` <vault|ticker>',
      '- usage: `/eligibility` <vault|ticker>',
    ].join('\n')
  }
  const lines = [
    'Holder Rooms',
    '',
    '- join command: `/join` <vault|ticker>',
    '- check command: `/eligibility` <vault|ticker>',
    '',
  ]
  for (const policy of policies.slice(0, 12)) {
    lines.push(
      `- ${truncateAddress(policy.vaultAddress)} -> ${policy.roomChatId} | minSharesRaw=${policy.minSharesRaw} | graceHours=${policy.graceHours} | enabled=${String(policy.enabled)}`,
    )
  }
  return lines.join('\n')
}

async function createTelegramHolderRoomInviteLink(params: {
  botToken: string
  roomChatId: string
  ttlSeconds?: number
}): Promise<string | null> {
  return createTelegramHolderRoomInviteLinkShared(params)
}

function readTradeLimitFromEnv(key: string, fallback: number): number {
  const raw = Number(asTrimmed(process.env[key] ?? ''))
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  return Math.floor(raw)
}

function tradeRateLimitForAction(actionType: 'buy' | 'sell' | 'bid'): { userLimit: number; chatLimit: number } {
  if (actionType === 'bid') {
    return {
      userLimit: readTradeLimitFromEnv('TELEGRAM_BID_USER_RATE_LIMIT_PER_MIN', 3),
      chatLimit: readTradeLimitFromEnv('TELEGRAM_BID_CHAT_RATE_LIMIT_PER_MIN', 20),
    }
  }
  return {
    userLimit: readTradeLimitFromEnv('TELEGRAM_TRADE_USER_RATE_LIMIT_PER_MIN', 10),
    chatLimit: readTradeLimitFromEnv('TELEGRAM_TRADE_CHAT_RATE_LIMIT_PER_MIN', 60),
  }
}

function checkTelegramTradeRateLimit(params: {
  chatId: string
  userId: string
  actionType: 'buy' | 'sell' | 'bid'
}): { ok: true } | { ok: false; reason: 'rate_limit_user' | 'rate_limit_chat'; retryAfterSeconds: number } {
  return checkTelegramTradeRateLimitShared(params)
}

function buildTradeCommandTemplate(actionType: 'buy' | 'sell' | 'bid'): string {
  if (actionType === 'buy') return '/buy'
  if (actionType === 'sell') return '/sell'
  return '/bid'
}

function formatTradeRateLimitText(params: {
  actionType: 'buy' | 'sell' | 'bid'
  reason: 'rate_limit_user' | 'rate_limit_chat'
  retryAfterSeconds: number
}): string {
  return [
    'Trade blocked',
    '',
    `- reason: ${params.reason}`,
    `- retry_after_seconds: ${params.retryAfterSeconds}`,
    `- retry: ${buildTradeCommandTemplate(params.actionType)}`,
  ].join('\n')
}

type ScopedVaultRow = (Awaited<ReturnType<typeof listTelegramScopedVaults>>)[number]

function resolveScopedVaultByAddress(scopedVaults: ScopedVaultRow[], vaultAddress: string): ScopedVaultRow | null {
  const normalized = asTrimmed(vaultAddress).toLowerCase()
  if (!isAddressLike(normalized)) return null
  return scopedVaults.find((row) => row.vaultAddress.toLowerCase() === normalized) ?? null
}

function buildTradeVaultPickerReplyMarkup(params: {
  actionType: InteractiveTradeAction
  scopedVaults: ScopedVaultRow[]
}): Record<string, unknown> {
  const rows: Array<Array<Record<string, unknown>>> = []
  const buttons = params.scopedVaults.slice(0, 12).map((vault) => ({
    text: truncateAddress(vault.vaultAddress),
    callback_data: `tradeflow:v:${params.actionType}:${vault.vaultAddress.toLowerCase()}`,
  }))
  for (let idx = 0; idx < buttons.length; idx += 2) {
    rows.push(buttons.slice(idx, idx + 2))
  }
  rows.push([{ text: 'Back', callback_data: 'menu:start' }])
  return {
    inline_keyboard: rows,
  }
}

function formatBpsPercentLabel(percentBps: number): string {
  const whole = Math.floor(percentBps / 100)
  const fraction = percentBps % 100
  if (fraction === 0) return `${whole}%`
  return `${whole}.${String(fraction).padStart(2, '0')}%`
}

function buildTradePercentPickerReplyMarkup(params: {
  actionType: InteractiveTradeAction
  vaultAddress: `0x${string}`
}): Record<string, unknown> {
  const presets = [2500, 5000, 7500, 9900]
  const presetButtons = presets.map((percentBps) => ({
    text: formatBpsPercentLabel(percentBps),
    callback_data: `tradeflow:p:${params.actionType}:${params.vaultAddress}:${percentBps}`,
  }))
  return {
    inline_keyboard: [
      [presetButtons[0]!, presetButtons[1]!],
      [presetButtons[2]!, presetButtons[3]!],
      [
        { text: 'Custom %', callback_data: `tradeflow:c:${params.actionType}:${params.vaultAddress}` },
        { text: 'Change Vault', callback_data: `menu:${params.actionType}` },
      ],
    ],
  }
}

function buildTradeCustomPercentReplyMarkup(params: {
  actionType: InteractiveTradeAction
  vaultAddress: `0x${string}`
}): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Use Presets', callback_data: `tradeflow:v:${params.actionType}:${params.vaultAddress}` },
        { text: 'Change Vault', callback_data: `menu:${params.actionType}` },
      ],
      [{ text: 'Back', callback_data: 'menu:start' }],
    ],
  }
}

function formatUnitsCompact(value: bigint, decimals: number, maxFractionDigits = 8): string {
  const full = formatUnits(value, Math.max(0, decimals))
  const [whole, fraction = ''] = full.split('.')
  if (!fraction) return whole
  const trimmed = fraction.slice(0, Math.max(0, maxFractionDigits)).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

function parsePercentInputToBps(rawText: string): number | null {
  const text = asTrimmed(rawText)
  if (!text) return null
  const normalized = text.replace(/%/g, '').replace(/,/g, '').trim()
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 1 || value > 99.99) return null
  const bps = Math.round(value * 100)
  if (!Number.isFinite(bps) || bps < 100 || bps > 9_999) return null
  return bps
}

async function buildTradeIntentFromPercent(params: {
  actionType: InteractiveTradeAction
  vault: ScopedVaultRow
  canonicalCswAddress: `0x${string}`
  percentBps: number
}): Promise<{ ok: true; tradeIntent: ParsedTelegramTradeIntent } | { ok: false; text: string }> {
  const percentBps = Math.max(100, Math.min(9_999, Math.floor(Number(params.percentBps))))
  const wallet = getAddress(params.canonicalCswAddress as Address)
  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl(), { timeout: 20_000 }),
  }) as any

  if (params.actionType === 'buy' || params.actionType === 'bid') {
    const ethBalanceWei = (await client.getBalance({ address: wallet }).catch(() => 0n)) as bigint
    const amountWei = applyBps(ethBalanceWei, BigInt(percentBps))
    if (amountWei <= 0n) {
      return {
        ok: false,
        text: [
          'Trade blocked',
          '',
          '- selected size rounds to zero from your current ETH balance',
          '- choose a larger percent or fund your wallet',
        ].join('\n'),
      }
    }
    const amountEthText = formatUnitsCompact(amountWei, 18, 8)
    const amountEth = Number(amountEthText)
    if (!Number.isFinite(amountEth) || amountEth <= 0) {
      return {
        ok: false,
        text: 'Trade blocked: failed to derive a valid ETH amount from the selected percent.',
      }
    }
    if (params.actionType === 'buy') {
      return {
        ok: true,
        tradeIntent: {
          actionType: 'buy',
          identifier: params.vault.vaultAddress,
          amountInput: amountEthText,
          amount: amountEth,
          amountUnit: 'ETH',
        },
      }
    }
    const usdIntentRaw = amountEth * readEthUsdPrice()
    const usdIntentText = formatAmount(usdIntentRaw, 2)
    const usdIntent = Number(usdIntentText)
    if (!Number.isFinite(usdIntent) || usdIntent <= 0) {
      return {
        ok: false,
        text: 'Bid blocked: selected ETH size is too small after USD conversion.',
      }
    }
    return {
      ok: true,
      tradeIntent: {
        actionType: 'bid',
        identifier: params.vault.vaultAddress,
        amountInput: usdIntentText,
        amount: usdIntent,
        amountUnit: 'USD',
      },
    }
  }

  if (!isAddressLike(params.vault.creatorCoinAddress)) {
    return {
      ok: false,
      text: 'Sell blocked: creator coin token address is unavailable for this vault.',
    }
  }

  const shareToken = getAddress(params.vault.creatorCoinAddress as Address)
  const [shareBalanceRaw, decimalsRaw] = (await Promise.all([
    client
      .readContract({
        address: shareToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet],
      })
      .catch(() => 0n),
    client
      .readContract({
        address: shareToken,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      .catch(() => 18),
  ])) as [bigint, bigint | number]
  const decimals = Number(decimalsRaw)
  const shareDecimals = Number.isFinite(decimals) && decimals >= 0 ? Math.floor(decimals) : 18
  const amountRaw = applyBps(shareBalanceRaw, BigInt(percentBps))
  if (amountRaw <= 0n) {
    return {
      ok: false,
      text: [
        'Sell blocked',
        '',
        '- selected size rounds to zero from your current share balance',
        '- choose a larger percent or acquire more shares',
      ].join('\n'),
    }
  }
  const shareAmountText = formatUnitsCompact(amountRaw, shareDecimals, 8)
  const shareAmount = Number(shareAmountText)
  if (!Number.isFinite(shareAmount) || shareAmount <= 0) {
    return {
      ok: false,
      text: 'Sell blocked: failed to derive a valid share amount from the selected percent.',
    }
  }
  return {
    ok: true,
    tradeIntent: {
      actionType: 'sell',
      identifier: params.vault.vaultAddress,
      amountInput: shareAmountText,
      amount: shareAmount,
      amountUnit: 'SHARE',
    },
  }
}

function isTradeMembershipCheckEnabled(): boolean {
  return isTradeMembershipCheckEnabledShared()
}

async function readTelegramChatMemberStatus(params: {
  chatId: string
  userId: string
}): Promise<string | null> {
  return readTelegramChatMemberStatusShared({
    botToken: getTelegramWebhookConfig().botToken,
    chatId: params.chatId,
    userId: params.userId,
  })
}

async function verifyTradeMembership(params: {
  chatId: string
  userId: string
}): Promise<{ ok: true } | { ok: false; status: string | null }> {
  if (!isTradeMembershipCheckEnabled()) return { ok: true }
  if (isPrivateChatId(params.chatId)) return { ok: true }
  const status = await readTelegramChatMemberStatus(params)
  if (status === 'creator' || status === 'administrator' || status === 'member') {
    return { ok: true }
  }
  return {
    ok: false,
    status,
  }
}

async function executeTelegramNativeCommand(params: {
  text: string
  chatId: string
  userId: string
  groupId?: string
  senderWallet?: `0x${string}`
  messageId?: number
  allowTradeArgs?: boolean
  db?: Awaited<ReturnType<typeof getDb>> | null
  skipSchemaEnsure?: boolean
  tradePrefetch?: {
    link?: Awaited<ReturnType<typeof getTelegramLinkByUserId>> | null
    scopedVaults?: Awaited<ReturnType<typeof listTelegramScopedVaults>>
  }
}): Promise<TelegramCommandResponse | null> {
  if (!isTelegramNativeCommand(params.text)) return null
  const head = getCommandHead(params.text)
  const tradeIntent = parseTelegramTradeIntent(params.text)
  const deployIntent = parseTelegramDeployIntent(params.text)

  if (head === 'start') {
    const isLinked = await isTelegramUserLinked({
      telegramUserId: params.userId,
      db: params.db,
    })
    if (!isLinked && isPrivateChatId(params.chatId)) {
      const db = params.db ?? (await getDb())
      if (db) {
        await ensureTelegramTradingSchema(db as any)
        await upsertTelegramOnboardingSession({ db: db as any, telegramUserId: params.userId, step: 'welcome' })
      }
      return {
        text: buildOnboardingWelcomeText(),
        replyMarkup: buildOnboardingWelcomeReplyMarkup(),
      }
    }
    if (!isLinked && !isPrivateChatId(params.chatId)) {
      return {
        text: buildUnlinkedGroupStartLandingText(),
        replyMarkup: buildHelpReplyMarkup({ chatId: params.chatId, isLinked: false }),
      }
    }
    return {
      text: buildStartLandingText({ isLinked: true }),
      replyMarkup: buildHelpReplyMarkup({ chatId: params.chatId, isLinked: true }),
    }
  }

  if (head === 'link') {
    if (!isPrivateChatId(params.chatId)) {
      return buildTelegramLinkFlowResponse({
        chatId: params.chatId,
        telegramUserId: params.userId,
        linkButtonText: 'Refresh Connect',
      })
    }
    const db = params.db ?? (await getDb())
    const isLinked = await isTelegramUserLinked({ telegramUserId: params.userId, db: db ?? undefined })
    if (isLinked) {
      return buildTelegramLinkFlowResponse({
        chatId: params.chatId,
        telegramUserId: params.userId,
        linkButtonText: 'Refresh Connect',
      })
    }
    if (!db) {
      return {
        text: ['Link', '', '- database unavailable — retry in a few seconds', '- then send /start'].join('\n'),
      }
    }
    await ensureTelegramTradingSchema(db as any)
    const session = await readTelegramOnboardingSession({ db: db as any, telegramUserId: params.userId })
    const step = session?.step
    if (!step || step === 'welcome') {
      return {
        text: buildOnboardingWelcomeText(),
        replyMarkup: buildOnboardingWelcomeReplyMarkup(),
      }
    }
    if (step === 'csw_fork') {
      return {
        text: buildCswForkText(),
        replyMarkup: buildCswForkReplyMarkup(),
      }
    }
    if (step === 'branch_link' || step === 'branch_create') {
      return buildTelegramLinkFlowResponse({
        chatId: params.chatId,
        telegramUserId: params.userId,
        linkButtonText: 'Refresh Connect',
        zoraOnboardingBranch: step === 'branch_link' ? 'has' : 'need',
      })
    }
    return buildTelegramLinkFlowResponse({
      chatId: params.chatId,
      telegramUserId: params.userId,
      linkButtonText: 'Refresh Connect',
    })
  }

  if (head === 'tip') {
    if (!isStarsTipsEnabledForChat(params.chatId)) {
      return {
        text: [
          'Tips',
          '',
          '- Telegram Stars tips are currently disabled in this chat',
        ].join('\n'),
      }
    }
    const starsMatch = params.text.match(/^\/?tip(?:\s+(\d+))?/i)
    const stars = parseTipStars(starsMatch?.[1] ?? '') ?? 1
    return {
      text: [
        'Tip with Telegram Stars',
        '',
        `Quick amount: ${stars} ⭐`,
        'Tap a button below to open a one-tap Stars invoice.',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [{ text: `Tip ⭐${stars}`, callback_data: `tip:${stars}:manual` }],
          [
            { text: 'Tip ⭐1', callback_data: 'tip:1:manual' },
            { text: 'Tip ⭐5', callback_data: 'tip:5:manual' },
          ],
        ],
      },
    }
  }

  if (head === 'zora') {
    return buildTelegramZoraResponse(params.chatId)
  }

  const db = params.db ?? (await getDb())
  if (!db) {
    if (head === 'linked') {
      return {
        text: [
          'Link Status',
          '',
          '- linked: unknown (database unavailable)',
          '- next: run /link and retry /linked in a moment',
        ].join('\n'),
      }
    }
    if (head === 'unlink') {
      return {
        text: [
          'Unlink',
          '',
          '- database unavailable',
          '- retry in a few seconds',
        ].join('\n'),
      }
    }
    if (head === 'wallet') {
      return {
        text: [
          'Wallet',
          '',
          '- unavailable while database is offline',
          '- retry in a few seconds',
        ].join('\n'),
      }
    }
    if (head === 'vaults' || head === 'list') {
      return { text: ['Vaults', '', '- unavailable while database is offline'].join('\n') }
    }
    if (head === 'auctions') {
      return { text: ['Auctions', '', '- unavailable while database is offline'].join('\n') }
    }
    if (head === 'mybids') {
      return { text: ['My Bids', '', '- unavailable while database is offline'].join('\n') }
    }
    if (head === 'signals') {
      return { text: ['Signals', '', '- unavailable while database is offline'].join('\n') }
    }
    if (head === 'join' || head === 'rooms' || head === 'eligibility') {
      return { text: ['Holder Rooms', '', '- unavailable while database is offline'].join('\n') }
    }
    if (head === 'buy' || head === 'sell' || head === 'bid') {
      return {
        text: [
          'Trade Flow',
          '',
          '- interactive trade flow is unavailable while database is offline',
          '- retry in a few seconds',
        ].join('\n'),
      }
    }
    if (tradeIntent) {
      return {
        text: [
          'Trade Preview',
          '',
          '- database unavailable',
          '- retry in a few seconds',
        ].join('\n'),
      }
    }
    if (head === 'deploy') {
      if (deployIntent?.kind === 'zora') {
        return buildTelegramZoraResponse(params.chatId)
      }
      if (deployIntent?.kind === 'menu' || deployIntent?.kind === 'usage' || !deployIntent) {
        return {
          text: deployIntent?.kind === 'usage' ? deployIntent.text : formatDeployUsageText(),
          replyMarkup: buildDeployMenuReplyMarkup(),
        }
      }
      return {
        text: [
          'Deploy flow',
          '',
          '- database unavailable',
          '- retry in a few seconds',
        ].join('\n'),
      }
    }
    return null
  }

  if (!params.skipSchemaEnsure) {
    await ensureWaitlistSchema(db as any)
    await ensureKeeprSchema()
    await ensureTelegramTradingSchema(db as any)
  }

  if (head === 'deploy') {
    if (!deployIntent) {
      return {
        text: formatDeployUsageText(),
        replyMarkup: buildDeployMenuReplyMarkup(),
      }
    }
    if (deployIntent.kind === 'menu') {
      return {
        text: [
          'Deploy Wizard',
          '',
          '- pick deploy type below',
          '- then run the generated `/deploy ...` template',
          '- confirm preview to execute',
        ].join('\n'),
        replyMarkup: buildDeployMenuReplyMarkup(),
      }
    }
    if (deployIntent.kind === 'usage') {
      return {
        text: deployIntent.text,
        replyMarkup: buildDeployMenuReplyMarkup(),
      }
    }
    if (deployIntent.kind === 'zora') {
      return buildTelegramZoraResponse(params.chatId)
    }

    const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
    if (!link || link.linkStatus !== 'active') {
      return {
        text: [
          'Deploy blocked',
          '',
          '- link required: run /link first',
          '- after linking, retry /deploy',
        ].join('\n'),
      }
    }
    if (!link.ownerVerified) {
      return {
        text: [
          'Deploy blocked',
          '',
          '- owner verification required',
          '- run /linked and ensure ownerVerified is true',
        ].join('\n'),
      }
    }

    const intentPayload: Record<string, unknown> =
      deployIntent.kind === 'trend'
        ? {
            deployType: 'trend',
            ticker: deployIntent.ticker,
          }
        : {
            deployType: deployIntent.coinType,
            name: deployIntent.name,
            symbol: deployIntent.symbol,
            metadataUri: deployIntent.metadataUri,
            currencyInput: deployIntent.currencyInput,
          }

    const deployBuild = buildDeployCommandFromIntent(intentPayload)
    if (!deployBuild) {
      return {
        text: formatDeployUsageText('Unable to build deploy command from supplied arguments.'),
        replyMarkup: buildDeployMenuReplyMarkup(),
      }
    }

    const token = await createTelegramActionToken({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      actionType: deployIntent.kind === 'trend' ? 'deploy_trend' : `deploy_${deployIntent.coinType}`,
      intentPayload,
      ttlSeconds: 60 * 3,
    })

    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: 'deploy',
      intent: intentPayload,
      execution: {
        mode: 'preview',
        commandText: deployBuild.commandText,
      },
      status: 'previewed',
    })

    return {
      text: formatDeployPreviewText({
        commandText: deployBuild.commandText,
        deployLabel: deployBuild.deployLabel,
        detailLines: deployBuild.detailLines,
        expiresAt: token.expiresAt,
      }),
      replyMarkup: buildDeployPreviewReplyMarkup(token.token),
    }
  }

  if (head === 'buy' || head === 'sell' || head === 'bid') {
    const actionType = head as InteractiveTradeAction
    const flowStartState = reduceTradeFlowState(TRADE_FLOW_IDLE_STATE, {
      type: 'START',
      actionType,
    })
    const hasArgs = commandHasArguments(params.text, actionType)
    if (hasArgs && !params.allowTradeArgs) {
      return {
        text: [
          'Trade Flow',
          '',
          `- Step 1/3: send \`/${actionType}\` with no arguments`,
          '- Step 2/3: pick vault and size',
          '- Step 3/3: review preview and tap Accept or Decline',
        ].join('\n'),
      }
    }
    if (!hasArgs) {
      const prefetchedLink = params.tradePrefetch?.link
      const link =
        prefetchedLink === undefined
          ? await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
          : prefetchedLink
      if (!link || link.linkStatus !== 'active') {
        return {
          text: [
            'Trade blocked',
            '',
            '- link required: run /link first',
            '- after linking, retry your command',
          ].join('\n'),
        }
      }
      if (!link.ownerVerified) {
        return {
          text: [
            'Trade blocked',
            '',
            '- owner verification required',
            '- run /linked and ensure ownerVerified is true',
          ].join('\n'),
        }
      }

      const tradePolicy = await getTelegramChatTradePolicy({
        db: db as any,
        chatId: params.chatId,
      })
      if ((actionType === 'buy' || actionType === 'sell') && !tradePolicy.buySellEnabled) {
        return {
          text: [
            'Trade blocked',
            '',
            '- buy/sell disabled for this chat scope',
            '- ask an admin to enable buy/sell in telegram_chat_vault_scope',
          ].join('\n'),
        }
      }
      if (actionType === 'bid' && !tradePolicy.bidEnabled) {
        return {
          text: [
            'Trade blocked',
            '',
            '- bid disabled for this chat scope',
            '- ask an admin to enable bid in telegram_chat_vault_scope',
          ].join('\n'),
        }
      }

      const membership = await verifyTradeMembership({
        chatId: params.chatId,
        userId: params.userId,
      })
      if (!membership.ok) {
        return {
          text: [
            'Trade blocked',
            '',
            '- membership check failed for this chat',
            `- status: ${membership.status ?? 'unknown'}`,
            '- rejoin the group/topic and retry',
          ].join('\n'),
        }
      }

      const scopedVaults =
        params.tradePrefetch?.scopedVaults
          ? params.tradePrefetch.scopedVaults
          : await listTelegramScopedVaults({ db: db as any, chatId: params.chatId, limit: 20 })
      if (scopedVaults.length === 0) {
        return {
          text: [
            'Trade blocked',
            '',
            '- no vaults are currently scoped for this chat',
            '- ask an admin to configure telegram_chat_vault_scope',
          ].join('\n'),
        }
      }
      await clearTelegramTradePercentPrompt({
        db: db as any,
        chatId: params.chatId,
        telegramUserId: params.userId,
      })
      emitTelegramFunnelEvent({
        db,
        telegramUserId: params.userId,
        chatId: params.chatId,
        eventName: 'trade_flow_started',
        actionType,
        context: {
          entry: 'command',
          messageId: typeof params.messageId === 'number' ? params.messageId : null,
        },
      })
      if (flowStartState.status !== 'VaultSelect') {
        return {
          text: 'Trade flow unavailable. Please retry /buy, /sell, or /bid.',
        }
      }
      return {
        text: `Step 1/3 • Pick a vault to ${flowStartState.actionType.toUpperCase()}`,
        replyMarkup: buildTradeVaultPickerReplyMarkup({
          actionType: flowStartState.actionType,
          scopedVaults,
        }),
      }
    }
  }

  if (head === 'rooms') {
    if (!areHolderRoomsEnabled()) {
      return {
        text: [
          'Holder Rooms',
          '',
          '- holder rooms are currently disabled in this chat',
          '- ask an admin to enable TELEGRAM_HOLDER_ROOMS_ENABLED',
          '',
          formatHolderRoomUsageText(),
        ].join('\n'),
      }
    }
    const policies = await listHolderRoomPolicies({
      db: db as any,
      chatId: params.chatId,
      enabledOnly: true,
      limit: 20,
    })
    return { text: formatHolderRoomsText(policies) }
  }

  if (head === 'join' || head === 'eligibility') {
    if (!areHolderRoomsEnabled()) {
      return {
        text: [
          'Holder Rooms',
          '',
          '- holder rooms are currently disabled in this chat',
          '- ask an admin to enable TELEGRAM_HOLDER_ROOMS_ENABLED',
          '',
          formatHolderRoomUsageText(),
        ].join('\n'),
      }
    }

    const identifier = parseHolderRoomIdentifier(params.text, head)
    if (!identifier) {
      return {
        text: formatHolderRoomUsageText(),
      }
    }

    const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
    if (!link || link.linkStatus !== 'active') {
      return {
        text: [
          'Join Room',
          '',
          '- link required: run /link first',
          '- after linking, retry your command',
        ].join('\n'),
      }
    }
    if (!link.ownerVerified) {
      return {
        text: [
          'Join Room',
          '',
          '- owner verification required',
          '- run /linked and ensure ownerVerified is true',
        ].join('\n'),
      }
    }

    const scopedVaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId, limit: 50 })
    const target = resolveTradeTarget(scopedVaults, identifier)
    if (!target) {
      return {
        text: [
          'Join Room',
          '',
          '- target vault not found in this chat scope',
          '- run /vaults to see scoped vaults',
          '- usage: `/join` <vault|ticker>',
        ].join('\n'),
      }
    }

    const policy = await getHolderRoomPolicyByVault({
      db: db as any,
      chatId: params.chatId,
      vaultAddress: target.vaultAddress,
    })
    if (!policy || !policy.enabled) {
      return {
        text: [
          'Join Room',
          '',
          '- no holder room policy configured for this vault',
          '- run /rooms to list available holder rooms',
        ].join('\n'),
      }
    }

    const minShares = toBigIntStrict(policy.minSharesRaw)
    if (minShares <= 0n) {
      return {
        text: [
          'Join Room',
          '',
          '- holder room policy is misconfigured',
          '- minSharesRaw must be greater than 0',
        ].join('\n'),
      }
    }

    const shareToken = isAddressLike(target.creatorCoinAddress)
      ? target.creatorCoinAddress.toLowerCase()
      : target.vaultAddress.toLowerCase()
    const eligibility = await checkSharesEligibility({
      wallet: link.canonicalCswAddress.toLowerCase() as Address,
      shareToken: shareToken as Address,
      minShares,
    })

    const eligibilityLines = [
      'Holder Eligibility',
      '',
      `- vault: ${truncateAddress(target.vaultAddress)}`,
      `- roomChatId: ${policy.roomChatId}`,
      `- status: ${eligibility.eligible ? 'eligible' : 'not eligible'}`,
      `- balanceRaw: ${eligibility.evidence.shareBalance}`,
      `- thresholdRaw: ${eligibility.evidence.threshold}`,
      `- reason: ${eligibility.reason}`,
    ]

    if (head === 'eligibility') {
      if (eligibility.eligible) {
        eligibilityLines.push('- next: `/join` <vault|ticker>')
      } else {
        eligibilityLines.push('- next: acquire enough shares, then retry `/eligibility` <vault|ticker>')
      }
      return { text: eligibilityLines.join('\n') }
    }

    if (!eligibility.eligible) {
      return {
        text: [
          'Join Room',
          '',
          '- not eligible for holder room access',
          `- balanceRaw: ${eligibility.evidence.shareBalance}`,
          `- thresholdRaw: ${eligibility.evidence.threshold}`,
          '- check exact status: `/eligibility` <vault|ticker>',
        ].join('\n'),
      }
    }

    const inviteLink = await createTelegramHolderRoomInviteLink({
      botToken: getTelegramWebhookConfig().botToken,
      roomChatId: policy.roomChatId,
      ttlSeconds: 60 * 10,
    })
    if (!inviteLink) {
      return {
        text: [
          'Join Room',
          '',
          '- invite creation failed',
          '- retry `/join` <vault|ticker> in a few seconds',
        ].join('\n'),
      }
    }

    const nowIso = new Date().toISOString()
    await upsertHolderRoomMember({
      db: db as any,
      roomChatId: policy.roomChatId,
      telegramUserId: params.userId,
      canonicalCswAddress: link.canonicalCswAddress,
      status: 'active',
      lastEligibleAt: nowIso,
      graceUntil: null,
      lastCheckedAt: nowIso,
      removedAt: null,
    })

    const inviteMessage = [
      'Join Room',
      '',
      '- eligible: yes',
      `- vault: ${truncateAddress(target.vaultAddress)}`,
      `- roomChatId: ${policy.roomChatId}`,
      `- invite: ${inviteLink}`,
      '- invite validity is short-lived; use immediately',
    ].join('\n')

    if (!isPrivateChatId(params.chatId)) {
      const sentToDm = await sendTelegramMessage({
        botToken: getTelegramWebhookConfig().botToken,
        chatId: params.userId,
        text: inviteMessage,
      }).then(() => true).catch(() => false)

      return {
        text: sentToDm
          ? [
            'Join Room',
            '',
            '- eligible: yes',
            `- vault: ${truncateAddress(target.vaultAddress)}`,
            '- invite sent via private DM for security',
          ].join('\n')
          : [
            'Join Room',
            '',
            '- eligible: yes',
            '- invite ready but private DM delivery failed',
            '- open a private chat with this bot and send /start, then retry /join',
          ].join('\n'),
      }
    }

    return {
      text: inviteMessage,
    }
  }

  if (head === 'linked') {
    const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
    if (!link || link.linkStatus !== 'active') {
      const linkFlow = buildTelegramLinkFlowResponse({
        chatId: params.chatId,
        telegramUserId: params.userId,
        linkButtonText: menuLabel('connect'),
      })
      return {
        text: [formatLinkStatusText(link), '', 'Next step: start one-tap linking below.'].join('\n'),
        replyMarkup: linkFlow.replyMarkup,
      }
    }
    if (!link.ownerVerified) {
      const relinkFlow = buildTelegramLinkFlowResponse({
        chatId: params.chatId,
        telegramUserId: params.userId,
        telegramUsername: link.telegramUsername,
        linkButtonText: 'Reconnect',
      })
      return {
        text: [
          formatLinkStatusText(link),
          '',
          'Owner verification is still pending.',
          'Reconnect below to verify your canonical Coinbase Smart Wallet.',
        ].join('\n'),
        replyMarkup: relinkFlow.replyMarkup,
      }
    }
    return {
      text: [
        formatLinkStatusText(link),
        '',
        'Ready actions:',
        `- tap ${menuLabel('wallet')}, ${menuLabel('trade')}, or ${menuLabel('explore')} below`,
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [
            buildMiniAppLaunchButton({
              chatId: params.chatId,
              text: menuLabel('wallet'),
              url: buildTelegramMiniAppUrl({
                baseUrl: resolveTelegramMiniAppUrl(),
                pathname: '/swap',
                query: {
                  tgMiniApp: '1',
                  tgEntry: 'wallet',
                },
              }),
            }),
          ],
          [
            { text: menuLabel('trade'), callback_data: 'menu:trade' },
            { text: menuLabel('explore'), callback_data: 'menu:explore' },
            { text: menuLabel('help'), callback_data: 'menu:topics' },
          ],
        ],
      },
    }
  }

  if (head === 'unlink') {
    const before = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
    if (!before) {
      return {
        text: [
          'Unlink',
          '',
          '- no active link found for this Telegram user',
        ].join('\n'),
      }
    }
    const revoked = await revokeTelegramLink({ db: db as any, telegramUserId: params.userId, reason: 'user_requested' })
    if (!revoked.revoked) {
      return {
        text: [
          'Unlink',
          '',
          '- link already revoked',
        ].join('\n'),
      }
    }
    return {
      text: [
        'Unlink',
        '',
        '- link revoked',
        `- canonicalCSW: ${truncateAddress(before.canonicalCswAddress)}`,
        '- run /link to link again',
      ].join('\n'),
    }
  }

  if (head === 'wallet') {
    const summary = await getTelegramPortfolioSummary({ db: db as any, telegramUserId: params.userId })
    return { text: formatWalletText(summary) }
  }

  if (head === 'vaults' || head === 'list') {
    const vaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId })
    return { text: formatVaultsText(vaults) }
  }

  if (head === 'auctions') {
    const auctions = await listTelegramAuctions({ db: db as any, chatId: params.chatId })
    return { text: formatAuctionsText(auctions) }
  }

  if (head === 'mybids') {
    const bids = await listTelegramUserBids({ db: db as any, telegramUserId: params.userId })
    return { text: formatSignalsText('My Bids', bids) }
  }

  if (head === 'signals') {
    const signals = await listTelegramSignals({ db: db as any, chatId: params.chatId })
    return { text: formatSignalsText('Signals', signals) }
  }

  if (tradeIntent) {
    const prefetchedLink = params.tradePrefetch?.link
    const link =
      prefetchedLink === undefined
        ? await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
        : prefetchedLink
    if (!link || link.linkStatus !== 'active') {
      return {
        text: [
          'Trade blocked',
          '',
          '- link required: run /link first',
          '- after linking, retry your command',
        ].join('\n'),
      }
    }
    if (!link.ownerVerified) {
      return {
        text: [
          'Trade blocked',
          '',
          '- owner verification required',
          '- run /linked and ensure ownerVerified is true',
        ].join('\n'),
      }
    }

    const tradePolicy = await getTelegramChatTradePolicy({
      db: db as any,
      chatId: params.chatId,
    })
    if ((tradeIntent.actionType === 'buy' || tradeIntent.actionType === 'sell') && !tradePolicy.buySellEnabled) {
      return {
        text: [
          'Trade blocked',
          '',
          '- buy/sell disabled for this chat scope',
          '- ask an admin to enable buy/sell in telegram_chat_vault_scope',
        ].join('\n'),
      }
    }
    if (tradeIntent.actionType === 'bid' && !tradePolicy.bidEnabled) {
      return {
        text: [
          'Trade blocked',
          '',
          '- bid disabled for this chat scope',
          '- ask an admin to enable bid in telegram_chat_vault_scope',
        ].join('\n'),
      }
    }

    const membership = await verifyTradeMembership({
      chatId: params.chatId,
      userId: params.userId,
    })
    if (!membership.ok) {
      return {
        text: [
          'Trade blocked',
          '',
          '- membership check failed for this chat',
          `- status: ${membership.status ?? 'unknown'}`,
          '- rejoin the group/topic and retry',
        ].join('\n'),
      }
    }

    const rateLimit = checkTelegramTradeRateLimit({
      chatId: params.chatId,
      userId: params.userId,
      actionType: tradeIntent.actionType,
    })
    if (!rateLimit.ok) {
      return {
        text: formatTradeRateLimitText({
          actionType: tradeIntent.actionType,
          reason: rateLimit.reason,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }),
      }
    }

    const scopedVaults =
      params.tradePrefetch?.scopedVaults
        ? params.tradePrefetch.scopedVaults
        : await listTelegramScopedVaults({ db: db as any, chatId: params.chatId })
    const target = resolveTradeTarget(scopedVaults, tradeIntent.identifier)
    if (!target) {
      return {
        text: [
          'Trade blocked',
          '',
          '- target vault not found in this chat scope',
          '- use /vaults to list allowed vaults',
          '- start again with /buy, /sell, or /bid',
        ].join('\n'),
      }
    }

    const ethUsd = readEthUsdPrice()
    const shareUsd = readShareUsdFallback()
    let amountEth = tradeIntent.actionType === 'buy' ? tradeIntent.amount : 0
    let usdEstimate =
      tradeIntent.actionType === 'buy'
        ? tradeIntent.amount * ethUsd
        : tradeIntent.actionType === 'sell'
          ? tradeIntent.amount * shareUsd
          : tradeIntent.amount
    let bidQuote: CcaAuctionQuote | null = null

    if (tradeIntent.actionType === 'bid') {
      if (!isAddressLike(target.ccaStrategyAddress)) {
        return {
          text: [
            'Bid blocked',
            '',
            '- this vault does not have an active CCA strategy',
            '- use /auctions to find active auctions',
          ].join('\n'),
        }
      }
      try {
        bidQuote = await readCcaAuctionQuote({
          ccaStrategyAddress: target.ccaStrategyAddress as `0x${string}`,
          usdIntent: tradeIntent.amount,
        })
      } catch (error: any) {
        const reason = asTrimmed(error?.message ?? '')
        if (reason === 'cca_auction_not_active') {
          return {
            text: [
              'Bid blocked',
              '',
              '- auction is not active for this vault',
              '- use /auctions to pick an active target',
            ].join('\n'),
          }
        }
        return {
          text: [
            'Bid blocked',
            '',
            '- failed to quote bid amount right now',
            '- please retry /bid in a moment',
          ].join('\n'),
        }
      }
      amountEth = bidQuote.amountEth
      usdEstimate = bidQuote.usdIntent
    }

    const intentPayload: Record<string, unknown> = {
      version: 1,
      actionType: tradeIntent.actionType,
      chainId: target.chainId,
      vaultAddress: target.vaultAddress,
      creatorCoinAddress: target.creatorCoinAddress,
      ccaStrategyAddress: target.ccaStrategyAddress,
      amountInput: tradeIntent.amountInput,
      amountEth: Number(formatAmount(amountEth, 8)),
      usdEstimate: Number(formatAmount(usdEstimate, 2)),
      amountUnit: tradeIntent.amountUnit,
      canonicalCswAddress: link.canonicalCswAddress,
      profileId: link.profileId,
      ownerVerified: link.ownerVerified,
      createdAt: new Date().toISOString(),
    }
    if (tradeIntent.actionType === 'bid' && bidQuote) {
      intentPayload.bid = {
        auctionAddress: bidQuote.auctionAddress,
        ccaStrategyAddress: bidQuote.ccaStrategyAddress,
        tokenSymbol: bidQuote.tokenSymbol,
        maxPriceQ96: bidQuote.maxPriceQ96.toString(),
        maxPriceWeiPerToken: bidQuote.maxPriceWeiPerToken.toString(),
        amountWei: bidQuote.amountWei.toString(),
        clearingPriceQ96: bidQuote.clearingPriceQ96.toString(),
        clearingPriceWeiPerToken: bidQuote.clearingPriceWeiPerToken.toString(),
      }
    }

    const tradeToken = await createTelegramActionToken({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      actionType: tradeIntent.actionType,
      intentPayload,
      ttlSeconds: 90,
    })

    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: tradeIntent.actionType,
      intent: intentPayload,
      quote: {
        usdEstimate: Number(formatAmount(usdEstimate, 2)),
        amountEth: Number(formatAmount(amountEth, 8)),
        rate: ethUsd,
        ...(bidQuote
          ? {
              auctionAddress: bidQuote.auctionAddress,
              ccaStrategyAddress: bidQuote.ccaStrategyAddress,
              tokenSymbol: bidQuote.tokenSymbol,
              maxPriceQ96: bidQuote.maxPriceQ96.toString(),
              maxPriceWeiPerToken: bidQuote.maxPriceWeiPerToken.toString(),
              amountWei: bidQuote.amountWei.toString(),
              clearingPriceQ96: bidQuote.clearingPriceQ96.toString(),
              clearingPriceWeiPerToken: bidQuote.clearingPriceWeiPerToken.toString(),
            }
          : {}),
      },
      status: 'previewed',
    })
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_preview_ready',
      actionType: tradeIntent.actionType,
      context: {
        vaultAddress: target.vaultAddress,
        creatorCoinAddress: target.creatorCoinAddress,
        amountInput: tradeIntent.amountInput,
        amountUnit: tradeIntent.amountUnit,
      },
    })

    return {
      text: formatTradePreviewText({
        actionType: tradeIntent.actionType,
        targetLabel: truncateAddress(target.vaultAddress),
        amountInput: tradeIntent.amountInput,
        amountEth,
        usdEstimate,
        bidContext: bidQuote
          ? {
              auctionAddress: bidQuote.auctionAddress,
              tokenSymbol: bidQuote.tokenSymbol,
              clearingPriceWeiPerToken: bidQuote.clearingPriceWeiPerToken,
              maxPriceWeiPerToken: bidQuote.maxPriceWeiPerToken,
            }
          : null,
      }),
      replyMarkup: buildTradePreviewReplyMarkup({
        token: tradeToken.token,
      }),
    }
  }

  return null
}

function tradeIntentToSyntheticCommand(tradeIntent: ParsedTelegramTradeIntent): string {
  if (tradeIntent.actionType === 'bid') {
    return `/bid ${tradeIntent.identifier} $${tradeIntent.amountInput}`
  }
  return `/${tradeIntent.actionType} ${tradeIntent.identifier} ${tradeIntent.amountInput}`
}

async function handleTelegramTradeFlowCallback(params: {
  callbackData: string
  chatId: string
  userId: string
  messageId?: number
}): Promise<TelegramCommandResponse | null> {
  const callback = parseTradeFlowCallbackData(params.callbackData)
  if (!callback) return null
  let tradeFlowState: TradeFlowState = reduceTradeFlowState(TRADE_FLOW_IDLE_STATE, {
    type: 'START',
    actionType: callback.actionType,
  })

  const db = await getDb()
  if (!db) {
    return {
      text: 'Trade flow unavailable while database is offline. Please retry in a few seconds.',
      callbackToast: 'Temporarily unavailable',
    }
  }
  await ensureWaitlistSchema(db as any)
  await ensureKeeprSchema()
  await ensureTelegramTradingSchema(db as any)

  const scopedVaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId, limit: 20 })
  const target = resolveScopedVaultByAddress(scopedVaults, callback.vaultAddress)
  if (!target) {
    return {
      text: [
        'Trade flow',
        '',
        '- selected vault is no longer available in this chat scope',
        '- run /vaults and start again',
      ].join('\n'),
      callbackToast: 'Vault unavailable',
    }
  }

  if (callback.kind !== 'custom') {
    await clearTelegramTradePercentPrompt({
      db: db as any,
      chatId: params.chatId,
      telegramUserId: params.userId,
    })
  }

  if (callback.kind === 'vault') {
    tradeFlowState = reduceTradeFlowState(tradeFlowState, {
      type: 'VAULT_SELECTED',
      actionType: callback.actionType,
      vaultAddress: callback.vaultAddress,
    })
    if (tradeFlowState.status !== 'SizeSelect') {
      return {
        text: 'Trade flow state invalid. Please restart with /buy, /sell, or /bid.',
        callbackToast: 'Flow reset',
      }
    }
    return {
      text: `Step 2/3 • Pick size for ${tradeFlowState.actionType.toUpperCase()} ${truncateAddress(target.vaultAddress)}`,
      replyMarkup: buildTradePercentPickerReplyMarkup({
        actionType: tradeFlowState.actionType,
        vaultAddress: tradeFlowState.vaultAddress,
      }),
      callbackToast: 'Vault selected',
    }
  }

  if (callback.kind === 'custom') {
    tradeFlowState = reduceTradeFlowState(tradeFlowState, {
      type: 'VAULT_SELECTED',
      actionType: callback.actionType,
      vaultAddress: callback.vaultAddress,
    })
    tradeFlowState = reduceTradeFlowState(tradeFlowState, {
      type: 'CUSTOM_SELECTED',
      actionType: callback.actionType,
      vaultAddress: callback.vaultAddress,
    })
    if (tradeFlowState.status !== 'CustomPercentAwaitingInput') {
      return {
        text: 'Trade flow state invalid. Please restart with /buy, /sell, or /bid.',
        callbackToast: 'Flow reset',
      }
    }
    await upsertTelegramTradePercentPrompt({
      db: db as any,
      chatId: params.chatId,
      telegramUserId: params.userId,
      actionType: tradeFlowState.actionType,
      vaultAddress: tradeFlowState.vaultAddress,
      ttlSeconds: 60 * 3,
    })
    return {
      text: [
        `Step 2/3 • Custom ${tradeFlowState.actionType.toUpperCase()} size`,
        '',
        `Vault: ${truncateAddress(target.vaultAddress)}`,
        '- send a percent between 1 and 99.99 (example: 42%)',
      ].join('\n'),
      replyMarkup: buildTradeCustomPercentReplyMarkup({
        actionType: tradeFlowState.actionType,
        vaultAddress: tradeFlowState.vaultAddress,
      }),
      callbackToast: 'Send percent',
    }
  }

  tradeFlowState = reduceTradeFlowState(tradeFlowState, {
    type: 'VAULT_SELECTED',
    actionType: callback.actionType,
    vaultAddress: callback.vaultAddress,
  })
  tradeFlowState = reduceTradeFlowState(tradeFlowState, {
    type: 'PERCENT_SELECTED',
    actionType: callback.actionType,
    vaultAddress: callback.vaultAddress,
    percentBps: callback.percentBps,
  })
  if (tradeFlowState.status !== 'PreviewReady') {
    return {
      text: 'Trade flow state invalid. Please restart with /buy, /sell, or /bid.',
      callbackToast: 'Flow reset',
    }
  }

  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
  if (!link || link.linkStatus !== 'active') {
    return {
      text: [
        'Trade blocked',
        '',
        '- link required: run /link first',
        '- after linking, retry your command',
      ].join('\n'),
      callbackToast: 'Link required',
    }
  }
  if (!link.ownerVerified) {
    return {
      text: [
        'Trade blocked',
        '',
        '- owner verification required',
        '- run /linked and ensure ownerVerified is true',
      ].join('\n'),
      callbackToast: 'Owner check required',
    }
  }

  const intentResult = await buildTradeIntentFromPercent({
    actionType: tradeFlowState.actionType,
    vault: target,
    canonicalCswAddress: link.canonicalCswAddress.toLowerCase() as `0x${string}`,
    percentBps: tradeFlowState.percentBps,
  })
  if (!intentResult.ok) {
    return {
      text: intentResult.text,
      callbackToast: 'Invalid size',
    }
  }
  const syntheticCommand = tradeIntentToSyntheticCommand(intentResult.tradeIntent)
  const previewResponse = await executeTelegramNativeCommand({
    text: syntheticCommand,
    chatId: params.chatId,
    userId: params.userId,
    messageId: params.messageId,
    allowTradeArgs: true,
    db: db as any,
    skipSchemaEnsure: true,
    tradePrefetch: {
      link,
      scopedVaults,
    },
  })
  if (!previewResponse) {
    return {
      text: 'Trade preview unavailable. Please retry /buy, /sell, or /bid.',
      callbackToast: 'Preview unavailable',
    }
  }
  return {
    ...previewResponse,
    callbackToast: asTrimmed(previewResponse.callbackToast ?? '') || 'Preview ready',
  }
}

async function maybeHandlePendingTradePercentInput(params: {
  text: string
  chatId: string
  userId: string
  messageId?: number
}): Promise<TelegramCommandResponse | null> {
  if (!params.text || params.text.startsWith('/')) return null
  const db = await getDb()
  if (!db) return null
  await ensureTelegramTradingSchema(db as any)
  const prompt = await getTelegramTradePercentPrompt({
    db: db as any,
    chatId: params.chatId,
    telegramUserId: params.userId,
  })
  if (!prompt) return null
  let tradeFlowState: TradeFlowState = reduceTradeFlowState(TRADE_FLOW_IDLE_STATE, {
    type: 'START',
    actionType: prompt.actionType,
  })
  tradeFlowState = reduceTradeFlowState(tradeFlowState, {
    type: 'VAULT_SELECTED',
    actionType: prompt.actionType,
    vaultAddress: prompt.vaultAddress as `0x${string}`,
  })
  tradeFlowState = reduceTradeFlowState(tradeFlowState, {
    type: 'CUSTOM_SELECTED',
    actionType: prompt.actionType,
    vaultAddress: prompt.vaultAddress as `0x${string}`,
  })

  const percentBps = parsePercentInputToBps(params.text)
  if (!percentBps) {
    reduceTradeFlowState(tradeFlowState, {
      type: 'CUSTOM_INPUT_INVALID',
      actionType: prompt.actionType,
      vaultAddress: prompt.vaultAddress as `0x${string}`,
      reason: 'invalid_custom_percent',
    })
    return {
      text: [
        `Step 2/3 • Custom ${prompt.actionType.toUpperCase()} size`,
        '',
        '- send a percent between 1 and 99.99',
        '- example: 42%',
      ].join('\n'),
      replyMarkup: buildTradeCustomPercentReplyMarkup({
        actionType: prompt.actionType,
        vaultAddress: prompt.vaultAddress as `0x${string}`,
      }),
    }
  }
  tradeFlowState = reduceTradeFlowState(tradeFlowState, {
    type: 'CUSTOM_INPUT_VALID',
    actionType: prompt.actionType,
    vaultAddress: prompt.vaultAddress as `0x${string}`,
    percentBps,
  })
  if (tradeFlowState.status !== 'PreviewReady') {
    return {
      text: 'Trade flow state invalid. Please restart with /buy, /sell, or /bid.',
    }
  }

  const scopedVaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId, limit: 20 })
  const target = resolveScopedVaultByAddress(scopedVaults, prompt.vaultAddress)
  if (!target) {
    await clearTelegramTradePercentPrompt({
      db: db as any,
      chatId: params.chatId,
      telegramUserId: params.userId,
    })
    return {
      text: [
        'Trade flow',
        '',
        '- the selected vault is no longer available in this chat scope',
        '- run /vaults and start again',
      ].join('\n'),
    }
  }

  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
  if (!link || link.linkStatus !== 'active' || !link.ownerVerified) {
    await clearTelegramTradePercentPrompt({
      db: db as any,
      chatId: params.chatId,
      telegramUserId: params.userId,
    })
    return {
      text: [
        'Trade blocked',
        '',
        '- link + owner verification required',
        '- run /link then /linked, then retry',
      ].join('\n'),
    }
  }

  const intentResult = await buildTradeIntentFromPercent({
    actionType: tradeFlowState.actionType,
    vault: target,
    canonicalCswAddress: link.canonicalCswAddress.toLowerCase() as `0x${string}`,
    percentBps: tradeFlowState.percentBps,
  })
  if (!intentResult.ok) {
    return {
      text: intentResult.text,
      replyMarkup: buildTradeCustomPercentReplyMarkup({
        actionType: tradeFlowState.actionType,
        vaultAddress: prompt.vaultAddress as `0x${string}`,
      }),
    }
  }

  await consumeTelegramTradePercentPrompt({
    db: db as any,
    chatId: params.chatId,
    telegramUserId: params.userId,
  })

  const syntheticCommand = tradeIntentToSyntheticCommand(intentResult.tradeIntent)
  const previewResponse = await executeTelegramNativeCommand({
    text: syntheticCommand,
    chatId: params.chatId,
    userId: params.userId,
    messageId: params.messageId,
    allowTradeArgs: true,
    db: db as any,
    skipSchemaEnsure: true,
    tradePrefetch: {
      link,
      scopedVaults,
    },
  })
  if (previewResponse) return previewResponse
  return {
    text: 'Trade preview unavailable. Please retry /buy, /sell, or /bid.',
  }
}

function buildReusableCommandButton(label: string, command: string): Record<string, unknown> {
  const useCopyText = getTelegramWebhookConfig().copyTextButtons
  if (useCopyText) {
    return { text: label, copy_text: { text: command } }
  }
  return { text: label, switch_inline_query_current_chat: command }
}

function buildDeployMenuReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Trend Deploy', callback_data: 'deploy:type:trend' },
        { text: 'Content Coin', callback_data: 'deploy:type:content' },
      ],
      [
        { text: 'Creator Coin', callback_data: 'deploy:type:creator' },
        { text: 'Zora Sign Up', callback_data: 'deploy:type:zora' },
      ],
      [{ text: 'Back', callback_data: 'menu:start' }],
    ],
  }
}

function buildDeployTypeReplyMarkup(deployType: DeployWizardType): Record<string, unknown> {
  if (deployType === 'trend') {
    return {
      inline_keyboard: [
        [buildReusableCommandButton('Insert Trend Template', '/deploy trend BASEAI')],
        [{ text: 'Back', callback_data: 'menu:deploy' }],
      ],
    }
  }
  if (deployType === 'content') {
    return {
      inline_keyboard: [
        [buildReusableCommandButton('Insert Content Template', '/deploy content "My Content Coin" MCC')],
        [{ text: 'Back', callback_data: 'menu:deploy' }],
      ],
    }
  }
  return {
    inline_keyboard: [
      [buildReusableCommandButton('Insert Creator Template', '/deploy creator "My Creator Coin" MCC')],
      [{ text: 'Back', callback_data: 'menu:deploy' }],
    ],
  }
}

function buildDeployPreviewReplyMarkup(token: string): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Confirm', callback_data: `deploy:confirm:${token}` },
        { text: 'Decline', callback_data: `deploy:decline:${token}` },
      ],
    ],
  }
}

function formatDeployTypeText(deployType: DeployWizardType): string {
  if (deployType === 'trend') {
    return [
      'Deploy Wizard • Trend',
      '',
      '- command: `/deploy trend` <TICKER>',
      '- example: `/deploy trend` BASEAI',
      '- flow: preview -> confirm -> execute `/coin trend reserve`',
    ].join('\n')
  }
  if (deployType === 'content') {
    return [
      'Deploy Wizard • Content Coin',
      '',
      '- command: `/deploy content` "<NAME>" <SYMBOL> [metadataUri] [ETH|ZORA|CREATOR_COIN|CONTENT_COIN]',
      '- default currency label: CONTENT_COIN',
      '- metadataUri optional: auto-generated when omitted',
    ].join('\n')
  }
  return [
    'Deploy Wizard • Creator Coin',
    '',
    '- command: `/deploy creator` "<NAME>" <SYMBOL> [metadataUri] [ETH|ZORA|CREATOR_COIN|CONTENT_COIN]',
    '- default currency label: CREATOR_COIN',
    '- metadataUri optional: auto-generated when omitted',
  ].join('\n')
}

function formatTelegramZoraText(chatId: string): string {
  const miniAppUrl = resolveTelegramMiniAppUrl()
  const zoraAppUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/accounts',
    query: {
      tgMiniApp: '1',
      tgEntry: 'zora-signup',
      chatAction: 'zora-signup',
      tgChatId: chatId,
    },
  })
  return [
    'Zora Sign Up',
    '',
    '1) Run `/link` if your Telegram account is not linked yet',
    '2) Open the app link below',
    '3) Tap "Link Zora" in Accounts',
    '',
    `Open: ${zoraAppUrl}`,
  ].join('\n')
}

function buildTelegramZoraResponse(chatId: string): TelegramCommandResponse {
  const miniAppUrl = resolveTelegramMiniAppUrl()
  const zoraAppUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/accounts',
    query: {
      tgMiniApp: '1',
      tgEntry: 'zora-signup',
      chatAction: 'zora-signup',
      tgChatId: chatId,
    },
  })
  return {
    text: formatTelegramZoraText(chatId),
    replyMarkup: {
      inline_keyboard: [
        [buildMiniAppLaunchButton({ chatId, text: 'Open Zora Linking', url: zoraAppUrl })],
        [{ text: 'Back', callback_data: 'menu:start' }],
      ],
    },
  }
}

function buildDeployCommandFromIntent(intent: Record<string, unknown>): {
  commandText: string
  deployLabel: string
  detailLines: string[]
} | null {
  return buildDeployCommandFromIntentShared(intent)
}

function formatDeployPreviewText(params: {
  commandText: string
  deployLabel: string
  detailLines: string[]
  expiresAt: string
}): string {
  return [
    `Deploy Preview • ${params.deployLabel}`,
    '',
    ...params.detailLines,
    '',
    `Action: ${params.commandText}`,
    `Token expires: ${params.expiresAt}`,
  ].join('\n')
}

function formatDeployTokenFailure(reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'): string {
  return formatDeployTokenFailureShared(reason)
}

async function handleTelegramDeployCallback(params: {
  callbackData: string
  chatId: string
  userId: string
  messageId?: number
  groupId: string
  senderWallet: `0x${string}`
}): Promise<TelegramCommandResponse | null> {
  const callback = parseDeployCallbackData(params.callbackData)
  if (!callback) return null

  if (callback.kind === 'type') {
    if (callback.deployType === 'zora') {
      return {
        ...buildTelegramZoraResponse(params.chatId),
        callbackToast: 'Zora setup',
      }
    }
    return {
      text: formatDeployTypeText(callback.deployType),
      replyMarkup: buildDeployTypeReplyMarkup(callback.deployType),
      callbackToast: 'Template ready',
    }
  }

  const db = await getDb()
  if (!db) {
    return {
      text: 'Deploy action unavailable while database is offline. Please retry in a few seconds.',
      callbackToast: 'Temporarily unavailable',
    }
  }

  await ensureWaitlistSchema(db as any)
  await ensureKeeprSchema()
  await ensureTelegramTradingSchema(db as any)

  const consumed = await consumeTelegramActionToken({
    db: db as any,
    token: callback.token,
    telegramUserId: params.userId,
    chatId: params.chatId,
  })
  if (!consumed.ok) {
    const callbackToast =
      consumed.reason === 'expired'
        ? 'Preview expired'
        : consumed.reason === 'consumed'
          ? 'Already used'
          : consumed.reason === 'scope_mismatch'
            ? 'Wrong chat scope'
            : 'Preview missing'
    return {
      text: formatDeployTokenFailure(consumed.reason),
      callbackToast,
      replyMarkup: buildDeployMenuReplyMarkup(),
    }
  }

  const intent = consumed.intentPayload ?? {}
  const deployBuild = buildDeployCommandFromIntent(intent)
  if (!deployBuild) {
    return {
      text: [
        'Deploy blocked',
        '',
        '- malformed deploy payload',
        '- start a new `/deploy` preview',
      ].join('\n'),
      callbackToast: 'Invalid preview',
      replyMarkup: buildDeployMenuReplyMarkup(),
    }
  }

  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
  if (!link || link.linkStatus !== 'active' || !link.ownerVerified) {
    const relinkFlow = buildTelegramLinkFlowResponse({
      chatId: params.chatId,
      telegramUserId: params.userId,
      telegramUsername: link?.telegramUsername,
      linkButtonText: 'Reconnect',
    })
    return {
      text: [
        'Deploy blocked',
        '',
        '- account link is no longer active/verified',
        '- run /linked and /link again if needed',
      ].join('\n'),
      callbackToast: 'Reconnect required',
      replyMarkup: relinkFlow.replyMarkup,
    }
  }

  if (callback.kind === 'decline') {
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: 'deploy',
      intent,
      status: 'cancelled',
    })
    return {
      text: `Declined ${deployBuild.deployLabel} deploy preview.`,
      callbackToast: 'Deploy declined',
    }
  }

  const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
  if (!canonicalSenderWallet) {
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: 'deploy',
      intent,
      execution: {
        mode: 'keepr_coin_command',
        commandText: deployBuild.commandText,
      },
      status: 'failed',
      errorMessage: 'canonical_wallet_missing',
    })
    return {
      text: 'Deploy blocked: canonical wallet is not available.',
      callbackToast: 'Canonical wallet missing',
      replyMarkup: buildDeployMenuReplyMarkup(),
    }
  }

  const execution = await handleKeeprCommand({
    groupId: params.groupId,
    senderWallet: canonicalSenderWallet,
    text: deployBuild.commandText,
    chatId: params.chatId,
    userId: params.userId,
  })

  const status = execution.ok ? 'executed' : 'failed'
  await logTelegramActionAudit({
    db: db as any,
    telegramUserId: params.userId,
    chatId: params.chatId,
    messageId: params.messageId,
    profileId: link.profileId,
    canonicalCswAddress: link.canonicalCswAddress,
    actionType: 'deploy',
    intent,
    execution: {
      mode: 'keepr_coin_command',
      commandText: deployBuild.commandText,
    },
    status,
    errorMessage: execution.ok ? null : asTrimmed(execution.response),
  })
  if (execution.ok) {
    return {
      text: [
        `Deploy sent • ${deployBuild.deployLabel}`,
        '',
        execution.response,
      ].join('\n'),
      callbackToast: 'Deploy sent',
    }
  }
  return {
    text: [
      `Deploy failed • ${deployBuild.deployLabel}`,
      '',
      execution.response || 'Execution failed. Retry with a fresh deploy preview.',
    ].join('\n'),
    callbackToast: 'Deploy failed',
    replyMarkup: buildDeployMenuReplyMarkup(),
  }
}

async function executeTelegramCommand(params: {
  text: string
  chatId: string
  userId: string
  groupId: string
  senderWallet: `0x${string}`
  isAdmin: boolean
  messageId?: number
}): Promise<TelegramCommandResponse> {
  const pendingCustomResponse = await maybeHandlePendingTradePercentInput({
    text: params.text,
    chatId: params.chatId,
    userId: params.userId,
    messageId: params.messageId,
  })
  if (pendingCustomResponse) return pendingCustomResponse

  const nativeResponse = await executeTelegramNativeCommand({
    text: params.text,
    chatId: params.chatId,
    userId: params.userId,
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    messageId: params.messageId,
  })
  if (nativeResponse) return nativeResponse

  if (isTwitterCommand(params.text)) {
    const twitterResult = await handleTwitterCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: params.text,
      role: params.isAdmin ? 'ADMIN' : 'MEMBER',
    })
    return { text: asTrimmed(twitterResult.response) }
  }

  const keeprResult = await handleKeeprCommand({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: params.text,
    chatId: params.chatId,
    userId: params.userId,
  })
  return { text: asTrimmed(keeprResult?.response ?? '') || 'Command received.' }
}

function formatTradeTokenFailure(reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'): string {
  if (reason === 'expired') return 'Trade confirmation expired. Re-run your /buy, /sell, or /bid command.'
  if (reason === 'consumed') return 'This action was already confirmed or cancelled. Start a new preview.'
  if (reason === 'scope_mismatch') return 'Trade confirmation scope mismatch. Use a fresh preview from this chat.'
  return 'Trade confirmation token was not found. Start a new preview.'
}

function buildTradeRecoveryReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: menuLabel('buy'), callback_data: 'menu:buy' },
        { text: menuLabel('sell'), callback_data: 'menu:sell' },
        { text: menuLabel('bid'), callback_data: 'menu:bid' },
      ],
      [
        { text: menuLabel('wallet'), callback_data: 'menu:wallet' },
        { text: 'Link Status', callback_data: 'menu:linked' },
      ],
      [{ text: 'Main Menu', callback_data: 'menu:start' }],
    ],
  }
}

function buildTradeSignalText(params: {
  actionType: 'buy' | 'sell' | 'bid'
  targetLabel: string
  targetAddress?: string
  amountInput: string
  amountEth?: number
  usdEstimate?: number
  txHash?: string | null
}): string {
  const lines = [`✅ Trade Signal • ${params.actionType.toUpperCase()}`, '', `Vault: ${params.targetLabel}`]

  if (params.actionType === 'buy') {
    lines.push(`Size: ${params.amountInput} ETH (~$${formatAmount(params.usdEstimate ?? 0, 2)})`)
    lines.push('Next: /buy')
  } else if (params.actionType === 'sell') {
    lines.push(`Size: ${params.amountInput} SHARE (~$${formatAmount(params.usdEstimate ?? 0, 2)})`)
    lines.push('Next: /sell')
  } else {
    lines.push(`Size: ${formatAmount(params.amountEth ?? 0, 6)} ETH (intent ~$${formatAmount(params.usdEstimate ?? 0, 2)})`)
    lines.push('Next: /bid')
    if (typeof params.usdEstimate === 'number' && Number.isFinite(params.usdEstimate)) {
      lines.push(`Intent: ~$${formatAmount(params.usdEstimate, 2)} USD`)
    }
  }
  if (params.txHash) {
    lines.push(`Tx: ${params.txHash}`)
  }
  return lines.join('\n')
}

function buildTradeSignalReplyMarkup(params: {
  actionType: 'buy' | 'sell' | 'bid'
  targetAddress?: string
  amountInput: string
  chatId?: string
}): Record<string, unknown> | undefined {
  const target = isAddressLike(params.targetAddress) ? params.targetAddress.toLowerCase() : null
  if (!target) return undefined
  if (!asTrimmed(params.amountInput)) return undefined

  const command = params.actionType === 'buy' ? '/buy' : params.actionType === 'sell' ? '/sell' : '/bid'
  const reuseLabel = params.actionType === 'buy' ? 'Start Buy' : params.actionType === 'sell' ? 'Start Sell' : 'Start Bid'
  const useCopyText = getTelegramWebhookConfig().copyTextButtons
  const reuseButton = useCopyText
    ? { text: reuseLabel, copy_text: { text: command } }
    : { text: reuseLabel, switch_inline_query_current_chat: command }
  const miniAppUrl = resolveTelegramMiniAppUrl()
  const vaultUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: `/vault/${target}`,
    query: {
      tgMiniApp: '1',
      tgEntry: 'signal',
      chatAction: 'vault-detail',
      vaultAddress: target,
    },
  })

  const keyboard: Array<Array<Record<string, unknown>>> = [
    [reuseButton, { text: 'Open Wallet', callback_data: 'menu:wallet' }],
    [{ text: 'View Vault', url: vaultUrl }],
  ]
  if (isStarsTipsEnabledForChat(asTrimmed(params.chatId ?? ''))) {
    const tipContext = `signal-${params.actionType}`
    keyboard.push([
      { text: 'Tip ⭐1', callback_data: `tip:1:${tipContext}` },
      { text: 'Tip ⭐5', callback_data: `tip:5:${tipContext}` },
    ])
  }
  return {
    inline_keyboard: keyboard,
  }
}

async function handleTelegramTradeCallback(params: {
  callbackData: string
  chatId: string
  userId: string
  messageId?: number
  groupId: string
  senderWallet: `0x${string}`
}): Promise<TelegramCommandResponse | null> {
  const callback = parseTradeCallbackData(params.callbackData)
  if (!callback) return null
  let tradeFlowState: TradeFlowState = TRADE_FLOW_IDLE_STATE

  if (callback.kind === 'edit') {
    return {
      text: tradeEditHint(callback.actionType),
      callbackToast: `${callback.actionType.toUpperCase()} template ready`,
    }
  }

  const db = await getDb()
  if (!db) {
    return {
      text: 'Trade action unavailable while database is offline. Please retry in a few seconds.',
      callbackToast: 'Temporarily unavailable',
    }
  }

  await ensureWaitlistSchema(db as any)
  await ensureKeeprSchema()
  await ensureTelegramTradingSchema(db as any)

  const consumed = await consumeTelegramActionToken({
    db: db as any,
    token: callback.token,
    telegramUserId: params.userId,
    chatId: params.chatId,
  })
  if (!consumed.ok) {
    tradeFlowState = reduceTradeFlowState(tradeFlowState, {
      type: 'TOKEN_INVALID',
      actionType: 'buy',
      reason: consumed.reason,
    })
    const callbackToast =
      consumed.reason === 'expired'
        ? 'Preview expired'
        : consumed.reason === 'consumed'
          ? 'Already used'
          : consumed.reason === 'scope_mismatch'
            ? 'Wrong chat scope'
            : 'Preview missing'
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_token_invalid',
      context: {
        reason: consumed.reason,
      },
    })
    return {
      text: formatTradeTokenFailure(consumed.reason),
      callbackToast,
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }

  const actionType = asTrimmed(consumed.actionType).toLowerCase()
  const actionTypeSafe: 'buy' | 'sell' | 'bid' =
    actionType === 'buy' || actionType === 'sell' || actionType === 'bid' ? actionType : 'buy'
  tradeFlowState = reduceTradeFlowState(tradeFlowState, {
    type: 'START',
    actionType: actionTypeSafe,
  })
  const intent = consumed.intentPayload ?? {}
  const creatorCoinAddress = asTrimmed(intent.creatorCoinAddress ?? '').toLowerCase()
  const vaultAddress = asTrimmed(intent.vaultAddress ?? '').toLowerCase()
  const targetLabel = truncateAddress(vaultAddress || creatorCoinAddress || 'vault')
  const amountInput = asTrimmed(intent.amountInput ?? '')
  const amountEth = Number(intent.amountEth ?? 0)
  const usdEstimate = Number(intent.usdEstimate ?? 0)

  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
  if (!link || link.linkStatus !== 'active' || !link.ownerVerified) {
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      actionType: actionTypeSafe,
      context: {
        reason: 'link_not_active_or_verified',
      },
    })
    const relinkFlow = buildTelegramLinkFlowResponse({
      chatId: params.chatId,
      telegramUserId: params.userId,
      telegramUsername: link?.telegramUsername,
      linkButtonText: 'Reconnect',
    })
    return {
      text: [
        'Trade blocked',
        '',
        '- account link is no longer active/verified',
        '- run /linked and /link again if needed',
      ].join('\n'),
      callbackToast: 'Reconnect required',
      replyMarkup: relinkFlow.replyMarkup,
    }
  }

  if (callback.kind === 'decline') {
    tradeFlowState = reduceTradeFlowState(tradeFlowState, {
      type: 'DECLINE',
      actionType: actionTypeSafe,
      token: callback.token,
    })
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_preview_declined',
      actionType: actionTypeSafe,
      context: {
        tokenConsumedAt: consumed.consumedAt,
      },
    })
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: actionTypeSafe,
      intent,
      status: 'cancelled',
    })
    return {
      text: `Declined ${actionTypeSafe.toUpperCase()} preview.`,
      callbackToast: `${actionTypeSafe.toUpperCase()} declined`,
    }
  }

  const tradePolicy = await getTelegramChatTradePolicy({
    db: db as any,
    chatId: params.chatId,
  })
  if ((actionTypeSafe === 'buy' || actionTypeSafe === 'sell') && !tradePolicy.buySellEnabled) {
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      actionType: actionTypeSafe,
      context: {
        reason: 'buy_sell_disabled',
      },
    })
    return {
      text: 'Trade blocked: buy/sell disabled for this chat scope.',
      callbackToast: 'Buy/sell disabled',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }
  if (actionTypeSafe === 'bid' && !tradePolicy.bidEnabled) {
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      actionType: actionTypeSafe,
      context: {
        reason: 'bid_disabled',
      },
    })
    return {
      text: 'Trade blocked: bid disabled for this chat scope.',
      callbackToast: 'Bid disabled',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }

  const membership = await verifyTradeMembership({
    chatId: params.chatId,
    userId: params.userId,
  })
  if (!membership.ok) {
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      actionType: actionTypeSafe,
      context: {
        reason: 'membership_required',
        status: membership.status,
      },
    })
    return {
      text: `Trade blocked: membership required (status=${membership.status ?? 'unknown'}).`,
      callbackToast: 'Membership required',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }

  const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
  if (!canonicalSenderWallet) {
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      actionType: actionTypeSafe,
      context: {
        reason: 'canonical_wallet_missing',
      },
    })
    return {
      text: 'Trade blocked: canonical wallet is not available.',
      callbackToast: 'Canonical wallet missing',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }

  if ((actionTypeSafe === 'buy' || actionTypeSafe === 'sell') && isAddressLike(creatorCoinAddress) && amountInput) {
    tradeFlowState = reduceTradeFlowState(tradeFlowState, {
      type: 'ACCEPT',
      actionType: actionTypeSafe,
      token: callback.token,
    })
    const commandText = `/coin ${actionTypeSafe} ${creatorCoinAddress} ${amountInput}`
    const execution = await handleKeeprCommand({
      groupId: params.groupId,
      senderWallet: canonicalSenderWallet,
      text: commandText,
      chatId: params.chatId,
      userId: params.userId,
    })
    const status = execution.ok ? 'executed' : 'failed'
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: actionTypeSafe,
      intent,
      quote: {
        amountEth: Number.isFinite(amountEth) ? amountEth : null,
        usdEstimate: Number.isFinite(usdEstimate) ? usdEstimate : null,
      },
      execution: {
        mode: 'keepr_coin_command',
        commandText,
      },
      status,
      errorMessage: execution.ok ? null : asTrimmed(execution.response),
    })
    if (execution.ok) {
      emitTelegramFunnelEvent({
        db,
        telegramUserId: params.userId,
        chatId: params.chatId,
        eventName: 'trade_confirmed',
        actionType: actionTypeSafe,
        context: {
          mode: 'keepr_coin_command',
        },
      })
      return {
        text: [
          `Confirmed ${actionTypeSafe.toUpperCase()} request`,
          '',
          execution.response,
        ].join('\n'),
        signalText: buildTradeSignalText({
          actionType: actionTypeSafe,
          targetLabel,
          targetAddress: vaultAddress || creatorCoinAddress,
          amountInput,
          amountEth,
          usdEstimate,
        }),
        signalReplyMarkup: buildTradeSignalReplyMarkup({
          actionType: actionTypeSafe,
          targetAddress: vaultAddress || creatorCoinAddress,
          amountInput,
          chatId: params.chatId,
        }),
        callbackToast: `${actionTypeSafe.toUpperCase()} sent`,
      }
    }
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      actionType: actionTypeSafe,
      context: {
        reason: 'keepr_execution_failed',
      },
    })
    return {
      text: [
        `Failed ${actionTypeSafe.toUpperCase()} execution`,
        '',
        execution.response || 'Execution failed. Retry with a fresh preview.',
      ].join('\n'),
      callbackToast: `${actionTypeSafe.toUpperCase()} failed`,
    }
  }

  if (actionTypeSafe === 'bid') {
    const strategyAddressRaw = asTrimmed(intent.ccaStrategyAddress ?? '')
    const auctionAddressRaw = asTrimmed((intent as any)?.bid?.auctionAddress ?? '')
    const maxPriceQ96Raw = asTrimmed((intent as any)?.bid?.maxPriceQ96 ?? '')
    const amountWeiRaw = asTrimmed((intent as any)?.bid?.amountWei ?? '')
    const usdIntent = Number(intent.usdEstimate ?? 0)
    if (!isAddressLike(strategyAddressRaw) || !isAddressLike(auctionAddressRaw) || !maxPriceQ96Raw || !amountWeiRaw) {
      emitTelegramFunnelEvent({
        db,
        telegramUserId: params.userId,
        chatId: params.chatId,
        eventName: 'trade_confirm_failed',
        actionType: actionTypeSafe,
        context: {
          reason: 'invalid_bid_payload',
        },
      })
      return {
        text: [
          'Bid blocked',
          '',
          '- malformed bid intent payload',
          '- please run /bid again to generate a fresh preview',
        ].join('\n'),
        callbackToast: 'Invalid bid preview',
        replyMarkup: buildTradeRecoveryReplyMarkup(),
      }
    }

    try {
      const freshQuote = await readCcaAuctionQuote({
        ccaStrategyAddress: strategyAddressRaw as `0x${string}`,
        usdIntent,
      })
      const previousAmountWei = toBigIntStrict(amountWeiRaw)
      const nextAmountWei = freshQuote.amountWei
      if (previousAmountWei > 0n) {
        const diff = previousAmountWei > nextAmountWei ? previousAmountWei - nextAmountWei : nextAmountWei - previousAmountWei
        const driftBps = Number((diff * 10_000n) / previousAmountWei)
        if (driftBps > 300) {
          emitTelegramFunnelEvent({
            db,
            telegramUserId: params.userId,
            chatId: params.chatId,
            eventName: 'trade_confirm_failed',
            actionType: actionTypeSafe,
            context: {
              reason: 'bid_drift_exceeded',
              driftBps,
            },
          })
          await logTelegramActionAudit({
            db: db as any,
            telegramUserId: params.userId,
            chatId: params.chatId,
            messageId: params.messageId,
            profileId: link.profileId,
            canonicalCswAddress: link.canonicalCswAddress,
            actionType: actionTypeSafe,
            intent,
            quote: {
              amountEth: freshQuote.amountEth,
              usdEstimate: usdIntent,
              driftBps,
            },
            execution: { mode: 'cca_bid_userop' },
            status: 'failed',
            errorCode: 'bid_drift_exceeded',
            errorMessage: `drift_bps_${driftBps}`,
          })
          return {
            text: [
              'Bid confirmation expired by price drift',
              '',
              `Drift ${formatAmount(driftBps / 100, 2)}% exceeded the 3% safety limit.`,
              'Please run /bid again for a fresh quote.',
            ].join('\n'),
            callbackToast: 'Bid drift too high',
            replyMarkup: buildTradeRecoveryReplyMarkup(),
          }
        }
      }

      const privyWalletContext = await resolvePrivyWalletOwnerContextByPrivyUserId({
        privyUserId: link.privyUserId,
        canonicalCswAddress: link.canonicalCswAddress,
      })

      const publicClient = createPublicClient({
        chain: base,
        transport: http(getBaseRpcUrl(), { timeout: 30_000 }),
      }) as any

      const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient,
        walletId: privyWalletContext.walletId,
        smartWallet: getAddress(link.canonicalCswAddress as Address),
        expectedOwnerAddress: getAddress(privyWalletContext.ownerAddress as Address),
        maxScan: 512,
      })

      const callData = encodeFunctionData({
        abi: CCA_AUCTION_ABI,
        functionName: 'submitBid',
        args: [
          freshQuote.maxPriceQ96,
          freshQuote.amountWei,
          getAddress(link.canonicalCswAddress as Address),
          '0x',
        ],
      })

      const execution = await sendPrivyCoinbaseSmartWalletUserOperation({
        publicClient,
        bundlerUrl: getBundlerAndPaymasterUrl(),
        walletId: privyWalletContext.walletId,
        smartWallet: getAddress(link.canonicalCswAddress as Address),
        ownerAddress: getAddress(ownerContext.ownerAddress as Address),
        ownerIndex: ownerContext.ownerIndex,
        calls: [
          {
            to: getAddress(freshQuote.auctionAddress as Address),
            value: freshQuote.amountWei,
            data: callData,
          },
        ],
        simulate: true,
      })

      await logTelegramActionAudit({
        db: db as any,
        telegramUserId: params.userId,
        chatId: params.chatId,
        messageId: params.messageId,
        profileId: link.profileId,
        canonicalCswAddress: link.canonicalCswAddress,
        actionType: actionTypeSafe,
        intent,
        quote: {
          amountEth: freshQuote.amountEth,
          usdEstimate: freshQuote.usdIntent,
          amountWei: freshQuote.amountWei.toString(),
          maxPriceQ96: freshQuote.maxPriceQ96.toString(),
          tokenSymbol: freshQuote.tokenSymbol,
          clearingPriceWeiPerToken: freshQuote.clearingPriceWeiPerToken.toString(),
          maxPriceWeiPerToken: freshQuote.maxPriceWeiPerToken.toString(),
        },
        execution: {
          mode: 'cca_bid_userop',
          userOpHash: execution.userOpHash,
          ownerAddress: execution.ownerAddress,
          ownerIndex: execution.ownerIndex,
          auctionAddress: freshQuote.auctionAddress,
        },
        status: 'executed',
        txHash: execution.txHash,
      })
      emitTelegramFunnelEvent({
        db,
        telegramUserId: params.userId,
        chatId: params.chatId,
        eventName: 'trade_confirmed',
        actionType: actionTypeSafe,
        context: {
          mode: 'cca_bid_userop',
          txHash: execution.txHash,
        },
      })

      return {
        text: [
          'Bid executed',
          '',
          `Exact ETH at confirm: ${formatAmount(freshQuote.amountEth, 6)} ETH`,
          `Auction: ${truncateAddress(freshQuote.auctionAddress)}`,
          `Clearing: ${formatEthPerToken(freshQuote.clearingPriceWeiPerToken, freshQuote.tokenSymbol)}`,
          `Tx: ${execution.txHash}`,
        ].join('\n'),
        signalText: buildTradeSignalText({
          actionType: 'bid',
          targetLabel,
          targetAddress: vaultAddress || creatorCoinAddress,
          amountInput,
          amountEth: freshQuote.amountEth,
          usdEstimate: freshQuote.usdIntent,
          txHash: execution.txHash,
        }),
        signalReplyMarkup: buildTradeSignalReplyMarkup({
          actionType: 'bid',
          targetAddress: vaultAddress || creatorCoinAddress,
          amountInput,
          chatId: params.chatId,
        }),
        callbackToast: 'BID sent',
      }
    } catch (error: any) {
      const helperCode = isCoinbaseSmartWalletHelperError(error) ? error.code : null
      const helperRetryable = isCoinbaseSmartWalletHelperError(error) ? error.retryable : null
      const message = asTrimmed(error?.message ?? '') || 'bid_execution_failed'
      await logTelegramActionAudit({
        db: db as any,
        telegramUserId: params.userId,
        chatId: params.chatId,
        messageId: params.messageId,
        profileId: link.profileId,
        canonicalCswAddress: link.canonicalCswAddress,
        actionType: actionTypeSafe,
        intent,
        quote: {
          amountEth: Number.isFinite(amountEth) ? amountEth : null,
          usdEstimate: Number.isFinite(usdEstimate) ? usdEstimate : null,
        },
        execution: { mode: 'cca_bid_userop' },
        status: 'failed',
        errorCode: helperCode ?? message,
        errorMessage: helperRetryable === null ? message : `${message} (retryable=${helperRetryable ? 'true' : 'false'})`,
      })
      emitTelegramFunnelEvent({
        db,
        telegramUserId: params.userId,
        chatId: params.chatId,
        eventName: 'trade_confirm_failed',
        actionType: actionTypeSafe,
        context: {
          reason: helperCode ?? message,
        },
      })
      return {
        text: [
          'Bid execution failed',
          '',
          helperCode ? `Reason: ${helperCode}` : `Reason: ${message}`,
          'Please run /bid again to retry.',
        ].join('\n'),
        callbackToast: helperCode ? 'Bid failed' : 'Bid retry needed',
        replyMarkup: buildTradeRecoveryReplyMarkup(),
      }
    }
  }

  return {
    text: 'Unsupported trade action.',
    callbackToast: 'Unsupported action',
    replyMarkup: buildTradeRecoveryReplyMarkup(),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: { ok: true } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const webhookConfig = getTelegramWebhookConfig()
  const botToken = webhookConfig.botToken
  if (!botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot is not configured' } satisfies ApiEnvelope<never>)
  }

  const configuredSecret = webhookConfig.webhookSecret
  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      error: 'Telegram webhook secret is not configured',
    } satisfies ApiEnvelope<never>)
  }
  const providedSecret = asTrimmed(req.headers?.['x-telegram-bot-api-secret-token'])
  if (providedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Invalid Telegram webhook secret' } satisfies ApiEnvelope<never>)
  }

  const update = await readJsonBody<TelegramUpdate>(req, { maxBytes: 512_000 })
  if (!update) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const inlineResult = await handleInlineQueryUpdate({
    updateId: update.update_id,
    inlineQuery: update.inline_query,
    botToken,
    targetChatId: webhookConfig.targetChatId,
    answerInlineQuery: answerTelegramInlineQuery,
    onError: (error, meta) => {
      console.error('[telegram/webhook] inline query failed', {
        updateId: meta.updateId,
        inlineQueryId: meta.inlineQueryId,
        err: error instanceof Error ? error.message : String(error),
      })
    },
  })
  if (inlineResult) {
    return res.status(200).json({
      success: true,
      data: inlineResult satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const chosenInlineResult = await handleChosenInlineResultUpdate({
    updateId: update.update_id,
    chosenInlineResult: update.chosen_inline_result,
    onChosenInlineResult: async ({ resultId, userId, query, inlineMessageId }) => {
      const resultMatch = resultId.match(/^r(\d+):([a-z0-9_]+):(.+)$/i)
      const rankPosition = resultMatch ? Number(resultMatch[1]) + 1 : null
      const resultType = resultMatch ? asTrimmed(resultMatch[2]).toLowerCase() : null
      const resultKey = resultMatch ? asTrimmed(resultMatch[3]) : null
      const queryClass: InlineQueryClass = classifyInlineQuery(query)
      const db = await getDb().catch(() => null)
      if (!db) return
      await ensureTelegramTradingSchema(db as any).catch(() => {})
      emitTelegramFunnelEvent({
        db: db as any,
        telegramUserId: userId || null,
        chatId: webhookConfig.targetChatId || null,
        eventName: 'inline_result_chosen',
        actionType: 'inline',
        context: {
          source: 'inline',
          resultId,
          resultType,
          resultKey,
          rankPosition,
          queryClass,
          query: query || null,
          inlineMessageId: inlineMessageId || null,
        },
      })
    },
    onError: (error, meta) => {
      console.error('[telegram/webhook] chosen inline result handling failed', {
        updateId: meta.updateId,
        resultId: meta.resultId,
        err: error instanceof Error ? error.message : String(error),
      })
    },
  })
  if (chosenInlineResult) {
    return res.status(200).json({
      success: true,
      data: chosenInlineResult satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const preCheckoutResult = await handlePreCheckoutUpdate({
    updateId: update.update_id,
    preCheckoutQuery: update.pre_checkout_query,
    parseTipInvoicePayload,
    areStarsTipsEnabled,
    answerPreCheckoutQuery: answerTelegramPreCheckoutQuery,
    botToken,
    onAnswerError: (error, meta) => {
      console.error('[telegram/webhook] pre-checkout answer failed', {
        updateId: meta.updateId,
        preCheckoutQueryId: meta.preCheckoutQueryId,
        err: error instanceof Error ? error.message : String(error),
      })
    },
  })
  if (preCheckoutResult) {
    return res.status(200).json({
      success: true,
      data: preCheckoutResult satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const successfulPaymentResult = await handleSuccessfulPaymentUpdate({
    updateId: update.update_id,
    message: update.message && typeof update.message === 'object' ? update.message : null,
    successfulPayment: update.message?.successful_payment ?? null,
    parseTipInvoicePayload,
    isStarsTipsEnabledForChat,
    getDb,
    getTelegramLinkByUserId: ({ db, telegramUserId }) => getTelegramLinkByUserId({ db, telegramUserId }),
    logTelegramActionAudit,
    sendTelegramMessage,
    botToken,
    onMessageError: (error, meta) => {
      console.error('[telegram/webhook] tip thank-you message failed', {
        updateId: meta.updateId,
        chatId: meta.chatId,
        err: error instanceof Error ? error.message : String(error),
      })
    },
  })
  if (successfulPaymentResult) {
    return res.status(200).json({
      success: true,
      data: successfulPaymentResult satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const callbackQuery = update.callback_query
  if (callbackQuery && typeof callbackQuery === 'object') {
    const normalizedCallback = normalizeCallbackQuery(callbackQuery)
    if (!normalizedCallback) {
      return res.status(200).json({
        success: true,
        data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }
    const { callbackQueryId, callbackData, chatId, callbackMessageId, userId } = normalizedCallback
    const parsedTradeFlowCallback = parseTradeFlowCallbackData(callbackData)
    const parsedTradeCallback = parseTradeCallbackData(callbackData)
    const parsedDeployCallback = parseDeployCallbackData(callbackData)
    const parsedTipCallback = parseTipCallbackData(callbackData)
    const mappedCommand = resolveHelpCallbackCommand(callbackData)
    const isMenuNavigationCallback = callbackData.startsWith('menu:') || callbackData.startsWith('help:')
    const isOnboardingCallback = asTrimmed(callbackData).toLowerCase().startsWith('onboard:')
    const canReplaceMenuMessage =
      (isMenuNavigationCallback || isOnboardingCallback) && typeof callbackMessageId === 'number'
    const adminUserIds = parseAdminUserIds()
    const isAdmin = userId ? adminUserIds.has(userId) : false

    const isAllowedContext = isTelegramContextAllowed({
      chatId,
      userId,
      allowAdminDm: webhookConfig.allowAdminDm,
      allowPrivateDm: isTelegramPrivateDmEnabled(),
      signalsChatId: webhookConfig.signalsChatId,
    })
    if (!isAllowedContext) {
      await answerTelegramCallbackQuery({
        botToken,
        callbackQueryId,
        text: 'This chat is not enabled for bot actions.',
        showAlert: true,
      }).catch(() => {})
      return res.status(200).json({
        success: true,
        data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    if (parsedTipCallback) {
      const tipsEnabled = isStarsTipsEnabledForChat(chatId)
      await answerTelegramCallbackQuery({
        botToken,
        callbackQueryId,
        text: tipsEnabled ? `Tip invoice sent (${parsedTipCallback.stars} ⭐)` : 'Tips are disabled in this chat',
        showAlert: false,
      }).catch(() => {})
      if (tipsEnabled) {
        try {
          await sendTelegramStarsInvoice({
            botToken,
            chatId,
            userId,
            stars: parsedTipCallback.stars,
            context: parsedTipCallback.context,
          })
        } catch (error) {
          console.error('[telegram/webhook] sendInvoice failed', {
            updateId: update.update_id ?? null,
            callbackQueryId,
            err: error instanceof Error ? error.message : String(error),
          })
          await sendTelegramMessage({
            botToken,
            chatId,
            text: 'Tip invoice failed. Please retry.',
            replyToMessageId: callbackMessageId,
          }).catch(() => {})
        }
      }
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    const callbackDataLower = asTrimmed(callbackData).toLowerCase()
    if (isOnboardingCallback) {
      const cbFrom = callbackQuery.from && typeof callbackQuery.from === 'object' ? callbackQuery.from : null
      const cbUsername = cbFrom && typeof cbFrom.username === 'string' ? cbFrom.username : undefined
      const onboardResult = await handleTelegramOnboardingCallback({
        callbackDataLower,
        chatId,
        userId,
        telegramUsername: cbUsername,
      })
      if (onboardResult) {
        try {
          await answerTelegramCallbackQuery({
            botToken,
            callbackQueryId,
            text: onboardResult.callbackToast,
          })
        } catch (error) {
          console.error('[telegram/webhook] onboarding callback acknowledgement failed', {
            updateId: update.update_id ?? null,
            callbackQueryId,
            err: error instanceof Error ? error.message : String(error),
          })
        }
        if (canReplaceMenuMessage) {
          await replaceTelegramMenuMessage({
            botToken,
            chatId,
            messageId: callbackMessageId as number,
            text: onboardResult.response.text,
            replyMarkup: onboardResult.response.replyMarkup,
          })
        } else {
          const chunks = splitTelegramMessage(onboardResult.response.text)
          for (let idx = 0; idx < chunks.length; idx += 1) {
            const chunk = chunks[idx]
            if (!chunk) continue
            await sendTelegramMessage({
              botToken,
              chatId,
              text: chunk,
              replyToMessageId: idx === 0 ? callbackMessageId : undefined,
              replyMarkup: idx === 0 ? onboardResult.response.replyMarkup : undefined,
            })
          }
        }
        const signalChunks = splitTelegramMessage(asTrimmed(onboardResult.response.signalText ?? ''))
        const signalDestination = resolveSignalsDestination(chatId)
        for (let idx = 0; idx < signalChunks.length; idx += 1) {
          const signalChunk = signalChunks[idx]
          if (!signalChunk) continue
          await sendTelegramMessage({
            botToken,
            chatId: signalDestination.chatId,
            text: signalChunk,
            messageThreadId: signalDestination.messageThreadId,
            replyMarkup: idx === 0 ? onboardResult.response.signalReplyMarkup : undefined,
          })
        }
        return res.status(200).json({
          success: true,
          data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
        } satisfies ApiEnvelope<TelegramWebhookOk>)
      }
      try {
        await answerTelegramCallbackQuery({
          botToken,
          callbackQueryId,
          text: 'Unknown onboarding action. Send /start.',
        })
      } catch (error) {
        console.error('[telegram/webhook] unknown onboarding callback acknowledgement failed', {
          updateId: update.update_id ?? null,
          callbackQueryId,
          err: error instanceof Error ? error.message : String(error),
        })
      }
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    let callbackAcknowledged = false
    try {
      await answerTelegramCallbackQuery({
        botToken,
        callbackQueryId,
        text: resolveImmediateCallbackToast({
          parsedTradeFlowCallback,
          parsedTradeCallback,
          parsedDeployCallback,
          callbackData,
          mappedCommand,
        }),
      })
      callbackAcknowledged = true
    } catch (error) {
      console.error('[telegram/webhook] callback acknowledgement failed', {
        updateId: update.update_id ?? null,
        callbackQueryId,
        err: error instanceof Error ? error.message : String(error),
      })
    }

    const executionContext = resolveCommandExecutionContext({
      chatId,
      userId,
      isAdmin,
    })
    const groupId = executionContext.groupId
    const senderWallet = executionContext.senderWallet
    const callbackResponse =
      (await handleTelegramDeployCallback({
        callbackData,
        chatId,
        userId,
        messageId: callbackMessageId,
        groupId,
        senderWallet,
      })) ??
      (await handleTelegramTradeFlowCallback({
        callbackData,
        chatId,
        userId,
        messageId: callbackMessageId,
      })) ??
      (await handleTelegramTradeCallback({
        callbackData,
        chatId,
        userId,
        messageId: callbackMessageId,
        groupId,
        senderWallet,
      }))
    if (callbackResponse) {
      if (!callbackAcknowledged) {
        try {
          await answerTelegramCallbackQuery({
            botToken,
            callbackQueryId,
            text: asTrimmed(callbackResponse.callbackToast ?? ''),
          })
        } catch (error) {
          console.error('[telegram/webhook] trade callback acknowledgement failed', {
            updateId: update.update_id ?? null,
            callbackQueryId,
            err: error instanceof Error ? error.message : String(error),
          })
        }
      }
      const chunks = splitTelegramMessage(callbackResponse.text)
      let startIdx = 0
      if (typeof callbackMessageId === 'number' && chunks.length > 0) {
        const firstChunk = chunks[0] ?? ''
        if (firstChunk) {
          await replaceTelegramMenuMessage({
            botToken,
            chatId,
            messageId: callbackMessageId,
            text: firstChunk,
            replyMarkup: callbackResponse.replyMarkup,
          })
          startIdx = 1
        }
      }
      for (let idx = startIdx; idx < chunks.length; idx += 1) {
        const chunk = chunks[idx]
        if (!chunk) continue
        await sendTelegramMessage({
          botToken,
          chatId,
          text: chunk,
          replyToMessageId: idx === 0 && startIdx === 0 ? callbackMessageId : undefined,
          replyMarkup: idx === 0 && startIdx === 0 ? callbackResponse.replyMarkup : undefined,
        })
      }
      const signalChunks = splitTelegramMessage(asTrimmed(callbackResponse.signalText ?? ''))
      const signalDestination = resolveSignalsDestination(chatId)
      for (let idx = 0; idx < signalChunks.length; idx += 1) {
        const signalChunk = signalChunks[idx]
        if (!signalChunk) continue
        await sendTelegramMessage({
          botToken,
          chatId: signalDestination.chatId,
          text: signalChunk,
          messageThreadId: signalDestination.messageThreadId,
          replyMarkup: idx === 0 ? callbackResponse.signalReplyMarkup : undefined,
        })
      }
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    const menuIsLinked = await isTelegramUserLinked({ telegramUserId: userId })
    if (asTrimmed(callbackData).toLowerCase() === 'menu:start' && !menuIsLinked && isPrivateChatId(chatId)) {
      const db = await getDb()
      if (db) {
        await ensureTelegramTradingSchema(db as any)
        await upsertTelegramOnboardingSession({ db: db as any, telegramUserId: userId, step: 'welcome' })
      }
    }
    const staticMenuResponse = resolveStaticMenuCallbackResponse({
      callbackData,
      chatId,
      isLinked: menuIsLinked,
    })
    if (staticMenuResponse) {
      if (canReplaceMenuMessage) {
        await replaceTelegramMenuMessage({
          botToken,
          chatId,
          messageId: callbackMessageId as number,
          text: staticMenuResponse.text,
          replyMarkup: staticMenuResponse.replyMarkup,
        })
      } else {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: staticMenuResponse.text,
          replyToMessageId: callbackMessageId,
          replyMarkup: staticMenuResponse.replyMarkup,
        })
      }
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    if (!mappedCommand) {
      if (canReplaceMenuMessage) {
        await replaceTelegramMenuMessage({
          botToken,
          chatId,
          messageId: callbackMessageId as number,
          text: 'Unknown menu action. Send /start to reopen the menu.',
          replyMarkup: buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked }),
        })
      } else {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: 'Unknown menu action. Send /start to reopen the menu.',
          replyToMessageId: callbackMessageId,
          replyMarkup: buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked }),
        })
      }
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    if (isInlineLauncherCommand(mappedCommand)) {
      if (canReplaceMenuMessage) {
        await replaceTelegramMenuMessage({
          botToken,
          chatId,
          messageId: callbackMessageId as number,
          text:
            'Inline shortcuts are ready. Tap a button below to pre-fill a draft in this chat, then send it.',
          replyMarkup: buildInlineLauncherReplyMarkup(),
        })
      } else {
        await sendTelegramMessage({
          botToken,
          chatId,
          text:
            'Inline shortcuts are ready. Tap a button below to pre-fill a draft in this chat, then send it.',
          replyToMessageId: callbackMessageId,
          replyMarkup: buildInlineLauncherReplyMarkup(),
        })
      }
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    let response: TelegramCommandResponse = { text: '' }
    try {
      response = await executeTelegramCommand({
        text: mappedCommand,
        chatId,
        userId,
        groupId,
        senderWallet,
        isAdmin,
        messageId: callbackMessageId,
      })
    } catch (error) {
      console.error('[telegram/webhook] callback command handling failed', {
        updateId: update.update_id ?? null,
        callbackQueryId,
        chatId,
        err: error instanceof Error ? error.message : String(error),
      })
      response = { text: 'Request failed. Please try again in a few seconds.' }
    }

    if (!response.text) {
      response.text = 'Command received.'
    }
    const shouldUseFocusedHelp = isDefaultHelpCommand(mappedCommand)
    if (shouldUseFocusedHelp) {
      response.text = buildFocusedHelpText()
      if (!response.replyMarkup) {
        response.replyMarkup = buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked })
      }
    }

    const helpMarkup = response.replyMarkup
      ?? (isArenaHelpCommand(mappedCommand)
        ? buildArenaHelpShortcutReplyMarkup()
        : isHelpCategoryCommand(mappedCommand)
          ? buildHelpCategoryReplyMarkup()
          : isHelpCommand(mappedCommand)
            ? buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked })
            : undefined)
    if (canReplaceMenuMessage) {
      await replaceTelegramMenuMessage({
        botToken,
        chatId,
        messageId: callbackMessageId as number,
        text: response.text,
        replyMarkup: helpMarkup,
      })
    } else {
      const chunks = splitTelegramMessage(response.text)
      for (let idx = 0; idx < chunks.length; idx += 1) {
        const chunk = chunks[idx]
        if (!chunk) continue
        await sendTelegramMessage({
          botToken,
          chatId,
          text: chunk,
          replyToMessageId: idx === 0 ? callbackMessageId : undefined,
          replyMarkup: idx === 0 ? helpMarkup : undefined,
        })
      }
    }

    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const message = extractUpdateMessage(update)
  if (!message) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }
  const normalizedMessage = normalizeMessageContext(message)
  if (!normalizedMessage) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }
  const { chatId, userId, fromBot, text, messageId } = normalizedMessage
  const normalizedText = normalizeTelegramCommand(text)
  const commandText = shouldAutoRouteToAi({ chatId, text, message }) ? normalizeTelegramCommand(`/ai ${text}`) : normalizedText
  if (!text) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (fromBot) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const adminUserIds = parseAdminUserIds()
  const isAdmin = userId ? adminUserIds.has(userId) : false
  const isAllowedContext = isTelegramContextAllowed({
    chatId,
    userId,
    allowAdminDm: webhookConfig.allowAdminDm,
    allowPrivateDm: isTelegramPrivateDmEnabled(),
  })
  if (!isAllowedContext) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const shouldGuidePrivateDmSetup =
    isPrivateChatId(chatId) &&
    commandText === normalizedText &&
    !normalizedText.startsWith('/') &&
    !isLikelyCommandText(normalizedText)
  if (shouldGuidePrivateDmSetup) {
    const linked = await isTelegramUserLinked({ telegramUserId: userId })
    if (!linked) {
      const db = await getDb()
      if (!db) {
        return res.status(200).json({
          success: true,
          data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
        } satisfies ApiEnvelope<TelegramWebhookOk>)
      }
      await ensureTelegramTradingSchema(db as any)
      const inserted = await tryInsertTelegramPrivateDmWelcomeSent({ db: db as any, telegramUserId: userId })
      if (!inserted) {
        return res.status(200).json({
          success: true,
          data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
        } satisfies ApiEnvelope<TelegramWebhookOk>)
      }
      await upsertTelegramOnboardingSession({ db: db as any, telegramUserId: userId, step: 'welcome' })
      await sendTelegramMessage({
        botToken,
        chatId,
        text: buildStartAndLinkNudgeText(),
        replyToMessageId: messageId,
        replyMarkup: buildStartAndLinkNudgeReplyMarkup(),
      })
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }
  }

  if (isInlineLauncherCommand(normalizedText)) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text:
        'Inline shortcuts are ready. Tap a button below to pre-fill a draft in this chat, then send it.',
      replyToMessageId: messageId,
      replyMarkup: buildInlineLauncherReplyMarkup(),
    })
    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const executionContext = resolveCommandExecutionContext({
    chatId,
    userId,
    isAdmin,
  })
  const senderWallet = executionContext.senderWallet
  const groupId = executionContext.groupId

  let response: TelegramCommandResponse = { text: '' }
  try {
    response = await executeTelegramCommand({
      text: commandText,
      chatId,
      userId,
      groupId,
      senderWallet,
      isAdmin,
      messageId,
    })
  } catch (error) {
    console.error('[telegram/webhook] command handling failed', {
      updateId: update.update_id ?? null,
      chatId,
      err: error instanceof Error ? error.message : String(error),
    })
    response = { text: 'Request failed. Please try again in a few seconds.' }
  }

  if (!response.text) {
    response.text = 'Command received.'
  }
  const menuIsLinked = await isTelegramUserLinked({ telegramUserId: userId })
  const shouldUseFocusedHelp = isDefaultHelpCommand(normalizedText)
  if (shouldUseFocusedHelp) {
    response.text = buildFocusedHelpText()
    if (!response.replyMarkup) {
      response.replyMarkup = buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked })
    }
  }

  const chunks = splitTelegramMessage(response.text)
  const helpMarkup = response.replyMarkup
    ?? (isArenaHelpCommand(normalizedText)
      ? buildArenaHelpShortcutReplyMarkup()
      : isHelpCategoryCommand(normalizedText)
        ? buildHelpCategoryReplyMarkup()
        : isHelpCommand(normalizedText)
          ? buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked })
          : undefined)
  for (let idx = 0; idx < chunks.length; idx += 1) {
    const chunk = chunks[idx]
    if (!chunk) continue
    await sendTelegramMessage({
      botToken,
      chatId,
      text: chunk,
      replyToMessageId: idx === 0 ? message.message_id : undefined,
      replyMarkup: idx === 0 ? helpMarkup : undefined,
    })
  }
  const signalChunks = splitTelegramMessage(asTrimmed(response.signalText ?? ''))
  const signalDestination = resolveSignalsDestination(chatId)
  for (let idx = 0; idx < signalChunks.length; idx += 1) {
    const signalChunk = signalChunks[idx]
    if (!signalChunk) continue
    await sendTelegramMessage({
      botToken,
      chatId: signalDestination.chatId,
      text: signalChunk,
      messageThreadId: signalDestination.messageThreadId,
      replyMarkup: idx === 0 ? response.signalReplyMarkup : undefined,
    })
  }

  return res.status(200).json({
    success: true,
    data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
  } satisfies ApiEnvelope<TelegramWebhookOk>)
}
