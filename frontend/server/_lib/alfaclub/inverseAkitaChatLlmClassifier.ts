/**
 * LLM classifier for InverseAKITA loose chat opinions.
 *
 * Strict / qualified / mention parses stay deterministic. This layer only
 * replaces (or audits) the loose sentiment lexicon: extract the author's
 * directional lean + asset, or skip when the message is not a trade opinion.
 *
 * Modes:
 *   - classify (default when enabled): use the LLM result when parseable
 *   - advisory: log the LLM result but keep the deterministic loose parse
 *
 * Failure policy (`failMode`):
 *   - allow (default): fall back to the regex lexicon
 *   - block: treat as no intent (skip) when the LLM is unavailable/unparseable
 */

import { randomUUID } from 'node:crypto'

import { getElizaLlmService } from '../../agents/eliza/llm.js'
import { logger } from '../infra/logger.js'
import type { CounterTradeSide } from './counterTradeConfig.js'
import type { HyperliquidPerpMarket } from './hyperliquid.js'

declare const process: { env: Record<string, string | undefined> }

export type InverseAkitaChatLlmMode = 'classify' | 'advisory'
export type InverseAkitaChatLlmFailMode = 'allow' | 'block'

export type InverseAkitaChatLlmClassifierConfig = {
  enabled: boolean
  mode: InverseAkitaChatLlmMode
  failMode: InverseAkitaChatLlmFailMode
  timeoutMs: number
}

export type InverseAkitaChatLlmClassification =
  | {
      verdict: 'trade'
      userSide: CounterTradeSide
      pair: string
      reason: string
    }
  | { verdict: 'skip'; reason: string }

