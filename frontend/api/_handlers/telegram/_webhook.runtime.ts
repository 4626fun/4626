// Compatibility runtime while webhook modules are fully extracted.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PrivyClient } from '@privy-io/server-auth'
import { createPublicClient, encodeFunctionData, erc20Abi, formatUnits, getAddress, http, parseEther, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  rateLimitKey,
  getClientIp,
  RATE_LIMITS,
} from '../../../packages/server-core/src/index.js'

import { checkSharesEligibility } from '../../../server/_lib/keeprGating.js'
import { ensureAccountsIdentitySchema, fetchCreatorCoinSummary } from '../../../server/_lib/accountsIdentity.js'
import { getKeeprVaultByGroupId, getKeeprVaultByVaultAddress } from '../../../server/_lib/keeprRegistry.js'
import { ensureKeeprSchema } from '../../../server/_lib/keeprSchema.js'
import { extractCreatorCoinAddressFromProfile, fetchZoraProfile } from '../../../server/_lib/zoraProfile.js'
import { appendControlAuditEvent } from '../../../server/_lib/agentControl/audit.js'
import { evaluatePolicy } from '../../../server/_lib/agentControl/policy.js'
import { nowIso } from '../../../server/_lib/agentControl/types.js'
import {
  buildTelegramTradeControlBundle,
  TELEGRAM_TRADE_CONTROL_ACTIONS,
  TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
} from '../../../server/_lib/agentControl/telegramTradeControl.js'

import { resolveBaseAppInviteUrl as resolveBaseAppInviteUrlShared } from '../../../server/_lib/baseAppInvite.js'
import {
  isCoinbaseSmartWalletHelperError,
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from '../../../server/_lib/privyCoinbaseSmartWallet.js'
import {
  resolveTelegramIdentityContext,
  type TelegramSenderWalletSource as SenderWalletSource,
} from '../../../server/agent/core/resolveIdentityContext.js'
import { executeDeterministicCommand } from '../../../server/agent/core/executeDeterministicCommand.js'
import { processTelegramAgentInput } from '../../../server/agent/core/processTelegramAgentInput.js'
import {
  clearTelegramActiveMessage,
  consumeTelegramActionToken,
  createTelegramLinkStartToken,
  createTelegramActionToken,
  consumeTelegramTradePercentPrompt,
  getTelegramTradePercentPrompt,
  clearTelegramTradePercentPrompt,
  ensureTelegramTradingSchema,
  getTelegramChatTradePolicy,
  getTelegramActiveMessage,
  getHolderRoomPolicyByVault,
  getTelegramLinkByUserId,
  getTelegramPortfolioSummary,
  listHolderRoomPolicies,
  logTelegramActionAudit as logTelegramActionAuditShared,
  logTelegramFunnelEvent,
  isTelegramFunnelEventsEnabledForChat,
  listTelegramAuctions,
  listTelegramScopedVaults,
  listTelegramUserBids,
  readTelegramOnboardingSession,
  revokeTelegramLink,
  tryInsertTelegramPrivateDmWelcomeSent,
  upsertTelegramActiveMessage,
  upsertTelegramOnboardingSession,
  upsertTelegramTradePercentPrompt,
  upsertHolderRoomMember,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

import { getTelegramWebhookConfig } from './webhook/config.js'
import {
  areHolderRoomsEnabled as areHolderRoomsEnabledShared,
  getBaseRpcUrl as getBaseRpcUrlShared,
  getBundlerAndPaymasterUrl as getBundlerAndPaymasterUrlShared,
  isPrivateChatId as isPrivateChatIdShared,
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
  resolveSenderWalletWithSource as resolveSenderWalletWithSourceShared,
  resolveSignalsDestination as resolveSignalsDestinationShared,
  resolveTelegramMiniAppUrl as resolveTelegramMiniAppUrlShared,
} from './webhook/env.js'
import {
  buildMiniAppLaunchButton as buildMiniAppLaunchButtonShared,
  buildTelegramMiniAppUrl as buildTelegramMiniAppUrlShared,
  TELEGRAM_MINI_APP_LINK_PATH,
} from './webhook/miniApp.js'
import {
  resolveHelpCallbackCommand as resolveHelpCallbackCommandShared,
  resolveImmediateCallbackToast as resolveImmediateCallbackToastShared,
  resolveNavigationCallbackToast as resolveNavigationCallbackToastShared,
} from './webhook/parsers/callbackMenu.js'
import { isTelegramNativeCommand as isTelegramNativeCommandShared, normalizeTelegramCommand as normalizeTelegramCommandShared, shouldAutoRouteToAi as shouldAutoRouteToAiShared } from './webhook/parsers/command.js'
import { parseDeployCallbackData as parseDeployCallbackDataShared, parseTelegramDeployIntent as parseTelegramDeployIntentShared } from './webhook/parsers/deploy.js'
import { parseHolderRoomIdentifier as parseHolderRoomIdentifierShared } from './webhook/parsers/holderRooms.js'
import {
  formatVaultDeployUsageText as formatVaultDeployUsageTextShared,
  parseTelegramVaultDeployIntent as parseTelegramVaultDeployIntentShared,
  parseVaultDeployCallbackData as parseVaultDeployCallbackDataShared,
} from './webhook/parsers/vaultDeploy.js'
import {
  buildTelegramAnalyzeInlineDraft,
  filterTelegramApprovedTradeVaults,
  getTelegramApprovedInlineTokenByAddress,
  TELEGRAM_APPROVED_INLINE_TOKENS,
} from './webhook/approvedTokens.js'
import {
  buildInlineQueryAnswer,
  classifyInlineQuery,
  normalizeInlineTokenAddress,
  type InlineMediaAsset,
  type InlineQueryAnswer,
  type InlineQueryClass,
} from './webhook/parsers/inline.js'
import {
  buildInlineTokenAnalysisAnswer,
  parseTokenAnalysisResultId,
} from './webhook/inlineTokenFormatting.js'
import { resolveInlineTokenAnalysis } from './webhook/services/inlineTokenAnalysis.js'
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
import { answerTelegramCallbackQuery as answerTelegramCallbackQueryShared } from './webhook/telegramApi/interactions.js'
import { answerTelegramInlineQuery as answerTelegramInlineQueryShared } from './webhook/telegramApi/inline.js'
import { deleteTelegramMessage as deleteTelegramMessageShared, editTelegramInlineMessage as editTelegramInlineMessageShared, editTelegramMessage as editTelegramMessageShared, replaceTelegramMenuMessage as replaceTelegramMenuMessageShared, sendTelegramMessage as sendTelegramMessageShared, sendTelegramPhoto as sendTelegramPhotoShared } from './webhook/telegramApi/messaging.js'
import { isTelegramContextAllowed } from './webhook/services/access.js'
import { emitTelegramFunnelEvent as emitTelegramFunnelEventShared } from './webhook/services/funnel.js'
import { buildTelegramProcessedCommandResponse } from './webhook/services/commandResponse.js'
import { buildDeployCommandFromIntent as buildDeployCommandFromIntentShared, formatDeployTokenFailure as formatDeployTokenFailureShared } from './webhook/services/deploy.js'
import {
  buildVaultDeployPreviewReplyMarkup as buildVaultDeployPreviewReplyMarkupShared,
  fetchVaultDeployStatusFromTelegram,
  formatVaultDeployPreviewText as formatVaultDeployPreviewTextShared,
  formatVaultDeployTokenFailure as formatVaultDeployTokenFailureShared,
  startAkitaVaultDeployFromTelegram,
  type VaultDeployContracts,
} from './webhook/services/vaultDeploy.js'
import { checkTelegramTradeRateLimit as checkTelegramTradeRateLimitShared } from './webhook/services/trade.js'
import {
  collectPrivyWalletRows as collectPrivyWalletRowsShared,
  extractPrivyWalletAddressCandidate as extractPrivyWalletAddressCandidateShared,
  extractPrivyWalletIdCandidate as extractPrivyWalletIdCandidateShared,
} from './webhook/services/privyWallet.js'
import { normalizeCallbackQuery } from './webhook/updates/callbackQuery.js'
import { extractSharedSelection, extractUpdateMessage as extractUpdateMessageShared, normalizeMessageContext } from './webhook/updates/message.js'
import { handleChosenInlineResultUpdate } from './webhook/updates/chosenInlineResult.js'
import {
  appendCommandMicroHints as appendCommandMicroHintsShared,
  getCommandHead as getCommandHeadShared,
  isHelpCategoryCommand as isHelpCategoryCommandShared,
  isHelpCommand as isHelpCommandShared,
  isLikelyCommandText as isLikelyCommandTextShared,
  wrapCommandListingsWithBackticks as wrapCommandListingsWithBackticksShared,
} from './webhook/utils.js'
import { handleInlineQueryUpdate } from './webhook/updates/inlineQuery.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const TELEGRAM_MENU_LABELS = {
  connect: '■ Connect',
  wallet: '■ Wallet',
  trade: 'Trade',
  explore: 'Explore',
  cre: 'CRE Ops',
  solana: 'Solana',
  help: 'Help',
  vaults: 'Vaults',
  auctions: 'Auctions',
  buy: 'Buy',
  sell: 'Sell',
  bid: 'Bid',
  back: 'Back',
} as const

type TelegramHomeState = 'unlinked' | 'pending' | 'ready'

function sanitizeTelegramLabel(label: string): string {
  return label.replace(/\uFE0F/g, '')
}

function menuLabel(key: keyof typeof TELEGRAM_MENU_LABELS): string {
  return sanitizeTelegramLabel(TELEGRAM_MENU_LABELS[key])
}

const TELEGRAM_ID_PICKER_REQUESTS = {
  user: 1001,
  premium: 1002,
  bot: 1003,
  group: 2001,
  channel: 2002,
  forum: 2003,
  myGroup: 2101,
  myChannel: 2102,
  myForum: 2103,
} as const

type TelegramFrom = {
  id?: number | string
  is_bot?: boolean
  username?: string
}

type TelegramChat = {
  id?: number | string
}

type TelegramSharedUser = {
  user_id?: number | string
  first_name?: string
  last_name?: string
  username?: string
}

type TelegramUsersShared = {
  request_id?: number
  users?: TelegramSharedUser[]
}

type TelegramChatShared = {
  request_id?: number
  chat_id?: number | string
  title?: string
  username?: string
}

type TelegramMessage = {
  message_id?: number
  text?: string
  caption?: string
  from?: TelegramFrom
  chat?: TelegramChat
  reply_to_message?: TelegramMessage
  successful_payment?: TelegramSuccessfulPayment
  users_shared?: TelegramUsersShared
  chat_shared?: TelegramChatShared
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
  inline_message_id?: string
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

function resolveSignalsDestination(sourceChatId: string): { chatId: string; messageThreadId?: number } {
  return resolveSignalsDestinationShared(sourceChatId)
}

function isPrivateChatId(chatId: string): boolean {
  return isPrivateChatIdShared(chatId)
}

function resolveSenderWalletWithSource(userId: string): { senderWallet: `0x${string}`; source: SenderWalletSource } {
  const resolved = resolveSenderWalletWithSourceShared(userId)
  return {
    senderWallet: resolved.wallet,
    source: resolved.source,
  }
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
  senderWalletSource: SenderWalletSource
  session: ReturnType<typeof resolveTelegramIdentityContext>['session']
} {
  return resolveTelegramIdentityContext({
    chatId: params.chatId,
    userId: params.userId,
    isAdmin: params.isAdmin,
    zeroAddress: ZERO_ADDRESS as `0x${string}`,
    isPrivateChatId,
    resolveGroupId,
    resolveSenderWalletWithSource: (userId) => {
      const resolved = resolveSenderWalletWithSource(userId)
      return {
        wallet: resolved.senderWallet,
        source: resolved.source,
      }
    },
  })
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

function isHelpCommand(rawText: string): boolean {
  return isHelpCommandShared(rawText)
}

function isHelpCategoryCommand(rawText: string): boolean {
  return isHelpCategoryCommandShared(rawText)
}

type TelegramCommandResponse = {
  text: string
  replyMarkup?: Record<string, unknown>
  signalText?: string
  signalReplyMarkup?: Record<string, unknown>
  callbackToast?: string
  media?: {
    kind: 'photo'
    bytes: Uint8Array
    contentType?: string
    filename?: string
    caption?: string
    replyMarkup?: Record<string, unknown>
    suppressText?: boolean
  }
}

function wrapCommandListingsWithBackticks(text: string): string {
  return wrapCommandListingsWithBackticksShared(text)
}

function appendCommandMicroHints(text: string): string {
  return appendCommandMicroHintsShared(text)
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

function formatVaultDeployUsageText(reason?: string): string {
  return formatVaultDeployUsageTextShared(reason)
}

function parseTelegramDeployIntent(rawText: string): ParsedTelegramDeployIntent | null {
  return parseTelegramDeployIntentShared(rawText)
}

function parseTelegramVaultDeployIntent(rawText: string):
  | { kind: 'menu' }
  | { kind: 'usage'; text: string }
  | { kind: 'request'; token: 'akita'; version: string }
  | null {
  return parseTelegramVaultDeployIntentShared(rawText)
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
  return getCommandHeadShared(rawText)
}

function isLikelyCommandText(rawText: string): boolean {
  return isLikelyCommandTextShared(rawText)
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

type ResolvedTradeIdentifier = {
  identifier: string
  profileLookupAttempted: boolean
  profileLookupHit: boolean
}

async function resolveTradeIdentifier(params: {
  identifier: string
}): Promise<ResolvedTradeIdentifier> {
  const trimmed = asTrimmed(params.identifier)
  if (!trimmed) {
    return { identifier: '', profileLookupAttempted: false, profileLookupHit: false }
  }

  const normalized = trimmed.toLowerCase()
  if (normalized === 'vault' || normalized === 'default' || isAddressLike(normalized)) {
    return {
      identifier: normalized,
      profileLookupAttempted: false,
      profileLookupHit: false,
    }
  }

  try {
    const profile = await fetchZoraProfile(trimmed)
    const creatorCoinAddress = extractCreatorCoinAddressFromProfile(profile)
    if (creatorCoinAddress) {
      return {
        identifier: creatorCoinAddress,
        profileLookupAttempted: true,
        profileLookupHit: true,
      }
    }
  } catch {
    // Best-effort resolver: fall back to existing identifier behavior.
  }

  return {
    identifier: trimmed,
    profileLookupAttempted: true,
    profileLookupHit: false,
  }
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

function parseVaultDeployCallbackData(rawData: string):
  | { kind: 'confirm' | 'decline'; token: string }
  | { kind: 'status'; token: string }
  | null {
  return parseVaultDeployCallbackDataShared(rawData)
}

function parseTwitterCallbackData(rawData: string):
  | { kind: 'confirm' | 'decline'; token: string }
  | null {
  const data = asTrimmed(rawData)
  const match = data.match(/^twitter:(confirm|decline):([a-zA-Z0-9._-]+)$/)
  if (!match) return null
  const token = asTrimmed(match[2] ?? '')
  if (!token) return null
  return {
    kind: match[1] === 'confirm' ? 'confirm' : 'decline',
    token,
  }
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

function buildTwitterPostPreviewReplyMarkup(token: string): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Post', callback_data: `twitter:confirm:${token}` },
        { text: 'Cancel', callback_data: `twitter:decline:${token}` },
      ],
    ],
  }
}

function formatTwitterTokenFailure(reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'): string {
  if (reason === 'expired') return 'X post confirmation expired. Start a new `/x post` preview.'
  if (reason === 'consumed') return 'This X post preview was already used or cancelled.'
  if (reason === 'scope_mismatch') return 'X post confirmation scope mismatch. Use a fresh preview from this chat.'
  return 'X post confirmation token not found. Start a new `/x post` preview.'
}

function buildTwitterPostRecoveryReplyMarkup(tweetText?: string): Record<string, unknown> {
  const rows: Array<Array<Record<string, unknown>>> = []
  const draft = asTrimmed(tweetText ?? '')
  if (draft) {
    rows.push([buildReusableCommandButton('Reuse Draft', `/x post ${draft}`)])
  } else {
    rows.push([buildReusableCommandButton('Compose X Post', '/x post ')])
  }
  rows.push([
    { text: 'X Help', callback_data: 'help:social' },
    { text: 'Back', callback_data: 'menu:start' },
  ])
  return {
    inline_keyboard: rows,
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
  const normalizedTokenAddress = normalizeInlineTokenAddress(params.rawQuery)
  if (normalizedTokenAddress) {
    const db = await getDb().catch(() => null)
    const resolution = await resolveInlineTokenAnalysis({
      normalizedAddress: normalizedTokenAddress,
      db: db as any,
      secondaryBudgetMs: 250,
    })
    return buildInlineTokenAnalysisAnswer({ resolution })
  }

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
    linkButtonUrl: buildTelegramMiniAppUrl({
      baseUrl: resolveTelegramMiniAppUrl(),
      pathname: TELEGRAM_MINI_APP_LINK_PATH,
    }),
  })
}

function buildHelpCategoryReplyMarkup(params: { isAdmin: boolean }): Record<string, unknown> {
  const secondaryRow = params.isAdmin
    ? [
        { text: 'Ops', callback_data: 'help:ops' },
        { text: menuLabel('wallet'), callback_data: 'help:wallet' },
      ]
    : [{ text: menuLabel('wallet'), callback_data: 'help:wallet' }]
  return {
    inline_keyboard: [
      [
        { text: 'Core', callback_data: 'help:core' },
        { text: 'Coin', callback_data: 'help:coin' },
        { text: 'Social', callback_data: 'help:social' },
      ],
      secondaryRow,
      [{ text: 'Help', callback_data: 'help:all' }],
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
  return resolveBaseAppInviteUrlShared()
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
        'Connect your 4626 account (one time)',
        '',
        'For security, linking is only available in a private chat with this bot.',
        'Linking verifies your 4626 account and finishes the wallet setup required for bot actions.',
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
    pathname: TELEGRAM_MINI_APP_LINK_PATH,
    query: linkQuery,
  })
  const openMiniAppButton = buildMiniAppLaunchButton({
    chatId: params.chatId,
    text: 'Open Mini App',
    url: linkUrl,
  })
  const baseInviteUrl = resolveTelegramBaseAppInviteUrl()
  const linkBodyLines =
    params.zoraOnboardingBranch === 'need'
      ? [
          '<b>Base app | 4626.fun</b>',
          '',
          'Need a Coinbase Smart Wallet? Install Base app first, then come back here to finish connecting Telegram.',
          '',
          '1) Tap Get Base app.',
          '2) Tap Open Mini App.',
          '3) Sign in to 4626 and verify your email.',
          '4) Create or connect your Coinbase Smart Wallet.',
          '5) Finish wallet confirmation so Telegram actions can unlock safely.',
          '',
          '4626 never holds your keys — you approve actions in your wallet.',
          'After setup is complete, Telegram actions run directly through the bot.',
        ]
      : params.zoraOnboardingBranch === 'has'
        ? [
            '<b>Link | 4626.fun</b>',
            '',
            'Finish connecting your Telegram account, then complete wallet confirmation on your Coinbase Smart Wallet.',
            '',
            '4626 never holds your keys — you approve actions in your wallet.',
            '',
            '1) Tap Open Mini App.',
            '2) Sign in to 4626 and verify your email.',
            '3) Complete the wallet confirmation step on your Coinbase Smart Wallet.',
            '',
            'After setup is complete, Telegram actions run directly through the bot.',
          ]
        : [
            'Connect your 4626 account (one time)',
            '',
            '1) Tap Open Mini App.',
            '2) Sign in to 4626 and verify your email.',
            '3) Connect your Coinbase Smart Wallet if you have one.',
            '4) Finish wallet confirmation so bot actions can unlock safely.',
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
      'If the button fails, return to this DM and tap Open Mini App again.',
      "Do not copy this URL into a browser — Telegram Mini App context is required.",
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

function shouldSendFreshPrivateDmCommandReply(params: {
  chatId: string
  normalizedText: string
}): boolean {
  if (!isPrivateChatId(params.chatId)) return false
  const normalized = asTrimmed(params.normalizedText)
  if (normalized.startsWith('/')) return true
  if (isDefaultHelpCommand(params.normalizedText)) return true
  const commandToken = tokenizeTelegramCommand(params.normalizedText)[0]?.toLowerCase() ?? ''
  return commandToken === '/start' || commandToken === 'start'
}

function buildOnboardingWelcomeText(): string {
  return [
    '<b>Welcome to 4626.fun on Telegram</b>',
    '',
    '4626 brings creator coins, vault activity, and wallet actions on Base into Telegram.',
    '',
    'Connect once with your verified 4626 account, then use this bot to check your wallet, trade, and follow what is happening onchain.',
    '',
    'Tap <b>Start</b> to choose your wallet path and open the Mini App.',
  ].join('\n')
}

function buildOnboardingWelcomeReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [{ text: 'Start', callback_data: 'onboard:begin' }],
      [
        { text: 'Check Link Status', callback_data: 'menu:linked' },
        { text: menuLabel('help'), callback_data: 'menu:topics' },
      ],
    ],
  }
}

function buildCswForkText(): string {
  return [
    '<b>Coinbase Smart Wallet | 4626.fun</b>',
    '',
    'Choose how you want to continue wallet setup before opening the Mini App.',
    '',
    'If you already have a Coinbase Smart Wallet, link it. Otherwise, install Base app and create one first.',
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
    '<blockquote>Groups are for discovery and live context. Do setup in a private chat first, then come back here ready to act.</blockquote>',
    '',
    '<u>In your DM with this bot</u>',
    '/start — home (tap <b>Start</b> to begin onboarding)',
    '/link — continue wallet linking after onboarding',
    '/linked — check Telegram link and wallet setup',
    '',
    'After setup is ready, use /buy, /sell, /bid, and /wallet from Telegram.',
  ].join('\n')
}

function buildStartLandingText(params: { state: Exclude<TelegramHomeState, 'unlinked'> }): string {
  if (params.state === 'ready') {
    return [
      '<b>4626 Command Center</b>',
      '',
      'Your 4626 account and smart wallet are connected.',
      'You can trade creator coins and manage vault activity on Base directly from Telegram.',
      '',
      '<u>Quick commands (tap to run)</u>',
      '/wallet — balances, positions, and recent actions',
      '/buy — guided creator-coin buy flow',
      '/sell — guided creator-coin sell flow',
      '/bid — guided auction bid flow',
      '/linked — account and wallet link status',
      '',
      'Use the buttons below for Wallet, Trade, Explore, and Help.',
    ].join('\n')
  }
  return [
    '<b>Welcome back to 4626</b>',
    '',
    '<blockquote>Your Telegram account is connected, but wallet setup is not finished yet. Finish it once and trading actions will unlock here.</blockquote>',
    '',
    '<u>Next step</u>',
    'Tap <b>Finish Wallet Setup</b> to reopen the connect flow and complete wallet confirmation.',
  ].join('\n')
}

function buildStartAndLinkNudgeText(): string {
  return buildOnboardingWelcomeText()
}

function buildStartAndLinkNudgeReplyMarkup(): Record<string, unknown> {
  return buildOnboardingWelcomeReplyMarkup()
}

function buildStartReplyMarkup(params: { chatId: string; state: TelegramHomeState }): Record<string, unknown> {
  if (params.state === 'ready') {
    return {
      inline_keyboard: [
        [{ text: menuLabel('wallet'), callback_data: 'menu:wallet' }],
        [
          { text: menuLabel('trade'), callback_data: 'menu:trade' },
          { text: menuLabel('explore'), callback_data: 'menu:explore' },
          { text: menuLabel('help'), callback_data: 'menu:topics' },
        ],
      ],
    }
  }

  if (params.state === 'pending') {
    return {
      inline_keyboard: [
        [{ text: 'Finish Wallet Setup', callback_data: 'menu:connect' }],
        [
          { text: 'Check Link Status', callback_data: 'menu:linked' },
          { text: menuLabel('help'), callback_data: 'menu:topics' },
        ],
      ],
    }
  }

  if (!isPrivateChatId(params.chatId)) {
    return {
      inline_keyboard: [
        [
          { text: 'Check Link Status', callback_data: 'menu:linked' },
          { text: menuLabel('help'), callback_data: 'menu:topics' },
        ],
      ],
    }
  }

  return buildOnboardingWelcomeReplyMarkup()
}

function buildFocusedHelpText(): string {
  return [
    '<b>4626 on Telegram</b>',
    '',
    'Use <code>/help all</code> for the full command guide.',
    '',
    '🎮 <b>Start Here</b>',
    '├ <code>/start</code> — home and onboarding',
    '├ <code>/link</code> — open the Mini App connect flow',
    '├ <code>/linked</code> — check link and wallet setup',
    '└ <code>/help all</code> — full command guide',
    '',
    '💼 <b>Core Actions</b>',
    '├ <code>/wallet</code> — balances and positions',
    '├ <code>/buy</code> — guided buy flow',
    '├ <code>/sell</code> — guided sell flow',
    '├ <code>/bid</code> — guided bid flow',
    '└ <code>/vaults</code> — browse vaults and discovery',
    '',
    '🧠 <b>Focused Guides</b>',
    '└ <code>/help coin|social|ops|wallet</code> — deeper sections',
  ].join('\n')
}

function buildHelpReplyMarkup(params: { chatId: string; isLinked: boolean }): Record<string, unknown> {
  const keyboard: Array<Array<Record<string, unknown>>> = params.isLinked
    ? [
        [{ text: menuLabel('wallet'), callback_data: 'menu:wallet' }],
        [
          { text: menuLabel('trade'), callback_data: 'menu:trade' },
          { text: menuLabel('explore'), callback_data: 'menu:explore' },
          { text: menuLabel('help'), callback_data: 'menu:topics' },
        ],
        [{ text: 'Check Link Status', callback_data: 'menu:linked' }],
      ]
    : [
        [{ text: menuLabel('connect'), callback_data: 'menu:connect' }],
        [
          { text: menuLabel('explore'), callback_data: 'menu:explore' },
          { text: menuLabel('help'), callback_data: 'menu:topics' },
        ],
        [{ text: 'Check Link Status', callback_data: 'menu:linked' }],
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

function shouldShowOperatorMenus(params: { isAdmin: boolean }): boolean {
  return params.isAdmin
}

function isOperatorCallbackToken(rawData: string): boolean {
  const token = asTrimmed(rawData).toLowerCase()
  return token === 'menu:cre' || token === 'menu:solana' || token.startsWith('cre:')
}

function isOperatorCommand(rawText: string): boolean {
  return asTrimmed(rawText).toLowerCase().startsWith('/cre')
}

function buildOperatorAccessDeniedResponse(params: {
  chatId: string
  homeState: TelegramHomeState
}): TelegramCommandResponse {
  return {
    text: [
      `${menuLabel('cre')} and ${menuLabel('solana')} are only available to configured bot operators.`,
      '',
      'Use /start for regular wallet, trade, and discovery actions.',
    ].join('\n'),
    replyMarkup: buildStartReplyMarkup({ chatId: params.chatId, state: params.homeState }),
  }
}

function buildCreReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Status', callback_data: 'cre:status' },
        { text: 'Auctions', callback_data: 'cre:auction' },
      ],
      [
        { text: 'Health', callback_data: 'cre:health' },
        { text: menuLabel('solana'), callback_data: 'menu:solana' },
      ],
      [
        { text: 'Tend All', callback_data: 'cre:tend' },
        { text: 'Report All', callback_data: 'cre:report' },
      ],
      [{ text: 'Ask AI About CRE', switch_inline_query_current_chat: 'ai summarize current CRE status, auctions, health, and next operator actions' }],
      [{ text: menuLabel('back'), callback_data: 'menu:start' }],
    ],
  }
}

