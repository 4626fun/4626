import { executeBacktestCounterRebalance } from '../../../../_lib/alfaclub/backtestCounterRebalance.js'
import {
  getPerpMarketContext,
  getPerpMarkets,
  getCandleSnapshot,
  type HyperliquidPerpMarketContext,
} from '../../../../_lib/alfaclub/hyperliquid.js'
import {
  classifyFundingOiRegime,
  formatFundingOiRegime,
  type FundingOiRegimeResult,
} from '../../../../_lib/alfaclub/fundingOiRegime.js'
import {
  recordFundingOiRegimeObservation,
  settleDueFundingOiRegimeHorizons,
  type FundingOiObservationInput,
} from '../../../../_lib/alfaclub/fundingOiObservationStore.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * Outer timeout for a real backtest job. A 90-day 1m run with cached bars
 * finishes in ~5-10s, but Hyperliquid chunked fallback (or a stalled API /
 * Supabase deadlock) can block the Eliza chat consumer indefinitely. This
 * races the job against a configurable deadline (default 60s) so a hung
 * backtest surfaces a user-friendly error instead of blocking forever.
 * BACKTEST-002.
 */
const DEFAULT_BACKTEST_JOB_TIMEOUT_MS = 60_000

function backtestJobTimeoutMs(): number {
  const raw = Number(process.env.BACKTEST_JOB_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BACKTEST_JOB_TIMEOUT_MS
}

export type VirtualsBacktestRequest = {
  symbol: string
  leveragePercent: number
  rebalanceHealthPercent: number
  rebalanceSizePercent: number
  initialLongUsd: number
  initialShortUsd: number
  windowHours: number
}

export type VirtualsBacktestResult = {
  responseText: string
  resolvedInterval: string
}

const DEFAULT_TOTAL_EQUITY_USD = 4_000
const DEFAULT_WINDOW_HOURS = 24 * 90
const MIN_WINDOW_HOURS = 24 * 1 // 1 day minimum
const MAX_WINDOW_HOURS = 24 * 90 // 90 days maximum
const DEFAULT_LEVERAGE_PERCENT = 50
const DEFAULT_REBALANCE_HEALTH_PERCENT = 75
const DEFAULT_REBALANCE_SIZE_PERCENT = 35
const FALLBACK_MAX_LEVERAGE = 40

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parsePositive(value: string | undefined, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return numeric
}

function parsePercentField(
  text: string,
  names: string[],
  fallback: number,
  min = 0,
  max = 100,
): number {
  for (const name of names) {
    const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const jsonPattern = new RegExp(`"${quoted}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i')
    const jsonMatch = text.match(jsonPattern)
    if (jsonMatch?.[1]) return clampRange(parsePositive(jsonMatch[1], fallback), min, max)

    const plainPattern = new RegExp(`\\b${quoted}\\b\\s*[:=]?\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i')
    const plainMatch = text.match(plainPattern)
    if (plainMatch?.[1]) return clampRange(parsePositive(plainMatch[1], fallback), min, max)
  }
  return clampRange(fallback, min, max)
}

function parseCapital(text: string): { initialLongUsd: number; initialShortUsd: number } {
  const longMatch = text.match(/\blong\b[^\d$]{0,12}\$?\s*([0-9]+(?:\.[0-9]+)?)/i)
  const shortMatch = text.match(/\bshort\b[^\d$]{0,12}\$?\s*([0-9]+(?:\.[0-9]+)?)/i)
  if (longMatch?.[1] && shortMatch?.[1]) {
    return {
      initialLongUsd: clampRange(parsePositive(longMatch[1], 1000), 100, 100_000),
      initialShortUsd: clampRange(parsePositive(shortMatch[1], 1000), 100, 100_000),
    }
  }
  const totalMatch = text.match(/\b(capital|budget)\b[^\d$]{0,12}\$?\s*([0-9]+(?:\.[0-9]+)?)/i)
  if (totalMatch?.[2]) {
    const total = clampRange(parsePositive(totalMatch[2], DEFAULT_TOTAL_EQUITY_USD), 200, 200_000)
    return { initialLongUsd: total / 2, initialShortUsd: total / 2 }
  }
  return { initialLongUsd: DEFAULT_TOTAL_EQUITY_USD / 2, initialShortUsd: DEFAULT_TOTAL_EQUITY_USD / 2 }
}

function normalizeMarketSymbol(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  if (!trimmed) return 'BTC'
  const cleaned = trimmed
    .replace(/[^A-Z0-9/._-]/g, '')
    .replace(/[-_]/g, '/')
    .replace(/\/PERP$/i, '')
    .replace(/PERP$/i, '')
    .replace(/\/USDC$/i, '')
    .replace(/\/USD$/i, '')
    .replace(/USDC$/i, '')
    .replace(/USD$/i, '')
    .replace(/\//g, '')
  return cleaned || 'BTC'
}

function parseSymbol(text: string, noFallback = false): string | null {
  const jsonMatch = text.match(/"symbol"\s*:\s*"([^"]{1,24})"/i)
  if (jsonMatch?.[1]) return normalizeMarketSymbol(jsonMatch[1])

  const explicit = text.match(/\b(symbol|pair|market)\b\s*[:=]?\s*([A-Za-z0-9/_\-.]{2,24})\b/i)
  if (explicit?.[2]) return normalizeMarketSymbol(explicit[2])

  const afterBacktest = text.match(/\bbacktest\b[^\w]{0,4}([A-Za-z0-9/_\-.]{2,24})\b/i)
  if (afterBacktest?.[1]) {
    const normalized = normalizeMarketSymbol(afterBacktest[1])
    if (normalized && normalized !== 'FOR' && normalized !== 'ON') return normalized
  }

  const fallbackTokens = text.match(/\b([A-Za-z]{2,12}(?:\/(?:USDC|USD))?)\b/g)
  if (fallbackTokens) {
    const blocked = new Set([
      'BACKTEST',
      'LEVERAGEPERCENT',
      'REBALANCEHEALTHPERCENT',
      'REBALANCESIZEPERCENT',
      'CAPITAL',
      'BUDGET',
      'LONG',
      'SHORT',
      'REQUEST',
      'PLEASE',
      'FOR',
      'ON',
      'SIGNAL',
      'COUNTER',
      'BIAS',
      'DIRECTION',
      'ZAG',
      'ZIG',
      'GIVE',
      'ME',
      'THE',
      'WHAT',
      'IS',
      'TELL',
      'SHOW',
      'TRADE',
    ])
    for (const token of fallbackTokens) {
      const normalized = normalizeMarketSymbol(token)
      if (!normalized || blocked.has(normalized)) continue
      return normalized
    }
  }

  if (noFallback) return null
  return 'BTC'
}

async function resolveAppliedLeverage(params: {
  symbol: string
  leveragePercent: number
}): Promise<{ appliedLeverage: number; maxLeverage: number }> {
  const markets = await getPerpMarkets()
  const market = markets?.find((entry) => entry.symbol === params.symbol)
  const maxLeverage = clampRange(market?.maxLeverage ?? FALLBACK_MAX_LEVERAGE, 1, 100)
  const appliedLeverage = clampRange((maxLeverage * params.leveragePercent) / 100, 1, maxLeverage)
  return { appliedLeverage, maxLeverage }
}

function parseWindowHours(text: string): number {
  // Check for explicit day/hour specifications: "7d", "30d", "90d", "7 day", "30 days"
  const dayMatch = text.match(/\b(\d+)\s*d(?:ays?)?\b/i)
  if (dayMatch?.[1]) {
    const days = parseInt(dayMatch[1], 10)
    if (days > 0) return Math.min(Math.max(days * 24, MIN_WINDOW_HOURS), MAX_WINDOW_HOURS)
  }
  // Check for explicit hour specifications: "168h", "720h", "2160h"
  const hourMatch = text.match(/\b(\d+)\s*h(?:rs?|ours?)?\b/i)
  if (hourMatch?.[1]) {
    const hours = parseInt(hourMatch[1], 10)
    if (hours > 0) return Math.min(Math.max(hours, MIN_WINDOW_HOURS), MAX_WINDOW_HOURS)
  }
  // Check for offering-name-style hints: "backtestReport7d", "backtestReport30d"
  const nameMatch = text.match(/(?:backtest|report)(\d+)d/i)
  if (nameMatch?.[1]) {
    const days = parseInt(nameMatch[1], 10)
    if (days > 0) return Math.min(Math.max(days * 24, MIN_WINDOW_HOURS), MAX_WINDOW_HOURS)
  }
  return DEFAULT_WINDOW_HOURS
}

export function parseBacktestRequestFromText(text: string): VirtualsBacktestRequest | null {
  const normalized = text.toLowerCase()
  if (!normalized.includes('backtest')) return null
  return {
    symbol: parseSymbol(text) ?? 'BTC',
    leveragePercent: parsePercentField(text, ['leveragePercent', 'leverage_percent'], DEFAULT_LEVERAGE_PERCENT),
    rebalanceHealthPercent: parsePercentField(
      text,
      ['rebalanceHealthPercent', 'rebalance_health_percent'],
      DEFAULT_REBALANCE_HEALTH_PERCENT,
    ),
    rebalanceSizePercent: parsePercentField(
      text,
      ['rebalanceSizePercent', 'rebalance_size_percent'],
      DEFAULT_REBALANCE_SIZE_PERCENT,
    ),
    ...parseCapital(text),
    windowHours: parseWindowHours(text),
  }
}

/**
 * Parse a backtest request from the ACP offering name + requirement JSON.
 *
 * When a buyer purchases an offering (e.g. `generateBacktestReport7d`), the
 * ACP protocol sets `job.description = offeringName` and sends the buyer's
 * requirement data as a JSON message with contentType "requirement".
 *
 * This function extracts:
 * - windowHours from the offering name suffix (7d→168h, 30d→720h, 90d→2160h)
 * - symbol, leveragePercent, rebalanceHealthPercent, rebalanceSizePercent
 *   from the requirement JSON
 *
 * Returns null if the offering name is not a backtest report offering.
 */
export function parseBacktestRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): VirtualsBacktestRequest | null {
  // Only handle generateBacktestReport* offerings
  const match = offeringName.match(/^generateBacktestReport(\d+)d$/i)
  if (!match) return null
  const days = parseInt(match[1], 10)
  const windowHours = Math.min(Math.max(days * 24, MIN_WINDOW_HOURS), MAX_WINDOW_HOURS)

  // Parse the requirement JSON for symbol and optional params
  let req: Record<string, unknown> = {}
  try {
    req = JSON.parse(requirementJson)
  } catch {
    // If JSON parse fails, try to extract a symbol from the raw text
    const symbol = parseSymbol(requirementJson, true)
    if (!symbol) return null
    return {
      symbol,
      leveragePercent: DEFAULT_LEVERAGE_PERCENT,
      rebalanceHealthPercent: DEFAULT_REBALANCE_HEALTH_PERCENT,
      rebalanceSizePercent: DEFAULT_REBALANCE_SIZE_PERCENT,
      initialLongUsd: DEFAULT_TOTAL_EQUITY_USD / 2,
      initialShortUsd: DEFAULT_TOTAL_EQUITY_USD / 2,
      windowHours,
    }
  }

  const symbol = typeof req.symbol === 'string' ? normalizeMarketSymbol(req.symbol) : null
  if (!symbol) return null

  return {
    symbol,
    leveragePercent: typeof req.leveragePercent === 'number' ? clampRange(req.leveragePercent, 0, 100) : DEFAULT_LEVERAGE_PERCENT,
    rebalanceHealthPercent:
      typeof req.rebalanceHealthPercent === 'number'
        ? clampRange(req.rebalanceHealthPercent, 0, 100)
        : DEFAULT_REBALANCE_HEALTH_PERCENT,
    rebalanceSizePercent:
      typeof req.rebalanceSizePercent === 'number'
        ? clampRange(req.rebalanceSizePercent, 0, 100)
        : DEFAULT_REBALANCE_SIZE_PERCENT,
    initialLongUsd: DEFAULT_TOTAL_EQUITY_USD / 2,
    initialShortUsd: DEFAULT_TOTAL_EQUITY_USD / 2,
    windowHours,
  }
}

/**
 * Parse a counter-trade signal request from the ACP offering name + requirement JSON.
 * Returns the symbol if this is a counterTradeSignal offering, null otherwise.
 */
export function parseSignalRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): string | null {
  if (!offeringName.toLowerCase().includes('countertrade') && !offeringName.toLowerCase().includes('counter_trade')) {
    return null
  }
  let req: Record<string, unknown> = {}
  try {
    req = JSON.parse(requirementJson)
  } catch {
    return parseSymbol(requirementJson, true)
  }
  const symbol = typeof req.symbol === 'string' ? normalizeMarketSymbol(req.symbol) : null
  return symbol
}

