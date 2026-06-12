/**
 * LLM advisor layer for the room counter-trade loop.
 *
 * The deterministic engine (`counterTradeEngine.ts`) remains the authority for
 * what is counterable and for every hard cap (side, leverage, per-trade and
 * daily notional, cooldowns, liquidation distance). This layer asks the Eliza
 * LLM service to *vet* each candidate counter-trade with portfolio and usage
 * context, and its power is strictly one-directional:
 *
 *   - it can VETO a candidate (skip)
 *   - it can SHRINK the notional (sizeFactor in (0, 1])
 *   - it can NEVER enlarge size, raise leverage, flip side, or originate trades
 *
 * Modes:
 *   - advisory (default): decisions are logged but never change execution —
 *     run this first to build trust in the model's judgment.
 *   - gate: veto/downsize is applied to execution.
 *
 * Failure policy: if the LLM is unreachable, times out, or returns an
 * unparseable decision, `failMode` decides — 'allow' (default) proceeds with
 * the deterministic decision, 'block' skips the trade.
 */

import { randomUUID } from 'node:crypto'

import { logger } from '../infra/logger.js'
import { getElizaLlmService } from '../../agents/eliza/llm.js'
import type { HyperliquidClearinghouseState, HyperliquidUserFillDetailed } from './hyperliquid.js'
import type { CounterTradeBias, CounterTradePreset, CounterTradeSide } from './counterTradeConfig.js'
import type { CounterTradeFillAction } from './counterTradeEngine.js'

declare const process: { env: Record<string, string | undefined> }

export type CounterTradeLlmMode = 'advisory' | 'gate'
export type CounterTradeLlmFailMode = 'allow' | 'block'

export type CounterTradeLlmAdvisorConfig = {
  enabled: boolean
  mode: CounterTradeLlmMode
  failMode: CounterTradeLlmFailMode
  timeoutMs: number
  /** Downsizes below this factor are treated as a veto instead of a dust trade. */
  minSizeFactor: number
}

export type CounterTradeLlmAdvice =
  | { verdict: 'execute'; sizeFactor: number; reason: string }
  | { verdict: 'skip'; reason: string }

export type CounterTradeLlmGateResult = {
  /** Whether the trade should still run (always true when not gating). */
  proceed: boolean
  /** Possibly downsized notional (unchanged when not gating). */
  notionalUsd: number
  /** True when an LLM round-trip actually happened. */
  evaluated: boolean
  /** Whether the advice changed execution (gate mode only). */
  applied: boolean
  advice: CounterTradeLlmAdvice | null
  /** Set when proceed=false, for the action record. */
  skipReason: string | null
}

