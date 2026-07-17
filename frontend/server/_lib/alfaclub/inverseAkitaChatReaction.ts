import { arenaCommandAllowedForRoom, readArenaConfig } from '../arena/arenaConfig.js'
import {
  parseTradeFillFromOutput,
  resolveOpenArenaPositionSide,
  runArenaOpenPositions,
  runArenaTrade,
} from '../arena/arenaClient.js'
import { validateArenaPair } from '../arena/arenaPairPolicy.js'
import { resolveRoomDefaultArenaIdentity } from '../arena/arenaIdentityMappingStore.js'
import { logger } from '../infra/logger.js'
import { deriveCounterSide, type CounterTradeSide } from './counterTradeConfig.js'
import {
  isInverseAkitaBotAuthoredChatText,
  isRegisteredInverseAkitaBotOutboundText,
  registerInverseAkitaBotOutboundText,
  resetInverseAkitaBotOutboundTextRegistryForTests,
} from './inverseAkitaBotAuthoredText.js'
export {
  isInverseAkitaBotAuthoredChatText,
  isRegisteredInverseAkitaBotOutboundText,
  registerInverseAkitaBotOutboundText,
} from './inverseAkitaBotAuthoredText.js'
import { getAllPerpMarkets, type HyperliquidPerpMarket } from './hyperliquid.js'
import {
  INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID,
  isInverseAkitaChatReactionRoom,
  resolveInverseAkitaChatAuthorAccess,
} from './inverseAkitaChatReactionPolicy.js'
import {
  classifyInverseAkitaChatOpinion,
  type InverseAkitaChatLlmClassifierConfig,
} from './inverseAkitaChatLlmClassifier.js'
import {
  claimInverseOpinionTradeIntent,
  recordInverseOpinionTradeSubmitted,
  recordInverseOpinionTradeTerminal,
  recordInverseOpinionTradeUnknown,
  type InverseOpinionParseMode,
} from './inverseOpinionTradeRecorder.js'
import { isInverseOpinionTradeCaptureEnabled } from './inverseOpinionTradeCaptureConfig.js'
import { reconcileInverseOpinionTrades } from './inverseOpinionTradeReconciler.js'
import { formatInverseOpinionSkipReply } from './inverseOpinionTerminalReplyFormatter.js'
import type { OpinionTradeDecision } from './inverseOpinionTradeStore.js'
import { isRailwayRuntimeEnv } from './keeprAlfaClubSplit.js'
import {
  isInverseAkitaChatSelfSender,
  isInverseAkitaChatSelfUsername,
  readInverseAkitaChatSelfSenderAddresses,
} from './inverseAkitaChatSelfSenders.js'
import {
  isAlfaClubChipUsername,
  isAlfaClubTradeCompletedSender,
  parseInverseAkitaChatTradeEvent,
  resolveInverseAkitaTradeEventAuthor,
} from './inverseAkitaChatTradeEvent.js'
import { readRoomLabelStatus } from './roomLabelCache.js'

declare const process: { env: Record<string, string | undefined> }

const CHAT_TRADE_INTENT_RE =
  /^(?:go(?:ing)?\s+)?(long|short)\s+(?:on\s+)?((?:[a-z0-9]{1,12}:)?[a-z0-9]{2,20})\s*[!.?]*$/i

const QUALIFIED_TRADE_INTENT_RE =
  /\b(?:should\s+i|shall\s+i|can\s+i|would\s+you\s+say\s+i\s+should|do\s+you\s+think\s+i\s+should)\s+(?:go\s+)?(long|short)\s+(?:on\s+)?((?:[a-z0-9]{1,12}:)?[a-z0-9]{2,20})\b/i

const MENTION_LED_TRADE_INTENT_RE =
  /\b(long|short)\s+(?:on\s+)?((?:[a-z0-9]{1,12}:)?[a-z0-9]{2,20})\b/i

