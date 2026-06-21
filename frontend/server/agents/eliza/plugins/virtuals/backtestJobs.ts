import { executeBacktestCounterRebalance } from '../../../../_lib/alfaclub/backtestCounterRebalance.js'

export type VirtualsBacktestRequest = {
  symbol: string
  windowHours: number
  leverage: number
  initialLongUsd: number
  initialShortUsd: number
  requireOneMinute: boolean
}

export type VirtualsBacktestResult = {
  responseText: string
  resolvedInterval: string
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parsePositive(value: string | undefined, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return numeric
}

function parseWindowHours(text: string): number {
  const dayMatch = text.match(/(\d+(?:\.\d+)?)\s*(d|day|days)\b/i)
  if (dayMatch?.[1]) return clampRange(Math.round(parsePositive(dayMatch[1], 7) * 24), 1, 24 * 90)
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i)
  if (hourMatch?.[1]) return clampRange(Math.round(parsePositive(hourMatch[1], 24)), 1, 24 * 90)
  return 24 * 7
}

function parseLeverage(text: string): number {
  const xMatch = text.match(/(\d+(?:\.\d+)?)\s*x\b/i)
  if (xMatch?.[1]) return clampRange(parsePositive(xMatch[1], 20), 1, 40)
  const leverageMatch = text.match(/\bleverage\b[:=\s]*([0-9]+(?:\.[0-9]+)?)/i)
  if (leverageMatch?.[1]) return clampRange(parsePositive(leverageMatch[1], 20), 1, 40)
  return 20
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
    const total = clampRange(parsePositive(totalMatch[2], 2000), 200, 200_000)
    return { initialLongUsd: total / 2, initialShortUsd: total / 2 }
  }
  return { initialLongUsd: 1000, initialShortUsd: 1000 }
}

function parseSymbol(text: string): string {
  const explicit = text.match(/\b(symbol|pair|market)\b[:=\s]*([A-Za-z]{2,12})\b/i)
  if (explicit?.[2]) return explicit[2].toUpperCase()
  const token = text.match(/\b(BTC|ETH|SOL|HYPE|AVAX|ARB|OP|DOGE|XRP|BNB)\b/i)
  if (token?.[1]) return token[1].toUpperCase()
  return 'BTC'
}

function parseRequireOneMinute(text: string): boolean {
  const normalized = text.toLowerCase()
  if (/\brequire1m\b\s*[:=]?\s*(true|1|yes|on)\b/.test(normalized)) return true
  if (/\b(1m only|only 1m|one minute only|minute-only)\b/.test(normalized)) return true
  return false
}

export function parseBacktestRequestFromText(text: string): VirtualsBacktestRequest | null {
  const normalized = text.toLowerCase()
  if (!normalized.includes('backtest')) return null
  return {
    symbol: parseSymbol(text),
    windowHours: parseWindowHours(text),
    leverage: parseLeverage(text),
    ...parseCapital(text),
    requireOneMinute: parseRequireOneMinute(text),
  }
}

export async function runRealBacktestJob(
  request: VirtualsBacktestRequest,
  deps?: {
    run?: typeof executeBacktestCounterRebalance
  },
): Promise<VirtualsBacktestResult> {
  const run = deps?.run ?? executeBacktestCounterRebalance
  const result = await run({
    symbol: request.symbol,
    interval: request.requireOneMinute ? '1m' : 'auto',
    windowHours: request.windowHours,
    leverage: request.leverage,
    initialLongMarginUsd: request.initialLongUsd,
    initialShortMarginUsd: request.initialShortUsd,
    initialLongBufferUsd: request.initialLongUsd,
    initialShortBufferUsd: request.initialShortUsd,
    healthFloor: 0.75,
    deadband: 0.08,
    minChunkUsd: 500,
    maxChunkUsd: 1000,
    cooldownBars: 3,
    requireNoCommingle: true,
  })

  if (request.requireOneMinute && result.resolvedInterval !== '1m') {
    throw new Error(
      `1m-only requested but resolved interval was ${result.resolvedInterval}. ` +
        '1m cache coverage is insufficient for this request.',
    )
  }

  const tail = result.stdout.split('\n').slice(-8).join('\n').slice(0, 1200)
  const responseText =
    `Backtest complete for ${request.symbol} (${request.windowHours}h, ${request.leverage}x, long $${Math.round(request.initialLongUsd)}, short $${Math.round(request.initialShortUsd)}${request.requireOneMinute ? ', 1m-only' : ''}). ` +
    `Resolved interval: ${result.resolvedInterval}.\n\n` +
    `Recent output:\n${tail || '(no stdout output captured)'}`
  return { responseText, resolvedInterval: result.resolvedInterval }
}