export function parseFundingOiRegimeRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): string | null {
  if (offeringName.toLowerCase() !== 'fundingoiregimeshadow') return null
  let req: Record<string, unknown>
  try {
    req = JSON.parse(requirementJson) as Record<string, unknown>
  } catch {
    return parseSymbol(requirementJson, true)
  }
  return typeof req.symbol === 'string' ? normalizeMarketSymbol(req.symbol) : null
}

export type FundingOiRegimeJobResult = FundingOiRegimeResult & { responseText: string }

export async function runFundingOiRegimeJob(
  symbol: string,
  deps?: {
    readMarketContext?: (symbol: string) => Promise<HyperliquidPerpMarketContext | null>
    recordObservation?: typeof recordFundingOiRegimeObservation
    settleHorizons?: typeof settleDueFundingOiRegimeHorizons
    now?: () => number
    idempotencyKey?: string
  },
): Promise<FundingOiRegimeJobResult> {
  const normalizedSymbol = normalizeMarketSymbol(symbol)
  const readMarketContext = deps?.readMarketContext ?? getPerpMarketContext
  const context = await readMarketContext(normalizedSymbol)
  const analysis = classifyFundingOiRegime({
    symbol: normalizedSymbol,
    fundingRate: context?.fundingRate ?? null,
    openInterestUsd: context?.openInterestUsd ?? null,
    volume24hUsd: context?.volume24hUsd ?? null,
    priceChange24hPct: context?.priceChange24hPct ?? null,
  })
  const observedAtMs = (deps?.now ?? Date.now)()
  const observation: FundingOiObservationInput = {
    idempotencyKey: deps?.idempotencyKey,
    observedAtMs,
    symbol: analysis.symbol,
    markPriceUsd: context?.markPriceUsd ?? null,
    fundingRate: analysis.fundingRate,
    openInterestUsd: analysis.openInterestUsd,
    volume24hUsd: analysis.volume24hUsd,
    priceChange24hPct: analysis.priceChange24hPct,
    regime: analysis.regime,
    fundingBias: analysis.fundingBias,
    oiParticipation: analysis.oiParticipation,
    confidence: analysis.confidence,
    reasons: analysis.reasons,
    missingFields: [
      ...(context?.markPriceUsd == null || !Number.isFinite(context.markPriceUsd) ? ['markPriceUsd' as const] : []),
      ...analysis.missingFields,
    ],
  }
  const recordObservation = deps?.recordObservation ?? recordFundingOiRegimeObservation
  const settleHorizons = deps?.settleHorizons ?? settleDueFundingOiRegimeHorizons
  await recordObservation(observation).catch(() => {})
  await settleHorizons({
    nowMs: observedAtMs,
    readMarkPriceAt: async (dueSymbol, targetAtMs) => {
      const candles = await getCandleSnapshot({
        coin: dueSymbol,
        interval: '1m',
        startTimeMs: targetAtMs - 60_000,
        endTimeMs: targetAtMs + 120_000,
      })
      const candle = candles
        ?.filter((item) => Number.isFinite(item.close) && item.close > 0)
        .sort((a, b) => Math.abs(a.time - targetAtMs) - Math.abs(b.time - targetAtMs))[0]
      return candle ? { priceUsd: candle.close, priceAtMs: candle.time } : null
    },
  }).catch(() => {})
  return { ...analysis, responseText: formatFundingOiRegime(analysis) }
}