function normalizeChatTradeIntentText(text: string): string {
  return text
    .replace(/@[\w.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Known Hyperliquid perp aliases so the loose sentiment parser only fires on
 * real assets (or explicit $TICKER), not random words. Deliberately excludes
 * ambiguous everyday words like "ton".
 */
const PAIR_ALIASES: Record<string, string> = {
  btc: 'BTC', bitcoin: 'BTC', xbt: 'BTC',
  eth: 'ETH', ethereum: 'ETH', ether: 'ETH',
  sol: 'SOL', solana: 'SOL',
  doge: 'DOGE', dogecoin: 'DOGE',
  xrp: 'XRP', ripple: 'XRP',
  ada: 'ADA', cardano: 'ADA',
  avax: 'AVAX', avalanche: 'AVAX',
  link: 'LINK', chainlink: 'LINK',
  sui: 'SUI',
  apt: 'APT', aptos: 'APT',
  arb: 'ARB', arbitrum: 'ARB',
  op: 'OP', optimism: 'OP',
  pol: 'POL', matic: 'POL', polygon: 'POL',
  ltc: 'LTC', litecoin: 'LTC',
  bnb: 'BNB',
  near: 'NEAR',
  dot: 'DOT', polkadot: 'DOT',
  atom: 'ATOM', cosmos: 'ATOM',
  uni: 'UNI', uniswap: 'UNI',
  aave: 'AAVE',
  hype: 'HYPE', hyperliquid: 'HYPE',
  pepe: 'PEPE',
  wif: 'WIF',
  bonk: 'BONK',
  shib: 'SHIB',
  trx: 'TRX', tron: 'TRX',
  ena: 'ENA',
  ondo: 'ONDO',
  sei: 'SEI',
  tia: 'TIA', celestia: 'TIA',
  inj: 'INJ', injective: 'INJ',
  jup: 'JUP', jupiter: 'JUP',
  ldo: 'LDO', lido: 'LDO',
  mkr: 'MKR', maker: 'MKR',
  crv: 'CRV', curve: 'CRV',
  fartcoin: 'FARTCOIN',
  kas: 'KAS', kaspa: 'KAS',
  xlm: 'XLM', stellar: 'XLM',
  bch: 'BCH',
  fil: 'FIL', filecoin: 'FIL',
  wld: 'WLD', worldcoin: 'WLD',
  ordi: 'ORDI',
  popcat: 'POPCAT',
  pnut: 'PNUT',
  moodeng: 'MOODENG',
  pengu: 'PENGU',
  trump: 'TRUMP',
  eigen: 'EIGEN',
  zro: 'ZRO', layerzero: 'ZRO',
  strk: 'STRK', starknet: 'STRK',
  render: 'RENDER', rndr: 'RENDER',
  virtual: 'VIRTUAL', virtuals: 'VIRTUAL',
  ai16z: 'AI16Z',
  aixbt: 'AIXBT',
  zora: 'ZORA',
}

const MARKET_CONCEPT_CANDIDATES: Record<string, readonly string[]> = {
  oil: ['xyz:CL', 'xyz:BRENTOIL', 'flx:OIL', 'cash:WTI', 'km:USOIL', 'mkts:USOIL'],
  crude: ['xyz:CL', 'xyz:BRENTOIL', 'flx:OIL', 'cash:WTI', 'km:USOIL', 'mkts:USOIL'],
  brent: ['xyz:BRENTOIL'],
}

function normalizeMarketSymbol(symbol: string): string {
  const trimmed = symbol.trim().replace(/^\$/, '')
  if (!trimmed.includes(':')) return trimmed.toUpperCase()
  const [dex, pair] = trimmed.split(':', 2)
  return `${dex.toLowerCase()}:${(pair ?? '').toUpperCase()}`
}

function resolveListedMarketSymbol(
  candidate: string,
  markets: readonly HyperliquidPerpMarket[],
): string | null {
  const matches = listListedMarketSymbols(candidate, markets)
  return matches.length === 1 ? matches[0]! : null
}

function listListedMarketSymbols(
  candidate: string,
  markets: readonly HyperliquidPerpMarket[],
): string[] {
  const normalized = normalizeMarketSymbol(candidate)
  const exact = markets.find(
    (market) => normalizeMarketSymbol(market.symbol).toLowerCase() === normalized.toLowerCase(),
  )
  if (exact) return [normalizeMarketSymbol(exact.symbol)]
  if (normalized.includes(':')) return []

  return markets
    .map((market) => normalizeMarketSymbol(market.symbol))
    .filter((listed) => listed.includes(':') && listed.split(':', 2)[1] === normalized)
}

/** Extract the first recognizable listed perp asset from casual chat ($TICKER wins). */
export function extractChatMarketAsset(
  text: string,
  availableMarkets?: readonly HyperliquidPerpMarket[],
): string | null {
  const dollarMatch = /\$((?:[a-z0-9]{1,12}:)?[a-z0-9]{2,20})\b/i.exec(text)
  if (dollarMatch) {
    const raw = dollarMatch[1]!.toLowerCase()
    if (availableMarkets) return resolveListedMarketSymbol(raw, availableMarkets)
    return PAIR_ALIASES[raw] ?? raw.toUpperCase()
  }
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
    const conceptCandidates = MARKET_CONCEPT_CANDIDATES[word]
    if (conceptCandidates) {
      if (!availableMarkets) return conceptCandidates[0] ?? null
      const listed = conceptCandidates.flatMap((candidate) =>
        listListedMarketSymbols(candidate, availableMarkets),
      )
      return listed.length === 1 ? listed[0]! : null
    }
    const mapped = PAIR_ALIASES[word]
    if (mapped) return mapped
  }
  if (availableMarkets) {
    const marketToken = '((?:[a-z0-9]{1,12}:)?[a-z0-9]{2,20})'
    const contextualCandidates = [
      new RegExp(`\\b(?:bullish|bearish|long|short|buy|sell|bid|fade)\\s+(?:on\\s+)?${marketToken}\\b`, 'i'),
      new RegExp(
        `\\b${marketToken}\\s+(?:looks?|is|seems?|feels?|has|gonna|going|could|will|to|moon|pump|dump|crash|nuke|rally|rip)\\b`,
        'i',
      ),
    ]
    for (const pattern of contextualCandidates) {
      const candidate = pattern.exec(text)?.[1]
      if (!candidate) continue
      const resolved = resolveListedMarketSymbol(candidate, availableMarkets)
      if (resolved) return resolved
    }
  }
  return null
}

export type InverseAkitaMarketClarification = {
  concept: string
  candidates: string[]
}

function extractChatMarketAmbiguity(
  text: string,
  availableMarkets: readonly HyperliquidPerpMarket[],
): InverseAkitaMarketClarification | null {
  const dollarMatch = /\$((?:[a-z0-9]{1,12}:)?[a-z0-9]{2,20})\b/i.exec(text)
  if (dollarMatch) {
    const concept = dollarMatch[1]!
    const candidates = listListedMarketSymbols(concept, availableMarkets)
    if (candidates.length > 1) return { concept, candidates }
  }

  for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
    const conceptCandidates = MARKET_CONCEPT_CANDIDATES[word]
    if (!conceptCandidates) continue
    const candidates = conceptCandidates.flatMap((candidate) =>
      listListedMarketSymbols(candidate, availableMarkets),
    )
    if (candidates.length > 1) return { concept: word, candidates }
  }
  return null
}

/**
 * Loose market-sentiment lexicon. Any opinion-sounding phrase counts; the
 * decisive direction (long vs short) is the user's lean we then invert.
 */
const BULLISH_SENTIMENT_RES: RegExp[] = [
  /\blong(?:ing|ed)?\b/i,
  /\bbull(?:ish|s)?\b/i,
  /\bpump(?:s|ing|ed)?\b/i,
  /\bmoon(?:ing|shot|s)?\b/i,
  /\bsend(?:ing)?\s+it\b/i,
  /\brip(?:s|ping)\b/i,
  /\brally(?:ing)?\b/i,
  /\bbreak(?:s|ing)?\s?out\b/i,
  /\bath\b/i,
  /\bup\s?only\b/i,
  /\bgoing\s+(?:up|higher)\b/i,
  /\bbuy(?:ing)?\b/i,
  /\bbid(?:ding)?\b/i,
  /\baccumulat(?:e|ing|ed)\b/i,
  /\bap(?:e|ing|ed)\s+(?:in|into)?\b/i,
  /\bload(?:ing)?\s+(?:up|the\s+boat)\b/i,
  /\bundervalued\b/i,
  /\bcheap\b/i,
  /\bprint(?:s|ing)\b/i,
  /\bgod\s+candle\b/i,
  /\bsupercycle\b/i,
  /\bnumber\s+go\s+up\b/i,
  /\bso\s+back\b/i,
  /\blook(?:s|ing)?\s+(?:good|strong|great|juicy|ready|bullish)\b/i,
  /\bto\s+\$?\d*[1-9]\d*(?:\.\d+)?k?\b/i,
  /\bgonna\s+(?:run|rip|fly|pump|moon|send)\b/i,
]

const BEARISH_SENTIMENT_RES: RegExp[] = [
  /\bshort(?:ing|ed)?\b/i,
  /\bbear(?:ish|s)?\b/i,
  /\bdump(?:s|ing|ed)?\b/i,
  /\bcrash(?:ing|es)?\b/i,
  /\bnuke(?:s|d|ing)?\b/i,
  /\btank(?:s|ing|ed)?\b/i,
  /\bbleed(?:s|ing)?\b/i,
  /\brug(?:ged|pull|s)?\b/i,
  /\brekt\b/i,
  /\bcooked\b/i,
  /\bdead\b/i,
  /\bit'?s\s+over\b/i,
  /\bovervalued\b/i,
  /\bweak\b/i,
  /\bheavy\b/i,
  /\bugly\b/i,
  /\bdrop(?:s|ping|ped)?\b/i,
  /\bdown\s?bad\b/i,
  /\bgoing\s+(?:down|lower)\b/i,
  /\bsell(?:ing)?\b/i,
  /\bfad(?:e|ing)\b/i,
  /\btop\s+(?:is\s+)?in\b/i,
  /\btopped\b/i,
  /\bto\s+(?:zero|\$?0)\b/i,
  /\bcapitulat(?:e|ion|ing)\b/i,
  /\bcorrection\b/i,
  /\bpull\s?back\b/i,
  /\blos(?:e|ing|t)\s+(?:all\s+)?momentum\b/i,
  /\bngmi\b/i,
  /\bexit\s+liquidity\b/i,
  /\brip\b(?!(?:s|ping))/i,
  /\blook(?:s|ing)?\s+(?:bad|weak|terrible|cooked|grim|bearish|heavy|rough)\b/i,
]

const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'isnt', "isn't", 'aint', "ain't",
  'dont', "don't", 'doesnt', "doesn't", 'wont', "won't",
  'wouldnt', "wouldn't", 'cant', "can't", 'nothing',
])