function buildSolanaReplyMarkup(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Status', callback_data: 'cre:solana' },
        { text: 'Health', callback_data: 'cre:health' },
      ],
      [
        { text: 'Settle Fees', callback_data: 'cre:settle-fees' },
        { text: 'Relay Entries', callback_data: 'cre:relay-entries' },
      ],
      [{ text: 'Ask AI About Solana', switch_inline_query_current_chat: 'ai summarize current Solana health, pending entries, and fee settlement status' }],
      [
        { text: menuLabel('cre'), callback_data: 'menu:cre' },
        { text: menuLabel('back'), callback_data: 'menu:start' },
      ],
    ],
  }
}

function resolveOperatorReplyMarkup(commandText: string): Record<string, unknown> | undefined {
  const normalized = asTrimmed(commandText).toLowerCase()
  if (!normalized.startsWith('/cre')) return undefined
  if (
    normalized === '/cre solana' ||
    normalized === '/cre settle-fees' ||
    normalized === '/cre relay-entries'
  ) {
    return buildSolanaReplyMarkup()
  }
  return buildCreReplyMarkup()
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
  homeState: TelegramHomeState
  isAdmin: boolean
}): TelegramCommandResponse | null {
  const token = asTrimmed(params.callbackData).toLowerCase()
  if (token === 'menu:start') {
    if (params.homeState !== 'unlinked') {
      return {
        text: buildStartLandingText({ state: params.homeState }),
        replyMarkup: buildStartReplyMarkup({ chatId: params.chatId, state: params.homeState }),
      }
    }
    if (!isPrivateChatId(params.chatId)) {
      return {
        text: buildUnlinkedGroupStartLandingText(),
        replyMarkup: buildStartReplyMarkup({ chatId: params.chatId, state: 'unlinked' }),
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
    if (params.homeState !== 'ready') {
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
  if (token === 'menu:cre') {
    if (!shouldShowOperatorMenus({ isAdmin: params.isAdmin })) {
      return buildOperatorAccessDeniedResponse({
        chatId: params.chatId,
        homeState: params.homeState,
      })
    }
    return {
      text: [menuLabel('cre'), '', 'Tap an operator action to inspect or run keeper flows.'].join('\n'),
      replyMarkup: buildCreReplyMarkup(),
    }
  }
  if (token === 'menu:solana') {
    if (!shouldShowOperatorMenus({ isAdmin: params.isAdmin })) {
      return buildOperatorAccessDeniedResponse({
        chatId: params.chatId,
        homeState: params.homeState,
      })
    }
    return {
      text: [menuLabel('solana'), '', 'Tap a Solana action to inspect bridge health or run the relay path.'].join('\n'),
      replyMarkup: buildSolanaReplyMarkup(),
    }
  }
  if (token === 'menu:topics') {
    return {
      text: [`${menuLabel('help')} Topics`, '', 'Pick a focused command guide.'].join('\n'),
      replyMarkup: buildHelpCategoryReplyMarkup({ isAdmin: params.isAdmin }),
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
  dismissOwnerUserId?: string | null
}): Promise<{ messageId: number | null }> {
  try {
    return await sendTelegramMessageShared(params)
  } catch (error) {
    console.error('[telegram/webhook] sendMessage delivery failed', {
      chatId: params.chatId,
      replyToMessageId: params.replyToMessageId ?? null,
      messageThreadId: params.messageThreadId ?? null,
      hasReplyMarkup: Boolean(params.replyMarkup),
      err: error instanceof Error ? error.message : String(error),
    })
    const fallbackText = asTrimmed(params.text)
    if (!fallbackText) return { messageId: null }
    try {
      return await sendTelegramMessageShared({
        botToken: params.botToken,
        chatId: params.chatId,
        text: fallbackText,
        ...(typeof params.messageThreadId === 'number' ? { messageThreadId: params.messageThreadId } : {}),
      })
    } catch (fallbackError) {
      console.error('[telegram/webhook] sendMessage fallback delivery failed', {
        chatId: params.chatId,
        messageThreadId: params.messageThreadId ?? null,
        err: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      })
      return { messageId: null }
    }
  }
}

async function sendTelegramPhoto(params: {
  botToken: string
  chatId: string
  photo: Uint8Array
  filename?: string
  contentType?: string
  caption?: string
  replyToMessageId?: number
  messageThreadId?: number
  replyMarkup?: Record<string, unknown>
  dismissOwnerUserId?: string | null
}): Promise<{ messageId: number | null }> {
  return sendTelegramPhotoShared(params)
}

async function editTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
  dismissOwnerUserId?: string | null
}): Promise<boolean> {
  return editTelegramMessageShared(params)
}

async function editTelegramInlineMessage(params: {
  botToken: string
  inlineMessageId: string
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<boolean> {
  return editTelegramInlineMessageShared(params)
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
  dismissOwnerUserId?: string | null
}): Promise<{ messageId: number | null }> {
  try {
    return await replaceTelegramMenuMessageShared(params)
  } catch (error) {
    console.error('[telegram/webhook] replace menu message failed', {
      chatId: params.chatId,
      messageId: params.messageId,
      hasReplyMarkup: Boolean(params.replyMarkup),
      err: error instanceof Error ? error.message : String(error),
    })
    return sendTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      text: params.text,
    })
  }
}

async function loadTelegramActiveMessageState(params: {
  chatId: string
  ownerUserId?: string | null
}): Promise<{
  db: Awaited<ReturnType<typeof getDb>> | null
  activeMessageId: number | null
  dismissOwnerUserId: string | null
}> {
  const dismissOwnerUserId = asTrimmed(params.ownerUserId ?? '') || null
  if (!dismissOwnerUserId) {
    return { db: null, activeMessageId: null, dismissOwnerUserId: null }
  }
  try {
    const db = await getDb()
    if (!db) {
      return { db: null, activeMessageId: null, dismissOwnerUserId }
    }
    await ensureTelegramTradingSchema(db as any)
    const active = await getTelegramActiveMessage({
      db: db as any,
      chatId: params.chatId,
      ownerTelegramUserId: dismissOwnerUserId,
    })
    return {
      db,
      activeMessageId: typeof active?.messageId === 'number' ? active.messageId : null,
      dismissOwnerUserId,
    }
  } catch (error) {
    console.error('[telegram/webhook] active message state load failed', {
      chatId: params.chatId,
      ownerUserId: dismissOwnerUserId,
      err: error instanceof Error ? error.message : String(error),
    })
    return {
      db: null,
      activeMessageId: null,
      dismissOwnerUserId,
    }
  }
}

async function upsertTelegramActiveMessageState(params: {
  db: Awaited<ReturnType<typeof getDb>> | null
  chatId: string
  ownerUserId?: string | null
  messageId?: number | null
}): Promise<void> {
  const ownerUserId = asTrimmed(params.ownerUserId ?? '')
  const messageId = Number(params.messageId)
  if (!params.db || !ownerUserId || !Number.isFinite(messageId) || messageId <= 0) return
  await upsertTelegramActiveMessage({
    db: params.db as any,
    chatId: params.chatId,
    ownerTelegramUserId: ownerUserId,
    messageId: Math.floor(messageId),
  })
}

async function clearTelegramActiveMessageState(params: {
  db: Awaited<ReturnType<typeof getDb>> | null
  chatId: string
  ownerUserId?: string | null
  messageId?: number | null
}): Promise<void> {
  const ownerUserId = asTrimmed(params.ownerUserId ?? '')
  if (!params.db || !ownerUserId) return
  await clearTelegramActiveMessage({
    db: params.db as any,
    chatId: params.chatId,
    ownerTelegramUserId: ownerUserId,
    messageId: typeof params.messageId === 'number' ? params.messageId : null,
  })
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

function truncateAddress(value: string | null | undefined): string {
  const v = asTrimmed(value)
  if (!v) return 'n/a'
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return v
  return `${v.slice(0, 6)}…${v.slice(-4)}`
}

function escapeTelegramHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildTelegramCommandChrome(params: {
  title: string
  command: string
  summaryLines: string[]
  detailLines?: string[]
  expandableDetails?: boolean
}): string {
  const sections = [
    `<b>${escapeTelegramHtmlText(params.title)}</b>`,
    `<code>${escapeTelegramHtmlText(params.command)}</code>`,
  ]
  if (params.summaryLines.length > 0) {
    sections.push(
      '',
      `<blockquote>${escapeTelegramHtmlText(params.summaryLines.join('\n'))}</blockquote>`,
    )
  }
  if (params.detailLines && params.detailLines.length > 0) {
    sections.push(
      '',
      `<blockquote${params.expandableDetails ? ' expandable' : ''}>${escapeTelegramHtmlText(params.detailLines.join('\n'))}</blockquote>`,
    )
  }
  return sections.join('\n')
}

function isTelegramIdPickerStartCommand(text: string): boolean {
  const tokens = tokenizeTelegramCommand(text).map((token) => token.toLowerCase())
  if ((tokens[0] ?? '') !== '/start' && (tokens[0] ?? '') !== 'start') return false
  const tail = tokens
    .slice(1)
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .trim()
  return tail === 'id' || tail === 'get id' || tail === 'getid'
}

function buildTelegramIdPickerReplyMarkup(): Record<string, unknown> {
  return {
    keyboard: [
      [
        {
          text: '👤 User',
          request_users: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.user,
            user_is_bot: false,
            max_quantity: 1,
            request_name: true,
            request_username: true,
            request_photo: true,
          },
        },
        {
          text: '⭐ Premium',
          request_users: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.premium,
            user_is_bot: false,
            user_is_premium: true,
            max_quantity: 1,
            request_name: true,
            request_username: true,
            request_photo: true,
          },
        },
        {
          text: '🤖 Bot',
          request_users: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.bot,
            user_is_bot: true,
            max_quantity: 1,
            request_name: true,
            request_username: true,
            request_photo: true,
          },
        },
      ],
      [
        {
          text: '👥 Group',
          request_chat: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.group,
            chat_is_channel: false,
            request_title: true,
            request_username: true,
            request_photo: true,
          },
        },
        {
          text: '📣 Channel',
          request_chat: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.channel,
            chat_is_channel: true,
            request_title: true,
            request_username: true,
            request_photo: true,
          },
        },
        {
          text: '💬 Forum',
          request_chat: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.forum,
            chat_is_channel: false,
            chat_is_forum: true,
            request_title: true,
            request_username: true,
            request_photo: true,
          },
        },
      ],
      [
        {
          text: '🛡 My Group',
          request_chat: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.myGroup,
            chat_is_channel: false,
            chat_is_created: true,
            request_title: true,
            request_username: true,
            request_photo: true,
          },
        },
        {
          text: '📢 My Channel',
          request_chat: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.myChannel,
            chat_is_channel: true,
            chat_is_created: true,
            request_title: true,
            request_username: true,
            request_photo: true,
          },
        },
        {
          text: '🧵 My Forum',
          request_chat: {
            request_id: TELEGRAM_ID_PICKER_REQUESTS.myForum,
            chat_is_channel: false,
            chat_is_forum: true,
            chat_is_created: true,
            request_title: true,
            request_username: true,
            request_photo: true,
          },
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: 'Pick a user, group, channel, or forum',
  }
}

