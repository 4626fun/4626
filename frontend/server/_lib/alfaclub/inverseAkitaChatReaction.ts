import { arenaCommandAllowedForRoom, readArenaConfig } from '../arena/arenaConfig.js'
import { runArenaTrade } from '../arena/arenaClient.js'
import { validateArenaPair } from '../arena/arenaPairPolicy.js'
import { resolveRoomDefaultArenaIdentity } from '../arena/arenaIdentityMappingStore.js'
import { logger } from '../infra/logger.js'
import { isHermitOwner, isHermitUserAllowed } from '../hermit/policy.js'
import { deriveCounterSide, type CounterTradeSide } from './counterTradeConfig.js'
import { getPerpMarkets, type HyperliquidPerpMarket } from './hyperliquid.js'
import {
  INVERSE_AKITA_ROOM_ID,
  isInverseAkitaPilotRoom,
} from './inverseAkitaStakerPilot.js'

declare const process: { env: Record<string, string | undefined> }

const CHAT_TRADE_INTENT_RE =
  /^(?:go(?:ing)?\s+)?(long|short)\s+(?:on\s+)?([a-z0-9]{2,20})\s*[!.?]*$/i

const DEFAULT_CHAT_REACTION_SIZE_USD = 50
const DEFAULT_CHAT_REACTION_LEVERAGE_PCT = 69
const DEFAULT_FALLBACK_MAX_LEVERAGE = 10
const FALLBACK_PAIR_MAX_LEVERAGE: Record<string, number> = {
  BTC: 40,
  ETH: 25,
  SOL: 20,
}
const PERP_MARKET_CACHE_MS = 5 * 60_000
const DEFAULT_SENDER_COOLDOWN_MS = 90_000

const senderCooldownUntilMs = new Map<string, number>()
let cachedPerpMarkets: { fetchedAtMs: number; markets: HyperliquidPerpMarket[] } | null = null

function readEnvFlag(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function isInverseAkitaChatReactionEnabledByEnv(): boolean {
  return readEnvFlag('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ENABLED', true)
}

export function readInverseAkitaChatReactionSizeUsd(): number {
  const config = readArenaConfig()
  const configured = readPositiveNumberEnv(
    'INVERSE_AKITA_CHAT_REACTION_SIZE_USD',
    DEFAULT_CHAT_REACTION_SIZE_USD,
  )
  return Math.max(configured, config.minTradeSizeUsd)
}

export function readInverseAkitaChatReactionLeveragePct(): number {
  return readPositiveNumberEnv(
    'INVERSE_AKITA_CHAT_REACTION_LEVERAGE_PCT',
    DEFAULT_CHAT_REACTION_LEVERAGE_PCT,
  )
}

function readOptionalPositiveNumberEnv(name: string): number | null {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return null
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** 69% (or env pct) of Hyperliquid max leverage for the pair, floored to an integer. */
export function computeInverseAkitaChatReactionLeverage(params: {
  maxLeverage: number
  pct?: number
}): number {
  const pct = params.pct ?? readInverseAkitaChatReactionLeveragePct()
  if (!Number.isFinite(params.maxLeverage) || params.maxLeverage <= 0) return 1
  if (!Number.isFinite(pct) || pct <= 0) return 1
  return Math.max(1, Math.floor(params.maxLeverage * (pct / 100)))
}

function resolveFallbackMaxLeverage(pair: string): number {
  const normalizedPair = String(pair ?? '').trim().toUpperCase()
  return FALLBACK_PAIR_MAX_LEVERAGE[normalizedPair] ?? DEFAULT_FALLBACK_MAX_LEVERAGE
}

async function loadPerpMarketsCached(): Promise<HyperliquidPerpMarket[] | null> {
  const nowMs = Date.now()
  if (cachedPerpMarkets && nowMs - cachedPerpMarkets.fetchedAtMs < PERP_MARKET_CACHE_MS) {
    return cachedPerpMarkets.markets
  }
  const markets = await getPerpMarkets()
  if (!markets) return null
  cachedPerpMarkets = { fetchedAtMs: nowMs, markets }
  return markets
}

async function lookupPairMaxLeverage(pair: string): Promise<number | null> {
  const normalizedPair = String(pair ?? '').trim().toUpperCase()
  const markets = await loadPerpMarketsCached()
  if (!markets) return null
  const row = markets.find((market) => market.symbol.toUpperCase() === normalizedPair)
  if (!row?.maxLeverage || !Number.isFinite(row.maxLeverage) || row.maxLeverage <= 0) return null
  return row.maxLeverage
}

/** Pair-aware leverage: pct of Hyperliquid max for that asset. */
export async function resolveInverseAkitaChatReactionLeverage(pair: string): Promise<number> {
  const absoluteOverride = readOptionalPositiveNumberEnv('INVERSE_AKITA_CHAT_REACTION_LEVERAGE')
  if (absoluteOverride != null) return absoluteOverride

  const maxLeverage = (await lookupPairMaxLeverage(pair)) ?? resolveFallbackMaxLeverage(pair)
  return computeInverseAkitaChatReactionLeverage({ maxLeverage })
}

export function readInverseAkitaChatReactionCooldownMs(): number {
  return readPositiveNumberEnv('INVERSE_AKITA_CHAT_REACTION_COOLDOWN_MS', DEFAULT_SENDER_COOLDOWN_MS)
}

export type ParsedInverseAkitaChatTradeIntent = {
  userSide: CounterTradeSide
  pair: string
}

export type InverseAkitaChatHistoryMessage = {
  id?: string | number | null
  date?: number | string | null
  sender?: string | null
  text?: string | null
  isBot?: boolean | null
}

export function parseInverseAkitaChatTradeIntent(text: string): ParsedInverseAkitaChatTradeIntent | null {
  const trimmed = String(text ?? '').trim()
  if (!trimmed || trimmed.startsWith('/')) return null
  const match = CHAT_TRADE_INTENT_RE.exec(trimmed)
  if (!match) return null
  const userSide = match[1]?.toLowerCase()
  const pair = match[2]?.toUpperCase()
  if (userSide !== 'long' && userSide !== 'short') return null
  if (!pair) return null
  return { userSide, pair }
}

export type InverseAkitaChatTradeIntentMessage = {
  id: string
  date: number
  sender: string
  text: string
  userSide: CounterTradeSide
  pair: string
}

function isHexAddress(value: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(value.trim())
}

function shouldSkipInverseChatReactionSender(senderLower: string): boolean {
  if (!isHexAddress(senderLower)) return true
  if (isHermitUserAllowed(senderLower) || isHermitOwner(senderLower)) return true
  return false
}

function isCommandLikeChatText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('/')) return true
  if (/^arena(?:\s|$)/i.test(trimmed)) return true
  if (/^gmeow+\b/i.test(trimmed)) return true
  return false
}