function isNegatedAt(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 32), matchIndex)
  const words = before.toLowerCase().split(/[^a-z']+/).filter(Boolean)
  return words.slice(-3).some((word) => NEGATION_WORDS.has(word))
}

function scoreSentiment(text: string, patterns: RegExp[]): { score: number; flipped: number } {
  let score = 0
  let flipped = 0
  for (const re of patterns) {
    const match = re.exec(text)
    if (!match) continue
    if (isNegatedAt(text, match.index)) flipped += 1
    else score += 1
  }
  return { score, flipped }
}

/**
 * Detect the user's directional lean from arbitrary market chatter.
 * Negated terms ("not bullish") count toward the opposite side.
 */
export function detectChatMarketSentiment(text: string): CounterTradeSide | null {
  const bull = scoreSentiment(text, BULLISH_SENTIMENT_RES)
  const bear = scoreSentiment(text, BEARISH_SENTIMENT_RES)
  const longScore = bull.score + bear.flipped
  const shortScore = bear.score + bull.flipped
  if (longScore > shortScore) return 'long'
  if (shortScore > longScore) return 'short'
  return null
}

function parseTradeIntentMatch(match: RegExpExecArray): ParsedInverseAkitaChatTradeIntent | null {
  const userSide = match[1]?.toLowerCase()
  const pair = match[2]?.toUpperCase()
  if (userSide !== 'long' && userSide !== 'short') return null
  if (!pair) return null
  return { userSide, pair }
}

/** Reaction on the user's trigger message — alternates 🔄 / 🙃 per message id. */
export const INVERSE_AKITA_CHAT_REACTION_EMOJIS = ['🔄', '🙃'] as const

function pickDeterministicIndex(seed: string, count: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return count > 0 ? hash % count : 0
}

export function resolveInverseAkitaChatReactionEmoji(seed: string): (typeof INVERSE_AKITA_CHAT_REACTION_EMOJIS)[number] {
  const normalized = String(seed ?? '').trim() || 'inverse'
  return INVERSE_AKITA_CHAT_REACTION_EMOJIS[
    pickDeterministicIndex(normalized, INVERSE_AKITA_CHAT_REACTION_EMOJIS.length)
  ]
}

type InverseReplyContext = {
  pair: string
  userSide: CounterTradeSide
  counterSide: CounterTradeSide
  existingSide?: CounterTradeSide
  sizeUsd: number
  leverage: number
}

export type InverseChatPositionAction = 'open' | 'add' | 'trim'

/** How to adjust the book before/instead of a naive counter-side open. */
export function resolveInverseChatPositionAction(params: {
  openSide: CounterTradeSide | null
  counterSide: CounterTradeSide
}): InverseChatPositionAction {
  if (!params.openSide) return 'open'
  if (params.openSide === params.counterSide) return 'add'
  return 'trim'
}

const LONG_USER_SHORT_BOT_SUCCESS: Array<(ctx: InverseReplyContext) => string> = [
  (c) =>
    `wow, long ${c.pair}? brave. i shorted it anyway. you're welcome ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `cute thesis. i heard "please short ${c.pair}" and obeyed ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `you typed long ${c.pair}. my wallet typed short ${c.pair}. we are not the same ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `thanks for the free counter-signal. short ${c.pair} is live ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `long ${c.pair} in this chat? immediately shorted. call it alpha ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `bold public call. i faded you and shorted ${c.pair}. no notes ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `i don't follow your bias, i invert it. short ${c.pair} deployed ($${c.sizeUsd} @ ${c.leverage}x)`,
]

const SHORT_USER_LONG_BOT_SUCCESS: Array<(ctx: InverseReplyContext) => string> = [
  (c) =>
    `short ${c.pair}? cute. i went long out of pure spite ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `bearish fanfic noted. i longed ${c.pair} instead ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `you said short ${c.pair}. i said long ${c.pair}. trust issues? ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `thanks for the exit liquidity narrative. i'm long ${c.pair} now ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `short ${c.pair} is wild energy. i countered long. cope ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `your short take was adorable. i longed ${c.pair} professionally ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) =>
    `i don't mirror, i menace. long ${c.pair} is on ($${c.sizeUsd} @ ${c.leverage}x)`,
]

/** User bearish + bot already long ETH — stack the long. */
const SHORT_USER_LONG_BOT_ADD: Array<(ctx: InverseReplyContext) => string> = [
  (c) => `kek bottom signal. added $${c.sizeUsd} to ${c.pair} long (${c.leverage}x)`,
  (c) => `${c.pair} going down? yum. sized up the long (+$${c.sizeUsd} @ ${c.leverage}x)`,
  (c) => `bearish cope is my buy signal. increased ${c.pair} long ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) => `thanks for the dip narrative. stacked ${c.pair} long (+$${c.sizeUsd} @ ${c.leverage}x)`,
  (c) => `you sound bearish. i sound longer. added $${c.sizeUsd} to ${c.pair} (${c.leverage}x)`,
]

/** User bullish + bot already short — stack the short. */
const LONG_USER_SHORT_BOT_ADD: Array<(ctx: InverseReplyContext) => string> = [
  (c) => `kek top signal. added $${c.sizeUsd} to ${c.pair} short (${c.leverage}x)`,
  (c) => `${c.pair} moon thesis? cute. stacked the short (+$${c.sizeUsd} @ ${c.leverage}x)`,
  (c) => `bullish fanfic noted. increased ${c.pair} short ($${c.sizeUsd} @ ${c.leverage}x)`,
  (c) => `you said up only. i said more short. added $${c.sizeUsd} (${c.leverage}x)`,
  (c) => `top caller vibes. sized up ${c.pair} short (+$${c.sizeUsd} @ ${c.leverage}x)`,
]

/** User long + bot already long — trim toward fading them. */
const LONG_USER_LONG_BOT_TRIM: Array<(ctx: InverseReplyContext) => string> = [
  (c) =>
    `you said long ${c.pair}? already long. trimmed $${c.sizeUsd} — your call is my exit signal`,
  (c) => `kek top signal on your long take. trimmed ${c.pair} long ($${c.sizeUsd})`,
  (c) => `bullish cope detected. took $${c.sizeUsd} off the ${c.pair} long. you're welcome`,
  (c) => `long ${c.pair} gang? i was already there. trimmed anyway ($${c.sizeUsd})`,
]

/** User short + bot already short — trim the short leg. */
const SHORT_USER_SHORT_BOT_TRIM: Array<(ctx: InverseReplyContext) => string> = [
  (c) =>
    `you said short ${c.pair}? already short. trimmed $${c.sizeUsd} — your bearishness paid rent`,
  (c) => `kek bottom signal on your short take. trimmed ${c.pair} short ($${c.sizeUsd})`,
  (c) => `bearish fanfic noted. cut $${c.sizeUsd} from the ${c.pair} short. cope`,
  (c) => `short ${c.pair} energy? same. trimmed $${c.sizeUsd} off the book anyway`,
]

const INVERSE_TRADE_FAIL: Array<(ctx: InverseReplyContext) => string> = [
  (c) =>
    `tried to ${c.counterSide} ${c.pair} purely to annoy you. hyperliquid said no. tragic.`,
  (c) =>
    `attempted the opposite ${c.counterSide} on ${c.pair}. exchange rejected it. skill issue (shared).`,
  (c) =>
    `wanted to invert your ${c.userSide} ${c.pair} take. trade failed. the universe saved you this once.`,
  (c) =>
    `i went to ${c.counterSide} ${c.pair} out of principle. execution said absolutely not.`,
]

function pickInverseReplyTemplate<T>(seed: string, bucket: string, templates: T[]): T {
  const key = `${seed}:${bucket}`
  return templates[pickDeterministicIndex(key, templates.length)]
}

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

export async function loadInverseAkitaChatReactionMarkets(): Promise<HyperliquidPerpMarket[] | null> {
  const nowMs = Date.now()
  if (cachedPerpMarkets && nowMs - cachedPerpMarkets.fetchedAtMs < PERP_MARKET_CACHE_MS) {
    return cachedPerpMarkets.markets
  }
  const markets = await getAllPerpMarkets()
  if (!markets) return cachedPerpMarkets?.markets ?? null
  cachedPerpMarkets = { fetchedAtMs: nowMs, markets }
  return markets
}

async function lookupPairMaxLeverage(pair: string): Promise<number | null> {
  const normalizedPair = normalizeMarketSymbol(pair)
  const markets = await loadInverseAkitaChatReactionMarkets()
  if (!markets) return null
  const row = markets.find(
    (market) => normalizeMarketSymbol(market.symbol).toLowerCase() === normalizedPair.toLowerCase(),
  )
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
  marketClarification?: InverseAkitaMarketClarification
}

export type InverseAkitaChatHistoryMessage = {
  id?: string | number | null
  date?: number | string | null
  sender?: string | null
  text?: string | null
  username?: string | null
  isBot?: boolean | null
  replyId?: string | number | null
  reply_id?: string | null
}

export function parseInverseAkitaChatTradeIntent(
  text: string,
  options?: {
    allowLooseSentiment?: boolean
    availableMarkets?: readonly HyperliquidPerpMarket[]
  },
): ParsedInverseAkitaChatTradeIntent | null {
  const trimmed = String(text ?? '').trim()
  if (!trimmed || trimmed.startsWith('/')) return null

  const normalized = normalizeChatTradeIntentText(trimmed)
  if (!normalized) return null

  const strict = CHAT_TRADE_INTENT_RE.exec(normalized)
  if (strict) return parseTradeIntentMatch(strict)

  const qualified = QUALIFIED_TRADE_INTENT_RE.exec(normalized)
  if (qualified) return parseTradeIntentMatch(qualified)

  if (/@[\w.-]+/.test(trimmed)) {
    const mentionLed = MENTION_LED_TRADE_INTENT_RE.exec(normalized)
    if (mentionLed) return parseTradeIntentMatch(mentionLed)
  }

  // Loose fallback: top-level opinion chatter only. Quote-replies are usually
  // InverseAKITA's own trim/add copy ("long SOL gang? i was already there…").
  if (options?.allowLooseSentiment === false) return null

  const sentimentSide = detectChatMarketSentiment(normalized)
  if (sentimentSide) {
    const pair = extractChatMarketAsset(normalized, options?.availableMarkets)
    if (pair) return { userSide: sentimentSide, pair }
    if (options?.availableMarkets) {
      const marketClarification = extractChatMarketAmbiguity(
        normalized,
        options.availableMarkets,
      )
      if (marketClarification) {
        return {
          userSide: sentimentSide,
          pair: marketClarification.concept.toUpperCase(),
          marketClarification,
        }
      }
    }
  }

  return null
}

export type InverseAkitaChatTradeIntentMessage = {
  id: string
  date: number
  sender: string
  text: string
  publicAuthorLabel?: string | null
  userSide: CounterTradeSide
  pair: string
  ordinal?: number
  parseMode?: InverseOpinionParseMode
  marketClarification?: InverseAkitaMarketClarification
}

function resolveInverseOpinionParseMode(text: string): InverseOpinionParseMode {
  const trimmed = String(text ?? '').trim()
  const normalized = normalizeChatTradeIntentText(trimmed)
  if (CHAT_TRADE_INTENT_RE.test(normalized)) return 'strict'
  if (QUALIFIED_TRADE_INTENT_RE.test(normalized)) return 'qualified'
  if (/@[\w.-]+/.test(trimmed) && MENTION_LED_TRADE_INTENT_RE.test(normalized)) return 'mention'
  return 'loose'
}

function isHexAddress(value: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(value.trim())
}

function isInvalidInverseChatReactionSender(senderLower: string): boolean {
  return !isHexAddress(senderLower)
}

function shouldSkipInverseChatReactionHistoryMessage(params: {
  senderLower: string
  text: string
  username?: string | null
  isBot?: boolean | null
  selfAddressLower: string
  /** Structured Chip / `trade-completed` posts are attributed later. */
  allowTradeCompletedSender?: boolean
}): boolean {
  const looksLikeChip =
    isAlfaClubTradeCompletedSender(params.senderLower)
    || isAlfaClubChipUsername(params.username)
  const tradeCompleted = params.allowTradeCompletedSender === true && looksLikeChip
  // Chip trade cards may be flagged isBot — still ingest them.
  if (params.isBot === true && !looksLikeChip) return true
  if (!tradeCompleted && isInvalidInverseChatReactionSender(params.senderLower)) {
    return true
  }
  if (isInverseAkitaChatSelfUsername(params.username)) return true
  if (
    !tradeCompleted
    && isInverseAkitaChatSelfSender(params.senderLower, [
      params.selfAddressLower,
    ])
  ) {
    return true
  }
  if (isInverseAkitaBotAuthoredChatText(params.text)) return true
  if (isRegisteredInverseAkitaBotOutboundText(params.text)) return true
  return false
}

async function resolveRoomCreatorAddress(roomId: string): Promise<string | null> {
  try {
    const rows = await readRoomLabelStatus([roomId])
    const creator = String(rows[0]?.creatorAddress ?? '')
      .trim()
      .toLowerCase()
    return isHexAddress(creator) ? creator : null
  } catch {
    return null
  }
}

function isCommandLikeChatText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('/')) return true
  if (/^arena(?:\s|$)/i.test(trimmed)) return true
  if (/^gmeow+\b/i.test(trimmed)) return true
  return false
}