function buildTelegramIdPickerText(): string {
  return buildTelegramCommandChrome({
    title: 'AKITA | TELEGRAM ID',
    command: '/id',
    summaryLines: [
      'Pick a native Telegram target below.',
      'Telegram will return the selected user or chat ID here.',
    ],
    detailLines: [
      'User, Premium, and Bot use the people picker.',
      'Group, Channel, and Forum use the chat picker.',
      'My Group / My Channel / My Forum filter to chats you created.',
    ],
    expandableDetails: true,
  })
}

function resolveTelegramIdPickerRequestLabel(requestId: number | null): string {
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.user) return 'User'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.premium) return 'Premium user'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.bot) return 'Bot'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.group) return 'Group'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.channel) return 'Channel'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.forum) return 'Forum'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.myGroup) return 'My Group'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.myChannel) return 'My Channel'
  if (requestId === TELEGRAM_ID_PICKER_REQUESTS.myForum) return 'My Forum'
  return 'Selection'
}

function formatTelegramSharedUserName(user: { firstName: string; lastName: string; username: string; userId: string }): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (user.username) return `@${user.username}`
  return user.userId
}

function buildTelegramIdSelectionText(selection: ReturnType<typeof extractSharedSelection>): string {
  if (!selection) return ''
  if (selection.kind === 'users') {
    const user = selection.users[0]
    if (!user) return ''
    const lines = [
      '<b>AKITA | TELEGRAM ID</b>',
      '<code>/id</code>',
      '',
      `<blockquote>${escapeTelegramHtmlText(`${resolveTelegramIdPickerRequestLabel(selection.requestId)}\n${formatTelegramSharedUserName(user)}`)}</blockquote>`,
      '',
      '<b>User ID</b>',
      `<code>${escapeTelegramHtmlText(user.userId)}</code>`,
    ]
    if (user.username) {
      lines.push('', '<b>Username</b>', escapeTelegramHtmlText(`@${user.username}`))
    }
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    if (fullName) {
      lines.push('', '<b>Name</b>', escapeTelegramHtmlText(fullName))
    }
    if (selection.users.length > 1) {
      lines.push('', escapeTelegramHtmlText(`Picked ${selection.users.length} users. Showing the first selection.`))
    }
    return lines.join('\n')
  }

  const displayName = selection.title || (selection.username ? `@${selection.username}` : selection.chatId)
  const lines = [
    '<b>AKITA | TELEGRAM ID</b>',
    '<code>/id</code>',
    '',
    `<blockquote>${escapeTelegramHtmlText(`${resolveTelegramIdPickerRequestLabel(selection.requestId)}\n${displayName}`)}</blockquote>`,
    '',
    '<b>Chat ID</b>',
    `<code>${escapeTelegramHtmlText(selection.chatId)}</code>`,
  ]
  if (selection.username) {
    lines.push('', '<b>Username</b>', escapeTelegramHtmlText(`@${selection.username}`))
  }
  if (selection.title) {
    lines.push('', '<b>Title</b>', escapeTelegramHtmlText(selection.title))
  }
  return lines.join('\n')
}