/** Collect casual trade-intent chat lines like "long btc" for room 1659 inverse reactions. */
export function collectInverseAkitaChatTradeIntents(params: {
  roomId: string
  messages: InverseAkitaChatHistoryMessage[]
  selfAddress?: string
}): InverseAkitaChatTradeIntentMessage[] {
  if (!isInverseAkitaPilotRoom(params.roomId)) return []
  if (!isInverseAkitaChatReactionEnabledByEnv()) return []

  const self = String(params.selfAddress ?? '').trim().toLowerCase()
  const out: InverseAkitaChatTradeIntentMessage[] = []

  for (const message of params.messages) {
    if (message.isBot === true) continue
    const id = String(message.id ?? '').trim()
    const sender = String(message.sender ?? '').trim().toLowerCase()
    const text = String(message.text ?? '').trim()
    if (!id || !text || isCommandLikeChatText(text)) continue
    if (self && sender === self) continue
    if (shouldSkipInverseChatReactionSender(sender)) continue

    const parsed = parseInverseAkitaChatTradeIntent(text)
    if (!parsed) continue

    const date = Number(message.date)
    out.push({
      id,
      date: Number.isFinite(date) ? date : 0,
      sender,
      text,
      userSide: parsed.userSide,
      pair: parsed.pair,
    })
  }

  return out
}

export function formatInverseAkitaChatReactionReply(params: {
  userSide: CounterTradeSide
  pair: string
  counterSide: CounterTradeSide
  sizeUsd: number
  leverage: number
  dryRun: boolean
  tradeOk: boolean
}): string {
  const action = params.counterSide === 'short' ? 'shorted' : 'longed'
  const failAction = params.counterSide
  if (params.tradeOk || params.dryRun) {
    return `you said ${params.userSide} ${params.pair}. i ${action} ${params.pair} instead lol (${params.sizeUsd} @ ${params.leverage}x)`
  }
  return `you said ${params.userSide} ${params.pair}. i tried to ${failAction} ${params.pair} instead — trade failed`
}