/** Collect casual trade-intent chat lines like "long btc" from configured inverse-reaction rooms. */
export async function collectInverseAkitaChatTradeIntents(params: {
  roomId: string
  messages: InverseAkitaChatHistoryMessage[]
  selfAddress?: string
  availableMarkets?: readonly HyperliquidPerpMarket[]
  llmConfig?: InverseAkitaChatLlmClassifierConfig
  /** Test seam — defaults to Eliza-backed classifier. */
  classifyOpinion?: typeof classifyInverseAkitaChatOpinion
}): Promise<InverseAkitaChatTradeIntentMessage[]> {
  if (!isInverseAkitaChatReactionRoom(params.roomId)) return []

  const self = String(params.selfAddress ?? '').trim().toLowerCase()
  const classifyOpinion = params.classifyOpinion ?? classifyInverseAkitaChatOpinion
  const out: InverseAkitaChatTradeIntentMessage[] = []
  let roomCreatorAddress: string | null | undefined
  const selfSenders = [
    self,
    ...readInverseAkitaChatSelfSenderAddresses(),
  ].filter(Boolean)

  for (const message of params.messages) {
    const id = String(message.id ?? '').trim()
    const senderRaw = String(message.sender ?? '').trim().toLowerCase()
    const text = String(message.text ?? '').trim()
    if (!id || !text || isCommandLikeChatText(text)) continue

    const chipSystem =
      isAlfaClubTradeCompletedSender(senderRaw) || isAlfaClubChipUsername(message.username)
    const tradeEvent = chipSystem ? parseInverseAkitaChatTradeEvent(text) : null

    if (
      shouldSkipInverseChatReactionHistoryMessage({
        senderLower: senderRaw,
        text,
        username: message.username,
        isBot: message.isBot,
        selfAddressLower: self,
        allowTradeCompletedSender: tradeEvent != null,
      })
    ) {
      continue
    }

    let sender = senderRaw
    let parsed:
      | {
          userSide: CounterTradeSide
          pair: string
          marketClarification?: InverseAkitaMarketClarification
        }
      | null = null
    let parseMode: InverseOpinionParseMode | undefined
    let publicAuthorLabel =
      typeof message.username === 'string' && message.username.trim()
        ? message.username.trim()
        : null

    if (tradeEvent) {
      if (roomCreatorAddress === undefined) {
        roomCreatorAddress = await resolveRoomCreatorAddress(params.roomId)
      }
      const attributed = resolveInverseAkitaTradeEventAuthor({
        payloadAddress: tradeEvent.userAddress,
        roomCreatorAddress,
        messageDate: Number(message.date),
        excludeAddresses: selfSenders,
        priorSpeakers: params.messages,
      })
      if (!attributed) continue
      sender = attributed
      parsed = { userSide: tradeEvent.userSide, pair: tradeEvent.pair }
      parseMode = 'strict'
      publicAuthorLabel = publicAuthorLabel || 'Chip'
    } else {
      const replyId = String(message.replyId ?? message.reply_id ?? '').trim()
      const allowLooseSentiment = replyId.length === 0
      const deterministic = parseInverseAkitaChatTradeIntent(text, {
        allowLooseSentiment,
        availableMarkets: params.availableMarkets,
      })
      parsed = deterministic
      parseMode = deterministic ? resolveInverseOpinionParseMode(text) : undefined

      // LLM for any staker's top-level chatter (owners and non-owners alike).
      if (allowLooseSentiment && (!deterministic || parseMode === 'loose')) {
        const llm = await classifyOpinion({
          text,
          roomId: params.roomId,
          availableMarkets: params.availableMarkets,
          config: params.llmConfig,
        })
        if (llm.blocked) continue
        if (llm.applied && llm.classification) {
          if (llm.classification.verdict === 'skip') continue
          parsed = {
            userSide: llm.classification.userSide,
            pair: llm.classification.pair,
          }
          parseMode = 'llm'
        }
      }
    }

    if (!parsed) continue
    if (isInvalidInverseChatReactionSender(sender)) continue

    const date = Number(message.date)
    out.push({
      id,
      date: Number.isFinite(date) ? date : 0,
      sender,
      text,
      publicAuthorLabel,
      userSide: parsed.userSide,
      pair: parsed.pair,
      ordinal: 0,
      parseMode: parseMode ?? resolveInverseOpinionParseMode(text),
      marketClarification: parsed.marketClarification,
    })
  }

  return out
}