type ResolvedTelegramPickerUserProfile = {
  telegramUserId: string
  telegramUsername: string | null
  profileId: number | null
  privyUserId: string | null
  canonicalCswAddress: `0x${string}` | null
  ownerVerified: boolean
  linkStatus: string | null
  zoraHandle: string | null
  creatorCoinAddress: `0x${string}` | null
  creatorCoinName: string | null
  creatorCoinSymbol: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  vaultAddress: `0x${string}` | null
  shareTokenAddress: `0x${string}` | null
  ccaStrategyAddress: `0x${string}` | null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatCompactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$${formatAmount(value / 1_000_000_000, 2)}B`
  if (abs >= 1_000_000) return `$${formatAmount(value / 1_000_000, 2)}M`
  if (abs >= 1_000) return `$${formatAmount(value / 1_000, 1)}K`
  return `$${formatAmount(value, value >= 100 ? 0 : 2)}`
}

function mapKeeprVaultRowToScopedVault(vault: Awaited<ReturnType<typeof getKeeprVaultByVaultAddress>>): ScopedVaultRow | null {
  if (!vault) return null
  return {
    vaultAddress: vault.vaultAddress,
    creatorCoinAddress: vault.creatorCoinAddress,
    chainId: vault.chainId,
    groupId: vault.groupId,
    isSettled: false,
    ccaStrategyAddress: isAddressLike(vault.config?.contracts?.ccaStrategy)
      ? (String(vault.config.contracts.ccaStrategy).toLowerCase() as `0x${string}`)
      : null,
  }
}

async function resolveTelegramPickerUserProfile(params: {
  db: Awaited<ReturnType<typeof getDb>>
  telegramUserId: string
}): Promise<ResolvedTelegramPickerUserProfile | null> {
  const db = params.db
  if (!db) return null
  await ensureAccountsIdentitySchema(db as any)
  await ensureKeeprSchema()

  const linkResult = await db.sql`
    SELECT
      telegram_user_id,
      telegram_username,
      profile_id,
      privy_user_id,
      canonical_csw_address,
      owner_verified,
      link_status
    FROM telegram_user_links
    WHERE telegram_user_id = ${params.telegramUserId}
    LIMIT 1;
  `
  const linkRow = linkResult.rows?.[0] ?? null
  if (!linkRow) return null

  const profileId = Number(linkRow.profile_id)
  const privyUserId = asTrimmed(linkRow.privy_user_id ?? '') || null
  const zoraResult = privyUserId
    ? await db.sql`
        SELECT canonical_csw_address, creator_coin_address, zora_handle
        FROM account_zora_signals
        WHERE privy_user_id = ${privyUserId}
        LIMIT 1;
      `
    : { rows: [] }
  const zoraRow = zoraResult.rows?.[0] ?? null
  const creatorCoinAddress = isAddressLike(zoraRow?.creator_coin_address)
    ? (String(zoraRow.creator_coin_address).toLowerCase() as `0x${string}`)
    : null
  const coinSummary = creatorCoinAddress ? await fetchCreatorCoinSummary(creatorCoinAddress) : null
  const metricsResult = creatorCoinAddress
    ? await db.sql`
        SELECT market_cap_usd, volume_24h_usd
        FROM creator_coins
        WHERE coin_address = ${creatorCoinAddress}
        LIMIT 1;
      `
    : { rows: [] }
  const metricsRow = metricsResult.rows?.[0] ?? null
  const vaultResult = creatorCoinAddress
    ? await db.sql`
        SELECT vault_address, share_token_address, config_json, chain_id, group_id, settled_at, creator_coin_address
        FROM keepr_vaults
        WHERE creator_coin_address = ${creatorCoinAddress}
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1;
      `
    : { rows: [] }
  const vaultRow = vaultResult.rows?.[0] ?? null
  const vaultConfig = vaultRow?.config_json && typeof vaultRow.config_json === 'object'
    ? (vaultRow.config_json as Record<string, unknown>)
    : {}
  const contracts =
    vaultConfig.contracts && typeof vaultConfig.contracts === 'object' && !Array.isArray(vaultConfig.contracts)
      ? (vaultConfig.contracts as Record<string, unknown>)
      : {}

  return {
    telegramUserId: String(linkRow.telegram_user_id),
    telegramUsername: asTrimmed(linkRow.telegram_username ?? '') || null,
    profileId: Number.isFinite(profileId) && profileId > 0 ? profileId : null,
    privyUserId,
    canonicalCswAddress: isAddressLike(zoraRow?.canonical_csw_address)
      ? (String(zoraRow.canonical_csw_address).toLowerCase() as `0x${string}`)
      : isAddressLike(linkRow.canonical_csw_address)
        ? (String(linkRow.canonical_csw_address).toLowerCase() as `0x${string}`)
        : null,
    ownerVerified: linkRow.owner_verified === true,
    linkStatus: asTrimmed(linkRow.link_status ?? '') || null,
    zoraHandle: asTrimmed(zoraRow?.zora_handle ?? '') || null,
    creatorCoinAddress,
    creatorCoinName: asTrimmed(coinSummary?.name ?? '') || null,
    creatorCoinSymbol: asTrimmed(coinSummary?.symbol ?? '') || null,
    marketCapUsd: toFiniteNumber(metricsRow?.market_cap_usd),
    volume24hUsd: toFiniteNumber(metricsRow?.volume_24h_usd),
    vaultAddress: isAddressLike(vaultRow?.vault_address) ? (String(vaultRow.vault_address).toLowerCase() as `0x${string}`) : null,
    shareTokenAddress: isAddressLike(vaultRow?.share_token_address) ? (String(vaultRow.share_token_address).toLowerCase() as `0x${string}`) : null,
    ccaStrategyAddress: isAddressLike(contracts.ccaStrategy) ? (String(contracts.ccaStrategy).toLowerCase() as `0x${string}`) : null,
  }
}

function buildTelegramPickedUserProfileText(params: {
  selectedUser: {
    userId: string
    firstName: string
    lastName: string
    username: string
  }
  profile: ResolvedTelegramPickerUserProfile | null
}): string {
  const selectedName = formatTelegramSharedUserName(params.selectedUser)
  const summaryLines = [selectedName]
  if (params.profile?.creatorCoinSymbol) summaryLines.push(`Coin: ${params.profile.creatorCoinSymbol}`)
  if (!params.profile) summaryLines.push('No linked 4626 profile found')

  const detailLines = [
    `Telegram ID: ${params.selectedUser.userId}`,
    `Telegram: ${params.selectedUser.username ? `@${params.selectedUser.username}` : 'n/a'}`,
  ]
  if (params.profile) {
    detailLines.push(
      `Link: ${params.profile.linkStatus ?? 'unknown'} • ${params.profile.ownerVerified ? 'wallet ready' : 'wallet setup pending'}`,
    )
    detailLines.push(`Profile ID: ${params.profile.profileId ?? 'n/a'}`)
    detailLines.push(`Creator coin: ${params.profile.creatorCoinAddress ?? 'n/a'}`)
    detailLines.push(`Name: ${params.profile.creatorCoinName ?? 'n/a'}`)
    detailLines.push(`Symbol: ${params.profile.creatorCoinSymbol ?? 'n/a'}`)
    detailLines.push(`Market cap: ${formatCompactUsd(params.profile.marketCapUsd)}`)
    detailLines.push(`Volume 24h: ${formatCompactUsd(params.profile.volume24hUsd)}`)
    detailLines.push(`Vault: ${params.profile.vaultAddress ?? 'n/a'}`)
    detailLines.push(`Vault token: ${params.profile.shareTokenAddress ?? 'n/a'}`)
    detailLines.push(`Wallet: ${params.profile.canonicalCswAddress ?? 'n/a'}`)
    if (params.profile.zoraHandle) detailLines.push(`Zora: ${params.profile.zoraHandle}`)
  } else {
    detailLines.push('This Telegram user has not linked a 4626 account yet.')
  }

  return buildTelegramCommandChrome({
    title: 'AKITA | CREATOR',
    command: '/id',
    summaryLines,
    detailLines,
    expandableDetails: true,
  })
}

function buildTelegramPickedUserActionsReplyMarkup(profile: ResolvedTelegramPickerUserProfile | null): Record<string, unknown> | undefined {
  if (!profile?.vaultAddress && !profile?.creatorCoinAddress) return undefined
  const approvedToken = getTelegramApprovedInlineTokenByAddress(profile.creatorCoinAddress)
  const buyTargetAddress = approvedToken?.address ?? profile.creatorCoinAddress ?? profile.vaultAddress
  if (!buyTargetAddress) return undefined
  const buttons: Array<Record<string, unknown>> = [
    {
      text: approvedToken?.buyLabel ?? `Buy ${profile.creatorCoinSymbol ?? 'Creator'}`,
      callback_data: `tradeflow:v:buy:${buyTargetAddress}`,
    },
  ]
  if (approvedToken) {
    buttons.push({
      text: approvedToken.analyzeLabel,
      switch_inline_query_current_chat: buildTelegramAnalyzeInlineDraft(approvedToken),
    })
  } else if (profile.creatorCoinAddress) {
    buttons.push({ text: 'Analyze Token', switch_inline_query_current_chat: profile.creatorCoinAddress })
  }
  return {
    inline_keyboard: [buttons],
  }
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

async function resolveTelegramHomeState(params: {
  telegramUserId: string
  db?: Awaited<ReturnType<typeof getDb>> | null
}): Promise<TelegramHomeState> {
  const db = params.db ?? (await getDb())
  if (!db) return 'unlinked'
  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.telegramUserId })
  if (!link || link.linkStatus !== 'active') return 'unlinked'
  return link.ownerVerified ? 'ready' : 'pending'
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

  const homeState = await resolveTelegramHomeState({ telegramUserId: params.userId, db })
  if (homeState !== 'unlinked') {
    return {
      response: {
        text: buildStartLandingText({ state: homeState }),
        replyMarkup: buildStartReplyMarkup({ chatId: params.chatId, state: homeState }),
      },
      callbackToast: homeState === 'ready' ? 'Already connected' : 'Continue setup',
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

  const isLinkExisting = token === 'onboard:csw:link'
  const isCreateNew = token === 'onboard:csw:create'
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

function formatLinkStatusDetails(link: Awaited<ReturnType<typeof getTelegramLinkByUserId>>): string[] {
  if (!link) {
    return [
      '- linked: no',
      '- next: send /start in a private DM, tap Start, then continue in the Mini App. Telegram will attach after your 4626 account is verified.',
    ]
  }
  const walletSetup = link.linkStatus === 'active' && link.ownerVerified ? 'ready' : 'pending'
  return [
    `- linked: ${link.linkStatus === 'active' ? 'yes' : 'no'}`,
    `- wallet setup: ${walletSetup}`,
    `- profile: ${String(link.profileId)}`,
    `- canonical wallet: ${link.canonicalCswAddress}`,
    `- linked at: ${link.linkedAt ?? 'n/a'}`,
  ]
}

function formatLinkStatusText(link: Awaited<ReturnType<typeof getTelegramLinkByUserId>>): string {
  if (!link) {
    return buildTelegramCommandChrome({
      title: 'AKITA | LINK STATUS',
      command: '/linked',
      summaryLines: [
        'Not connected yet.',
        'Open the Mini App to link Telegram and finish wallet checks.',
      ],
      detailLines: formatLinkStatusDetails(link),
      expandableDetails: true,
    })
  }

  const summaryLines =
    link.linkStatus === 'active' && link.ownerVerified
      ? [
          'Telegram linked. Ready for bot actions.',
          `Canonical wallet: ${truncateAddress(link.canonicalCswAddress)}`,
        ]
      : [
          'Telegram linked. Wallet setup pending.',
          'Finish wallet confirmation before trading and wallet actions unlock.',
        ]

  return buildTelegramCommandChrome({
    title: 'AKITA | LINK STATUS',
    command: '/linked',
    summaryLines,
    detailLines: formatLinkStatusDetails(link),
    expandableDetails: true,
  })
}

function formatWalletText(summary: Awaited<ReturnType<typeof getTelegramPortfolioSummary>>): string {
  if (!summary) {
    return buildTelegramCommandChrome({
      title: 'AKITA | WALLET',
      command: '/wallet',
      summaryLines: [
        'Wallet is not linked yet.',
        'Finish onboarding, then open /wallet again.',
      ],
      detailLines: [
        '- linked: no',
        '- next: finish onboarding (/start → Start in DM), then /wallet again',
      ],
      expandableDetails: true,
    })
  }

  const details = [
    `- linked: yes (${summary.link.linkStatus})`,
    `- canonicalCSW: ${truncateAddress(summary.link.canonicalCswAddress)}`,
    `- buys: ${summary.buyCount}`,
    `- sells: ${summary.sellCount}`,
    `- bids: ${summary.bidCount}`,
    `- successfulActions: ${summary.successfulActions}`,
  ]
  if (summary.recentActions.length > 0) {
    details.push('', 'Recent:')
    for (const row of summary.recentActions) {
      details.push(`- ${row.actionType} ${row.status}${row.txHash ? ` (${truncateAddress(row.txHash)})` : ''}`)
    }
  } else {
    details.push('', 'Recent: none yet')
  }
  return buildTelegramCommandChrome({
    title: 'AKITA | WALLET',
    command: '/wallet',
    summaryLines: [
      `CSW ${truncateAddress(summary.link.canonicalCswAddress)}`,
      `Buys ${summary.buyCount} • Sells ${summary.sellCount} • Bids ${summary.bidCount}`,
    ],
    detailLines: details,
    expandableDetails: true,
  })
}

function buildWalletReplyMarkup(summary: Awaited<ReturnType<typeof getTelegramPortfolioSummary>>): Record<string, unknown> {
  if (!summary) {
    return {
      inline_keyboard: [[
        { text: menuLabel('connect'), callback_data: 'menu:connect' },
        { text: menuLabel('back'), callback_data: 'menu:start' },
      ]],
    }
  }

  return {
    inline_keyboard: [[{ text: menuLabel('back'), callback_data: 'menu:start' }]],
  }
}

function formatVaultsText(vaults: Awaited<ReturnType<typeof listTelegramScopedVaults>>): string {
  if (vaults.length === 0) {
    return buildTelegramCommandChrome({
      title: 'AKITA | VAULTS',
      command: '/vaults',
      summaryLines: ['No scoped vaults found for this chat.'],
    })
  }

  const lines: string[] = []
  for (const vault of vaults.slice(0, 8)) {
    const status = vault.isSettled ? 'settled' : 'active'
    lines.push(
      `- ${truncateAddress(vault.vaultAddress)} | coin ${truncateAddress(vault.creatorCoinAddress)} | ${status}`,
    )
  }
  const summaryLines = [
    `${vaults.length} scoped vault${vaults.length === 1 ? '' : 's'} available in this chat.`,
    vaults.length > 8 ? 'Showing the first 8 entries below.' : 'Tap to expand the scoped vault list.',
  ]
  return buildTelegramCommandChrome({
    title: 'AKITA | VAULTS',
    command: '/vaults',
    summaryLines,
    detailLines: lines,
    expandableDetails: true,
  })
}

function formatAuctionsText(auctions: Awaited<ReturnType<typeof listTelegramAuctions>>): string {
  if (auctions.length === 0) {
    return buildTelegramCommandChrome({
      title: 'AKITA | AUCTIONS',
      command: '/auctions',
      summaryLines: ['No CCA auctions are configured in scope right now.'],
    })
  }

  const lines: string[] = []
  for (const row of auctions.slice(0, 8)) {
    const status = row.isSettled ? 'settled' : 'available'
    lines.push(`- ${truncateAddress(row.vaultAddress)} -> ${truncateAddress(row.ccaStrategyAddress)} (${status})`)
  }
  const summaryLines = [
    `${auctions.length} scoped auction${auctions.length === 1 ? '' : 's'} found.`,
    auctions.length > 8 ? 'Showing the first 8 entries below.' : 'Tap to expand the auction list.',
  ]
  return buildTelegramCommandChrome({
    title: 'AKITA | AUCTIONS',
    command: '/auctions',
    summaryLines,
    detailLines: lines,
    expandableDetails: true,
  })
}

function formatSignalsText(
  params: {
    title: string
    command: string
    rows: Array<{ actionType: string; status: string; txHash?: string | null }>
  },
): string {
  if (params.rows.length === 0) {
    return buildTelegramCommandChrome({
      title: `AKITA | ${params.title.toUpperCase()}`,
      command: params.command,
      summaryLines: ['No recent entries yet.'],
    })
  }

  const lines: string[] = []
  for (const row of params.rows.slice(0, 8)) {
    lines.push(`- ${row.actionType} ${row.status}${row.txHash ? ` (${truncateAddress(row.txHash)})` : ''}`)
  }
  const summaryLines = [
    `${params.rows.length} recent entr${params.rows.length === 1 ? 'y' : 'ies'} found.`,
    params.rows.length > 8 ? 'Showing the first 8 entries below.' : 'Tap to expand the recent activity list.',
  ]
  return buildTelegramCommandChrome({
    title: `AKITA | ${params.title.toUpperCase()}`,
    command: params.command,
    summaryLines,
    detailLines: lines,
    expandableDetails: true,
  })
}

async function logTelegramActionAudit(params: Parameters<typeof logTelegramActionAuditShared>[0] & { botToken?: string }) {
  await logTelegramActionAuditShared(params)
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

function resolveTradeTargetAddress(params: {
  actionType: InteractiveTradeAction
  vault: ScopedVaultRow
}): `0x${string}` {
  if (params.actionType === 'buy' && isAddressLike(params.vault.creatorCoinAddress)) {
    return params.vault.creatorCoinAddress
  }
  if (isAddressLike(params.vault.vaultAddress)) {
    return params.vault.vaultAddress
  }
  throw new Error('Scoped vault is missing a valid vault address.')
}

function formatTradeTargetLabelFromVault(params: {
  actionType: InteractiveTradeAction
  vault: ScopedVaultRow
}): string {
  if (params.actionType === 'buy') {
    const approvedToken = getTelegramApprovedInlineTokenByAddress(params.vault.creatorCoinAddress)
    if (approvedToken) return `$${approvedToken.symbol}`
    if (isAddressLike(params.vault.creatorCoinAddress)) return truncateAddress(params.vault.creatorCoinAddress)
  }
  return truncateAddress(params.vault.vaultAddress)
}

function formatTradeTargetLabelFromAddresses(params: {
  actionType: 'buy' | 'sell' | 'bid'
  creatorCoinAddress?: string | null
  vaultAddress?: string | null
}): string {
  if (params.actionType === 'buy') {
    const approvedToken = getTelegramApprovedInlineTokenByAddress(params.creatorCoinAddress)
    if (approvedToken) return `$${approvedToken.symbol}`
    if (isAddressLike(params.creatorCoinAddress)) return truncateAddress(params.creatorCoinAddress)
  }
  if (isAddressLike(params.vaultAddress)) return truncateAddress(params.vaultAddress)
  if (isAddressLike(params.creatorCoinAddress)) return truncateAddress(params.creatorCoinAddress)
  return 'vault'
}

function resolveTradeSignalTargetAddress(params: {
  actionType: 'buy' | 'sell' | 'bid'
  creatorCoinAddress?: string | null
  vaultAddress?: string | null
}): string | undefined {
  if (params.actionType === 'buy' && isAddressLike(params.creatorCoinAddress)) {
    return params.creatorCoinAddress.toLowerCase()
  }
  if (isAddressLike(params.vaultAddress)) return params.vaultAddress.toLowerCase()
  if (isAddressLike(params.creatorCoinAddress)) return params.creatorCoinAddress.toLowerCase()
  return undefined
}

function buildTradeVaultPickerReplyMarkup(params: {
  actionType: InteractiveTradeAction
  scopedVaults: ScopedVaultRow[]
}): Record<string, unknown> {
  if (params.actionType === 'buy') {
    const approvedVaults = filterTelegramApprovedTradeVaults(params.scopedVaults).slice(0, 12)
    if (approvedVaults.length > 0) {
      return {
        inline_keyboard: [
          ...approvedVaults.map((vault) => ([
            {
              text: vault.approvedToken.buyLabel,
              callback_data: `tradeflow:v:${params.actionType}:${vault.approvedToken.address}`,
            },
            {
              text: vault.approvedToken.analyzeLabel,
              switch_inline_query_current_chat: buildTelegramAnalyzeInlineDraft(vault.approvedToken),
            },
          ])),
          [{ text: 'Back', callback_data: 'menu:start' }],
        ],
      }
    }
  }
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
          identifier: resolveTradeTargetAddress({
            actionType: 'buy',
            vault: params.vault,
          }),
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
  const vaultDeployIntent = parseTelegramVaultDeployIntent(params.text)

  if (head === 'id' || head === 'getid' || head === 'get_id' || (head === 'start' && isTelegramIdPickerStartCommand(params.text))) {
    if (!isPrivateChatId(params.chatId)) {
      return {
        text: buildTelegramCommandChrome({
          title: 'AKITA | TELEGRAM ID',
          command: '/id',
          summaryLines: ['The native ID picker only works in a private chat with this bot.'],
          detailLines: ['Open the bot DM and send /id there.', 'If you came from a group, return after copying the user or chat ID you need.'],
        }),
      }
    }
    return {
      text: buildTelegramIdPickerText(),
      replyMarkup: buildTelegramIdPickerReplyMarkup(),
    }
  }

  if (head === 'start') {
    const homeState = await resolveTelegramHomeState({
      telegramUserId: params.userId,
      db: params.db,
    })
    if (homeState === 'unlinked' && isPrivateChatId(params.chatId)) {
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
    if (homeState === 'unlinked' && !isPrivateChatId(params.chatId)) {
      return {
        text: buildUnlinkedGroupStartLandingText(),
        replyMarkup: buildStartReplyMarkup({ chatId: params.chatId, state: 'unlinked' }),
      }
    }
    const linkedHomeState: Exclude<TelegramHomeState, 'unlinked'> = homeState === 'ready' ? 'ready' : 'pending'
    return {
      text: buildStartLandingText({ state: linkedHomeState }),
      replyMarkup: buildStartReplyMarkup({ chatId: params.chatId, state: linkedHomeState }),
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
    const homeState = await resolveTelegramHomeState({ telegramUserId: params.userId, db: db ?? undefined })
    if (homeState !== 'unlinked') {
      return buildTelegramLinkFlowResponse({
        chatId: params.chatId,
        telegramUserId: params.userId,
        linkButtonText: homeState === 'pending' ? 'Finish Wallet Setup' : 'Refresh Connect',
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
    if (head === 'vaults') {
      return { text: ['Vaults', '', '- unavailable while database is offline'].join('\n') }
    }
    if (head === 'auctions') {
      return { text: ['Auctions', '', '- unavailable while database is offline'].join('\n') }
    }
    if (head === 'mybids') {
      return { text: ['My Bids', '', '- unavailable while database is offline'].join('\n') }
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
    if (head === 'vaultdeploy') {
      if (!vaultDeployIntent || vaultDeployIntent.kind === 'menu') {
        return {
          text: formatVaultDeployUsageText(),
        }
      }
      if (vaultDeployIntent.kind === 'usage') {
        return {
          text: vaultDeployIntent.text,
        }
      }
      return {
        text: [
          'Vault Deploy',
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

  if (head === 'vaultdeploy') {
    if (!vaultDeployIntent || vaultDeployIntent.kind === 'menu') {
      return {
        text: formatVaultDeployUsageText(),
      }
    }
    if (vaultDeployIntent.kind === 'usage') {
      return {
        text: vaultDeployIntent.text,
      }
    }

    const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
    if (!link || link.linkStatus !== 'active') {
      return {
        text: [
          'Vault Deploy blocked',
          '',
          '- link required: run /link first',
          '- after linking, retry /vaultdeploy',
        ].join('\n'),
      }
    }
    if (!link.ownerVerified) {
      return {
        text: [
          'Vault Deploy blocked',
          '',
          '- wallet setup pending',
          '- run /linked, finish wallet confirmation, then retry',
        ].join('\n'),
      }
    }

    const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
    if (!canonicalSenderWallet) {
      return {
        text: [
          'Vault Deploy blocked',
          '',
          '- canonical wallet is unavailable',
          '- relink your account and retry',
        ].join('\n'),
      }
    }

    const creatorToken = getAddress('0x5b674196812451B7cEC024FE9d22D2c0b172fa75')
    const intentPayload: Record<string, unknown> = {
      deployType: 'vault',
      token: vaultDeployIntent.token,
      version: vaultDeployIntent.version,
      creatorToken,
      smartWallet: canonicalSenderWallet,
      createdAt: new Date().toISOString(),
    }

    const token = await createTelegramActionToken({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      actionType: 'vault_deploy',
      intentPayload,
      ttlSeconds: 60 * 5,
    })

    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: 'vault_deploy',
      intent: intentPayload,
      execution: {
        mode: 'preview',
        commandText: `/vaultdeploy ${vaultDeployIntent.token} ${vaultDeployIntent.version}`,
      },
      status: 'previewed',
    })

    return {
      text: formatVaultDeployPreviewText({
        version: vaultDeployIntent.version,
        creatorToken,
        smartWallet: canonicalSenderWallet,
        expiresAt: token.expiresAt,
      }),
      replyMarkup: buildVaultDeployPreviewReplyMarkup(token.token),
    }
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
          '- wallet setup pending',
          '- run /linked, finish wallet confirmation, then retry',
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
    const typedIdentifier = tradeIntent ? asTrimmed(tradeIntent.identifier).toLowerCase() : ''
    const allowNonAddressTradeArgs = Boolean(
      hasArgs && !params.allowTradeArgs && tradeIntent && typedIdentifier && !isAddressLike(typedIdentifier),
    )
    if (hasArgs && !params.allowTradeArgs && !allowNonAddressTradeArgs) {
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
            '- wallet setup pending',
            '- run /linked, finish wallet confirmation, then retry',
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
      const approvedBuyVaults = actionType === 'buy' ? filterTelegramApprovedTradeVaults(scopedVaults) : scopedVaults
      if (approvedBuyVaults.length === 0) {
        return {
          text: [
            'Trade blocked',
            '',
            actionType === 'buy'
              ? `- no approved tokens are currently scoped for this chat (${TELEGRAM_APPROVED_INLINE_TOKENS.map((token) => `$${token.symbol}`).join(', ')})`
              : '- no vaults are currently scoped for this chat',
            actionType === 'buy'
              ? '- ask an admin to scope an approved token for this chat'
              : '- ask an admin to configure telegram_chat_vault_scope',
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
        text:
          flowStartState.actionType === 'buy' && approvedBuyVaults.length > 0
            ? 'Step 1/3 • Pick an approved token to BUY'
            : `Step 1/3 • Pick a vault to ${flowStartState.actionType.toUpperCase()}`,
        replyMarkup: buildTradeVaultPickerReplyMarkup({
          actionType: flowStartState.actionType,
          scopedVaults: approvedBuyVaults,
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
          '- wallet setup pending',
          '- run /linked, finish wallet confirmation, then retry',
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

    const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
    if (!canonicalSenderWallet) {
      return {
        text: [
          'Join Room',
          '',
          '- canonical wallet is unavailable for this link',
          '- run /linked to verify wallet setup, then retry',
        ].join('\n'),
      }
    }

    const shareToken = isAddressLike(target.creatorCoinAddress)
      ? target.creatorCoinAddress.toLowerCase()
      : target.vaultAddress.toLowerCase()
    const eligibility = await checkSharesEligibility({
      wallet: canonicalSenderWallet as Address,
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
      canonicalCswAddress: canonicalSenderWallet,
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
        linkButtonText: 'Finish Wallet Setup',
      })
      return {
        text: [
          formatLinkStatusText(link),
          '',
          'Wallet setup is still pending.',
          'Use Finish Wallet Setup below to complete wallet confirmation for bot actions.',
        ].join('\n'),
        replyMarkup: relinkFlow.replyMarkup,
      }
    }
    return {
      text: [
        formatLinkStatusText(link),
        '',
        'Ready for bot actions.',
        'Use /start to open Wallet, Trade, or Explore.',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [{ text: 'Open Start Menu', callback_data: 'menu:start' }],
          [{ text: menuLabel('help'), callback_data: 'menu:topics' }],
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
    return {
      text: formatWalletText(summary),
      replyMarkup: buildWalletReplyMarkup(summary),
    }
  }

  if (head === 'vaults') {
    const vaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId })
    return { text: formatVaultsText(vaults) }
  }

  if (head === 'auctions') {
    const auctions = await listTelegramAuctions({ db: db as any, chatId: params.chatId })
    return { text: formatAuctionsText(auctions) }
  }

  if (head === 'mybids') {
    const bids = await listTelegramUserBids({ db: db as any, telegramUserId: params.userId })
    return {
      text: formatSignalsText({
        title: 'My Bids',
        command: '/mybids',
        rows: bids,
      }),
    }
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
          '- wallet setup pending',
          '- run /linked, finish wallet confirmation, then retry',
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
    const resolvedTradeIdentifier = await resolveTradeIdentifier({ identifier: tradeIntent.identifier })
    const target = resolveTradeTarget(scopedVaults, resolvedTradeIdentifier.identifier)
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_identifier_profile_resolution',
      actionType: tradeIntent.actionType,
      context: {
        identifierInput: tradeIntent.identifier,
        identifierResolved: resolvedTradeIdentifier.identifier,
        profileLookupAttempted: resolvedTradeIdentifier.profileLookupAttempted,
        profileLookupHit: resolvedTradeIdentifier.profileLookupHit,
      },
    })
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

    const targetLabel = formatTradeTargetLabelFromVault({
      actionType: tradeIntent.actionType,
      vault: target,
    })

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
      identifierInput: tradeIntent.identifier,
      identifierResolved: resolvedTradeIdentifier.identifier,
      identifierResolvedViaProfile: resolvedTradeIdentifier.profileLookupHit,
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
        identifierInput: tradeIntent.identifier,
        identifierResolved: resolvedTradeIdentifier.identifier,
        identifierResolvedViaProfile: resolvedTradeIdentifier.profileLookupHit,
      },
    })

    return {
      text: formatTradePreviewText({
        actionType: tradeIntent.actionType,
        targetLabel,
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
  let target = resolveTradeTarget(scopedVaults, callback.vaultAddress)
  if (!target && callback.actionType !== 'buy' && isPrivateChatId(params.chatId)) {
    target = mapKeeprVaultRowToScopedVault(await getKeeprVaultByVaultAddress(callback.vaultAddress))
  }
  if (!target) {
    return {
      text: [
        'Trade flow',
        '',
        callback.actionType === 'buy'
          ? '- selected token is no longer available in this chat scope'
          : '- selected vault is no longer available in this chat scope',
        '- run /vaults and start again',
      ].join('\n'),
      callbackToast: callback.actionType === 'buy' ? 'Token unavailable' : 'Vault unavailable',
    }
  }

  const targetLabel = formatTradeTargetLabelFromVault({
    actionType: callback.actionType,
    vault: target,
  })
  const targetNoun = callback.actionType === 'buy' ? 'Token' : 'Vault'

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
      text: `Step 2/3 • Pick size for ${tradeFlowState.actionType.toUpperCase()} ${targetLabel}`,
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
        `${targetNoun}: ${targetLabel}`,
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
        '- wallet setup pending',
        '- run /linked, finish wallet confirmation, then retry',
      ].join('\n'),
      callbackToast: 'Wallet setup pending',
    }
  }

  const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
  if (!canonicalSenderWallet) {
    return {
      text: [
        'Trade blocked',
        '',
        '- canonical wallet is unavailable for this link',
        '- run /linked and confirm wallet setup, then retry',
      ].join('\n'),
      callbackToast: 'Canonical wallet missing',
    }
  }

  const intentResult = await buildTradeIntentFromPercent({
    actionType: tradeFlowState.actionType,
    vault: target,
    canonicalCswAddress: canonicalSenderWallet,
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
      scopedVaults: resolveTradeTarget(scopedVaults, callback.vaultAddress) ? scopedVaults : [target],
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
  const target = resolveTradeTarget(scopedVaults, prompt.vaultAddress)
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
        prompt.actionType === 'buy'
          ? '- the selected token is no longer available in this chat scope'
          : '- the selected vault is no longer available in this chat scope',
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
        '- Telegram link and wallet setup are required',
        '- run /link, then /linked to finish wallet confirmation, then retry',
      ].join('\n'),
    }
  }

  const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
  if (!canonicalSenderWallet) {
    return {
      text: [
        'Trade blocked',
        '',
        '- canonical wallet is unavailable for this link',
        '- run /linked and confirm wallet setup, then retry',
      ].join('\n'),
      replyMarkup: buildTradeCustomPercentReplyMarkup({
        actionType: tradeFlowState.actionType,
        vaultAddress: prompt.vaultAddress as `0x${string}`,
      }),
    }
  }

  const intentResult = await buildTradeIntentFromPercent({
    actionType: tradeFlowState.actionType,
    vault: target,
    canonicalCswAddress: canonicalSenderWallet,
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
  void chatId
  return [
    'Zora Sign Up',
    '',
    '1) Run `/link` if your Telegram account is not linked yet',
    '2) Open 4626 on the web',
    '3) Go to Accounts and use "Link Zora"',
  ].join('\n')
}

function buildTelegramZoraResponse(chatId: string): TelegramCommandResponse {
  return {
    text: formatTelegramZoraText(chatId),
    replyMarkup: {
      inline_keyboard: [
        [{ text: menuLabel('connect'), callback_data: 'menu:connect' }],
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

function buildVaultDeployPreviewReplyMarkup(token: string): Record<string, unknown> {
  return buildVaultDeployPreviewReplyMarkupShared(token)
}

function formatVaultDeployPreviewText(params: {
  version: string
  creatorToken: `0x${string}`
  smartWallet: `0x${string}`
  expiresAt: string
}): string {
  return formatVaultDeployPreviewTextShared(params)
}

function formatVaultDeployTokenFailure(reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'): string {
  return formatVaultDeployTokenFailureShared(reason)
}

type VaultDeployStatusSnapshot = {
  sessionId: string
  step: string
  lastError: string | null
  lastUserOpHash: string | null
  lastTxHash: string | null
  contracts: VaultDeployContracts
  phase1Done: boolean
  phase2CoreDone: boolean
  phase2FinalizeDone: boolean
  phase4Done: boolean
  terminal: boolean
}

function isStepIn(step: string, values: string[]): boolean {
  const normalized = asTrimmed(step).toLowerCase()
  return values.includes(normalized)
}

function isPhase1Complete(step: string): boolean {
  return isStepIn(step, [
    'phase1_confirmed',
    'phase1_finalize_sent',
    'phase1_finalize_confirmed',
    'phase2_core_sent',
    'phase2_core_confirmed',
    'phase2_sent',
    'phase2_confirmed',
    'ovault_mesh_sent',
    'ovault_mesh_confirmed',
    'phase3_sent',
    'phase3_confirmed',
    'phase4_sent',
    'phase4_confirmed',
    'cleanup_sent',
    'completed',
  ])
}

function isPhase2CoreComplete(step: string, replaySkip: boolean): boolean {
  if (replaySkip) return true
  return isStepIn(step, [
    'phase2_core_confirmed',
    'phase2_sent',
    'phase2_confirmed',
    'ovault_mesh_sent',
    'ovault_mesh_confirmed',
    'phase3_sent',
    'phase3_confirmed',
    'phase4_sent',
    'phase4_confirmed',
    'cleanup_sent',
    'completed',
  ])
}

function isPhase2FinalizeComplete(step: string, replaySkip: boolean): boolean {
  if (replaySkip) return true
  return isStepIn(step, [
    'phase2_confirmed',
    'ovault_mesh_sent',
    'ovault_mesh_confirmed',
    'phase3_sent',
    'phase3_confirmed',
    'phase4_sent',
    'phase4_confirmed',
    'cleanup_sent',
    'completed',
  ])
}

function isPhase4Complete(step: string): boolean {
  return isStepIn(step, ['phase4_confirmed', 'cleanup_sent', 'completed'])
}

function toBasescanAddressUrl(address: string): string {
  return `https://basescan.org/address/${address}`
}