export type InverseAkitaChatLlmClassifyResult = {
  evaluated: boolean
  applied: boolean
  classification: InverseAkitaChatLlmClassification | null
  /** Set when classify+block and the LLM call failed. */
  blocked: boolean
  skipReason: string | null
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readPositiveNumber(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function readInverseAkitaChatLlmClassifierConfig(): InverseAkitaChatLlmClassifierConfig {
  const modeRaw = String(process.env.ALFACLUB_INVERSE_AKITA_CHAT_LLM_MODE ?? '')
    .trim()
    .toLowerCase()
  const failRaw = String(process.env.ALFACLUB_INVERSE_AKITA_CHAT_LLM_FAIL_MODE ?? '')
    .trim()
    .toLowerCase()
  return {
    enabled: readBool('ALFACLUB_INVERSE_AKITA_CHAT_LLM_ENABLED', false),
    mode: modeRaw === 'advisory' ? 'advisory' : 'classify',
    failMode: failRaw === 'block' ? 'block' : 'allow',
    // 15s default: OpenRouter/Groq first; leave room for one fallback hop.
    timeoutMs: readPositiveNumber('ALFACLUB_INVERSE_AKITA_CHAT_LLM_TIMEOUT_MS', 15_000),
  }
}

function listMarketHints(markets: readonly HyperliquidPerpMarket[] | undefined): string {
  if (!markets || markets.length === 0) {
    return 'Common: BTC, ETH, SOL, DOGE, WIF, and Hyperliquid HIP-3 symbols like xyz:TSLA.'
  }
  const names = markets
    .map((market) => String(market.symbol ?? '').trim())
    .filter(Boolean)
    .slice(0, 80)
  return names.length > 0 ? names.join(', ') : 'BTC, ETH, SOL'
}

export function buildInverseAkitaChatClassifierPrompt(params: {
  text: string
  availableMarkets?: readonly HyperliquidPerpMarket[]
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = [
    'You classify AlfaClub chat messages for InverseAKITA, a bot that fades (inverts) trade opinions.',
    'Decide whether the author is expressing a directional market lean on a specific asset.',
    'Extract the AUTHOR\'s lean (long/bullish vs short/bearish), not the inverted trade.',
    'Skip jokes with no asset, pure greetings, questions with no lean, or mixed/unclear direction.',
    'pair must be an uppercase Hyperliquid perp symbol (e.g. BTC, ETH, SOL, xyz:TSLA).',
    'Prefer listed markets when given. Do not invent tickers that are not implied by the message.',
    'Respond with EXACTLY ONE JSON object and nothing else:',
    '{"verdict":"trade","userSide":"long"|"short","pair":"BTC","reason":"<short>"}',
    '{"verdict":"skip","reason":"<short>"}',
  ].join('\n')

  const userMessage = [
    'Listed markets (sample):',
    listMarketHints(params.availableMarkets),
    '',
    'Chat message:',
    params.text.trim(),
    '',
    'Classify now.',
  ].join('\n')

  return { systemPrompt, userMessage }
}

function normalizePair(raw: unknown): string | null {
  const pair = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
  if (!pair) return null
  if (!/^[A-Z0-9]+(?::[A-Z0-9]+)?$/.test(pair)) return null
  return pair
}

export function parseInverseAkitaChatLlmClassification(
  text: string | null,
): InverseAkitaChatLlmClassification | null {
  if (!text) return null
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const raw = parsed as {
    verdict?: unknown
    userSide?: unknown
    pair?: unknown
    reason?: unknown
  }
  const verdict = String(raw.verdict ?? '')
    .trim()
    .toLowerCase()
  const reason = String(raw.reason ?? '').trim().slice(0, 240) || 'unspecified'

  if (verdict === 'skip') return { verdict: 'skip', reason }

  if (verdict !== 'trade') return null
  const userSideRaw = String(raw.userSide ?? '')
    .trim()
    .toLowerCase()
  if (userSideRaw !== 'long' && userSideRaw !== 'short') return null
  const pair = normalizePair(raw.pair)
  if (!pair) return null

  return { verdict: 'trade', userSide: userSideRaw, pair, reason }
}

type GenerateFn = (params: {
  agentKey: string
  userMessage: string
  systemPrompt: string
  vaultContext: string
  correlationId: string
  abortSignal?: AbortSignal
}) => Promise<{ text: string | null }>

/**
 * Classify a loose chat opinion. When disabled, returns evaluated=false so the
 * caller keeps the deterministic lexicon path.
 */
export async function classifyInverseAkitaChatOpinion(params: {
  text: string
  roomId?: string
  availableMarkets?: readonly HyperliquidPerpMarket[]
  config?: InverseAkitaChatLlmClassifierConfig
  generate?: GenerateFn
}): Promise<InverseAkitaChatLlmClassifyResult> {
  const config = params.config ?? readInverseAkitaChatLlmClassifierConfig()
  if (!config.enabled) {
    return {
      evaluated: false,
      applied: false,
      classification: null,
      blocked: false,
      skipReason: null,
    }
  }

  const generate: GenerateFn =
    params.generate ?? ((args) => getElizaLlmService().generateResponse(args))
  const { systemPrompt, userMessage } = buildInverseAkitaChatClassifierPrompt({
    text: params.text,
    availableMarkets: params.availableMarkets,
  })
  const correlationId = `ia-chat-llm-${randomUUID().slice(0, 8)}`

  let adviceText: string | null = null
  try {
    const result = await generate({
      agentKey: 'inverse-akita-chat-classifier',
      userMessage,
      systemPrompt,
      vaultContext: '',
      correlationId,
      abortSignal: AbortSignal.timeout(config.timeoutMs),
    })
    adviceText = result.text
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('inverse_akita.chat_llm_classifier_failed', {
      roomId: params.roomId ?? null,
      correlationId,
      message,
    })
    const block = config.mode === 'classify' && config.failMode === 'block'
    return {
      evaluated: false,
      applied: false,
      classification: null,
      blocked: block,
      skipReason: block ? 'llm_unavailable:request_failed' : null,
    }
  }

  const classification = parseInverseAkitaChatLlmClassification(adviceText)
  if (!classification) {
    logger.warn('inverse_akita.chat_llm_classifier_unparseable', {
      roomId: params.roomId ?? null,
      correlationId,
      preview: (adviceText ?? '').slice(0, 200),
    })
    const block = config.mode === 'classify' && config.failMode === 'block'
    return {
      evaluated: false,
      applied: false,
      classification: null,
      blocked: block,
      skipReason: block ? 'llm_unavailable:unparseable' : null,
    }
  }

  logger.info('inverse_akita.chat_llm_classification', {
    roomId: params.roomId ?? null,
    correlationId,
    mode: config.mode,
    verdict: classification.verdict,
    userSide: classification.verdict === 'trade' ? classification.userSide : null,
    pair: classification.verdict === 'trade' ? classification.pair : null,
    reason: classification.reason,
  })

  if (config.mode === 'advisory') {
    return {
      evaluated: true,
      applied: false,
      classification,
      blocked: false,
      skipReason: null,
    }
  }

  return {
    evaluated: true,
    applied: true,
    classification,
    blocked: false,
    skipReason:
      classification.verdict === 'skip'
        ? `llm_skip:${classification.reason.slice(0, 120)}`
        : null,
  }
}