export async function runRealBacktestJob(
  request: VirtualsBacktestRequest,
  deps?: {
    run?: typeof executeBacktestCounterRebalance
    resolveLeverage?: typeof resolveAppliedLeverage
  },
): Promise<VirtualsBacktestResult> {
  // BACKTEST-002: race the job against a configurable deadline so a stalled
  // backtest (Hyperliquid API hang, Supabase deadlock) cannot block the Eliza
  // chat / XMTP consumer indefinitely. The underlying job keeps running, but
  // this call surfaces a user-friendly timeout error instead of hanging.
  // This covers the service.ts chat entry point (service.ts:248) and any other
  // caller; the skillRouter also applies its own outer 60s race (harmless).
  const timeoutMs = backtestJobTimeoutMs()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      executeBacktestJob(request, deps),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Backtest timed out after ${Math.round(timeoutMs / 1000)}s`)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * BACKTEST-004: Extract the meaningful rows from a backtest stdout instead of
 * tail-truncating. The CLI prints "Top parameter sets (by objective):" near the
 * top (the actual sweep results) and "Saved ..." / "No-commingle ..." lines at
 * the tail. A naive `slice(-8)` keeps only the file-path lines and drops the
 * results. This helper pulls the top-N block plus the saved-file lines, falling
 * back to the tail when the marker is absent (e.g. unit-test mocks).
 */
const BACKTEST_STDOUT_MAX_CHARS = 4000

function formatBacktestStdoutSummary(stdout: string): string {
  const lines = stdout.split('\n')
  const topIdx = lines.findIndex((l) => l.includes('Top parameter sets'))
  if (topIdx >= 0) {
    const block: string[] = []
    // Capture the top-N block (header through the next blank line).
    for (let i = topIdx; i < lines.length; i++) {
      const l = lines[i]
      if (i > topIdx && l.trim() === '') break
      block.push(l)
    }
    // Append the saved-file and no-commingle status lines from the tail.
    for (const l of lines) {
      if (l.startsWith('Saved ') || l.startsWith('No-commingle requirement')) block.push(l)
    }
    return block.join('\n').slice(0, BACKTEST_STDOUT_MAX_CHARS)
  }
  // Fallback: no recognized marker — keep the tail (preserves prior behaviour).
  return lines.slice(-8).join('\n').slice(0, BACKTEST_STDOUT_MAX_CHARS)
}

async function executeBacktestJob(
  request: VirtualsBacktestRequest,
  deps?: {
    run?: typeof executeBacktestCounterRebalance
    resolveLeverage?: typeof resolveAppliedLeverage
  },
): Promise<VirtualsBacktestResult> {
  const run = deps?.run ?? executeBacktestCounterRebalance
  const resolveLeverage = deps?.resolveLeverage ?? resolveAppliedLeverage
  const { appliedLeverage, maxLeverage } = await resolveLeverage({
    symbol: request.symbol,
    leveragePercent: request.leveragePercent,
  })

  // Capital allocation: user's "capital" input is split 50/50 between long
  // and short legs. Within each leg, half goes to margin (position collateral)
  // and half to buffer (rebalance reserve). So `capital 4000` produces:
  //   longMargin=$1000, longBuffer=$1000, shortMargin=$1000, shortBuffer=$1000
  // This differs from the API path (_backtest-run.ts) which takes margin and
  // buffer as separate fields with no halving.
  const longMargin = Math.max(100, request.initialLongUsd * 0.5)
  const shortMargin = Math.max(100, request.initialShortUsd * 0.5)
  const targetChunk = Math.max(
    10,
    Math.min(request.initialLongUsd, request.initialShortUsd) * (request.rebalanceSizePercent / 100),
  )
  const result = await run({
    symbol: request.symbol,
    interval: '1m',
    windowHours: request.windowHours,
    leverage: appliedLeverage,
    initialLongMarginUsd: longMargin,
    initialShortMarginUsd: shortMargin,
    initialLongBufferUsd: longMargin,
    initialShortBufferUsd: shortMargin,
    healthFloor: clampRange(request.rebalanceHealthPercent / 100, 0.05, 0.99),
    deadband: 0.08,
    minChunkUsd: targetChunk,
    maxChunkUsd: targetChunk,
    cooldownBars: 3,
    requireNoCommingle: true,
  })

  if (result.resolvedInterval !== '1m') {
    // Don't throw — surface a warning instead. The 1m cache may not be
    // populated yet (requires `cache-backtest-minute-bars.ts` to run).
    // Coarser intervals (5m, 15m, 1h) still produce valid backtest results,
    // just with fewer rebalance opportunities per bar.
    const summary = formatBacktestStdoutSummary(result.stdout)
    const responseText =
      `Backtest complete for ${request.symbol} (${request.windowHours}h, ${appliedLeverage.toFixed(2)}x from ${request.leveragePercent}% of max ${maxLeverage}x, long $${Math.round(request.initialLongUsd)}, short $${Math.round(request.initialShortUsd)}, health ${request.rebalanceHealthPercent}%, size ${request.rebalanceSizePercent}%). ` +
      `Resolved interval: ${result.resolvedInterval} (WARNING: 1m cache unavailable — results use coarser candles; run cache-backtest-minute-bars.ts for 1m fidelity).\n\n` +
      `Top results:\n${summary || '(no stdout output captured)'}`
    return { responseText, resolvedInterval: result.resolvedInterval }
  }

  const summary = formatBacktestStdoutSummary(result.stdout)
  const responseText =
    `Backtest complete for ${request.symbol} (${request.windowHours}h, ${appliedLeverage.toFixed(2)}x from ${request.leveragePercent}% of max ${maxLeverage}x, long $${Math.round(request.initialLongUsd)}, short $${Math.round(request.initialShortUsd)}, health ${request.rebalanceHealthPercent}%, size ${request.rebalanceSizePercent}%). ` +
    `Resolved interval: ${result.resolvedInterval}.\n\n` +
    `Top results:\n${summary || '(no stdout output captured)'}`
  return { responseText, resolvedInterval: result.resolvedInterval }
}

// ---------------------------------------------------------------------------
// Counter-trade signal — lightweight directional read from a short backtest.
// Used by the `counterTradeSignal` Virtuals offering.
// ---------------------------------------------------------------------------

export type CounterTradeSignalResult = {
  responseText: string
  signal: 'long-bias' | 'short-bias' | 'neutral'
  conviction: number
  resolvedInterval: string
  priceChangePct: number
  realizedPnl: number
  rebalanceCount: number
  recommendedLeveragePercent: number
}

const SIGNAL_WINDOW_HOURS = 24 * 7 // 7-day lookback for signal
const SIGNAL_NEUTRAL_THRESHOLD_PCT = 1.5 // |priceChange| below this = neutral
const SIGNAL_MAX_CONVICTION_PCT = 15 // |priceChange| at/above this = 100 conviction

/**
 * Detects whether a message is a counter-trade signal request (as opposed to
 * a full backtest). Triggers on keywords: signal, counter, bias, direction,
 * zag, zig — plus a tradeable symbol.
 */
export function parseSignalRequestFromText(text: string): string | null {
  const normalized = text.toLowerCase()
  const isSignal =
    normalized.includes('signal') ||
    normalized.includes('counter') ||
    normalized.includes('bias') ||
    normalized.includes('direction') ||
    normalized.includes('zag') ||
    normalized.includes('zig')
  if (!isSignal) return null
  // Don't intercept full backtest requests
  if (normalized.includes('backtest')) return null
  const symbol = parseSymbol(text, true)
  if (!symbol) return null
  return symbol
}

/**
 * Runs a short 7-day backtest and derives a counter-trade directional signal.
 * The counter-rebalance strategy is inherently contrarian — when price rises,
 * the short leg accrues and the signal is short-biased (InverseAKITA "zags"
 * when akita "zigs"). When price falls, the signal is long-biased.
 */
export async function runCounterTradeSignal(
  symbol: string,
  deps?: {
    run?: typeof executeBacktestCounterRebalance
    resolveLeverage?: typeof resolveAppliedLeverage
  },
): Promise<CounterTradeSignalResult> {
  const timeoutMs = backtestJobTimeoutMs()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      executeSignalJob(symbol, deps),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Signal computation timed out after ${Math.round(timeoutMs / 1000)}s`)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function executeSignalJob(
  symbol: string,
  deps?: {
    run?: typeof executeBacktestCounterRebalance
    resolveLeverage?: typeof resolveAppliedLeverage
  },
): Promise<CounterTradeSignalResult> {
  const run = deps?.run ?? executeBacktestCounterRebalance
  const resolveLeverage = deps?.resolveLeverage ?? resolveAppliedLeverage
  const { appliedLeverage, maxLeverage } = await resolveLeverage({
    symbol,
    leveragePercent: DEFAULT_LEVERAGE_PERCENT,
  })

  // Minimal capital — we only need the price path and PnL direction, not
  // production-scale margin. $500 per side is enough to avoid dust rounding.
  const marginPerSide = 250
  const result = await run({
    symbol,
    interval: '1m',
    windowHours: SIGNAL_WINDOW_HOURS,
    leverage: appliedLeverage,
    initialLongMarginUsd: marginPerSide,
    initialShortMarginUsd: marginPerSide,
    initialLongBufferUsd: marginPerSide,
    initialShortBufferUsd: marginPerSide,
    healthFloor: 0.75,
    deadband: 0.08,
    minChunkUsd: 100,
    maxChunkUsd: 100,
    cooldownBars: 3,
    requireNoCommingle: true,
  })

  // Parse the CSV stdout to extract priceChangePct and realizedPnl.
  const { priceChangePct, realizedPnl, rebalanceCount } = parseSignalCsv(result.stdout)

  // Derive signal direction: counter-trade logic.
  // Price went up → short-bias (zag). Price went down → long-bias (zig).
  const absChange = Math.abs(priceChangePct)
  let signal: 'long-bias' | 'short-bias' | 'neutral'
  if (absChange < SIGNAL_NEUTRAL_THRESHOLD_PCT) {
    signal = 'neutral'
  } else if (priceChangePct > 0) {
    signal = 'short-bias'
  } else {
    signal = 'long-bias'
  }

  // Conviction: scale |priceChange| from neutral threshold to max threshold → 0-100.
  const conviction = Math.min(
    100,
    Math.round(
      ((absChange - SIGNAL_NEUTRAL_THRESHOLD_PCT) /
        (SIGNAL_MAX_CONVICTION_PCT - SIGNAL_NEUTRAL_THRESHOLD_PCT)) *
        100,
    ),
  )
  const effectiveConviction = Math.max(0, conviction)

  // Recommended leverage percent scales with conviction.
  const recommendedLeveragePercent = signal === 'neutral' ? 25 : Math.min(75, 30 + effectiveConviction * 0.4)

  const pnlDirection = realizedPnl > 0 ? 'profitable' : 'at a loss'
  const responseText =
    `Counter-Trade Signal for ${symbol} (${SIGNAL_WINDOW_HOURS}h lookback, ${appliedLeverage.toFixed(2)}x from ${DEFAULT_LEVERAGE_PERCENT}% of max ${maxLeverage}x).\n` +
    `Signal: ${signal.toUpperCase()} (conviction: ${effectiveConviction}/100)\n` +
    `Recommended leverage: ${recommendedLeveragePercent.toFixed(0)}% of market max\n` +
    `Price change: ${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}% over ${SIGNAL_WINDOW_HOURS}h\n` +
    `Counter-rebalance strategy was ${pnlDirection} (${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} realized, ${rebalanceCount} rebalances)\n` +
    `Resolved interval: ${result.resolvedInterval}\n` +
    `Rationale: InverseAKITA counter-trades — when price zigs up, this agent zags short. When price zigs down, this agent zags long. ` +
    `The ${SIGNAL_WINDOW_HOURS}h price move of ${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}% indicates a ${signal} posture.`

  return {
    responseText,
    signal,
    conviction: effectiveConviction,
    resolvedInterval: result.resolvedInterval,
    priceChangePct,
    realizedPnl,
    rebalanceCount,
    recommendedLeveragePercent,
  }
}