function toBasescanTxUrl(hash: string): string {
  return `https://basescan.org/tx/${hash}`
}

function truncateHash(value: string): string {
  const v = asTrimmed(value)
  if (!/^0x[a-fA-F0-9]{64}$/.test(v)) return v
  return `${v.slice(0, 10)}…${v.slice(-8)}`
}

function resolveVaultDeployContractsFromIntent(params: {
  intent: Record<string, unknown>
  launchImage?: { shareOft?: string | null; vaultAddress?: string | null } | null
}): VaultDeployContracts {
  const raw = (params.intent.predictedContracts as Record<string, unknown> | null) ?? null
  const normalize = (value: unknown): `0x${string}` | null => {
    if (typeof value !== 'string') return null
    try {
      return getAddress(value as Address)
    } catch {
      return null
    }
  }
  const creatorToken =
    normalize(raw?.creatorToken ?? params.intent.creatorToken) ?? getAddress('0x5b674196812451B7cEC024FE9d22D2c0b172fa75')
  const launchVault = normalize(params.launchImage?.vaultAddress ?? null)
  const launchShareOft = normalize(params.launchImage?.shareOft ?? null)
  return {
    creatorToken,
    vault: launchVault ?? normalize(raw?.vault) ?? null,
    wrapper: normalize(raw?.wrapper) ?? null,
    shareOFT: launchShareOft ?? normalize(raw?.shareOFT) ?? null,
    gaugeController: normalize(raw?.gaugeController) ?? null,
    ccaStrategy: normalize(raw?.ccaStrategy) ?? null,
    oracle: normalize(raw?.oracle) ?? null,
  }
}

function formatVaultDeployContractRow(params: {
  label: string
  address: string | null
  done: boolean
}): string {
  if (!params.address) return `${params.done ? '✅' : '⬜'} ${params.label}: pending`
  return `${params.done ? '✅' : '⬜'} <a href="${toBasescanAddressUrl(params.address)}">${params.label}</a> <code>${truncateAddress(params.address)}</code>`
}

function buildVaultDeployStatusCard(snapshot: VaultDeployStatusSnapshot): string {
  const lines = [
    '<b>AKITA Deploy</b>',
    '',
    `Session: <code>${snapshot.sessionId}</code>`,
    `Step: <code>${snapshot.step}</code>`,
    '',
    '<u>Contracts</u>',
    formatVaultDeployContractRow({ label: 'Vault', address: snapshot.contracts.vault, done: snapshot.phase1Done }),
    formatVaultDeployContractRow({ label: 'Wrapper', address: snapshot.contracts.wrapper, done: snapshot.phase1Done }),
    formatVaultDeployContractRow({ label: 'ShareOFT', address: snapshot.contracts.shareOFT, done: snapshot.phase1Done }),
    formatVaultDeployContractRow({
      label: 'Gauge',
      address: snapshot.contracts.gaugeController,
      done: snapshot.phase2CoreDone,
    }),
    formatVaultDeployContractRow({
      label: 'CCA Strategy',
      address: snapshot.contracts.ccaStrategy,
      done: snapshot.phase2CoreDone,
    }),
    formatVaultDeployContractRow({
      label: 'Oracle',
      address: snapshot.contracts.oracle,
      done: snapshot.phase2CoreDone,
    }),
    '',
    '<u>Pipeline</u>',
    `${snapshot.phase2FinalizeDone ? '✅' : '⬜'} Phase 2 finalize`,
    `${snapshot.phase4Done ? '✅' : '⬜'} Deferred auction launch`,
  ]
  if (snapshot.lastUserOpHash) {
    lines.push(`UserOp: <a href="${toBasescanTxUrl(snapshot.lastUserOpHash)}">${truncateHash(snapshot.lastUserOpHash)}</a>`)
  }
  if (snapshot.lastTxHash) {
    lines.push(`Tx: <a href="${toBasescanTxUrl(snapshot.lastTxHash)}">${truncateHash(snapshot.lastTxHash)}</a>`)
  }
  if (snapshot.lastError) {
    lines.push('')
    lines.push(`<b>Error:</b> <code>${snapshot.lastError}</code>`)
  }
  if (!snapshot.terminal) {
    lines.push('')
    lines.push('Tap <b>Refresh Status</b> to update checks.')
  }
  return lines.join('\n')
}