/** First informative line of a failed arena run, for chat-visible fail replies. */
export function summarizeInverseTradeFailureDetail(
  run: { error?: string; stderr?: string; stdout?: string } | undefined | null,
): string | null {
  if (!run) return null
  const lines: string[] = []
  for (const part of [run.error, run.stderr, run.stdout]) {
    for (const line of String(part ?? '').split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !lines.includes(trimmed)) lines.push(trimmed)
    }
  }
  if (lines.length === 0) return null
  // Node's exec error message ("Command failed: npx tsx ...") carries no
  // signal — prefer the underlying tool output when present.
  const informative = lines.filter((line) => !/^command failed:/i.test(line))
  const detail = (informative[0] ?? lines[0])!
  return detail.length > 160 ? `${detail.slice(0, 157)}...` : detail
}

export function formatInverseAkitaChatReactionReply(params: {
  seed: string
  userSide: CounterTradeSide
  pair: string
  counterSide: CounterTradeSide
  sizeUsd: number
  leverage: number
  dryRun: boolean
  tradeOk: boolean
  positionAction?: InverseChatPositionAction
  existingSide?: CounterTradeSide | null
  failDetail?: string | null
}): string {
  const positionAction = params.positionAction ?? 'open'
  const ctx: InverseReplyContext = {
    pair: params.pair,
    userSide: params.userSide,
    counterSide: params.counterSide,
    existingSide: params.existingSide ?? undefined,
    sizeUsd: params.sizeUsd,
    leverage: params.leverage,
  }

  let text: string
  if (params.tradeOk || params.dryRun) {
    let bucket: string
    let templates: Array<(ctx: InverseReplyContext) => string>
    if (positionAction === 'trim') {
      bucket = 'success-trim'
      templates = params.userSide === 'long' ? LONG_USER_LONG_BOT_TRIM : SHORT_USER_SHORT_BOT_TRIM
    } else if (positionAction === 'add') {
      bucket = 'success-add'
      templates =
        params.userSide === 'long' ? LONG_USER_SHORT_BOT_ADD : SHORT_USER_LONG_BOT_ADD
    } else {
      bucket = 'success'
      templates =
        params.userSide === 'long' ? LONG_USER_SHORT_BOT_SUCCESS : SHORT_USER_LONG_BOT_SUCCESS
    }
    text = pickInverseReplyTemplate(params.seed, bucket, templates)(ctx)
    if (params.dryRun) text = `${text} [dry-run]`
  } else {
    text = pickInverseReplyTemplate(params.seed, 'fail', INVERSE_TRADE_FAIL)(ctx)
    if (params.failDetail) text = `${text} (${params.failDetail})`
  }

  return text
}

