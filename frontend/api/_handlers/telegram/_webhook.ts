import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PrivyClient } from '@privy-io/server-auth'
import { createPublicClient, encodeFunctionData, formatUnits, getAddress, http, parseEther, type Address } from 'viem'
import { base } from 'viem/chains'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
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
  ensureTelegramTradingSchema,
  getTelegramLinkByUserId,
  getTelegramPortfolioSummary,
  logTelegramActionAudit,
  listTelegramAuctions,
  listTelegramScopedVaults,
  listTelegramSignals,
  listTelegramUserBids,
  revokeTelegramLink,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
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

type TelegramUpdate = {
  update_id?: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  inline_query?: TelegramInlineQuery
  callback_query?: TelegramCallbackQuery
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
  'portfolio',
  'vaults',
  'list',
  'auctions',
  'mybids',
  'signals',
  'buy',
  'sell',
  'bid',
])

const TELEGRAM_COMMAND_HEADS = [
  'help',
  'keepr',
  'link',
  'linked',
  'unlink',
  'portfolio',
  'vaults',
  'list',
  'auctions',
  'mybids',
  'signals',
  'buy',
  'sell',
  'bid',
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
}

function wrapCommandListingsWithBackticks(text: string): string {
  const formatCommandForBackticks = (rawCommand: string): string => {
    const command = asTrimmed(rawCommand)
    if (!command || command.includes('`')) return command
    const tokens = command.split(/\s+/g).filter(Boolean)
    if (tokens.length === 0) return command

    const hasPlaceholder = tokens.some((token) => /^<[^>]+>$/.test(token) || /^\$<[^>]+>$/.test(token))
    if (!hasPlaceholder) return `\`${command}\``

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
    if (head.length === 0) return `\`${command}\``
    return remainder ? `\`${head.join(' ')}\` ${remainder}` : `\`${head.join(' ')}\``
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

function parseTradeCallbackData(rawData: string):
  | { kind: 'confirm' | 'cancel'; token: string }
  | { kind: 'edit'; actionType: 'buy' | 'sell' | 'bid' }
  | null {
  const data = asTrimmed(rawData)
  if (!data.startsWith('trade:')) return null
  const parts = data.split(':')
  const kind = asTrimmed(parts[1]).toLowerCase()
  if (kind === 'confirm' || kind === 'cancel') {
    const token = asTrimmed(parts[2])
    if (!token) return null
    return { kind, token }
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
  actionType: 'buy' | 'sell' | 'bid'
  token: string
}): Record<string, unknown> {
  return {
    inline_keyboard: [
      [{ text: 'Confirm', callback_data: `trade:confirm:${params.token}` }],
      [{ text: 'Edit Amount', callback_data: `trade:edit:${params.actionType}` }],
      [{ text: 'Cancel', callback_data: `trade:cancel:${params.token}` }],
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
  if (actionType === 'buy') return 'Edit amount and resend: /buy <vault-address> <eth-amount> --confirm'
  if (actionType === 'sell') return 'Edit amount and resend: /sell <vault-address> <share-amount> --confirm'
  return 'Edit amount and resend: /bid <vault-address> $<usd-amount> --confirm'
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

function buildInlineQueryResults(rawQuery: string): Array<Record<string, unknown>> {
  const query = asTrimmed(rawQuery)
  const xPostCommand = `/x post ${normalizeInlineDraft(query)} --confirm`
  const aiPrompt = query ? `/ai ${query}` : '/ai What should I do next?'
  const marketQuote = `/mkt quote ${inferMarketSymbol(query)}`
  const tradeIntent = parseTelegramTradeIntent(query.startsWith('/') ? query : `/${query}`)
  const tradeResult: Record<string, unknown>[] = []
  if (tradeIntent) {
    const tradeCommand =
      tradeIntent.actionType === 'bid'
        ? `/bid ${tradeIntent.identifier} $${tradeIntent.amountInput} --confirm`
        : `/${tradeIntent.actionType} ${tradeIntent.identifier} ${tradeIntent.amountInput} --confirm`
    tradeResult.push({
      type: 'article',
      id: 'trade-copy',
      title: `Reuse ${tradeIntent.actionType.toUpperCase()} command`,
      description: tradeCommand,
      input_message_content: { message_text: tradeCommand },
    })
  }

  return [
    ...tradeResult,
    {
      type: 'article',
      id: 'help',
      title: 'Keepr Help',
      description: 'Insert /help',
      input_message_content: { message_text: '/help' },
    },
    {
      type: 'article',
      id: 'status',
      title: 'Vault Status',
      description: 'Insert /keepr status',
      input_message_content: { message_text: '/keepr status' },
    },
    {
      type: 'article',
      id: 'xpost',
      title: 'Draft X Post',
      description: 'Insert /x post ... --confirm',
      input_message_content: { message_text: xPostCommand },
    },
    {
      type: 'article',
      id: 'ai',
      title: 'Ask Keepr AI',
      description: 'Insert /ai <question>',
      input_message_content: { message_text: aiPrompt },
    },
    {
      type: 'article',
      id: 'mkt',
      title: 'Market Quote',
      description: 'Insert /mkt quote <symbol>',
      input_message_content: { message_text: marketQuote },
    },
  ]
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
    if (action === 'buy') return '/buy vault 0.05 --confirm'
    if (action === 'sell') return '/sell vault 100 --confirm'
    if (action === 'bid') return '/bid vault $250 --confirm'
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

async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  text: string
  replyToMessageId?: number
  messageThreadId?: number
  replyMarkup?: Record<string, unknown>
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/sendMessage`
  const formattedText = wrapCommandListingsWithBackticks(params.text)
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
  const formattedText = wrapCommandListingsWithBackticks(params.text)
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
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerInlineQuery`
  const payload = {
    inline_query_id: params.inlineQueryId,
    cache_time: 5,
    is_personal: true,
    results: buildInlineQueryResults(params.query),
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
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/answerCallbackQuery`
  const payload: Record<string, unknown> = {
    callback_query_id: params.callbackQueryId,
  }
  if (asTrimmed(params.text).length > 0) {
    payload.text = asTrimmed(params.text)
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

async function executeTelegramNativeCommand(params: {
  text: string
  chatId: string
  userId: string
  messageId?: number
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

    const scopedVaults = await listTelegramScopedVaults({ db: db as any, chatId: params.chatId })
    const target = resolveTradeTarget(scopedVaults, tradeIntent.identifier)
    if (!target) {
      return {
        text: [
          'Trade blocked',
          '',
          '- target vault not found in this chat scope',
          '- use /vaults to list allowed vaults',
          '- use /buy <vault-address> <amount> --confirm',
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
        actionType: tradeIntent.actionType,
        token: tradeToken.token,
      }),
    }
  }

  return null
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
  const targetAddress = isAddressLike(params.targetAddress) ? params.targetAddress.toLowerCase() : null

  if (params.actionType === 'buy') {
    lines.push(`Size: ${params.amountInput} ETH (~$${formatAmount(params.usdEstimate ?? 0, 2)})`)
    if (targetAddress) {
      lines.push(`Copy: /buy ${targetAddress} ${params.amountInput} --confirm`)
    }
  } else if (params.actionType === 'sell') {
    lines.push(`Size: ${params.amountInput} SHARE (~$${formatAmount(params.usdEstimate ?? 0, 2)})`)
    if (targetAddress) {
      lines.push(`Copy: /sell ${targetAddress} ${params.amountInput} --confirm`)
    }
  } else {
    lines.push(`Size: ${formatAmount(params.amountEth ?? 0, 6)} ETH (intent ~$${formatAmount(params.usdEstimate ?? 0, 2)})`)
    if (targetAddress) {
      lines.push(`Copy: /bid ${targetAddress} $${params.amountInput} --confirm`)
    }
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
  const amount = asTrimmed(params.amountInput)
  if (!amount) return undefined

  const command =
    params.actionType === 'bid'
      ? `/bid ${target} $${amount} --confirm`
      : `/${params.actionType} ${target} ${amount} --confirm`
  const editCommand =
    params.actionType === 'bid'
      ? `/bid ${target} $<new-usd-amount> --confirm`
      : params.actionType === 'buy'
        ? `/buy ${target} <new-eth-amount> --confirm`
        : `/sell ${target} <new-share-amount> --confirm`
  const reuseLabel =
    params.actionType === 'buy' ? 'Reuse Buy' : params.actionType === 'sell' ? 'Reuse Sell' : 'Reuse Bid'
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

  return {
    inline_keyboard: [
      [{ text: reuseLabel, switch_inline_query_current_chat: command }],
      [
        { text: 'Edit Amount', switch_inline_query_current_chat: editCommand },
        { text: 'Open Portfolio', callback_data: 'menu:portfolio' },
      ],
      [{ text: 'View Vault', url: vaultUrl }],
    ],
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
    return { text: tradeEditHint(callback.actionType) }
  }

  const db = await getDb()
  if (!db) {
    return { text: 'Trade action unavailable while database is offline. Please retry in a few seconds.' }
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
    return { text: formatTradeTokenFailure(consumed.reason) }
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
    }
  }

  if (callback.kind === 'cancel') {
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
    return { text: `Cancelled ${actionTypeSafe.toUpperCase()} preview.` }
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
        }),
      }
    }
    return {
      text: [
        `Failed ${actionTypeSafe.toUpperCase()} execution`,
        '',
        execution.response || 'Execution failed. Retry with a fresh preview.',
      ].join('\n'),
    }
  }

  if (actionTypeSafe === 'bid') {
    if (!isAddressLike(link.canonicalCswAddress)) {
      return { text: 'Bid blocked: canonical wallet is not available.' }
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
        }),
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
      }
    }
  }

  return { text: 'Unsupported trade action.' }
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

  const callbackQuery = update.callback_query
  if (callbackQuery && typeof callbackQuery === 'object') {
    const callbackQueryId = String(callbackQuery.id ?? '').trim()
    const callbackData = asTrimmed(callbackQuery.data ?? '')
    const callbackMessage = callbackQuery.message && typeof callbackQuery.message === 'object' ? callbackQuery.message : null
    const chatId = String(callbackMessage?.chat?.id ?? '').trim()
    const callbackMessageId = typeof callbackMessage?.message_id === 'number' ? callbackMessage.message_id : undefined
    const userId = String(callbackQuery.from?.id ?? '').trim()
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

    try {
      await answerTelegramCallbackQuery({ botToken, callbackQueryId })
    } catch (error) {
      console.error('[telegram/webhook] callback acknowledgement failed', {
        updateId: update.update_id ?? null,
        callbackQueryId,
        err: error instanceof Error ? error.message : String(error),
      })
    }

    const groupId = resolveGroupId(chatId)
    const senderWallet = resolveSenderWallet(userId)
    const tradeCallbackResponse = await handleTelegramTradeCallback({
      callbackData,
      chatId,
      userId,
      messageId: callbackMessage?.message_id,
      groupId,
      senderWallet,
    })
    if (tradeCallbackResponse) {
      const chunks = splitTelegramMessage(tradeCallbackResponse.text)
      for (let idx = 0; idx < chunks.length; idx += 1) {
        const chunk = chunks[idx]
        if (!chunk) continue
        await sendTelegramMessage({
          botToken,
          chatId,
          text: chunk,
          replyToMessageId: idx === 0 ? callbackMessage?.message_id : undefined,
          replyMarkup: idx === 0 ? tradeCallbackResponse.replyMarkup : undefined,
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

    const mappedCommand = resolveHelpCallbackCommand(callbackData)
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