/**
 * Parse the CSV block from backtest stdout to extract signal-relevant fields.
 * Returns { priceChangePct, realizedPnl, rebalanceCount } with safe defaults.
 */
function parseSignalCsv(stdout: string): {
  priceChangePct: number
  realizedPnl: number
  rebalanceCount: number
} {
  const defaults = { priceChangePct: 0, realizedPnl: 0, rebalanceCount: 0 }
  const lines = stdout.split('\n')
  // Find the CSV header line and the first data row.
  const headerIdx = lines.findIndex((l) => l.startsWith('symbol,interval,windowHours'))
  if (headerIdx < 0) return defaults
  const header = lines[headerIdx].split(',')
  const dataRow = lines[headerIdx + 1]
  if (!dataRow) return defaults
  const values = dataRow.split(',')
  const priceChangeIdx = header.indexOf('priceChangePct')
  const pnlIdx = header.indexOf('realizedPnl')
  const rebalanceIdx = header.indexOf('rebalanceCount')
  return {
    priceChangePct: priceChangeIdx >= 0 ? Number(values[priceChangeIdx]) || 0 : 0,
    realizedPnl: pnlIdx >= 0 ? Number(values[pnlIdx]) || 0 : 0,
    rebalanceCount: rebalanceIdx >= 0 ? Number(values[rebalanceIdx]) || 0 : 0,
  }
}