/**
 * Compact trade receipt posted into the trigger message's thread.
 * Returns null when there's nothing worth threading (skips, dry-runs
 * with no execution detail beyond the main reply).
 */
export function formatInverseAkitaThreadReceipt(params: {
  pair: string
  counterSide: CounterTradeSide
  sizeUsd: number
  leverage: number
  tradeOk: boolean
  dryRun: boolean
  positionAction?: InverseChatPositionAction
  existingSide?: CounterTradeSide | null
  fill: { totalSz: number; avgPx: number } | null
  failDetail?: string | null
}): string | null {
  const positionAction = params.positionAction ?? 'open'
  const side = params.counterSide === 'long' ? 'LONG' : 'SHORT'
  if (!params.tradeOk && !params.dryRun) {
    if (!params.failDetail) return null
    const failSide =
      positionAction === 'trim' && params.existingSide
        ? params.existingSide === 'long'
          ? 'LONG'
          : 'SHORT'
        : side
    return `🧾 receipt: ${failSide} ${params.pair} attempt failed — ${params.failDetail}`
  }
  let head: string
  if (positionAction === 'trim' && params.existingSide) {
    const trimmedSide = params.existingSide === 'long' ? 'LONG' : 'SHORT'
    head = `🧾 receipt: trimmed ${trimmedSide} ${params.pair} · -$${params.sizeUsd}`
  } else if (positionAction === 'add') {
    head = `🧾 receipt: added to ${side} ${params.pair} · +$${params.sizeUsd} · ${params.leverage}x`
  } else {
    head = `🧾 receipt: ${side} ${params.pair} · $${params.sizeUsd} notional · ${params.leverage}x`
  }
  if (params.dryRun) return `${head} · [dry-run]`
  if (params.fill) {
    return `${head} · filled ${params.fill.totalSz} @ $${params.fill.avgPx}`
  }
  return `${head} · submitted`
}

export function formatInverseAkitaChatReactionSkipReply(skipReason: string): string | null {
  if (skipReason === 'sender_cooldown') return null
  return formatInverseOpinionSkipReply(skipReason)
}

export function formatInverseAkitaMarketClarification(
  clarification: InverseAkitaMarketClarification,
): string {
  const concept = clarification.concept.trim().toLowerCase()
  if (concept === 'oil' || concept === 'crude') {
    return 'which oil market are you referring to?'
  }
  return `which ${concept.toUpperCase()} market are you referring to?`
}