export type CounterTradeCandidateContext = {
  roomId: string
  pair: string
  fill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  bias: CounterTradeBias
  preset: CounterTradePreset
  counterSide: CounterTradeSide
  counterLeverage: number
  counterNotionalUsd: number
  counterWalletState: HyperliquidClearinghouseState | null
  hourlyExecutedCount: number
  hourlyCap: number
  dailyNotionalUsedUsd: number
  dailyNotionalCapUsd: number
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

export function readCounterTradeLlmAdvisorConfig(): CounterTradeLlmAdvisorConfig {
  const modeRaw = String(process.env.ALFACLUB_COUNTER_TRADE_LLM_MODE ?? '').trim().toLowerCase()
  const failRaw = String(process.env.ALFACLUB_COUNTER_TRADE_LLM_FAIL_MODE ?? '').trim().toLowerCase()
  return {
    enabled: readBool('ALFACLUB_COUNTER_TRADE_LLM_ENABLED', false),
    mode: modeRaw === 'gate' ? 'gate' : 'advisory',
    failMode: failRaw === 'block' ? 'block' : 'allow',
    timeoutMs: readPositiveNumber('ALFACLUB_COUNTER_TRADE_LLM_TIMEOUT_MS', 12_000),
    minSizeFactor: Math.min(
      1,
      readPositiveNumber('ALFACLUB_COUNTER_TRADE_LLM_MIN_SIZE_FACTOR', 0.2),
    ),
  }
}

function describePortfolio(state: HyperliquidClearinghouseState | null): string {
  if (!state) return 'Counter wallet state unavailable.'
  const lines: string[] = []
  if (state.accountValueUsd != null) lines.push(`Account value: $${state.accountValueUsd.toFixed(0)}`)
  if (state.withdrawableUsd != null) lines.push(`Withdrawable: $${state.withdrawableUsd.toFixed(0)}`)
  const legs = state.assetPositions ?? []
  if (legs.length === 0) {
    lines.push('Open positions: none')
  } else {
    lines.push('Open positions:')
    for (const leg of legs.slice(0, 8)) {
      const side = (leg.side ?? 'flat').toUpperCase()
      const value = leg.positionValue != null ? `$${leg.positionValue.toFixed(0)}` : '?'
      const pnl =
        leg.unrealizedPnl != null
          ? `${leg.unrealizedPnl >= 0 ? '+' : ''}$${leg.unrealizedPnl.toFixed(0)} uPnL`
          : 'uPnL ?'
      const liq = leg.liquidationPx != null ? `liq $${leg.liquidationPx}` : 'liq ?'
      lines.push(`- ${side} ${leg.coin} ${value} (${pnl}, ${liq})`)
    }
  }
  return lines.join('\n')
}

export function buildCounterTradeAdvisorPrompt(context: CounterTradeCandidateContext): {
  systemPrompt: string
  userMessage: string
} {
  const systemPrompt = [
    'You are the risk reviewer for an automated counter-trading bot on Hyperliquid perps.',
    'The bot mirrors a tracked room wallet by opening the OPPOSITE side of its new positions.',
    'A deterministic engine has already sized a candidate counter-trade within hard caps.',
    'Your only job is to decide whether the candidate should run, and optionally shrink it.',
    'You may NOT increase size, change side, change leverage, or propose other trades.',
    'Veto when the candidate looks bad: stacking correlated exposure on existing positions,',
    'countering into obvious momentum, near-duplicate of an open leg, or thin remaining budget',
    'better saved for cleaner signals. Otherwise let it run, downsizing if conviction is low.',
    'Respond with EXACTLY ONE JSON object and nothing else, in one of these shapes:',
    '{"verdict": "execute", "sizeFactor": <number between 0 and 1>, "reason": "<short>"}',
    '{"verdict": "skip", "reason": "<short>"}',
  ].join('\n')

  const fillTime = new Date(context.fill.time).toISOString()
  const userLeverage = context.fill.dir?.match(/(\d+(?:\.\d+)?)\s*x/i)?.[1] ?? null
  const userMessage = [
    `Room ${context.roomId} wallet just did: ${context.fillAction.toUpperCase()} ${context.fill.side ?? '?'} ${context.pair}`,
    `at $${context.fill.px ?? '?'} size ${context.fill.sz ?? '?'} (${fillTime})${userLeverage ? ` ~${userLeverage}x` : ''}`,
    '',
    `Candidate counter-trade: ${context.counterSide.toUpperCase()} ${context.pair} $${context.counterNotionalUsd.toFixed(2)} at ${context.counterLeverage}x`,
    `Room bias: ${context.bias} | preset: ${context.preset}`,
    '',
    'Counter wallet portfolio:',
    describePortfolio(context.counterWalletState),
    '',
    `Usage: ${context.hourlyExecutedCount}/${context.hourlyCap} trades this hour, $${context.dailyNotionalUsedUsd.toFixed(0)}/$${context.dailyNotionalCapUsd.toFixed(0)} daily notional used.`,
    '',
    'Decide now.',
  ].join('\n')

  return { systemPrompt, userMessage }
}

/**
 * Parse the LLM's one-line JSON decision. Anything unusable returns null so
 * the caller can apply the configured fail mode. sizeFactor is clamped to
 * (0, 1] — the model can never scale a trade up.
 */
export function parseCounterTradeAdvice(text: string | null): CounterTradeLlmAdvice | null {
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

  const raw = parsed as { verdict?: unknown; sizeFactor?: unknown; reason?: unknown }
  const verdict = String(raw.verdict ?? '').trim().toLowerCase()
  const reason = String(raw.reason ?? '').trim().slice(0, 240) || 'unspecified'

  if (verdict === 'skip') return { verdict: 'skip', reason }
  if (verdict !== 'execute') return null

  const factorRaw = Number(raw.sizeFactor)
  const sizeFactor = Number.isFinite(factorRaw) ? Math.min(1, Math.max(0, factorRaw)) : 1
  if (sizeFactor <= 0) return { verdict: 'skip', reason }
  return { verdict: 'execute', sizeFactor, reason }
}

type GenerateFn = (params: {
  agentKey: string
  userMessage: string
  systemPrompt: string
  vaultContext: string
  correlationId: string
  abortSignal?: AbortSignal
}) => Promise<{ text: string | null }>

function failModeResult(
  config: CounterTradeLlmAdvisorConfig,
  context: CounterTradeCandidateContext,
  failureReason: string,
): CounterTradeLlmGateResult {
  const block = config.mode === 'gate' && config.failMode === 'block'
  return {
    proceed: !block,
    notionalUsd: context.counterNotionalUsd,
    evaluated: false,
    applied: block,
    advice: null,
    skipReason: block ? `llm_unavailable:${failureReason}` : null,
  }
}

/**
 * Evaluate a deterministic counter-trade candidate with the LLM and apply the
 * configured policy. When the advisor is disabled this is a pass-through.
 */
export async function applyCounterTradeLlmGate(
  context: CounterTradeCandidateContext,
  deps?: { config?: CounterTradeLlmAdvisorConfig; generate?: GenerateFn },
): Promise<CounterTradeLlmGateResult> {
  const config = deps?.config ?? readCounterTradeLlmAdvisorConfig()
  if (!config.enabled) {
    return {
      proceed: true,
      notionalUsd: context.counterNotionalUsd,
      evaluated: false,
      applied: false,
      advice: null,
      skipReason: null,
    }
  }

  const generate: GenerateFn =
    deps?.generate ?? ((params) => getElizaLlmService().generateResponse(params))

  const { systemPrompt, userMessage } = buildCounterTradeAdvisorPrompt(context)
  const correlationId = `ct-llm-${randomUUID().slice(0, 8)}`

  let adviceText: string | null = null
  try {
    const result = await generate({
      agentKey: 'counter-trade-advisor',
      userMessage,
      systemPrompt,
      vaultContext: '',
      correlationId,
      abortSignal: AbortSignal.timeout(config.timeoutMs),
    })
    adviceText = result.text
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('counter_trade.llm_advisor_failed', {
      roomId: context.roomId,
      pair: context.pair,
      correlationId,
      message,
    })
    return failModeResult(config, context, 'request_failed')
  }

  const advice = parseCounterTradeAdvice(adviceText)
  if (!advice) {
    logger.warn('counter_trade.llm_advice_unparseable', {
      roomId: context.roomId,
      pair: context.pair,
      correlationId,
      preview: (adviceText ?? '').slice(0, 200),
    })
    return failModeResult(config, context, 'unparseable')
  }

  logger.info('counter_trade.llm_advice', {
    roomId: context.roomId,
    pair: context.pair,
    correlationId,
    mode: config.mode,
    verdict: advice.verdict,
    sizeFactor: advice.verdict === 'execute' ? advice.sizeFactor : null,
    reason: advice.reason,
    candidateNotionalUsd: context.counterNotionalUsd,
  })

  if (config.mode === 'advisory') {
    return {
      proceed: true,
      notionalUsd: context.counterNotionalUsd,
      evaluated: true,
      applied: false,
      advice,
      skipReason: null,
    }
  }

  if (advice.verdict === 'skip') {
    return {
      proceed: false,
      notionalUsd: context.counterNotionalUsd,
      evaluated: true,
      applied: true,
      advice,
      skipReason: `llm_veto:${advice.reason.slice(0, 120)}`,
    }
  }

  if (advice.sizeFactor < config.minSizeFactor) {
    return {
      proceed: false,
      notionalUsd: context.counterNotionalUsd,
      evaluated: true,
      applied: true,
      advice,
      skipReason: `llm_downsize_below_floor:${advice.sizeFactor}`,
    }
  }

  return {
    proceed: true,
    notionalUsd: context.counterNotionalUsd * advice.sizeFactor,
    evaluated: true,
    applied: advice.sizeFactor < 1,
    advice,
    skipReason: null,
  }
}