function buildVaultDeployStatusReplyMarkup(params: {
  refreshToken?: string | null
  terminal: boolean
  txHash?: string | null
}): Record<string, unknown> | undefined {
  const rows: Array<Array<Record<string, unknown>>> = []
  if (!params.terminal && params.refreshToken) {
    rows.push([{ text: 'Refresh Status', callback_data: `vaultdeploy:status:${params.refreshToken}` }])
  }
  if (params.txHash) {
    rows.push([{ text: 'Open Tx', url: toBasescanTxUrl(params.txHash) }])
  }
  if (rows.length === 0) return undefined
  return { inline_keyboard: rows }
}

async function buildVaultDeployStatusSnapshot(params: {
  canonicalSmartWallet: `0x${string}`
  sessionId: string
  intent: Record<string, unknown>
}): Promise<VaultDeployStatusSnapshot | null> {
  const status = await fetchVaultDeployStatusFromTelegram({
    canonicalSmartWallet: params.canonicalSmartWallet,
    sessionId: params.sessionId,
  })
  if (!status.ok) return null
  const step = asTrimmed(String(status.data.step ?? '')).toLowerCase() || 'unknown'
  const replay = status.data.diagnostics?.replay
  const contracts = resolveVaultDeployContractsFromIntent({
    intent: params.intent,
    launchImage: status.data.launchImage ?? null,
  })
  const phase1Done = isPhase1Complete(step)
  const phase2CoreDone = isPhase2CoreComplete(step, replay?.phase2CoreSkipRecorded === true)
  const phase2FinalizeDone = isPhase2FinalizeComplete(step, replay?.phase2FinalizeSkipRecorded === true)
  const phase4Done = isPhase4Complete(step)
  const terminal = isStepIn(step, ['completed', 'failed', 'cancelled'])
  return {
    sessionId: asTrimmed(String(status.data.id ?? params.sessionId)) || params.sessionId,
    step,
    lastError: asTrimmed(String(status.data.lastError ?? '')) || null,
    lastUserOpHash: asTrimmed(String(status.data.lastUserOpHash ?? '')) || null,
    lastTxHash: asTrimmed(String(status.data.lastTxHash ?? '')) || null,
    contracts,
    phase1Done,
    phase2CoreDone,
    phase2FinalizeDone,
    phase4Done,
    terminal,
  }
}

async function handleTelegramVaultDeployCallback(params: {
  callbackData: string
  chatId: string
  userId: string
  messageId?: number
}): Promise<TelegramCommandResponse | null> {
  const callback = parseVaultDeployCallbackData(params.callbackData)
  if (!callback) return null

  const db = await getDb()
  if (!db) {
    return {
      text: 'Vault deploy action unavailable while database is offline. Please retry in a few seconds.',
      callbackToast: 'Temporarily unavailable',
    }
  }

  await ensureWaitlistSchema(db as any)
  await ensureKeeprSchema()
  await ensureTelegramTradingSchema(db as any)

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
        'Vault Deploy blocked',
        '',
        '- account link is no longer active/verified',
        '- run /linked and /link again if needed',
      ].join('\n'),
      callbackToast: 'Reconnect required',
      replyMarkup: relinkFlow.replyMarkup,
    }
  }

  const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
  if (!canonicalSenderWallet) {
    return {
      text: 'Vault Deploy blocked: canonical wallet is not available.',
      callbackToast: 'Canonical wallet missing',
    }
  }

  if (callback.kind === 'status') {
    const consumedStatus = await consumeTelegramActionToken({
      db: db as any,
      token: callback.token,
      telegramUserId: params.userId,
      chatId: params.chatId,
      actionType: 'vault_deploy_status',
    })
    if (!consumedStatus.ok) {
      const callbackToast =
        consumedStatus.reason === 'expired'
          ? 'Status token expired'
          : consumedStatus.reason === 'consumed'
            ? 'Already refreshed'
            : consumedStatus.reason === 'scope_mismatch'
              ? 'Wrong chat scope'
              : 'Status token missing'
      return {
        text: formatVaultDeployTokenFailure(consumedStatus.reason),
        callbackToast,
      }
    }

    const intent = consumedStatus.intentPayload ?? {}
    const sessionId = asTrimmed(String(intent.sessionId ?? ''))
    if (!sessionId) {
      return {
        text: 'Vault deploy status token is missing a session id. Start a new deploy preview.',
        callbackToast: 'Invalid status token',
      }
    }

    const snapshot = await buildVaultDeployStatusSnapshot({
      canonicalSmartWallet: canonicalSenderWallet,
      sessionId,
      intent,
    })
    if (!snapshot) {
      return {
        text: [
          'Vault Deploy status failed',
          '',
          '- unable to fetch deploy-session status right now',
          '- tap refresh again in a few seconds',
        ].join('\n'),
        callbackToast: 'Status unavailable',
      }
    }

    let refreshToken: string | null = null
    if (!snapshot.terminal) {
      const nextIntent = {
        ...intent,
        sessionId: snapshot.sessionId,
        predictedContracts: snapshot.contracts,
        updatedAt: new Date().toISOString(),
      }
      const nextToken = await createTelegramActionToken({
        db: db as any,
        telegramUserId: params.userId,
        chatId: params.chatId,
        actionType: 'vault_deploy_status',
        intentPayload: nextIntent,
        ttlSeconds: 60 * 15,
      })
      refreshToken = nextToken.token
    }

    return {
      text: buildVaultDeployStatusCard(snapshot),
      replyMarkup: buildVaultDeployStatusReplyMarkup({
        refreshToken,
        terminal: snapshot.terminal,
        txHash: snapshot.lastTxHash,
      }),
      callbackToast: snapshot.terminal ? 'Deployment finalized' : 'Status updated',
    }
  }

  const consumed = await consumeTelegramActionToken({
    db: db as any,
    token: callback.token,
    telegramUserId: params.userId,
    chatId: params.chatId,
    actionType: 'vault_deploy',
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
      text: formatVaultDeployTokenFailure(consumed.reason),
      callbackToast,
    }
  }

  const intent = consumed.intentPayload ?? {}
  const version = asTrimmed(String(intent.version ?? 'v1.7.1')) || 'v1.7.1'

  if (callback.kind === 'decline') {
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: 'vault_deploy',
      intent,
      status: 'cancelled',
    })
    return {
      text: 'Declined AKITA deploy preview.',
      callbackToast: 'Vault deploy declined',
    }
  }

  const started = await startAkitaVaultDeployFromTelegram({
    canonicalSmartWallet: canonicalSenderWallet,
    version,
  })
  const status = started.ok ? 'executed' : 'failed'
  await logTelegramActionAudit({
    db: db as any,
    telegramUserId: params.userId,
    chatId: params.chatId,
    messageId: params.messageId,
    profileId: link.profileId,
    canonicalCswAddress: link.canonicalCswAddress,
    actionType: 'vault_deploy',
    intent,
    execution: {
      mode: 'deploy_session_start',
      commandText: `/vaultdeploy akita ${version}`,
      details: started.ok ? started.data : null,
    },
    status,
    errorMessage: started.ok ? null : started.error,
  })

  if (!started.ok) {
    return {
      text: [
        'Vault Deploy failed • AKITA',
        '',
        `- status: ${started.status}`,
        `- reason: ${started.error}`,
        '- retry `/vaultdeploy akita v1.7.1`',
      ].join('\n'),
      callbackToast: 'Vault deploy failed',
    }
  }

  const data = started.data
  const sessionId = asTrimmed(String(data.sessionId ?? ''))
  if (!sessionId) {
    return {
      text: 'Vault Deploy started but no session id was returned. Please retry.',
      callbackToast: 'Session missing',
    }
  }

  const statusIntent = {
    token: 'akita',
    version,
    sessionId,
    creatorToken: intent.creatorToken ?? getAddress('0x5b674196812451B7cEC024FE9d22D2c0b172fa75'),
    smartWallet: canonicalSenderWallet,
    predictedContracts: data.predictedContracts ?? null,
    createdAt: new Date().toISOString(),
  }

  const snapshot = await buildVaultDeployStatusSnapshot({
    canonicalSmartWallet: canonicalSenderWallet,
    sessionId,
    intent: statusIntent,
  })
  const effectiveSnapshot: VaultDeployStatusSnapshot = snapshot ?? {
    sessionId,
    step: asTrimmed(String(data.nextAction ?? 'manual_continue')) || 'manual_continue',
    lastError: null,
    lastUserOpHash: null,
    lastTxHash: null,
    contracts: data.predictedContracts ?? resolveVaultDeployContractsFromIntent({ intent: statusIntent }),
    phase1Done: false,
    phase2CoreDone: false,
    phase2FinalizeDone: false,
    phase4Done: false,
    terminal: false,
  }

  let refreshToken: string | null = null
  if (!effectiveSnapshot.terminal) {
    const refresh = await createTelegramActionToken({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      actionType: 'vault_deploy_status',
      intentPayload: statusIntent,
      ttlSeconds: 60 * 15,
    })
    refreshToken = refresh.token
  }

  return {
    text: buildVaultDeployStatusCard(effectiveSnapshot),
    replyMarkup: buildVaultDeployStatusReplyMarkup({
      refreshToken,
      terminal: effectiveSnapshot.terminal,
      txHash: effectiveSnapshot.lastTxHash,
    }),
    callbackToast: 'Vault deploy started',
  }
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

  const execution = await executeDeterministicCommand({
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
    errorMessage: execution.ok ? null : asTrimmed(execution.rawResponseText),
  })
  if (execution.ok) {
    return {
      text: [
        `Deploy sent • ${deployBuild.deployLabel}`,
        '',
        execution.responseText,
      ].join('\n'),
      callbackToast: 'Deploy sent',
    }
  }
  return {
    text: [
      `Deploy failed • ${deployBuild.deployLabel}`,
      '',
      execution.responseText || 'Execution failed. Retry with a fresh deploy preview.',
    ].join('\n'),
    callbackToast: 'Deploy failed',
    replyMarkup: buildDeployMenuReplyMarkup(),
  }
}

function buildPremiumObservedCommandText(commandText: string, responseText: string): string | null {
  const normalized = asTrimmed(commandText).toLowerCase()
  const detailLines = responseText.split('\n').map((line) => line.trimEnd())
  if (normalized === '/cre status') {
    return buildTelegramCommandChrome({
      title: 'AKITA | CRE STATUS',
      command: '/cre status',
      summaryLines: [
        'Vault keeper snapshot.',
        'Idle funds, tend cadence, and latest report state.',
      ],
      detailLines,
      expandableDetails: true,
    })
  }
  if (normalized === '/cre auction') {
    return buildTelegramCommandChrome({
      title: 'AKITA | CRE AUCTIONS',
      command: '/cre auction',
      summaryLines: [
        'CCA auction snapshot.',
        'Settlement and graduation state across scoped vaults.',
      ],
      detailLines,
      expandableDetails: true,
    })
  }
  if (normalized === '/cre solana') {
    return buildTelegramCommandChrome({
      title: 'AKITA | SOLANA',
      command: '/cre solana',
      summaryLines: [
        'Solana bridge and relay snapshot.',
        'Price deviation, entries, and fee path health.',
      ],
      detailLines,
      expandableDetails: true,
    })
  }
  if (normalized === '/cre health') {
    return buildTelegramCommandChrome({
      title: 'AKITA | CRE HEALTH',
      command: '/cre health',
      summaryLines: [
        'Combined keeper health check.',
        'Cross-chain readiness and operator attention points.',
      ],
      detailLines,
      expandableDetails: true,
    })
  }
  return null
}

function resolveTelegramMediaFromAction(action: any): TelegramCommandResponse['media'] | undefined {
  const media = action?.telegramMedia
  if (!media || media.kind !== 'photo' || !(media.bytes instanceof Uint8Array)) return undefined
  return {
    kind: 'photo',
    bytes: media.bytes,
    ...(typeof media.contentType === 'string' ? { contentType: media.contentType } : {}),
    ...(typeof media.filename === 'string' ? { filename: media.filename } : {}),
    ...(typeof media.caption === 'string' ? { caption: media.caption } : {}),
    ...(media.replyMarkup && typeof media.replyMarkup === 'object' ? { replyMarkup: media.replyMarkup } : {}),
    ...(media.suppressText === true ? { suppressText: true } : {}),
  }
}

async function resolveTelegramReplyMarkupFromAction(params: {
  action: unknown
  chatId: string
  userId: string
}): Promise<Record<string, unknown> | undefined> {
  const action = params.action as any
  if (asTrimmed(action?.action ?? '') !== 'twitter.preview_post') return undefined

  const tweetText = asTrimmed(action?.tweetText ?? '')
  if (!tweetText) return buildTwitterPostRecoveryReplyMarkup()

  const db = await getDb().catch(() => null)
  if (!db) return buildTwitterPostRecoveryReplyMarkup(tweetText)

  try {
    await ensureTelegramTradingSchema(db as any)
    const token = await createTelegramActionToken({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      actionType: 'twitter_post',
      intentPayload: {
        version: 1,
        tweetText,
        createdAt: new Date().toISOString(),
      },
      ttlSeconds: Math.max(30, Math.min(60 * 15, Math.floor(Number(action?.ttlSeconds ?? 90)))),
    })
    return buildTwitterPostPreviewReplyMarkup(token.token)
  } catch (error) {
    console.error('[telegram/webhook] failed to create twitter action token', {
      chatId: params.chatId,
      userId: params.userId,
      err: error instanceof Error ? error.message : String(error),
    })
    return buildTwitterPostRecoveryReplyMarkup(tweetText)
  }
}