export function isInverseAkitaChatReactionSenderCoolingDown(
  sender: string,
  nowMs = Date.now(),
): boolean {
  const until = senderCooldownUntilMs.get(sender.trim().toLowerCase()) ?? 0
  return until > nowMs
}

export function markInverseAkitaChatReactionSenderCooldown(
  sender: string,
  nowMs = Date.now(),
): void {
  const normalized = sender.trim().toLowerCase()
  senderCooldownUntilMs.set(
    normalized,
    nowMs + readInverseAkitaChatReactionCooldownMs(),
  )
}

/** For unit tests only. */
export function __resetInverseAkitaChatReactionCooldownForTests(): void {
  senderCooldownUntilMs.clear()
}

export function __resetInverseAkitaChatReactionMarketCacheForTests(): void {
  cachedPerpMarkets = null
}

export type InverseAkitaChatReactionResult = {
  ok: boolean
  skipped?: boolean
  skipReason?: string
  replyText: string
  counterSide: CounterTradeSide
  pair: string
}

export async function executeInverseAkitaChatReaction(params: {
  roomId: string
  intent: InverseAkitaChatTradeIntentMessage
}): Promise<InverseAkitaChatReactionResult> {
  const roomId = String(params.roomId ?? '').trim()
  if (!isInverseAkitaPilotRoom(roomId)) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'wrong_room',
      replyText: '',
      counterSide: 'short',
      pair: params.intent.pair,
    }
  }
  if (!isInverseAkitaChatReactionEnabledByEnv()) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'disabled',
      replyText: '',
      counterSide: deriveCounterSide(params.intent.userSide),
      pair: params.intent.pair,
    }
  }
  if (!arenaCommandAllowedForRoom(roomId)) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'arena_room_blocked',
      replyText: '',
      counterSide: deriveCounterSide(params.intent.userSide),
      pair: params.intent.pair,
    }
  }
  if (isInverseAkitaChatReactionSenderCoolingDown(params.intent.sender)) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'sender_cooldown',
      replyText: '',
      counterSide: deriveCounterSide(params.intent.userSide),
      pair: params.intent.pair,
    }
  }

  const baseConfig = readArenaConfig()
  if (!baseConfig.enabled || !baseConfig.tradingEnabled) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'arena_trading_disabled',
      replyText: '',
      counterSide: deriveCounterSide(params.intent.userSide),
      pair: params.intent.pair,
    }
  }

  const pairCheck = validateArenaPair(params.intent.pair, baseConfig)
  if (!pairCheck.ok) {
    return {
      ok: false,
      skipped: true,
      skipReason: pairCheck.reason,
      replyText: '',
      counterSide: deriveCounterSide(params.intent.userSide),
      pair: params.intent.pair,
    }
  }

  const identity = await resolveRoomDefaultArenaIdentity({ roomId, baseConfig })
  const counterSide = deriveCounterSide(params.intent.userSide)
  const sizeUsd = readInverseAkitaChatReactionSizeUsd()
  const leverage = await resolveInverseAkitaChatReactionLeverage(pairCheck.normalizedPair)
  const executionConfig = {
    ...baseConfig,
    agentId: identity.agentId,
    agentWalletAddress: identity.agentWalletAddress,
    hlApiWalletAddress: identity.hlApiWalletAddress,
  }

  if (!executionConfig.agentWalletAddress) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'missing_executor_wallet',
      replyText: '',
      counterSide,
      pair: pairCheck.normalizedPair,
    }
  }

  const trade = await runArenaTrade(
    {
      action: 'open',
      pair: pairCheck.normalizedPair,
      side: counterSide,
      sizeUsd,
      leverage,
    },
    executionConfig,
  )

  markInverseAkitaChatReactionSenderCooldown(params.intent.sender)

  const replyText = formatInverseAkitaChatReactionReply({
    userSide: params.intent.userSide,
    pair: pairCheck.normalizedPair,
    counterSide,
    sizeUsd,
    leverage,
    dryRun: baseConfig.dryRun,
    tradeOk: trade.ok,
  })

  logger.info('inverse_akita.chat_reaction', {
    roomId,
    messageId: params.intent.id,
    sender: params.intent.sender,
    userSide: params.intent.userSide,
    counterSide,
    pair: pairCheck.normalizedPair,
    sizeUsd,
    leverage,
    tradeOk: trade.ok,
    dryRun: baseConfig.dryRun,
  })

  return {
    ok: trade.ok,
    replyText,
    counterSide,
    pair: pairCheck.normalizedPair,
  }
}