function withInverseSkipReply(
  result: Omit<InverseAkitaChatReactionResult, 'replyText' | 'reactionEmoji'>,
  messageId: string,
): InverseAkitaChatReactionResult {
  const skipReply = result.skipped ? formatInverseAkitaChatReactionSkipReply(result.skipReason ?? '') : null
  return {
    ...result,
    replyText: skipReply ?? '',
    reactionEmoji: skipReply ? resolveInverseAkitaChatReactionEmoji(messageId) : '',
  }
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

/** For unit tests only. */
export function __resetInverseAkitaBotOutboundTextRegistryForTests(): void {
  resetInverseAkitaBotOutboundTextRegistryForTests()
}

export type InverseAkitaChatReactionResult = {
  ok: boolean
  skipped?: boolean
  skipReason?: string
  replyText: string
  reactionEmoji: string
  /** Optional trade receipt posted into the trigger message's thread. */
  threadReceiptText?: string | null
  counterSide: CounterTradeSide
  pair: string
}

export function readInverseAkitaTerminalReply(
  decision: Pick<OpinionTradeDecision, 'executionPhase' | 'terminalOutcome' | 'receiptSummary'>,
): InverseAkitaChatReactionResult | null {
  if (
    decision.executionPhase !== 'resolved'
    || (decision.terminalOutcome !== 'executed' && decision.terminalOutcome !== 'failed')
  ) return null
  const raw = decision.receiptSummary.terminalReply
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const replyText = typeof value.replyText === 'string' ? value.replyText : ''
  const threadReceiptText =
    value.threadReceiptText == null
      ? null
      : typeof value.threadReceiptText === 'string'
        ? value.threadReceiptText
        : null
  const reactionEmoji = typeof value.reactionEmoji === 'string' ? value.reactionEmoji : ''
  const counterSide = value.counterSide
  const pair = typeof value.pair === 'string' ? value.pair : ''
  if (
    typeof value.ok !== 'boolean'
    || !replyText.trim()
    || replyText.length > 2_000
    || (threadReceiptText != null && threadReceiptText.length > 2_000)
    || !reactionEmoji
    || reactionEmoji.length > 16
    || (counterSide !== 'long' && counterSide !== 'short')
    || !pair
    || pair.length > 64
  ) return null
  return {
    ok: value.ok,
    replyText,
    reactionEmoji,
    threadReceiptText,
    counterSide,
    pair,
  }
}

export async function executeInverseAkitaChatReaction(params: {
  roomId: string
  intent: InverseAkitaChatTradeIntentMessage
  claimedDecision?: OpinionTradeDecision
}): Promise<InverseAkitaChatReactionResult> {
  const roomId = String(params.roomId ?? '').trim()
  const counterSide = deriveCounterSide(params.intent.userSide)
  if (!isInverseAkitaChatReactionRoom(roomId)) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'wrong_room',
      replyText: '',
      reactionEmoji: '',
      counterSide,
      pair: params.intent.pair,
    }
  }

  const captureEnabled = isInverseOpinionTradeCaptureEnabled()
  if (isRailwayRuntimeEnv() && !captureEnabled) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'capture_required',
      replyText: '',
      reactionEmoji: '',
      counterSide,
      pair: params.intent.pair,
    }
  }
  let decision: OpinionTradeDecision | null = captureEnabled
    ? params.claimedDecision ?? null
    : null
  if (captureEnabled && !decision) {
    try {
      decision = await claimInverseOpinionTradeIntent({
        roomId,
        intent: params.intent,
      })
    } catch {
      return {
        ok: false,
        skipped: true,
        skipReason: 'attribution_store_unavailable',
        replyText: '',
        reactionEmoji: '',
        counterSide,
        pair: params.intent.pair,
      }
    }
  }

  let authorAccess: Awaited<ReturnType<typeof resolveInverseAkitaChatAuthorAccess>> | null = null
  const resolveWithoutSubmission = async (
    outcome: 'rejected' | 'blocked',
    reasonCode: string,
  ): Promise<void> => {
    if (!decision) return
    await recordInverseOpinionTradeTerminal({
      decision,
      outcome,
      reasonCode,
      receiptSummary: {
        parseMode: params.intent.parseMode ?? 'loose',
        authorAccess,
      },
    })
  }

  if (!isInverseAkitaChatReactionEnabledByEnv()) {
    await resolveWithoutSubmission('blocked', 'reaction_disabled')
    return {
      ok: false,
      skipped: true,
      skipReason: 'disabled',
      replyText: '',
      reactionEmoji: '',
      counterSide,
      pair: params.intent.pair,
    }
  }
  if (!arenaCommandAllowedForRoom(INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID)) {
    await resolveWithoutSubmission('blocked', 'arena_room_blocked')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'arena_room_blocked',
        counterSide,
        pair: params.intent.pair,
      },
      params.intent.id,
    )
  }
  if (isInverseAkitaChatReactionSenderCoolingDown(params.intent.sender)) {
    await resolveWithoutSubmission('blocked', 'sender_cooldown')
    return {
      ok: false,
      skipped: true,
      skipReason: 'sender_cooldown',
      replyText: '',
      reactionEmoji: '',
      counterSide,
      pair: params.intent.pair,
    }
  }

  try {
    authorAccess = await resolveInverseAkitaChatAuthorAccess({
      senderAddress: params.intent.sender,
      roomId,
    })
  } catch {
    await resolveWithoutSubmission('blocked', 'authority_check_failed')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'authority_check_failed',
        counterSide,
        pair: params.intent.pair,
      },
      params.intent.id,
    )
  }
  if (!authorAccess.eligible) {
    const skipReason = authorAccess.reason
    await resolveWithoutSubmission('rejected', skipReason)
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason,
        counterSide,
        pair: params.intent.pair,
      },
      params.intent.id,
    )
  }

  if (params.intent.marketClarification) {
    await resolveWithoutSubmission('rejected', 'market_ambiguous')
    return {
      ok: false,
      skipped: true,
      skipReason: 'market_ambiguous',
      replyText: formatInverseAkitaMarketClarification(
        params.intent.marketClarification,
      ),
      reactionEmoji: resolveInverseAkitaChatReactionEmoji(params.intent.id),
      counterSide,
      pair: params.intent.pair,
    }
  }

  const baseConfig = readArenaConfig()
  if (!baseConfig.enabled || !baseConfig.tradingEnabled) {
    await resolveWithoutSubmission('blocked', 'arena_trading_disabled')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'arena_trading_disabled',
        counterSide,
        pair: params.intent.pair,
      },
      params.intent.id,
    )
  }

  let markets: HyperliquidPerpMarket[] | null
  try {
    markets = await loadInverseAkitaChatReactionMarkets()
  } catch {
    markets = null
  }
  if (!markets) {
    await resolveWithoutSubmission('blocked', 'market_metadata_unavailable')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'market_metadata_unavailable',
        counterSide,
        pair: params.intent.pair,
      },
      params.intent.id,
    )
  }
  const listedPair = resolveListedMarketSymbol(params.intent.pair, markets)
  if (!listedPair) {
    await resolveWithoutSubmission('blocked', 'market_not_listed')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'market_not_listed',
        counterSide,
        pair: params.intent.pair,
      },
      params.intent.id,
    )
  }

  const pairCheck = validateArenaPair(listedPair, baseConfig)
  if (!pairCheck.ok) {
    await resolveWithoutSubmission('rejected', pairCheck.reason)
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: pairCheck.reason,
        counterSide,
        pair: params.intent.pair,
      },
      params.intent.id,
    )
  }

  let identity: Awaited<ReturnType<typeof resolveRoomDefaultArenaIdentity>>
  try {
    identity = await resolveRoomDefaultArenaIdentity({
      roomId: INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID,
      baseConfig,
    })
  } catch {
    await resolveWithoutSubmission('blocked', 'executor_identity_unavailable')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'missing_executor_wallet',
        counterSide,
        pair: pairCheck.normalizedPair,
      },
      params.intent.id,
    )
  }
  const sizeUsd = readInverseAkitaChatReactionSizeUsd()
  let leverage: number
  try {
    leverage = await resolveInverseAkitaChatReactionLeverage(pairCheck.normalizedPair)
  } catch {
    await resolveWithoutSubmission('blocked', 'market_metadata_unavailable')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'market_metadata_unavailable',
        counterSide,
        pair: pairCheck.normalizedPair,
      },
      params.intent.id,
    )
  }
  const executionConfig = {
    ...baseConfig,
    agentId: identity.agentId,
    agentWalletAddress: identity.agentWalletAddress,
    hlApiWalletAddress: identity.hlApiWalletAddress,
  }

  if (!executionConfig.agentWalletAddress) {
    await resolveWithoutSubmission('blocked', 'missing_executor_wallet')
    return withInverseSkipReply(
      {
        ok: false,
        skipped: true,
        skipReason: 'missing_executor_wallet',
        counterSide,
        pair: pairCheck.normalizedPair,
      },
      params.intent.id,
    )
  }

  let positionAction: InverseChatPositionAction = 'open'
  let existingSide: CounterTradeSide | null = null
  try {
    const positionsResult = await runArenaOpenPositions(executionConfig)
    const positions = Array.isArray(positionsResult.details?.positions)
      ? (positionsResult.details.positions as unknown[])
      : []
    existingSide = resolveOpenArenaPositionSide(positions, pairCheck.normalizedPair)
    positionAction = resolveInverseChatPositionAction({ openSide: existingSide, counterSide })
  } catch {
    // Position lookup is best-effort — fresh-open copy if it fails.
  }

  const tradeRequest =
    positionAction === 'trim'
      ? {
          action: 'close' as const,
          pair: pairCheck.normalizedPair,
          sizeUsd,
        }
      : {
          action: 'open' as const,
          pair: pairCheck.normalizedPair,
          side: counterSide,
          sizeUsd,
          leverage,
        }

  if (decision) {
    const submissionClaimed = await recordInverseOpinionTradeSubmitted({
      decision,
      executorWallet: executionConfig.agentWalletAddress,
      requestedParameters: {
        ...tradeRequest,
        sourceSide: params.intent.userSide,
        inverseSide: counterSide,
        positionAction,
        existingSide,
        agentId: executionConfig.agentId,
        hlApiWalletAddress: executionConfig.hlApiWalletAddress,
        authorAccess,
      },
      parseMode: params.intent.parseMode ?? 'loose',
    })
    if (!submissionClaimed) {
      return {
        ok: false,
        skipped: true,
        skipReason: 'decision_already_claimed',
        replyText: '',
        reactionEmoji: '',
        counterSide,
        pair: pairCheck.normalizedPair,
      }
    }
  }

  let trade: Awaited<ReturnType<typeof runArenaTrade>>
  try {
    trade = await runArenaTrade(tradeRequest, executionConfig)
  } catch (error) {
    if (decision) {
      await recordInverseOpinionTradeUnknown({
        decision,
        reasonCode: 'arena_submit_unknown',
        receiptSummary: {
          errorKind: 'thrown',
          authorAccess,
        },
      })
    }
    throw error
  }

  markInverseAkitaChatReactionSenderCooldown(params.intent.sender)

  const reactionEmoji = resolveInverseAkitaChatReactionEmoji(params.intent.id)
  const failDetail = trade.ok ? null : summarizeInverseTradeFailureDetail(trade.run)
  const fill = parseTradeFillFromOutput(String(trade.run?.stdout ?? ''))
  const receiptSummary = {
    arenaMessage: String(trade.message ?? '').slice(0, 240),
    fill,
    authorAccess,
    run: trade.run
      ? {
          code: trade.run.code,
          timedOut: trade.run.timedOut,
          dryRun: trade.run.dryRun,
        }
      : null,
  }
  const replyText = formatInverseAkitaChatReactionReply({
    seed: params.intent.id,
    userSide: params.intent.userSide,
    pair: pairCheck.normalizedPair,
    counterSide,
    sizeUsd,
    leverage,
    dryRun: baseConfig.dryRun,
    tradeOk: trade.ok,
    positionAction,
    existingSide,
    failDetail,
  })
  const threadReceiptText = formatInverseAkitaThreadReceipt({
    pair: pairCheck.normalizedPair,
    counterSide,
    sizeUsd,
    leverage,
    tradeOk: trade.ok,
    dryRun: baseConfig.dryRun,
    positionAction,
    existingSide,
    fill,
    failDetail,
  })
  if (decision && !trade.ok && trade.run?.timedOut) {
    await recordInverseOpinionTradeUnknown({
      decision,
      reasonCode: 'arena_submit_unknown',
      receiptSummary,
    })
  } else if (decision) {
    await recordInverseOpinionTradeTerminal({
      decision,
      outcome: trade.ok ? 'executed' : 'failed',
      reasonCode: trade.ok ? 'arena_execution_succeeded' : 'arena_execution_failed',
      receiptSummary: {
        ...receiptSummary,
        terminalReply: {
          ok: trade.ok,
          replyText,
          threadReceiptText,
          reactionEmoji,
          counterSide,
          pair: pairCheck.normalizedPair,
        },
      },
    })
    if (trade.ok) {
      void reconcileInverseOpinionTrades().catch(() => {
        logger.warn('[inverse-opinion-reconciler] eager pass failed', {
          reason: 'reconciliation_failed',
        })
      })
    }
  }
  logger.info('inverse_akita.chat_reaction', {
    roomId,
    messageId: params.intent.id,
    sender: params.intent.sender,
    authorAccessReason: authorAccess.reason,
    userSide: params.intent.userSide,
    counterSide,
    pair: pairCheck.normalizedPair,
    sizeUsd,
    leverage,
    positionAction,
    existingSide,
    tradeOk: trade.ok,
    dryRun: baseConfig.dryRun,
    reactionEmoji,
  })

  return {
    ok: trade.ok,
    replyText,
    reactionEmoji,
    threadReceiptText,
    counterSide,
    pair: pairCheck.normalizedPair,
  }
}
