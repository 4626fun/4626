import { executeBacktestCounterRebalance } from '../../../../_lib/alfaclub/backtestCounterRebalance.js'
import { getPerpMarkets } from '../../../../_lib/alfaclub/hyperliquid.js'

export type VirtualsBacktestRequest = {
  symbol: string
  leveragePercent: number
  rebalanceHealthPercent: number
  rebalanceSizePercent: number
  initialLongUsd: number
  initialShortUsd: number
}

export type VirtualsBacktestResult = {
  responseText: string
  resolvedInterval: string
}

const DEFAULT_TOTAL_EQUITY_USD = 4_000
const FIXED_WINDOW_HOURS = 24 * 90
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

function parseSymbol(text: string): string {
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
    ])
    for (const token of fallbackTokens) {
      const normalized = normalizeMarketSymbol(token)
      if (!normalized || blocked.has(normalized)) continue
      return normalized
    }
  }

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

export function parseBacktestRequestFromText(text: string): VirtualsBacktestRequest | null {
  const normalized = text.toLowerCase()
  if (!normalized.includes('backtest')) return null
  return {
    symbol: parseSymbol(text),
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
  }
}

export async function runRealBacktestJob(
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

  const longMargin = Math.max(100, request.initialLongUsd * 0.5)
  const shortMargin = Math.max(100, request.initialShortUsd * 0.5)
  const targetChunk = Math.max(
    10,
    Math.min(request.initialLongUsd, request.initialShortUsd) * (request.rebalanceSizePercent / 100),
  )
  const result = await run({
    symbol: request.symbol,
    interval: '1m',
    windowHours: FIXED_WINDOW_HOURS,
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
    throw new Error(
      `1m execution required but resolved interval was ${result.resolvedInterval}. ` +
        '1m cache coverage is insufficient for this request.',
    )
  }

  const tail = result.stdout.split('\n').slice(-8).join('\n').slice(0, 1200)
  const responseText =
    `Backtest complete for ${request.symbol} (${FIXED_WINDOW_HOURS}h, ${appliedLeverage.toFixed(2)}x from ${request.leveragePercent}% of max ${maxLeverage}x, long $${Math.round(request.initialLongUsd)}, short $${Math.round(request.initialShortUsd)}, health ${request.rebalanceHealthPercent}%, size ${request.rebalanceSizePercent}%). ` +
    `Resolved interval: ${result.resolvedInterval}.\n\n` +
    `Recent output:\n${tail || '(no stdout output captured)'}`
  return { responseText, resolvedInterval: result.resolvedInterval }
}