async function executeTelegramCommand(params: {
  text: string
  chatId: string
  userId: string
  groupId: string
  senderWallet: `0x${string}`
  senderWalletSource: SenderWalletSource
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

  if (isOperatorCommand(params.text) && !params.isAdmin) {
    const homeState = await resolveTelegramHomeState({ telegramUserId: params.userId })
    return buildOperatorAccessDeniedResponse({
      chatId: params.chatId,
      homeState,
    })
  }

  const processed = await processTelegramAgentInput({
    text: params.text,
    chatId: params.chatId,
    userId: params.userId,
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    senderWalletSource: params.senderWalletSource,
    isAdmin: params.isAdmin,
    isPrivateChat: isPrivateChatId(params.chatId),
    twitterConfirmMode: 'preview_only',
    emptyResponseFallback: 'Command received.',
  })
  const response: TelegramCommandResponse = buildTelegramProcessedCommandResponse({
    commandText: params.text,
    processed,
    buildObservedCommandText: buildPremiumObservedCommandText,
    resolveMediaFromAction: resolveTelegramMediaFromAction,
  })
  if (!response.media?.replyMarkup) {
    response.replyMarkup = await resolveTelegramReplyMarkupFromAction({
      action: processed.action,
      chatId: params.chatId,
      userId: params.userId,
    })
  }
  return response
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
  const targetNoun = params.actionType === 'buy' ? 'Token' : 'Vault'
  const lines = [`✅ Trade Signal • ${params.actionType.toUpperCase()}`, '', `${targetNoun}: ${params.targetLabel}`]

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
  const keyboard: Array<Array<Record<string, unknown>>> = [[reuseButton, { text: 'Open Wallet', callback_data: 'menu:wallet' }]]
  return {
    inline_keyboard: keyboard,
  }
}

async function appendControlAuditBestEffort(
  params: Parameters<typeof appendControlAuditEvent>[0],
): Promise<void> {
  await appendControlAuditEvent(params).catch(() => undefined)
}

function resolveTradeAmountForPolicy(params: {
  actionType: 'buy' | 'sell' | 'bid'
  amountInput: string
  amountEth: number
  usdEstimate: number
}): { unit: string; value: number } | undefined {
  if (params.actionType === 'buy') {
    if (Number.isFinite(params.amountEth) && params.amountEth > 0) {
      return { unit: 'eth', value: params.amountEth }
    }
    const amountInput = Number(params.amountInput)
    if (Number.isFinite(amountInput) && amountInput > 0) {
      return { unit: 'eth', value: amountInput }
    }
    return undefined
  }
  if (params.actionType === 'sell') {
    const amountInput = Number(params.amountInput)
    if (Number.isFinite(amountInput) && amountInput > 0) {
      return { unit: 'shares', value: amountInput }
    }
    return undefined
  }
  if (Number.isFinite(params.usdEstimate) && params.usdEstimate > 0) {
    return { unit: 'usd', value: params.usdEstimate }
  }
  return undefined
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
  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
  if (actionType !== 'buy' && actionType !== 'sell' && actionType !== 'bid') {
    const unsupportedCorrelationId = [
      'tg_trade',
      params.chatId,
      params.userId,
      Date.now().toString(36),
    ]
      .map((part) => String(part).replace(/[^a-zA-Z0-9:_-]/g, ''))
      .join(':')
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      context: {
        reason: 'unsupported_trade_action_type',
        actionType,
      },
    })
    if (link && Number.isFinite(link.profileId) && link.profileId > 0) {
      await logTelegramActionAudit({
        db: db as any,
        telegramUserId: params.userId,
        chatId: params.chatId,
        messageId: params.messageId,
        profileId: link.profileId,
        canonicalCswAddress: link.canonicalCswAddress,
        actionType: actionType || 'unknown',
        intent: consumed.intentPayload ?? {},
        status: 'failed',
        errorCode: 'unsupported_trade_action_type',
        errorMessage: 'Trade blocked: preview action type is unsupported.',
        correlationId: unsupportedCorrelationId,
      })
    }
    return {
      text: 'Trade blocked: preview action type is unsupported. Please start a fresh trade preview.',
      callbackToast: 'Unsupported action',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }
  const actionTypeSafe: 'buy' | 'sell' | 'bid' = actionType
  tradeFlowState = reduceTradeFlowState(tradeFlowState, {
    type: 'START',
    actionType: actionTypeSafe,
  })
  const intent = consumed.intentPayload ?? {}
  const creatorCoinAddress = asTrimmed(intent.creatorCoinAddress ?? '').toLowerCase()
  const vaultAddress = asTrimmed(intent.vaultAddress ?? '').toLowerCase()
  const targetLabel = formatTradeTargetLabelFromAddresses({
    actionType: actionTypeSafe,
    creatorCoinAddress,
    vaultAddress,
  })
  const targetAddress = resolveTradeSignalTargetAddress({
    actionType: actionTypeSafe,
    creatorCoinAddress,
    vaultAddress,
  })
  const tradeControl = buildTelegramTradeControlBundle({
    actorId: params.userId,
    chatId: params.chatId,
    actionType: actionTypeSafe,
    callbackToken: callback.token,
    callbackKind: callback.kind,
    intentPayload: intent,
    expiresAt: consumed.expiresAt,
    consumedAt: consumed.consumedAt ?? null,
    targetAddress,
    vaultAddress,
    creatorCoinAddress,
  })
  const {
    capability,
    proposal,
    controlAction,
    correlationId: proposalCorrelationId,
    chainId,
    amountInput,
    amountEth,
    usdEstimate,
    scopedVaultAddress,
    scopedCreatorCoinAddress,
    scopedTargetAddress,
  } = tradeControl
  await appendControlAuditBestEffort({
    db: db as any,
    event_type: 'proposal.created',
    proposal_id: proposal.proposal_id,
    capability_id: capability.capability_id,
    actor_type: 'telegram_user',
    actor_id: params.userId,
    subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
    action: controlAction,
    status: 'allow',
    correlation_id: proposalCorrelationId,
    metadata: {
      token_id: callback.token,
      trade_action_type: actionTypeSafe,
      chat_id: params.chatId,
    },
  })

  if (!link || link.linkStatus !== 'active' || !link.ownerVerified) {
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'proposal.denied',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: 'link_not_active_or_verified',
      metadata: {
        link_present: Boolean(link),
        link_status: link?.linkStatus ?? null,
        owner_verified: link?.ownerVerified ?? null,
      },
    })
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
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'confirmation.rejected',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: 'user_declined_confirmation',
      metadata: {
        token_id: callback.token,
        token_consumed_at: consumed.consumedAt ?? null,
      },
    })
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'proposal.denied',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: 'user_declined_confirmation',
      metadata: {
        token_id: callback.token,
      },
    })
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
      correlationId: proposalCorrelationId,
    })
    return {
      text: `Declined ${actionTypeSafe.toUpperCase()} preview.`,
      callbackToast: `${actionTypeSafe.toUpperCase()} declined`,
    }
  }

  await appendControlAuditBestEffort({
    db: db as any,
    event_type: 'confirmation.accepted',
    proposal_id: proposal.proposal_id,
    capability_id: capability.capability_id,
    actor_type: 'telegram_user',
    actor_id: params.userId,
    subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
    action: controlAction,
    status: 'allow',
    correlation_id: proposalCorrelationId,
    metadata: {
      token_id: callback.token,
      token_consumed_at: consumed.consumedAt ?? null,
    },
  })

  const tradePolicy = await getTelegramChatTradePolicy({
    db: db as any,
    chatId: params.chatId,
  })
  if ((actionTypeSafe === 'buy' || actionTypeSafe === 'sell') && !tradePolicy.buySellEnabled) {
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'policy.denied',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: 'buy_sell_disabled',
      metadata: {
        token_id: callback.token,
      },
    })
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
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: actionTypeSafe,
      intent,
      status: 'failed',
      errorCode: 'buy_sell_disabled',
      errorMessage: 'Trade blocked: buy/sell disabled for this chat scope.',
      correlationId: proposalCorrelationId,
    })
    return {
      text: 'Trade blocked: buy/sell disabled for this chat scope.',
      callbackToast: 'Buy/sell disabled',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }
  if (actionTypeSafe === 'bid' && !tradePolicy.bidEnabled) {
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'policy.denied',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: 'bid_disabled',
      metadata: {
        token_id: callback.token,
      },
    })
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
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: actionTypeSafe,
      intent,
      status: 'failed',
      errorCode: 'bid_disabled',
      errorMessage: 'Trade blocked: bid disabled for this chat scope.',
      correlationId: proposalCorrelationId,
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
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'policy.denied',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: 'membership_required',
      metadata: {
        token_id: callback.token,
        membershipStatus: membership.status ?? null,
      },
    })
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
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: actionTypeSafe,
      intent,
      status: 'failed',
      errorCode: 'membership_required',
      errorMessage: `membership_status_${membership.status ?? 'unknown'}`,
      correlationId: proposalCorrelationId,
    })
    return {
      text: `Trade blocked: membership required (status=${membership.status ?? 'unknown'}).`,
      callbackToast: 'Membership required',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }

  const canonicalSenderWallet = toCanonicalWalletOrNull(link.canonicalCswAddress)
  if (!canonicalSenderWallet) {
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'policy.denied',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: 'canonical_wallet_missing',
      metadata: {
        token_id: callback.token,
      },
    })
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
    await logTelegramActionAudit({
      db: db as any,
      telegramUserId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      profileId: link.profileId,
      canonicalCswAddress: link.canonicalCswAddress,
      actionType: actionTypeSafe,
      intent,
      status: 'failed',
      errorCode: 'canonical_wallet_missing',
      errorMessage: 'Trade blocked: canonical wallet is not available.',
      correlationId: proposalCorrelationId,
    })
    return {
      text: 'Trade blocked: canonical wallet is not available.',
      callbackToast: 'Canonical wallet missing',
      replyMarkup: buildTradeRecoveryReplyMarkup(),
    }
  }

  const policyResult = evaluatePolicy({
    capability,
    proposal,
    context: {
      actor_type: 'telegram_user',
      actor_id: params.userId,
      telegram_user_id: params.userId,
      chat_id: params.chatId,
      canonical_wallet: canonicalSenderWallet,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      ...(typeof chainId === 'number' ? { chain_id: chainId } : {}),
      ...(scopedVaultAddress ? { vault_address: scopedVaultAddress } : {}),
      ...(scopedCreatorCoinAddress ? { creator_coin_address: scopedCreatorCoinAddress } : {}),
      group_id: params.groupId,
      target: scopedTargetAddress ?? undefined,
      amount: resolveTradeAmountForPolicy({
        actionType: actionTypeSafe,
        amountInput,
        amountEth,
        usdEstimate,
      }),
      replay_key: callback.token,
      now_ms: Number.isFinite(Date.parse(consumed.consumedAt ?? ''))
        ? Date.parse(consumed.consumedAt ?? '')
        : Date.now(),
      confirmation: {
        confirmation_class: 'human_plus_policy',
        approved: true,
        approved_at: consumed.consumedAt ?? nowIso(),
        approval_actor_id: params.userId,
        token_id: callback.token,
        token_consumed_at: consumed.consumedAt ?? nowIso(),
      },
    },
    allowlist: {
      subsystems: [TELEGRAM_TRADE_CONTROL_SUBSYSTEM],
      actions: [...TELEGRAM_TRADE_CONTROL_ACTIONS],
      targets: scopedTargetAddress ? [scopedTargetAddress] : undefined,
    },
  })
  if (!policyResult.allowed) {
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'policy.denied',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'deny',
      correlation_id: proposalCorrelationId,
      reason: policyResult.reason,
      error_code: policyResult.deny_code,
      metadata: policyResult.details ?? {},
    })
    emitTelegramFunnelEvent({
      db,
      telegramUserId: params.userId,
      chatId: params.chatId,
      eventName: 'trade_confirm_failed',
      actionType: actionTypeSafe,
      context: {
        reason: policyResult.deny_code,
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
      execution: {
        mode: 'policy_gate',
      },
      status: 'failed',
      errorCode: policyResult.deny_code,
      errorMessage: policyResult.reason,
      correlationId: proposalCorrelationId,
    })
    return {
      text: [
        'Trade blocked',
        '',
        'Security policy denied this request. Please run the trade command again to create a fresh preview.',
      ].join('\n'),
      callbackToast: 'Policy blocked',
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
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'execution.started',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'allow',
      correlation_id: proposalCorrelationId,
      metadata: {
        mode: 'keepr_coin_command',
        commandText,
      },
    })
    const execution = await executeDeterministicCommand({
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
      errorMessage: execution.ok ? null : asTrimmed(execution.rawResponseText),
      correlationId: proposalCorrelationId,
    })
    await appendControlAuditBestEffort({
      db: db as any,
      event_type: execution.ok ? 'execution.succeeded' : 'execution.failed',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: execution.ok ? 'success' : 'failed',
      correlation_id: proposalCorrelationId,
      ...(execution.ok ? {} : { reason: asTrimmed(execution.rawResponseText) || 'execution_failed' }),
      ...(execution.ok ? {} : { error_code: 'keepr_coin_command_failed' }),
      metadata: {
        mode: 'keepr_coin_command',
        commandText,
        ok: execution.ok,
      },
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
          execution.responseText,
        ].join('\n'),
        signalText: buildTradeSignalText({
          actionType: actionTypeSafe,
          targetLabel,
          targetAddress,
          amountInput,
          amountEth,
          usdEstimate,
        }),
        signalReplyMarkup: buildTradeSignalReplyMarkup({
          actionType: actionTypeSafe,
          targetAddress,
          amountInput,
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
        execution.responseText || 'Execution failed. Retry with a fresh preview.',
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
      await appendControlAuditBestEffort({
        db: db as any,
        event_type: 'proposal.denied',
        proposal_id: proposal.proposal_id,
        capability_id: capability.capability_id,
        actor_type: 'telegram_user',
        actor_id: params.userId,
        subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
        action: controlAction,
        status: 'deny',
        correlation_id: proposalCorrelationId,
        reason: 'invalid_bid_payload',
      })
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
      await logTelegramActionAudit({
        db: db as any,
        telegramUserId: params.userId,
        chatId: params.chatId,
        messageId: params.messageId,
        profileId: link.profileId,
        canonicalCswAddress: link.canonicalCswAddress,
        actionType: actionTypeSafe,
        intent,
        execution: { mode: 'cca_bid_userop' },
        status: 'failed',
        errorCode: 'invalid_bid_payload',
        errorMessage: 'malformed bid intent payload',
        correlationId: proposalCorrelationId,
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

    await appendControlAuditBestEffort({
      db: db as any,
      event_type: 'execution.started',
      proposal_id: proposal.proposal_id,
      capability_id: capability.capability_id,
      actor_type: 'telegram_user',
      actor_id: params.userId,
      subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
      action: controlAction,
      status: 'allow',
      correlation_id: proposalCorrelationId,
      metadata: {
        mode: 'cca_bid_userop',
      },
    })

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
          await appendControlAuditBestEffort({
            db: db as any,
            event_type: 'execution.failed',
            proposal_id: proposal.proposal_id,
            capability_id: capability.capability_id,
            actor_type: 'telegram_user',
            actor_id: params.userId,
            subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
            action: controlAction,
            status: 'failed',
            correlation_id: proposalCorrelationId,
            reason: 'bid_drift_exceeded',
            error_code: 'bid_drift_exceeded',
            error_message: `drift_bps_${driftBps}`,
            metadata: {
              driftBps,
            },
          })
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
            correlationId: proposalCorrelationId,
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
        canonicalCswAddress: canonicalSenderWallet,
      })

      const publicClient = createPublicClient({
        chain: base,
        transport: http(getBaseRpcUrl(), { timeout: 30_000 }),
      }) as any

      const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient,
        walletId: privyWalletContext.walletId,
        smartWallet: getAddress(canonicalSenderWallet as Address),
        expectedOwnerAddress: getAddress(privyWalletContext.ownerAddress as Address),
        maxScan: 512,
      })

      const callData = encodeFunctionData({
        abi: CCA_AUCTION_ABI,
        functionName: 'submitBid',
        args: [
          freshQuote.maxPriceQ96,
          freshQuote.amountWei,
          getAddress(canonicalSenderWallet as Address),
          '0x',
        ],
      })

      const execution = await sendPrivyCoinbaseSmartWalletUserOperation({
        publicClient,
        bundlerUrl: getBundlerAndPaymasterUrl(),
        walletId: privyWalletContext.walletId,
        smartWallet: getAddress(canonicalSenderWallet as Address),
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
      await appendControlAuditBestEffort({
        db: db as any,
        event_type: 'execution.succeeded',
        proposal_id: proposal.proposal_id,
        capability_id: capability.capability_id,
        actor_type: 'telegram_user',
        actor_id: params.userId,
        subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
        action: controlAction,
        status: 'success',
        correlation_id: proposalCorrelationId,
        metadata: {
          mode: 'cca_bid_userop',
          txHash: execution.txHash,
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
          usdEstimate: freshQuote.usdIntent,
        },
        execution: {
          mode: 'cca_bid_userop',
          txHash: execution.txHash,
        },
        txHash: execution.txHash,
        status: 'executed',
        correlationId: proposalCorrelationId,
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
          targetAddress,
          amountInput,
          amountEth: freshQuote.amountEth,
          usdEstimate: freshQuote.usdIntent,
          txHash: execution.txHash,
        }),
        signalReplyMarkup: buildTradeSignalReplyMarkup({
          actionType: 'bid',
          targetAddress,
          amountInput,
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
        correlationId: proposalCorrelationId,
      })
      await appendControlAuditBestEffort({
        db: db as any,
        event_type: 'execution.failed',
        proposal_id: proposal.proposal_id,
        capability_id: capability.capability_id,
        actor_type: 'telegram_user',
        actor_id: params.userId,
        subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
        action: controlAction,
        status: 'failed',
        correlation_id: proposalCorrelationId,
        reason: helperCode ?? message,
        error_code: helperCode ?? 'bid_execution_failed',
        error_message: helperRetryable === null ? message : `${message} (retryable=${helperRetryable ? 'true' : 'false'})`,
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

async function handleTelegramTwitterCallback(params: {
  callbackData: string
  chatId: string
  userId: string
  groupId: string
  senderWallet: `0x${string}`
  senderWalletSource: SenderWalletSource
  isAdmin: boolean
}): Promise<TelegramCommandResponse | null> {
  const callback = parseTwitterCallbackData(params.callbackData)
  if (!callback) return null

  const db = await getDb()
  if (!db) {
    return {
      text: 'X post action unavailable while database is offline. Please retry in a few seconds.',
      callbackToast: 'Temporarily unavailable',
    }
  }

  await ensureTelegramTradingSchema(db as any)

  const consumed = await consumeTelegramActionToken({
    db: db as any,
    token: callback.token,
    telegramUserId: params.userId,
    chatId: params.chatId,
    actionType: 'twitter_post',
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
      text: formatTwitterTokenFailure(consumed.reason),
      callbackToast,
      replyMarkup: buildTwitterPostRecoveryReplyMarkup(),
    }
  }

  const intent = consumed.intentPayload ?? {}
  const tweetText = asTrimmed(intent.tweetText ?? '')
  if (!tweetText) {
    return {
      text: 'X post preview is missing its draft text. Start a new `/x post` preview.',
      callbackToast: 'Invalid preview',
      replyMarkup: buildTwitterPostRecoveryReplyMarkup(),
    }
  }

  if (callback.kind === 'decline') {
    return {
      text: `Cancelled X post preview.\n\nDraft kept:\n${tweetText}`,
      callbackToast: 'Post cancelled',
      replyMarkup: buildTwitterPostRecoveryReplyMarkup(tweetText),
    }
  }

  const processed = await processTelegramAgentInput({
    text: `/x post ${tweetText} --confirm`,
    chatId: params.chatId,
    userId: params.userId,
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    senderWalletSource: params.senderWalletSource,
    isAdmin: params.isAdmin,
    isPrivateChat: isPrivateChatId(params.chatId),
    twitterConfirmMode: 'allow_direct_confirm',
    emptyResponseFallback: 'Command received.',
  })

  const response: TelegramCommandResponse = buildTelegramProcessedCommandResponse({
    commandText: `/x post ${tweetText} --confirm`,
    processed,
    buildObservedCommandText: buildPremiumObservedCommandText,
    resolveMediaFromAction: resolveTelegramMediaFromAction,
  })
  return {
    ...response,
    callbackToast: asTrimmed((processed.action as any)?.action) === 'twitter.posted' ? 'Post sent' : 'Post failed',
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
  const limiter = checkRateLimit(rateLimitKey('telegram:webhook', getClientIp(req as any)), RATE_LIMITS.telegramWebhookIngest)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
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
      const tokenResult = parseTokenAnalysisResultId(resultId)
      const rankPosition = resultMatch ? Number(resultMatch[1]) + 1 : tokenResult?.rankPosition ?? null
      const resultType = resultMatch ? asTrimmed(resultMatch[2]).toLowerCase() : tokenResult ? 'article' : null
      const resultKey = resultMatch ? asTrimmed(resultMatch[3]) : tokenResult?.resultType ?? null
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

  const callbackQuery = update.callback_query
  if (callbackQuery && typeof callbackQuery === 'object') {
    const normalizedCallback = normalizeCallbackQuery(callbackQuery)
    if (!normalizedCallback) {
      return res.status(200).json({
        success: true,
        data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }
    const { callbackQueryId, callbackData, chatId = '', callbackMessageId, userId } = normalizedCallback
    const parsedTradeFlowCallback = parseTradeFlowCallbackData(callbackData)
    const parsedTradeCallback = parseTradeCallbackData(callbackData)
    const parsedDeployCallback = parseDeployCallbackData(callbackData)
    const parsedVaultDeployCallback = parseVaultDeployCallbackData(callbackData)
    const mappedCommand = resolveHelpCallbackCommand(callbackData)
    const isMenuNavigationCallback = callbackData.startsWith('menu:') || callbackData.startsWith('help:')
    const isOnboardingCallback = asTrimmed(callbackData).toLowerCase().startsWith('onboard:')
    const canReplaceMenuMessage =
      (isMenuNavigationCallback || isOnboardingCallback) && typeof callbackMessageId === 'number'
    const adminUserIds = parseAdminUserIds()
    const isAdmin = userId ? adminUserIds.has(userId) : false
    const callbackDataLower = asTrimmed(callbackData).toLowerCase()

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

    if (callbackDataLower === 'message:delete' || callbackDataLower.startsWith('message:delete:')) {
      const dismissOwnerUserId = callbackDataLower.startsWith('message:delete:')
        ? asTrimmed(callbackDataLower.slice('message:delete:'.length))
        : ''
      if (dismissOwnerUserId && dismissOwnerUserId !== userId) {
        await answerTelegramCallbackQuery({
          botToken,
          callbackQueryId,
          text: 'Only the requester can dismiss this.',
          showAlert: true,
        }).catch(() => {})
        return res.status(200).json({
          success: true,
          data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
        } satisfies ApiEnvelope<TelegramWebhookOk>)
      }
      try {
        await answerTelegramCallbackQuery({
          botToken,
          callbackQueryId,
          text: 'Deleted',
        })
      } catch (error) {
        console.error('[telegram/webhook] delete callback acknowledgement failed', {
          updateId: update.update_id ?? null,
          callbackQueryId,
          err: error instanceof Error ? error.message : String(error),
        })
      }
      if (typeof callbackMessageId === 'number') {
        await deleteTelegramMessage({
          botToken,
          chatId,
          messageId: callbackMessageId,
        }).catch(() => {})
      }
      const dismissState = await loadTelegramActiveMessageState({
        chatId,
        ownerUserId: dismissOwnerUserId || userId,
      }).catch(() => ({ db: null, activeMessageId: null, dismissOwnerUserId: dismissOwnerUserId || userId }))
      await clearTelegramActiveMessageState({
        db: dismissState.db,
        chatId,
        ownerUserId: dismissOwnerUserId || userId,
        messageId: callbackMessageId,
      }).catch(() => {})
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }
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

    if (isOperatorCallbackToken(callbackDataLower) && !isAdmin) {
      await answerTelegramCallbackQuery({
        botToken,
        callbackQueryId,
        text: 'Only configured bot operators can use CRE Ops and Solana actions.',
        showAlert: true,
      }).catch(() => {})
      return res.status(200).json({
        success: true,
        data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    let callbackAcknowledged = false
    try {
      const vaultDeployImmediateToast = parsedVaultDeployCallback
        ? parsedVaultDeployCallback.kind === 'status'
          ? 'Refreshing status...'
          : parsedVaultDeployCallback.kind === 'confirm'
            ? 'Starting deployment...'
            : 'Deployment cancelled'
        : ''
      await answerTelegramCallbackQuery({
        botToken,
        callbackQueryId,
        text:
          vaultDeployImmediateToast ||
          resolveImmediateCallbackToast({
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
    const senderWalletSource = executionContext.senderWalletSource
    const callbackResponse =
      (await handleTelegramVaultDeployCallback({
        callbackData,
        chatId,
        userId,
        messageId: callbackMessageId,
      })) ??
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
      })) ??
      (await handleTelegramTwitterCallback({
        callbackData,
        chatId,
        userId,
        groupId,
        senderWallet,
        senderWalletSource,
        isAdmin,
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
            dismissOwnerUserId: userId,
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
          dismissOwnerUserId: userId,
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

    const menuHomeState = await resolveTelegramHomeState({ telegramUserId: userId })
    const menuIsLinked = menuHomeState === 'ready'
    if (asTrimmed(callbackData).toLowerCase() === 'menu:start' && menuHomeState === 'unlinked' && isPrivateChatId(chatId)) {
      const db = await getDb()
      if (db) {
        await ensureTelegramTradingSchema(db as any)
        await upsertTelegramOnboardingSession({ db: db as any, telegramUserId: userId, step: 'welcome' })
      }
    }
    const staticMenuResponse = resolveStaticMenuCallbackResponse({
      callbackData,
      chatId,
      homeState: menuHomeState,
      isAdmin,
    })
    if (staticMenuResponse) {
      if (canReplaceMenuMessage) {
        await replaceTelegramMenuMessage({
          botToken,
          chatId,
          messageId: callbackMessageId as number,
          text: staticMenuResponse.text,
          replyMarkup: staticMenuResponse.replyMarkup,
          dismissOwnerUserId: userId,
        })
      } else {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: staticMenuResponse.text,
          replyToMessageId: callbackMessageId,
          replyMarkup: staticMenuResponse.replyMarkup,
          dismissOwnerUserId: userId,
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
          dismissOwnerUserId: userId,
        })
      } else {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: 'Unknown menu action. Send /start to reopen the menu.',
          replyToMessageId: callbackMessageId,
          replyMarkup: buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked }),
          dismissOwnerUserId: userId,
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
        senderWalletSource,
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
      ?? resolveOperatorReplyMarkup(mappedCommand)
      ?? (isHelpCategoryCommand(mappedCommand)
        ? buildHelpCategoryReplyMarkup({ isAdmin })
        : isHelpCommand(mappedCommand)
          ? buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked })
          : undefined)
    if (response.media) {
      const mediaCaption = asTrimmed(response.media.caption ?? response.text)
      await sendTelegramPhoto({
        botToken,
        chatId,
        photo: response.media.bytes,
        ...(response.media.filename ? { filename: response.media.filename } : {}),
        ...(response.media.contentType ? { contentType: response.media.contentType } : {}),
        ...(mediaCaption ? { caption: mediaCaption } : {}),
        ...(canReplaceMenuMessage ? {} : { replyToMessageId: callbackMessageId }),
        replyMarkup: response.media.replyMarkup ?? helpMarkup,
        dismissOwnerUserId: userId,
      })
      if (canReplaceMenuMessage) {
        await deleteTelegramMessage({
          botToken,
          chatId,
          messageId: callbackMessageId as number,
        }).catch(() => {})
      }
      if (!response.media.suppressText) {
        const textChunks = splitTelegramMessage(response.text)
        for (const chunk of textChunks) {
          if (!chunk || chunk === mediaCaption) continue
          await sendTelegramMessage({
            botToken,
            chatId,
            text: chunk,
            dismissOwnerUserId: userId,
          })
        }
      }
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }
    if (canReplaceMenuMessage) {
      await replaceTelegramMenuMessage({
        botToken,
        chatId,
        messageId: callbackMessageId as number,
        text: response.text,
        replyMarkup: helpMarkup,
        dismissOwnerUserId: userId,
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
          dismissOwnerUserId: userId,
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
  const sharedSelection = extractSharedSelection(message)

  if (fromBot) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (sharedSelection) {
    if (sharedSelection.kind === 'users') {
      const selectedUser = sharedSelection.users[0] ?? null
      const adminUserIds = parseAdminUserIds()
      const isAdmin = userId ? adminUserIds.has(userId) : false
      if (selectedUser && selectedUser.userId !== userId && !isAdmin) {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: 'You can only view your own linked profile from the ID picker.',
          replyToMessageId: messageId,
          replyMarkup: { remove_keyboard: true },
        })
        return res.status(200).json({
          success: true,
          data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
        } satisfies ApiEnvelope<TelegramWebhookOk>)
      }
      const db = await getDb()
      const pickedProfile = selectedUser && db
        ? await resolveTelegramPickerUserProfile({ db, telegramUserId: selectedUser.userId })
        : null
      await sendTelegramMessage({
        botToken,
        chatId,
        text: selectedUser
          ? buildTelegramPickedUserProfileText({
              selectedUser,
              profile: pickedProfile,
            })
          : buildTelegramIdSelectionText(sharedSelection),
        replyToMessageId: messageId,
        replyMarkup: { remove_keyboard: true },
      })
      const actionMarkup = buildTelegramPickedUserActionsReplyMarkup(pickedProfile)
      if (selectedUser && actionMarkup) {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: buildTelegramCommandChrome({
            title: 'Actions',
            command: '/buy',
            summaryLines: [`Trade ${pickedProfile?.creatorCoinSymbol ?? 'creator coin'} from this card.`],
          }),
          replyMarkup: actionMarkup,
        })
      }
    } else {
      await sendTelegramMessage({
        botToken,
        chatId,
        text: buildTelegramIdSelectionText(sharedSelection),
        replyToMessageId: messageId,
        replyMarkup: { remove_keyboard: true },
      })
    }
    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const normalizedText = normalizeTelegramCommand(text)
  const commandText = shouldAutoRouteToAi({ chatId, text, message }) ? normalizeTelegramCommand(`/ai ${text}`) : normalizedText
  if (!text) {
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
        dismissOwnerUserId: userId,
      })
      return res.status(200).json({
        success: true,
        data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }
  }

  const executionContext = resolveCommandExecutionContext({
    chatId,
    userId,
    isAdmin,
  })
  const senderWallet = executionContext.senderWallet
  const groupId = executionContext.groupId
  const senderWalletSource = executionContext.senderWalletSource

  let response: TelegramCommandResponse = { text: '' }
  try {
    response = await executeTelegramCommand({
      text: commandText,
      chatId,
      userId,
      groupId,
      senderWallet,
      senderWalletSource,
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

  const helpMarkup = response.replyMarkup
    ?? resolveOperatorReplyMarkup(normalizedText)
    ?? (isHelpCategoryCommand(normalizedText)
      ? buildHelpCategoryReplyMarkup({ isAdmin })
      : isHelpCommand(normalizedText)
        ? buildHelpReplyMarkup({ chatId, isLinked: menuIsLinked })
        : undefined)
  const deliveryState = await loadTelegramActiveMessageState({
    chatId,
    ownerUserId: userId,
  })
  const shouldSendFreshReply = shouldSendFreshPrivateDmCommandReply({
    chatId,
    normalizedText,
  })
  if (response.media) {
    const mediaCaption = asTrimmed(response.media.caption ?? response.text)
    const sentPhoto = await sendTelegramPhoto({
      botToken,
      chatId,
      photo: response.media.bytes,
      ...(response.media.filename ? { filename: response.media.filename } : {}),
      ...(response.media.contentType ? { contentType: response.media.contentType } : {}),
      ...(mediaCaption ? { caption: mediaCaption } : {}),
      replyToMessageId: deliveryState.activeMessageId ? undefined : message.message_id,
      replyMarkup: response.media.replyMarkup ?? helpMarkup,
      dismissOwnerUserId: deliveryState.dismissOwnerUserId,
    })
    if (
      deliveryState.activeMessageId &&
      (!sentPhoto.messageId || sentPhoto.messageId !== deliveryState.activeMessageId)
    ) {
      await deleteTelegramMessage({
        botToken,
        chatId,
        messageId: deliveryState.activeMessageId,
      }).catch(() => {})
    }
    await upsertTelegramActiveMessageState({
      db: deliveryState.db,
      chatId,
      ownerUserId: userId,
      messageId: sentPhoto.messageId,
    }).catch(() => {})
    if (!response.media.suppressText) {
      const textChunks = splitTelegramMessage(response.text)
      for (const chunk of textChunks) {
        if (!chunk || chunk === mediaCaption) continue
        await sendTelegramMessage({
          botToken,
          chatId,
          text: chunk,
          dismissOwnerUserId: deliveryState.dismissOwnerUserId,
        })
      }
    }
    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }
  const chunks = splitTelegramMessage(response.text)
  if (chunks.length > 0) {
    const firstChunk = chunks[0] ?? ''
    let trackedMessageId: number | null = null
    if (firstChunk) {
      if (shouldSendFreshReply) {
        await clearTelegramActiveMessageState({
          db: deliveryState.db,
          chatId,
          ownerUserId: userId,
          messageId: deliveryState.activeMessageId,
        }).catch(() => {})
        const sent = await sendTelegramMessage({
          botToken,
          chatId,
          text: firstChunk,
          replyToMessageId: message.message_id,
          replyMarkup: helpMarkup,
          dismissOwnerUserId: deliveryState.dismissOwnerUserId,
        })
        trackedMessageId = sent.messageId
      } else if (deliveryState.activeMessageId) {
        const replaced = await replaceTelegramMenuMessage({
          botToken,
          chatId,
          messageId: deliveryState.activeMessageId,
          text: firstChunk,
          replyMarkup: helpMarkup,
          dismissOwnerUserId: deliveryState.dismissOwnerUserId,
        })
        trackedMessageId = replaced.messageId ?? deliveryState.activeMessageId
      } else {
        const sent = await sendTelegramMessage({
          botToken,
          chatId,
          text: firstChunk,
          replyToMessageId: message.message_id,
          replyMarkup: helpMarkup,
          dismissOwnerUserId: deliveryState.dismissOwnerUserId,
        })
        trackedMessageId = sent.messageId
      }
    }
    await upsertTelegramActiveMessageState({
      db: deliveryState.db,
      chatId,
      ownerUserId: userId,
      messageId: trackedMessageId,
    }).catch(() => {})
  }
  for (let idx = 1; idx < chunks.length; idx += 1) {
    const chunk = chunks[idx]
    if (!chunk) continue
    await sendTelegramMessage({
      botToken,
      chatId,
      text: chunk,
      dismissOwnerUserId: deliveryState.dismissOwnerUserId,
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
