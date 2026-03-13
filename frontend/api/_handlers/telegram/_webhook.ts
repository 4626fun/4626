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
  listTelegramAuctions,
  listTelegramScopedVaults,
  listTelegramSignals,
  listTelegramUserBids,
  revokeTelegramLink,
  upsertTelegramTradePercentPrompt,
  upsertHolderRoomMember,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { checkRateLimit, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { handleKeeprCommand } from '../../../server/keepr/commands.js'
import { handleTwitterCommand } from '../../../server/twitter/commands.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

type TelegramFrom = {
  id?: number | string
  is_bot?: boolean
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
  successful_payment?: TelegramSuccessfulPayment
}

type TelegramInlineQuery = {
  id?: string | number
  query?: string
  from?: TelegramFrom
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
  const raw = asTrimmed(process.env.TELEGRAM_ADMIN_USER_IDS ?? '')
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[\s,]+/g)
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

function parseAllowedChatIds(): Set<string> {
  const explicit = asTrimmed(process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
  if (explicit) {
    return new Set(
      explicit
        .split(/[\s,]+/g)
        .map((part) => part.trim())
        .filter(Boolean),
    )
  }

  const fallback = asTrimmed(process.env.TELEGRAM_TARGET_CHAT_ID ?? '')
  return fallback ? new Set([fallback]) : new Set()
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
  const data = asTrimmed(rawData)
  const match = data.match(/^tip:(\d+):([a-z0-9-]{1,24})$/i)
  if (!match) return null
  const stars = parseTipStars(match[1])
  const context = asTrimmed(match[2]).toLowerCase()
  if (!stars || !context) return null
  return { stars, context }
}

function parseTipInvoicePayload(rawPayload: unknown): { stars: number; context: string } | null {
  const payload = asTrimmed(rawPayload)
  const match = payload.match(/^tip:(\d+):([a-z0-9-]{1,24})(?::.*)?$/i)
  if (!match) return null
  const stars = parseTipStars(match[1])
  const context = asTrimmed(match[2]).toLowerCase()
  if (!stars || !context) return null
  return { stars, context }
}

function areStarsTipsEnabled(): boolean {
  return parseBoolean(process.env.TELEGRAM_STARS_TIPS_ENABLED, false)
}

function isStarsTipsEnabledForChat(chatId: string): boolean {
  if (!areStarsTipsEnabled()) return false
  const allowedRaw = asTrimmed(process.env.TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS ?? '')
  if (!allowedRaw) return true
  const allowed = parseDelimitedSet(allowedRaw)
  return allowed.has(chatId)
}

function resolveSignalsDestination(sourceChatId: string): { chatId: string; messageThreadId?: number } {
  const destinationChatId = asTrimmed(process.env.TELEGRAM_SIGNALS_CHAT_ID ?? '') || sourceChatId
  const byChat = parseJsonObject(process.env.TELEGRAM_SIGNALS_THREAD_BY_CHAT_JSON)
  const mapped =
    byChat[sourceChatId] ??
    byChat[destinationChatId] ??
    byChat[String(sourceChatId)] ??
    byChat[String(destinationChatId)]
  const threadId =
    parseOptionalPositiveInteger(String(mapped ?? '')) ??
    parseOptionalPositiveInteger(process.env.TELEGRAM_SIGNALS_THREAD_ID) ??
    parseOptionalPositiveInteger(process.env.TELEGRAM_SIGNALS_TOPIC_ID)
  return {
    chatId: destinationChatId,
    ...(threadId ? { messageThreadId: threadId } : {}),
  }
}

function isPrivateChatId(chatId: string): boolean {
  // Telegram groups/channels are negative, private chats are positive.
  return !chatId.startsWith('-')
}

function resolveSenderWallet(userId: string): `0x${string}` {
  const userWalletMap = parseJsonObject(process.env.TELEGRAM_USER_WALLET_MAP_JSON)
  const mapped = asTrimmed(userWalletMap[userId])
  if (isAddressLike(mapped)) return mapped.toLowerCase() as `0x${string}`

  const fallback = asTrimmed(process.env.TELEGRAM_DEFAULT_SENDER_WALLET ?? '')
  if (isAddressLike(fallback)) return fallback.toLowerCase() as `0x${string}`

  return ZERO_ADDRESS
}

function resolveGroupId(chatId: string): string {
  const groupMap = parseJsonObject(process.env.TELEGRAM_GROUP_ID_MAP_JSON)
  const mapped = asTrimmed(groupMap[chatId])
  if (mapped) return mapped

  const fallback = asTrimmed(process.env.TELEGRAM_DEFAULT_GROUP_ID ?? '')
  if (fallback) return fallback

  return `telegram:${chatId}`
}

function extractUpdateMessage(update: TelegramUpdate): TelegramMessage | null {
  const m = update?.message
  if (m && typeof m === 'object') return m
  const em = update?.edited_message
  if (em && typeof em === 'object') return em
  const cp = update?.channel_post
  if (cp && typeof cp === 'object') return cp
  return null
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

const TELEGRAM_NATIVE_COMMANDS = new Set([
  'link',
  'linked',
  'unlink',
  'join',
  'rooms',
  'eligibility',
  'portfolio',
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
  'help',
  'keepr',
  'link',
  'linked',
  'unlink',
  'join',
  'rooms',
  'eligibility',
  'portfolio',
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

function isTelegramNativeCommand(rawText: string): boolean {
  return TELEGRAM_NATIVE_COMMANDS.has(getCommandHead(rawText))
}

function normalizeTelegramCommand(rawText: string): string {
  const text = asTrimmed(rawText).replace(/^\/([a-z0-9_]+)@[\w_]+(?=\s|$)/i, '/$1')
  // Treat /start (and /start payloads) as a quick help entrypoint in DMs/groups.
  if (/^\/start(?:\s+.*)?$/i.test(text)) {
    return '/help'
  }
  return text
}

function formatAmount(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function readEthUsdPrice(): number {
  const direct = Number(asTrimmed(process.env.TELEGRAM_ETH_USD ?? ''))
  if (Number.isFinite(direct) && direct > 0) return direct
  const fallback = Number(asTrimmed(process.env.TELEGRAM_BID_ETH_USD ?? ''))
  if (Number.isFinite(fallback) && fallback > 0) return fallback
  return 3000
}

function readShareUsdFallback(): number {
  const value = Number(asTrimmed(process.env.TELEGRAM_SHARE_USD_FALLBACK ?? ''))
  if (Number.isFinite(value) && value > 0) return value
  return 1
}

function getBaseRpcUrl(): string {
  const raw = asTrimmed(process.env.BASE_RPC_URL ?? '')
  if (!raw) return 'https://mainnet.base.org'
  return raw.split(',')[0]?.trim() || 'https://mainnet.base.org'
}

function getBundlerAndPaymasterUrl(): string {
  const direct =
    asTrimmed(process.env.CDP_PAYMASTER_URL ?? '') ||
    asTrimmed(process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '') ||
    asTrimmed(process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '') ||
    asTrimmed(process.env.PAYMASTER_URL ?? '') ||
    asTrimmed(process.env.BUNDLER_URL ?? '')
  if (!direct) {
    throw new Error('cdp_paymaster_url_missing')
  }
  return direct
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
  const text = asTrimmed(rawText)
  if (!text) return null

  const buySell = text.match(/^\/?(buy|sell)\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:--confirm)?\s*$/i)
  if (buySell) {
    const action = buySell[1]?.toLowerCase()
    const identifier = asTrimmed(buySell[2] ?? '')
    const amountInput = asTrimmed(buySell[3] ?? '')
    const amount = Number(amountInput)
    if ((action === 'buy' || action === 'sell') && identifier && Number.isFinite(amount) && amount > 0) {
      return {
        actionType: action,
        identifier,
        amountInput,
        amount,
        amountUnit: action === 'buy' ? 'ETH' : 'SHARE',
      }
    }
  }

  const bid = text.match(/^\/?bid\s+(\S+)\s+\$?([0-9]+(?:\.[0-9]+)?)\s*(?:--confirm)?\s*$/i)
  if (bid) {
    const identifier = asTrimmed(bid[1] ?? '')
    const amountInput = asTrimmed(bid[2] ?? '')
    const amount = Number(amountInput)
    if (identifier && Number.isFinite(amount) && amount > 0) {
      return {
        actionType: 'bid',
        identifier,
        amountInput,
        amount,
        amountUnit: 'USD',
      }
    }
  }
  return null
}

function commandHasArguments(rawText: string, head: InteractiveTradeAction): boolean {
  const text = asTrimmed(rawText)
  if (!text) return false
  const pattern = new RegExp(`^/?${head}(?:\\s+(.+))?$`, 'i')
  const match = text.match(pattern)
  const argTail = asTrimmed(match?.[1] ?? '')
  return Boolean(argTail)
}

function resolveTradeTarget(
  scopedVaults: Awaited<ReturnType<typeof listTelegramScopedVaults>>,
  identifier: string,
): (Awaited<ReturnType<typeof listTelegramScopedVaults>>)[number] | null {
  const token = asTrimmed(identifier).toLowerCase()
  if (!token) return null
  if (scopedVaults.length === 0) return null
  if (token === 'vault' || token === 'default') return scopedVaults[0] ?? null

  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(token)
  if (isAddress) {
    const byVault = scopedVaults.find((row) => row.vaultAddress.toLowerCase() === token)
    if (byVault) return byVault
    const byCoin = scopedVaults.find((row) => row.creatorCoinAddress.toLowerCase() === token)
    if (byCoin) return byCoin
    return null
  }
  if (scopedVaults.length === 1) return scopedVaults[0]
  return null
}

function parseTradeFlowCallbackData(rawData: string):
  | { kind: 'vault'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | { kind: 'percent'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}`; percentBps: number }
  | { kind: 'custom'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | null {
  const data = asTrimmed(rawData)
  const vaultMatch = data.match(/^tradeflow:v:(buy|sell|bid):(0x[a-fA-F0-9]{40})$/)
  if (vaultMatch) {
    return {
      kind: 'vault',
      actionType: vaultMatch[1].toLowerCase() as InteractiveTradeAction,
      vaultAddress: vaultMatch[2].toLowerCase() as `0x${string}`,
    }
  }
  const percentMatch = data.match(/^tradeflow:p:(buy|sell|bid):(0x[a-fA-F0-9]{40}):(\d{1,4})$/)
  if (percentMatch) {
    const percentBps = Number(percentMatch[3] ?? 0)
    if (!Number.isFinite(percentBps) || percentBps < 100 || percentBps > 9_999) return null
    return {
      kind: 'percent',
      actionType: percentMatch[1].toLowerCase() as InteractiveTradeAction,
      vaultAddress: percentMatch[2].toLowerCase() as `0x${string}`,
      percentBps: Math.floor(percentBps),
    }
  }
  const customMatch = data.match(/^tradeflow:c:(buy|sell|bid):(0x[a-fA-F0-9]{40})$/)
  if (customMatch) {
    return {
      kind: 'custom',
      actionType: customMatch[1].toLowerCase() as InteractiveTradeAction,
      vaultAddress: customMatch[2].toLowerCase() as `0x${string}`,
    }
  }
  return null
}

function parseTradeCallbackData(rawData: string):
  | { kind: 'accept' | 'decline'; token: string }
  | { kind: 'edit'; actionType: 'buy' | 'sell' | 'bid' }
  | null {
  const data = asTrimmed(rawData)
  if (!data.startsWith('trade:')) return null
  const parts = data.split(':')
  const kind = asTrimmed(parts[1]).toLowerCase()
  if (kind === 'accept' || kind === 'confirm' || kind === 'decline' || kind === 'cancel') {
    const token = asTrimmed(parts[2])
    if (!token) return null
    return { kind: kind === 'accept' || kind === 'confirm' ? 'accept' : 'decline', token }
  }
  if (kind === 'edit') {
    const actionType = asTrimmed(parts[2]).toLowerCase()
    if (actionType === 'buy' || actionType === 'sell' || actionType === 'bid') {
      return { kind: 'edit', actionType }
    }
  }
  return null
}

function getPrivyServerAuth(): { appId: string; appSecret: string } {
  const appId = asTrimmed(process.env.PRIVY_APP_ID ?? '')
  const appSecret = asTrimmed(process.env.PRIVY_APP_SECRET ?? '')
  if (!appId || !appSecret) {
    throw new Error('privy_server_auth_not_configured')
  }
  return { appId, appSecret }
}

function extractPrivyWalletIdCandidate(raw: any): string | null {
  const candidates = [
    raw?.walletId,
    raw?.wallet_id,
    raw?.id,
    raw?.wallet?.id,
    raw?.wallet?.walletId,
    raw?.wallet?.wallet_id,
  ]
  for (const c of candidates) {
    const value = asTrimmed(c)
    if (value) return value
  }
  return null
}

function extractPrivyWalletAddressCandidate(raw: any): `0x${string}` | null {
  const candidates = [raw?.address, raw?.walletAddress, raw?.wallet_address, raw?.wallet?.address]
  for (const c of candidates) {
    const value = asTrimmed(c)
    if (isAddressLike(value)) return value.toLowerCase() as `0x${string}`
  }
  return null
}

function collectPrivyWalletRows(user: any): any[] {
  const roots: any[] = []
  if (user && typeof user === 'object') roots.push(user)
  if (Array.isArray(user?.wallets)) roots.push(...user.wallets)
  if (user?.wallet && typeof user.wallet === 'object') roots.push(user.wallet)
  const linked = Array.isArray(user?.linkedAccounts)
    ? user.linkedAccounts
    : Array.isArray(user?.linked_accounts)
      ? user.linked_accounts
      : []
  roots.push(...linked)
  for (const account of linked) {
    if (Array.isArray(account?.embedded_wallets)) roots.push(...account.embedded_wallets)
    if (Array.isArray(account?.embeddedWallets)) roots.push(...account.embeddedWallets)
    if (Array.isArray(account?.wallets)) roots.push(...account.wallets)
  }
  return roots
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
      `Preview: BUY ${params.targetLabel}`,
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
      `Preview: SELL ${params.targetLabel}`,
      '',
      `Intent: ${params.amountInput} SHARE`,
      `USD estimate: ~$${formatAmount(params.usdEstimate, 2)}`,
      '',
      `Confirm Sell ${formatAmount(Number(params.amountInput), 4)} SHARE`,
      'Token expires in 90s.',
    ].join('\n')
  }
  const bidLines = [
    `Preview: BID ${params.targetLabel}`,
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

function normalizeInlineDraft(rawQuery: string): string {
  const compact = asTrimmed(rawQuery).replace(/\s+/g, ' ')
  const stripped = compact
    .replace(/^\/?x\s+post\s+/i, '')
    .replace(/^\/?tweet\s+/i, '')
    .replace(/\s*--confirm\b/gi, '')
    .trim()
  const truncated = stripped.slice(0, 240).trim()
  return truncated || 'your update here'
}

function inferMarketSymbol(rawQuery: string): string {
  const token = asTrimmed(rawQuery).split(/\s+/g)[0] ?? ''
  return /^[a-zA-Z]{1,10}$/.test(token) ? token.toUpperCase() : 'BTC'
}

function readInlineQueryResultCap(): number {
  const configured = Number(asTrimmed(process.env.TELEGRAM_INLINE_MAX_RESULTS ?? ''))
  if (Number.isFinite(configured) && configured >= 3 && configured <= 20) return Math.floor(configured)
  return 8
}

async function buildInlineQueryResults(params: {
  rawQuery: string
  userId: string
  chatId: string
}): Promise<Array<Record<string, unknown>>> {
  const query = asTrimmed(params.rawQuery)
  const userId = asTrimmed(params.userId)
  const chatId = asTrimmed(params.chatId)
  const xPostCommand = `/x post ${normalizeInlineDraft(query)} --confirm`
  const aiPrompt = query ? `/ai ${query}` : '/ai What should I do next?'
  const marketQuote = `/mkt quote ${inferMarketSymbol(query)}`
  const tradeIntent = parseTelegramTradeIntent(query.startsWith('/') ? query : `/${query}`)
  const results: Record<string, unknown>[] = []
  const seenIds = new Set<string>()
  const pushResult = (entry: Record<string, unknown>): void => {
    const id = asTrimmed(entry.id ?? '')
    if (!id || seenIds.has(id)) return
    seenIds.add(id)
    results.push(entry)
  }

  if (tradeIntent) {
    const tradeCommand = tradeIntent.actionType === 'buy' ? '/buy' : tradeIntent.actionType === 'sell' ? '/sell' : '/bid'
    pushResult({
      type: 'article',
      id: 'trade-copy',
      title: `Start ${tradeIntent.actionType.toUpperCase()} flow`,
      description: tradeCommand,
      input_message_content: { message_text: tradeCommand },
    })
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

  if (!link || link.linkStatus !== 'active') {
    pushResult({
      type: 'article',
      id: 'link-account',
      title: 'Link account to trade',
      description: 'Insert /link',
      input_message_content: { message_text: '/link' },
    })
  } else {
    pushResult({
      type: 'article',
      id: 'portfolio',
      title: 'My Portfolio',
      description: 'Insert /portfolio',
      input_message_content: { message_text: '/portfolio' },
    })
  }

  const sortedVaults = [...scopedVaults].sort((left, right) => left.vaultAddress.localeCompare(right.vaultAddress))
  for (let idx = 0; idx < sortedVaults.length; idx += 1) {
    const vault = sortedVaults[idx]
    const vaultAddress = asTrimmed(vault?.vaultAddress ?? '').toLowerCase()
    if (!isAddressLike(vaultAddress)) continue
    pushResult({
      type: 'article',
      id: `vault-buy-${idx}`,
      title: `Buy ${truncateAddress(vaultAddress)}`,
      description: '/buy',
      input_message_content: { message_text: '/buy' },
    })
    if (isAddressLike(vault.ccaStrategyAddress) && !vault.isSettled) {
      pushResult({
        type: 'article',
        id: `vault-bid-${idx}`,
        title: `Bid ${truncateAddress(vaultAddress)}`,
        description: '/bid',
        input_message_content: { message_text: '/bid' },
      })
    }
  }

  pushResult({
      type: 'article',
      id: 'help',
      title: 'Keepr Help',
      description: 'Insert /help',
      input_message_content: { message_text: '/help' },
    })
  pushResult({
      type: 'article',
      id: 'status',
      title: 'Vault Status',
      description: 'Insert /keepr status',
      input_message_content: { message_text: '/keepr status' },
    })
  pushResult({
      type: 'article',
      id: 'xpost',
      title: 'Draft X Post',
      description: 'Insert /x post ... --confirm',
      input_message_content: { message_text: xPostCommand },
    })
  pushResult({
      type: 'article',
      id: 'ai',
      title: 'Ask Keepr AI',
      description: 'Insert /ai <question>',
      input_message_content: { message_text: aiPrompt },
    })
  pushResult({
      type: 'article',
      id: 'mkt',
      title: 'Market Quote',
      description: 'Insert /mkt quote <symbol>',
      input_message_content: { message_text: marketQuote },
    })

  return results.slice(0, readInlineQueryResultCap())
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
      [{ text: 'Back', callback_data: 'menu:help' }],
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
        { text: 'Wallet', callback_data: 'help:wallet' },
        { text: 'All Commands', callback_data: 'help:all' },
      ],
      [{ text: 'Back', callback_data: 'menu:help' }],
    ],
  }
}

function resolveTelegramMiniAppUrl(): string {
  const configured = asTrimmed(process.env.TELEGRAM_MINI_APP_URL ?? '')
  if (configured && /^https?:\/\//i.test(configured)) return configured
  return 'https://app.4626.fun'
}

function buildTelegramMiniAppUrl(params: {
  baseUrl: string
  pathname?: string
  query?: Record<string, string>
}): string {
  try {
    const url = new URL(params.baseUrl)
    if (params.pathname) {
      url.pathname = params.pathname
    }
    const query = params.query ?? {}
    for (const [key, value] of Object.entries(query)) {
      if (!asTrimmed(value)) continue
      url.searchParams.set(key, value)
    }
    return url.toString()
  } catch {
    return params.baseUrl
  }
}

function buildTelegramLinkSwapNextPath(params: {
  token: string
  chatId: string
  telegramUsername?: string | null
}): string {
  const query = new URLSearchParams({
    tgMiniApp: '1',
    tgEntry: 'link',
    chatAction: 'link-account',
    tgChatId: params.chatId,
    tgLinkToken: params.token,
  })
  const username = asTrimmed(params.telegramUsername ?? '')
  if (username) {
    query.set('tgUsername', username)
  }
  return `/swap?${query.toString()}`
}

function buildMiniAppLaunchButton(params: {
  chatId: string
  text: string
  url: string
}): Record<string, unknown> {
  if (isPrivateChatId(params.chatId)) {
    return { text: params.text, web_app: { url: params.url } }
  }
  return { text: params.text, url: params.url }
}

function buildHelpReplyMarkup(chatId: string): Record<string, unknown> {
  const miniAppUrl = resolveTelegramMiniAppUrl()
  const tradeAppUrl = buildTelegramMiniAppUrl({
    baseUrl: miniAppUrl,
    pathname: '/swap',
    query: {
      tgMiniApp: '1',
      tgEntry: 'trade',
    },
  })
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

  const keyboard: Array<Array<Record<string, unknown>>> = [
      [
        { text: 'Link', callback_data: 'menu:link' },
        { text: 'Linked', callback_data: 'menu:linked' },
        { text: 'Unlink', callback_data: 'menu:unlink' },
      ],
      [
        { text: 'Buy', callback_data: 'menu:buy' },
        { text: 'Sell', callback_data: 'menu:sell' },
        { text: 'Bid', callback_data: 'menu:bid' },
      ],
      [
        { text: 'Portfolio', callback_data: 'menu:portfolio' },
        { text: 'Vaults', callback_data: 'menu:vaults' },
        { text: 'Auctions', callback_data: 'menu:auctions' },
      ],
      [
        { text: 'Join Room', callback_data: 'menu:join' },
        { text: 'Eligibility', callback_data: 'menu:eligibility' },
        { text: 'Rooms', callback_data: 'menu:rooms' },
      ],
      [
        { text: 'My Bids', callback_data: 'menu:mybids' },
        { text: 'Signals', callback_data: 'menu:signals' },
        { text: 'Help Topics', callback_data: 'menu:help' },
      ],
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
        { text: 'Wallet', callback_data: 'help:wallet' },
        { text: 'All Commands', callback_data: 'help:all' },
      ],
      [{ text: 'Inline Shortcuts', callback_data: 'help:inline' }],
      [
        { text: 'Ask AI', switch_inline_query_current_chat: 'ai What should I do next?' },
        { text: 'Draft X Post', switch_inline_query_current_chat: 'x post your update here' },
      ],
      [
        buildMiniAppLaunchButton({ chatId, text: 'Mini App: Trade', url: tradeAppUrl }),
        buildMiniAppLaunchButton({ chatId, text: 'Mini App: Vault', url: statusAppUrl }),
      ],
      [buildMiniAppLaunchButton({ chatId, text: 'Mini App: Ask AI', url: aiAppUrl })],
    ]

  return {
    inline_keyboard: keyboard,
  }
}

function resolveHelpCallbackCommand(rawData: string): string | null {
  const token = asTrimmed(rawData).toLowerCase()
  if (token.startsWith('menu:')) {
    const action = token.slice(5)
    if (action === 'link') return '/link'
    if (action === 'linked') return '/linked'
    if (action === 'unlink') return '/unlink'
    if (action === 'buy') return '/buy'
    if (action === 'sell') return '/sell'
    if (action === 'bid') return '/bid'
    if (action === 'join') return '/join'
    if (action === 'eligibility') return '/eligibility'
    if (action === 'rooms') return '/rooms'
    if (action === 'portfolio') return '/portfolio'
    if (action === 'vaults') return '/vaults'
    if (action === 'auctions') return '/auctions'
    if (action === 'mybids') return '/mybids'
    if (action === 'signals') return '/signals'
    if (action === 'help') return '/help'
    return null
  }
  if (!token.startsWith('help:')) return null
  const action = token.slice(5)
  if (!action || action === 'quick' || action === 'start') return '/help'
  if (action === 'inline') return '/inline'
  if (action === 'all') return '/help all'
  if (
    action === 'core' ||
    action === 'coin' ||
    action === 'market' ||
    action === 'social' ||
    action === 'ops' ||
    action === 'bankr' ||
    action === 'wallet'
  ) {
    return `/help ${action}`
  }
  return null
}

function resolveNavigationCallbackToast(rawData: string, mappedCommand: string | null): string {
  const token = asTrimmed(rawData).toLowerCase()
  if (token === 'menu:portfolio') return 'Portfolio ready'
  if (token === 'menu:vaults') return 'Vaults ready'
  if (token === 'menu:auctions') return 'Auctions ready'
  if (token === 'menu:mybids') return 'Bids ready'
  if (token === 'menu:signals') return 'Signals ready'
  if (token === 'menu:buy') return 'Buy flow'
  if (token === 'menu:sell') return 'Sell flow'
  if (token === 'menu:bid') return 'Bid flow'
  if (token === 'menu:link') return 'Link flow'
  if (token === 'menu:linked') return 'Link status'
  if (token === 'menu:unlink') return 'Unlink flow'
  if (token === 'menu:join') return 'Join flow'
  if (token === 'menu:eligibility') return 'Eligibility check'
  if (token === 'menu:rooms') return 'Rooms list'
  if (token === 'help:inline') return 'Inline shortcuts'
  if (token.startsWith('help:')) return 'Help topic'
  if (mappedCommand === '/help' || mappedCommand?.startsWith('/help ')) return 'Help'
  return ''
}

async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  text: string
  replyToMessageId?: number
  messageThreadId?: number
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendMessage`
  const textWithHints = appendCommandMicroHints(params.text)
  const formattedText = wrapCommandListingsWithBackticks(textWithHints)
  const backtickCount = (formattedText.match(/`/g) ?? []).length
  const useMarkdown = backtickCount >= 2 && backtickCount % 2 === 0
  const sendOnce = async (replyToMessageId?: number): Promise<Response> => {
    const payload: Record<string, unknown> = {
      chat_id: params.chatId,
      text: formattedText,
      disable_web_page_preview: true,
      ...(useMarkdown ? { parse_mode: 'Markdown' } : {}),
    }
    if (typeof replyToMessageId === 'number') {
      payload.reply_to_message_id = replyToMessageId
    }
    if (typeof params.messageThreadId === 'number') {
      payload.message_thread_id = params.messageThreadId
    }
    if (params.replyMarkup && typeof params.replyMarkup === 'object') {
      payload.reply_markup = params.replyMarkup
    }
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const firstResponse = await sendOnce(params.replyToMessageId)
  if (firstResponse.ok) return

  const firstDetails = await firstResponse.text().catch(() => '')
  const firstDetailsLower = firstDetails.toLowerCase()
  const retryWithoutReplyTarget =
    typeof params.replyToMessageId === 'number' &&
    firstResponse.status === 400 &&
    firstDetailsLower.includes('message to be replied not found')

  if (retryWithoutReplyTarget) {
    const retryResponse = await sendOnce(undefined)
    if (retryResponse.ok) return
    const retryDetails = await retryResponse.text().catch(() => '')
    throw new Error(`telegram_send_failed_${retryResponse.status}:${retryDetails.slice(0, 180)}`)
  }

  throw new Error(`telegram_send_failed_${firstResponse.status}:${firstDetails.slice(0, 180)}`)
}

async function editTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/editMessageText`
  const textWithHints = appendCommandMicroHints(params.text)
  const formattedText = wrapCommandListingsWithBackticks(textWithHints)
  const backtickCount = (formattedText.match(/`/g) ?? []).length
  const useMarkdown = backtickCount >= 2 && backtickCount % 2 === 0
  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    message_id: params.messageId,
    text: formattedText,
    disable_web_page_preview: true,
    ...(useMarkdown ? { parse_mode: 'Markdown' } : {}),
  }
  if (params.replyMarkup && typeof params.replyMarkup === 'object') {
    payload.reply_markup = params.replyMarkup
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (response.ok) return true
  const details = await response.text().catch(() => '')
  const detailsLower = details.toLowerCase()
  if (response.status === 400 && detailsLower.includes('message is not modified')) {
    return true
  }
  if (response.status === 400 && detailsLower.includes("message can't be edited")) {
    return false
  }
  throw new Error(`telegram_edit_failed_${response.status}:${details.slice(0, 180)}`)
}

async function deleteTelegramMessage(params: {
  botToken: string
  chatId: string
  messageId: number
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/deleteMessage`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: params.chatId,
      message_id: params.messageId,
    }),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    const detailsLower = details.toLowerCase()
    if (response.status === 400 && (detailsLower.includes('message to delete not found') || detailsLower.includes("message can't be deleted"))) {
      return
    }
    throw new Error(`telegram_delete_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

async function replaceTelegramMenuMessage(params: {
  botToken: string
  chatId: string
  messageId: number
  text: string
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  const chunks = splitTelegramMessage(params.text)
  const firstChunk = chunks[0] ?? 'Command received.'
  let edited = false
  try {
    edited = await editTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      messageId: params.messageId,
      text: firstChunk,
      replyMarkup: params.replyMarkup,
    })
  } catch {
    edited = false
  }
  if (!edited) {
    await sendTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      text: firstChunk,
      replyMarkup: params.replyMarkup,
    })
    await deleteTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      messageId: params.messageId,
    }).catch(() => {})
  }

  for (let idx = 1; idx < chunks.length; idx += 1) {
    const chunk = chunks[idx]
    if (!chunk) continue
    await sendTelegramMessage({
      botToken: params.botToken,
      chatId: params.chatId,
      text: chunk,
    })
  }
}

async function answerTelegramInlineQuery(params: {
  botToken: string
  inlineQueryId: string
  query: string
  userId: string
  chatId: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerInlineQuery`
  const payload = {
    inline_query_id: params.inlineQueryId,
    cache_time: 5,
    is_personal: true,
    results: await buildInlineQueryResults({
      rawQuery: params.query,
      userId: params.userId,
      chatId: params.chatId,
    }),
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_inline_answer_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

async function answerTelegramCallbackQuery(params: {
  botToken: string
  callbackQueryId: string
  text?: string
  showAlert?: boolean
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerCallbackQuery`
  const payload: Record<string, unknown> = {
    callback_query_id: params.callbackQueryId,
  }
  if (asTrimmed(params.text).length > 0) {
    payload.text = asTrimmed(params.text)
  }
  if (typeof params.showAlert === 'boolean') {
    payload.show_alert = params.showAlert
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_callback_answer_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

async function answerTelegramPreCheckoutQuery(params: {
  botToken: string
  preCheckoutQueryId: string
  ok: boolean
  errorMessage?: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerPreCheckoutQuery`
  const payload: Record<string, unknown> = {
    pre_checkout_query_id: params.preCheckoutQueryId,
    ok: params.ok,
  }
  if (!params.ok) {
    payload.error_message = asTrimmed(params.errorMessage ?? '') || 'Tip is not available right now.'
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_precheckout_answer_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

async function sendTelegramStarsInvoice(params: {
  botToken: string
  chatId: string
  userId: string
  stars: number
  context: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendInvoice`
  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    title: `Tip ${params.stars} Stars`,
    description: 'Support this 4626 signal with Telegram Stars.',
    payload: `tip:${params.stars}:${params.context}:${params.userId}:${Date.now()}`,
    currency: 'XTR',
    prices: [{ label: `Tip ${params.stars} Stars`, amount: params.stars }],
    start_parameter: 'tip-stars',
  }
  const providerToken = asTrimmed(process.env.TELEGRAM_STARS_PROVIDER_TOKEN ?? '')
  if (providerToken) {
    payload.provider_token = providerToken
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_send_invoice_failed_${response.status}:${details.slice(0, 180)}`)
  }
}

function truncateAddress(value: string): string {
  const v = asTrimmed(value)
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return v
  return `${v.slice(0, 6)}…${v.slice(-4)}`
}

function formatLinkStatusText(link: Awaited<ReturnType<typeof getTelegramLinkByUserId>>): string {
  if (!link) {
    return [
      'Link Status',
      '',
      '- linked: no',
      '- next: run /link to start one-time Telegram + Privy linking',
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

function formatPortfolioText(summary: Awaited<ReturnType<typeof getTelegramPortfolioSummary>>): string {
  if (!summary) {
    return [
      'Portfolio',
      '',
      '- linked: no',
      '- next: run /link, then /portfolio again',
    ].join('\n')
  }

  const lines = [
    'Portfolio',
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
  return parseBoolean(process.env.TELEGRAM_HOLDER_ROOMS_ENABLED, false)
}

function parseHolderRoomIdentifier(rawText: string, head: 'join' | 'eligibility'): string {
  const text = asTrimmed(rawText)
  if (!text) return ''
  const pattern = new RegExp(`^/?${head}(?:\\s+(\\S+))?`, 'i')
  const match = text.match(pattern)
  return asTrimmed(match?.[1] ?? '')
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
  const endpoint = `https://api.telegram.org/bot${params.botToken}/createChatInviteLink`
  const ttl = Math.max(60, Math.min(3600, Math.floor(Number(params.ttlSeconds ?? 60 * 10))))
  const payload: Record<string, unknown> = {
    chat_id: params.roomChatId,
    member_limit: 1,
    creates_join_request: false,
    expire_date: Math.floor(Date.now() / 1000) + ttl,
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_create_invite_failed_${response.status}:${details.slice(0, 180)}`)
  }
  const body = (await response.json().catch(() => null)) as any
  const inviteLink = asTrimmed(body?.result?.invite_link ?? '')
  return inviteLink || null
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
  const limits = tradeRateLimitForAction(params.actionType)
  const userWindow = checkRateLimit(rateLimitKey('telegram', 'trade', 'user', params.actionType, params.userId), {
    windowMs: 60_000,
    maxRequests: limits.userLimit,
  })
  if (!userWindow.allowed) {
    return {
      ok: false,
      reason: 'rate_limit_user',
      retryAfterSeconds: Math.max(1, Math.ceil((userWindow.resetAt - Date.now()) / 1000)),
    }
  }

  const chatWindow = checkRateLimit(rateLimitKey('telegram', 'trade', 'chat', params.actionType, params.chatId), {
    windowMs: 60_000,
    maxRequests: limits.chatLimit,
  })
  if (!chatWindow.allowed) {
    return {
      ok: false,
      reason: 'rate_limit_chat',
      retryAfterSeconds: Math.max(1, Math.ceil((chatWindow.resetAt - Date.now()) / 1000)),
    }
  }
  return { ok: true }
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
      [{ text: 'Custom', callback_data: `tradeflow:c:${params.actionType}:${params.vaultAddress}` }],
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
  return parseBoolean(process.env.TELEGRAM_REQUIRE_TRADE_MEMBERSHIP, false)
}

async function readTelegramChatMemberStatus(params: {
  chatId: string
  userId: string
}): Promise<string | null> {
  const botToken = asTrimmed(process.env.TELEGRAM_BOT_TOKEN ?? '')
  if (!botToken) return null
  const endpoint = `https://api.telegram.org/bot${botToken}/getChatMember`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: params.chatId,
      user_id: params.userId,
    }),
  })
  if (!response.ok) return null
  const payload = (await response.json().catch(() => null)) as any
  const status = asTrimmed(payload?.result?.status ?? '').toLowerCase()
  return status || null
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
  messageId?: number
  allowTradeArgs?: boolean
}): Promise<TelegramCommandResponse | null> {
  if (!isTelegramNativeCommand(params.text)) return null
  const head = getCommandHead(params.text)
  const tradeIntent = parseTelegramTradeIntent(params.text)

  if (head === 'link') {
    const miniAppUrl = resolveTelegramMiniAppUrl()
    let linkToken: { token: string; expiresAt: string } | null = null
    try {
      linkToken = createTelegramLinkStartToken({
        telegramUserId: params.userId,
        chatId: params.chatId,
        ttlSeconds: 60 * 15,
      })
    } catch {
      linkToken = null
    }
    const linkUrl = buildTelegramMiniAppUrl({
      baseUrl: miniAppUrl,
      pathname: '/continue',
      query: {
        from: 'waitlist',
        autologin: '1',
        auth: 'wallet',
        next:
          linkToken?.token
            ? buildTelegramLinkSwapNextPath({
                token: linkToken.token,
                chatId: params.chatId,
              })
            : '/swap',
      },
    })
    return {
      text: [
        'Link your 4626 account (one time)',
        '',
        '1) Open the Mini App link below',
        '2) Authenticate with Privy',
        '3) Confirm your canonical Coinbase Smart Wallet',
        '',
        `Open: ${linkUrl}`,
        ...(linkToken ? ['', `Link expires: ${linkToken.expiresAt}`] : []),
        '',
        'After completing, run /linked.',
      ].join('\n'),
    }
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

  const db = await getDb()
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
    if (head === 'portfolio') {
      return {
        text: [
          'Portfolio',
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
    return null
  }

  await ensureWaitlistSchema(db as any)
  await ensureKeeprSchema()
  await ensureTelegramTradingSchema(db as any)

  if (head === 'buy' || head === 'sell' || head === 'bid') {
    const actionType = head as InteractiveTradeAction
    const hasArgs = commandHasArguments(params.text, actionType)
    if (hasArgs && !params.allowTradeArgs) {
      return {
        text: [
          'Trade Flow',
          '',
          `- \`/${actionType}\` is interactive now`,
          `- send \`/${actionType}\` with no arguments`,
          '- pick vault, then size, then Accept or Decline',
        ].join('\n'),
      }
    }
    if (!hasArgs) {
      const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
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

      const scopedVaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId, limit: 20 })
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
      return {
        text: `Pick a vault to ${actionType.toUpperCase()}`,
        replyMarkup: buildTradeVaultPickerReplyMarkup({
          actionType,
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
      botToken: asTrimmed(process.env.TELEGRAM_BOT_TOKEN ?? ''),
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
    return {
      text: [
        'Join Room',
        '',
        '- eligible: yes',
        `- vault: ${truncateAddress(target.vaultAddress)}`,
        `- roomChatId: ${policy.roomChatId}`,
        `- invite: ${inviteLink}`,
        '- invite validity is short-lived; use immediately',
      ].join('\n'),
    }
  }

  if (head === 'linked') {
    const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
    return { text: formatLinkStatusText(link) }
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

  if (head === 'portfolio') {
    const summary = await getTelegramPortfolioSummary({ db: db as any, telegramUserId: params.userId })
    return { text: formatPortfolioText(summary) }
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
    const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
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

    const scopedVaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId })
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

  if (callback.kind === 'vault') {
    return {
      text: `Pick size for ${callback.actionType.toUpperCase()} ${truncateAddress(target.vaultAddress)}`,
      replyMarkup: buildTradePercentPickerReplyMarkup({
        actionType: callback.actionType,
        vaultAddress: callback.vaultAddress,
      }),
      callbackToast: 'Vault selected',
    }
  }

  if (callback.kind === 'custom') {
    await upsertTelegramTradePercentPrompt({
      db: db as any,
      chatId: params.chatId,
      telegramUserId: params.userId,
      actionType: callback.actionType,
      vaultAddress: callback.vaultAddress,
      ttlSeconds: 60 * 3,
    })
    return {
      text: [
        `Custom ${callback.actionType.toUpperCase()} size`,
        '',
        `Vault: ${truncateAddress(target.vaultAddress)}`,
        '- send a percent between 1 and 99.99 (example: 42%)',
      ].join('\n'),
      callbackToast: 'Send percent',
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
    actionType: callback.actionType,
    vault: target,
    canonicalCswAddress: link.canonicalCswAddress.toLowerCase() as `0x${string}`,
    percentBps: callback.percentBps,
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

  const percentBps = parsePercentInputToBps(params.text)
  if (!percentBps) {
    return {
      text: [
        `Custom ${prompt.actionType.toUpperCase()} size`,
        '',
        '- send a percent between 1 and 99.99',
        '- example: 42%',
      ].join('\n'),
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
    actionType: prompt.actionType,
    vault: target,
    canonicalCswAddress: link.canonicalCswAddress.toLowerCase() as `0x${string}`,
    percentBps,
  })
  if (!intentResult.ok) {
    return { text: intentResult.text }
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
  })
  if (previewResponse) return previewResponse
  return {
    text: 'Trade preview unavailable. Please retry /buy, /sell, or /bid.',
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
  })
  return { text: asTrimmed(keeprResult.response) }
}

function formatTradeTokenFailure(reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'): string {
  if (reason === 'expired') return 'Trade confirmation expired. Re-run your /buy, /sell, or /bid command.'
  if (reason === 'consumed') return 'This action was already confirmed or cancelled. Start a new preview.'
  if (reason === 'scope_mismatch') return 'Trade confirmation scope mismatch. Use a fresh preview from this chat.'
  return 'Trade confirmation token was not found. Start a new preview.'
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
  const useCopyText = parseBoolean(process.env.TELEGRAM_COPY_TEXT_BUTTONS, true)
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
    [reuseButton, { text: 'Open Portfolio', callback_data: 'menu:portfolio' }],
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
    const callbackToast =
      consumed.reason === 'expired'
        ? 'Preview expired'
        : consumed.reason === 'consumed'
          ? 'Already used'
          : consumed.reason === 'scope_mismatch'
            ? 'Wrong chat scope'
            : 'Preview missing'
    return {
      text: formatTradeTokenFailure(consumed.reason),
      callbackToast,
    }
  }

  const actionType = asTrimmed(consumed.actionType).toLowerCase()
  const actionTypeSafe: 'buy' | 'sell' | 'bid' =
    actionType === 'buy' || actionType === 'sell' || actionType === 'bid' ? actionType : 'buy'
  const intent = consumed.intentPayload ?? {}
  const creatorCoinAddress = asTrimmed(intent.creatorCoinAddress ?? '').toLowerCase()
  const vaultAddress = asTrimmed(intent.vaultAddress ?? '').toLowerCase()
  const targetLabel = truncateAddress(vaultAddress || creatorCoinAddress || 'vault')
  const amountInput = asTrimmed(intent.amountInput ?? '')
  const amountEth = Number(intent.amountEth ?? 0)
  const usdEstimate = Number(intent.usdEstimate ?? 0)

  const link = await getTelegramLinkByUserId({ db: db as any, telegramUserId: params.userId })
  if (!link || link.linkStatus !== 'active' || !link.ownerVerified) {
    return {
      text: [
        'Trade blocked',
        '',
        '- account link is no longer active/verified',
        '- run /linked and /link again if needed',
      ].join('\n'),
      callbackToast: 'Relink required',
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
    return {
      text: 'Trade blocked: buy/sell disabled for this chat scope.',
      callbackToast: 'Buy/sell disabled',
    }
  }
  if (actionTypeSafe === 'bid' && !tradePolicy.bidEnabled) {
    return {
      text: 'Trade blocked: bid disabled for this chat scope.',
      callbackToast: 'Bid disabled',
    }
  }

  const membership = await verifyTradeMembership({
    chatId: params.chatId,
    userId: params.userId,
  })
  if (!membership.ok) {
    return {
      text: `Trade blocked: membership required (status=${membership.status ?? 'unknown'}).`,
      callbackToast: 'Membership required',
    }
  }

  if ((actionTypeSafe === 'buy' || actionTypeSafe === 'sell') && isAddressLike(creatorCoinAddress) && amountInput) {
    const commandText = `/coin ${actionTypeSafe} ${creatorCoinAddress} ${amountInput}`
    const execution = await handleKeeprCommand({
      groupId: params.groupId,
      senderWallet: isAddressLike(link.canonicalCswAddress)
        ? (link.canonicalCswAddress as `0x${string}`)
        : params.senderWallet,
      text: commandText,
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
    if (!isAddressLike(link.canonicalCswAddress)) {
      return { text: 'Bid blocked: canonical wallet is not available.', callbackToast: 'Canonical wallet missing' }
    }
    const strategyAddressRaw = asTrimmed(intent.ccaStrategyAddress ?? '')
    const auctionAddressRaw = asTrimmed((intent as any)?.bid?.auctionAddress ?? '')
    const maxPriceQ96Raw = asTrimmed((intent as any)?.bid?.maxPriceQ96 ?? '')
    const amountWeiRaw = asTrimmed((intent as any)?.bid?.amountWei ?? '')
    const usdIntent = Number(intent.usdEstimate ?? 0)
    if (!isAddressLike(strategyAddressRaw) || !isAddressLike(auctionAddressRaw) || !maxPriceQ96Raw || !amountWeiRaw) {
      return {
        text: [
          'Bid blocked',
          '',
          '- malformed bid intent payload',
          '- please run /bid again to generate a fresh preview',
        ].join('\n'),
        callbackToast: 'Invalid bid preview',
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
      return {
        text: [
          'Bid execution failed',
          '',
          helperCode ? `Reason: ${helperCode}` : `Reason: ${message}`,
          'Please run /bid again to retry.',
        ].join('\n'),
        callbackToast: helperCode ? 'Bid failed' : 'Bid retry needed',
      }
    }
  }

  return { text: 'Unsupported trade action.', callbackToast: 'Unsupported action' }
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

  const botToken = asTrimmed(process.env.TELEGRAM_BOT_TOKEN ?? '')
  if (!botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot is not configured' } satisfies ApiEnvelope<never>)
  }

  const configuredSecret = asTrimmed(process.env.TELEGRAM_WEBHOOK_SECRET ?? '')
  if (configuredSecret) {
    const providedSecret = asTrimmed(req.headers?.['x-telegram-bot-api-secret-token'])
    if (providedSecret !== configuredSecret) {
      return res.status(401).json({ success: false, error: 'Invalid Telegram webhook secret' } satisfies ApiEnvelope<never>)
    }
  }

  const update = await readJsonBody<TelegramUpdate>(req, { maxBytes: 512_000 })
  if (!update) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const inlineQuery = update.inline_query
  if (inlineQuery && typeof inlineQuery === 'object') {
    const inlineQueryId = String(inlineQuery.id ?? '').trim()
    if (!inlineQueryId) {
      return res.status(200).json({
        success: true,
        data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    try {
      await answerTelegramInlineQuery({
        botToken,
        inlineQueryId,
        query: asTrimmed(inlineQuery.query ?? ''),
        userId: String(inlineQuery.from?.id ?? '').trim(),
        chatId: asTrimmed(process.env.TELEGRAM_TARGET_CHAT_ID ?? ''),
      })
    } catch (error) {
      console.error('[telegram/webhook] inline query failed', {
        updateId: update.update_id ?? null,
        inlineQueryId,
        err: error instanceof Error ? error.message : String(error),
      })
    }

    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const preCheckoutQuery = update.pre_checkout_query
  if (preCheckoutQuery && typeof preCheckoutQuery === 'object') {
    const preCheckoutQueryId = asTrimmed(preCheckoutQuery.id ?? '')
    const invoicePayload = parseTipInvoicePayload(preCheckoutQuery.invoice_payload)
    const preCheckoutCurrency = asTrimmed(preCheckoutQuery.currency ?? '').toUpperCase()
    const canProceed = areStarsTipsEnabled() && preCheckoutCurrency === 'XTR' && !!invoicePayload
    if (preCheckoutQueryId) {
      await answerTelegramPreCheckoutQuery({
        botToken,
        preCheckoutQueryId,
        ok: canProceed,
        errorMessage: canProceed ? undefined : 'Tip could not be validated. Please try again.',
      }).catch((error) => {
        console.error('[telegram/webhook] pre-checkout answer failed', {
          updateId: update.update_id ?? null,
          preCheckoutQueryId,
          err: error instanceof Error ? error.message : String(error),
        })
      })
    }
    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const paymentMessage = update.message && typeof update.message === 'object' ? update.message : null
  const successfulPayment = paymentMessage?.successful_payment
  if (paymentMessage && successfulPayment && typeof successfulPayment === 'object') {
    const paymentChatId = String(paymentMessage.chat?.id ?? '').trim()
    const paymentUserId = String(paymentMessage.from?.id ?? '').trim()
    const paymentMessageId = typeof paymentMessage.message_id === 'number' ? paymentMessage.message_id : undefined
    const tipPayload = parseTipInvoicePayload(successfulPayment.invoice_payload)
    const paymentCurrency = asTrimmed(successfulPayment.currency ?? '').toUpperCase()
    if (paymentChatId && tipPayload && paymentCurrency === 'XTR' && isStarsTipsEnabledForChat(paymentChatId)) {
      const db = await getDb()
      if (db && paymentUserId) {
        const link = await getTelegramLinkByUserId({ db, telegramUserId: paymentUserId }).catch(() => null)
        if (link && link.profileId > 0 && isAddressLike(link.canonicalCswAddress)) {
          await logTelegramActionAudit({
            db,
            telegramUserId: paymentUserId,
            chatId: paymentChatId,
            messageId: paymentMessageId,
            profileId: link.profileId,
            canonicalCswAddress: link.canonicalCswAddress,
            actionType: 'tip',
            intent: {
              source: 'telegram_stars',
              stars: tipPayload.stars,
              context: tipPayload.context,
              invoicePayload: successfulPayment.invoice_payload,
            },
            quote: {
              currency: paymentCurrency,
              totalAmount: parseOptionalPositiveInteger(successfulPayment.total_amount),
            },
            execution: {
              telegramPaymentChargeId: asTrimmed(successfulPayment.telegram_payment_charge_id ?? ''),
              providerPaymentChargeId: asTrimmed(successfulPayment.provider_payment_charge_id ?? ''),
            },
            status: 'paid',
          }).catch(() => {})
        }
      }
      await sendTelegramMessage({
        botToken,
        chatId: paymentChatId,
        text: `Thanks for the tip! ${tipPayload.stars} ⭐ received.`,
        replyToMessageId: paymentMessageId,
      }).catch((error) => {
        console.error('[telegram/webhook] tip thank-you message failed', {
          updateId: update.update_id ?? null,
          chatId: paymentChatId,
          err: error instanceof Error ? error.message : String(error),
        })
      })
    }
    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const callbackQuery = update.callback_query
  if (callbackQuery && typeof callbackQuery === 'object') {
    const callbackQueryId = String(callbackQuery.id ?? '').trim()
    const callbackData = asTrimmed(callbackQuery.data ?? '')
    const callbackMessage = callbackQuery.message && typeof callbackQuery.message === 'object' ? callbackQuery.message : null
    const chatId = String(callbackMessage?.chat?.id ?? '').trim()
    const callbackMessageId = typeof callbackMessage?.message_id === 'number' ? callbackMessage.message_id : undefined
    const userId = String(callbackQuery.from?.id ?? '').trim()
    const parsedTradeFlowCallback = parseTradeFlowCallbackData(callbackData)
    const parsedTradeCallback = parseTradeCallbackData(callbackData)
    const parsedTipCallback = parseTipCallbackData(callbackData)
    const mappedCommand = resolveHelpCallbackCommand(callbackData)
    const isMenuNavigationCallback = callbackData.startsWith('menu:') || callbackData.startsWith('help:')
    const canReplaceMenuMessage = isMenuNavigationCallback && typeof callbackMessageId === 'number'
    if (!callbackQueryId || !chatId) {
      return res.status(200).json({
        success: true,
        data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
      } satisfies ApiEnvelope<TelegramWebhookOk>)
    }

    const adminUserIds = parseAdminUserIds()
    const isAdmin = userId ? adminUserIds.has(userId) : false
    const allowAdminDm = parseBoolean(process.env.TELEGRAM_ALLOW_ADMIN_DM, true)
    const allowedChatIds = parseAllowedChatIds()
    const signalsChatId = asTrimmed(process.env.TELEGRAM_SIGNALS_CHAT_ID ?? '')
    const allowedByChat = allowedChatIds.size === 0 || allowedChatIds.has(chatId) || (signalsChatId !== '' && chatId === signalsChatId)
    const allowedByAdminDm = allowAdminDm && isAdmin && isPrivateChatId(chatId)
    if (!allowedByChat && !allowedByAdminDm) {
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

    if (!parsedTradeCallback && !parsedTradeFlowCallback) {
      try {
        await answerTelegramCallbackQuery({
          botToken,
          callbackQueryId,
          text: resolveNavigationCallbackToast(callbackData, mappedCommand),
        })
      } catch (error) {
        console.error('[telegram/webhook] callback acknowledgement failed', {
          updateId: update.update_id ?? null,
          callbackQueryId,
          err: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const groupId = resolveGroupId(chatId)
    const senderWallet = resolveSenderWallet(userId)
    const tradeCallbackResponse =
      (await handleTelegramTradeFlowCallback({
        callbackData,
        chatId,
        userId,
        messageId: callbackMessage?.message_id,
      })) ??
      (await handleTelegramTradeCallback({
        callbackData,
        chatId,
        userId,
        messageId: callbackMessage?.message_id,
        groupId,
        senderWallet,
      }))
    if (tradeCallbackResponse) {
      try {
        await answerTelegramCallbackQuery({
          botToken,
          callbackQueryId,
          text: asTrimmed(tradeCallbackResponse.callbackToast ?? ''),
        })
      } catch (error) {
        console.error('[telegram/webhook] trade callback acknowledgement failed', {
          updateId: update.update_id ?? null,
          callbackQueryId,
          err: error instanceof Error ? error.message : String(error),
        })
      }
      const chunks = splitTelegramMessage(tradeCallbackResponse.text)
      let startIdx = 0
      if (typeof callbackMessageId === 'number' && chunks.length > 0) {
        const firstChunk = chunks[0] ?? ''
        if (firstChunk) {
          await replaceTelegramMenuMessage({
            botToken,
            chatId,
            messageId: callbackMessageId,
            text: firstChunk,
            replyMarkup: tradeCallbackResponse.replyMarkup,
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
          replyToMessageId: idx === 0 && startIdx === 0 ? callbackMessage?.message_id : undefined,
          replyMarkup: idx === 0 && startIdx === 0 ? tradeCallbackResponse.replyMarkup : undefined,
        })
      }
      const signalChunks = splitTelegramMessage(asTrimmed(tradeCallbackResponse.signalText ?? ''))
      const signalDestination = resolveSignalsDestination(chatId)
      for (let idx = 0; idx < signalChunks.length; idx += 1) {
        const signalChunk = signalChunks[idx]
        if (!signalChunk) continue
        await sendTelegramMessage({
          botToken,
          chatId: signalDestination.chatId,
          text: signalChunk,
          messageThreadId: signalDestination.messageThreadId,
          replyMarkup: idx === 0 ? tradeCallbackResponse.signalReplyMarkup : undefined,
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
          text: 'Unknown menu action. Send /help to reopen the menu.',
          replyMarkup: buildHelpReplyMarkup(chatId),
        })
      } else {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: 'Unknown menu action. Send /help to reopen the menu.',
          replyToMessageId: callbackMessage?.message_id,
          replyMarkup: buildHelpReplyMarkup(chatId),
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
          replyToMessageId: callbackMessage?.message_id,
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
        messageId: callbackMessage?.message_id,
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

    const helpMarkup = response.replyMarkup
      ?? (isHelpCategoryCommand(mappedCommand)
        ? buildHelpCategoryReplyMarkup()
        : isHelpCommand(mappedCommand)
          ? buildHelpReplyMarkup(chatId)
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
          replyToMessageId: idx === 0 ? callbackMessage?.message_id : undefined,
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

  const chatId = String(message?.chat?.id ?? '').trim()
  const userId = String(message?.from?.id ?? '').trim()
  const fromBot = Boolean(message?.from?.is_bot)
  const text = asTrimmed(message.text ?? message.caption ?? '')
  const isStartCommand = /^\/start(?:\s+.*)?$/i.test(text)
  const normalizedText = normalizeTelegramCommand(text)
  if (!chatId || !text) {
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
  const allowAdminDm = parseBoolean(process.env.TELEGRAM_ALLOW_ADMIN_DM, true)
  const allowedChatIds = parseAllowedChatIds()
  const allowedByChat = allowedChatIds.size === 0 || allowedChatIds.has(chatId)
  const allowedByAdminDm = allowAdminDm && isAdmin && isPrivateChatId(chatId)
  if (!allowedByChat && !allowedByAdminDm) {
    return res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  if (isInlineLauncherCommand(normalizedText)) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text:
        'Inline shortcuts are ready. Tap a button below to pre-fill a draft in this chat, then send it.',
      replyToMessageId: message.message_id,
      replyMarkup: buildInlineLauncherReplyMarkup(),
    })
    return res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies TelegramWebhookOk,
    } satisfies ApiEnvelope<TelegramWebhookOk>)
  }

  const senderWallet = resolveSenderWallet(userId)
  const groupId = resolveGroupId(chatId)

  let response: TelegramCommandResponse = { text: '' }
  try {
    response = await executeTelegramCommand({
      text: normalizedText,
      chatId,
      userId,
      groupId,
      senderWallet,
      isAdmin,
      messageId: message.message_id,
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
  if (isStartCommand) {
    response.text = [
      'Welcome to 4626 on Telegram',
      '',
      'Use the menu below for quick actions: Link, Portfolio, Vaults, Auctions, Signals.',
      '',
      response.text,
    ].join('\n')
  }

  const chunks = splitTelegramMessage(response.text)
  const helpMarkup =
    response.replyMarkup ?? (isHelpCommand(normalizedText) ? buildHelpReplyMarkup(chatId) : undefined)
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
