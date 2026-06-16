import { getCandleSnapshot } from './hyperliquid.js'
import { getDb } from '../db/postgres.js'
import type { BacktestCandleInterval } from './backtestIntervalPolicy.js'
import {
  BACKTEST_INTERVAL_RANK,
  expectedBarCount,
  minCoverageRatio,
} from './backtestIntervalPolicy.js'

export type BacktestMarketBar = {
  timeMs: number
  close: number
}

export type BacktestMarketBarsPayload = {
  bars: BacktestMarketBar[]
  source: 'supabase' | 'hyperliquid_chunked' | 'hyperliquid'
  interval: BacktestCandleInterval
  windowHours: number
  expectedBars: number
  coverageRatio: number
}

const CHUNK_HOURS_BY_INTERVAL: Record<BacktestCandleInterval, number> = {
  '1m': 6,
  '5m': 24,
  '15m': 48,
  '1h': 168,
}

/** Long 1m horizons need Supabase cache — do not fan out hundreds of HL chunk requests first. */
const LONG_1M_HORIZON_HOURS = 24 * 30

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mergeBars(primary: BacktestMarketBar[], secondary: BacktestMarketBar[]): BacktestMarketBar[] {
  const byTime = new Map<number, BacktestMarketBar>()
  for (const bar of primary) byTime.set(bar.timeMs, bar)
  for (const bar of secondary) {
    if (!byTime.has(bar.timeMs)) byTime.set(bar.timeMs, bar)
  }
  return Array.from(byTime.values()).sort((a, b) => a.timeMs - b.timeMs)
}

async function fetchBarsFromSupabaseCache(params: {
  symbol: string
  windowHours: number
}): Promise<BacktestMarketBar[] | null> {
  const db = await getDb().catch(() => null)
  if (!db?.query) return null

  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - params.windowHours * 60 * 60 * 1000)
  try {
    const sql = `
      SELECT bar_time, close
      FROM public.backtest_market_bars_1m
      WHERE symbol = $1
        AND interval = '1m'
        AND bar_time >= $2
        AND bar_time <= $3
      ORDER BY bar_time ASC
    `
    const res = await db.query(sql, [params.symbol, startTime.toISOString(), endTime.toISOString()])
    const bars: BacktestMarketBar[] = []
    for (const row of res.rows ?? []) {
      const barTimeRaw = (row as { bar_time?: unknown }).bar_time
      const closeRaw = (row as { close?: unknown }).close
      const timeMs = new Date(String(barTimeRaw)).getTime()
      const close = typeof closeRaw === 'number' ? closeRaw : Number(closeRaw)
      if (!Number.isFinite(timeMs) || !Number.isFinite(close) || close <= 0) continue
      bars.push({ timeMs, close })
    }
    return bars.length > 0 ? bars : null
  } catch {
    return null
  }
}

async function fetchBarsFromHyperliquidChunked(params: {
  symbol: string
  interval: BacktestCandleInterval
  windowHours: number
}): Promise<BacktestMarketBar[]> {
  const endTimeMs = Date.now()
  const startTimeMs = endTimeMs - params.windowHours * 60 * 60 * 1000
  const expectedBars = expectedBarCount(params.windowHours, params.interval)

  // Single-request path when the full horizon fits Hyperliquid's ~5k candle history cap.
  if (expectedBars <= 5_000) {
    const candles = await getCandleSnapshot({
      coin: params.symbol,
      interval: params.interval,
      startTimeMs,
      endTimeMs,
    })
    if (!candles) {
      throw new Error(`hyperliquid_candle_fetch_failed symbol=${params.symbol} interval=${params.interval}`)
    }
    return candles
      .filter((candle) => Number.isFinite(candle.time) && Number.isFinite(candle.close) && candle.close > 0)
      .filter((candle) => candle.time >= startTimeMs && candle.time <= endTimeMs)
      .map((candle) => ({ timeMs: candle.time, close: candle.close }))
      .sort((a, b) => a.timeMs - b.timeMs)
  }

  const chunkMs = CHUNK_HOURS_BY_INTERVAL[params.interval] * 60 * 60 * 1000
  const byTime = new Map<number, BacktestMarketBar>()

  let cursor = startTimeMs
  let failedChunks = 0
  while (cursor < endTimeMs) {
    const chunkStart = cursor
    const chunkEnd = Math.min(endTimeMs, cursor + chunkMs)
    const candles = await getCandleSnapshot({
      coin: params.symbol,
      interval: params.interval,
      startTimeMs: chunkStart,
      endTimeMs: chunkEnd,
    })
    if (!candles) {
      failedChunks += 1
      cursor = chunkEnd + 1
      if (failedChunks > 1) await sleep(250)
      continue
    }
    for (const candle of candles) {
      if (!Number.isFinite(candle.time) || !Number.isFinite(candle.close) || candle.close <= 0) continue
      if (candle.time < startTimeMs || candle.time > endTimeMs) continue
      byTime.set(candle.time, { timeMs: candle.time, close: candle.close })
    }
    cursor = chunkEnd + 1
    if (cursor < endTimeMs) await sleep(120)
  }

  if (byTime.size === 0 && failedChunks > 0) {
    throw new Error(
      `hyperliquid_candle_fetch_failed symbol=${params.symbol} interval=${params.interval} failedChunks=${failedChunks}`,
    )
  }

  return Array.from(byTime.values()).sort((a, b) => a.timeMs - b.timeMs)
}

export async function loadBacktestMarketBars(params: {
  symbol: string
  interval: BacktestCandleInterval
  windowHours: number
}): Promise<BacktestMarketBarsPayload> {
  const expectedBars = expectedBarCount(params.windowHours, params.interval)
  const minCoverage = minCoverageRatio(params.windowHours, params.interval)

  let bars: BacktestMarketBar[] = []
  let source: BacktestMarketBarsPayload['source'] = 'hyperliquid'

  const cached =
    params.interval === '1m'
      ? await fetchBarsFromSupabaseCache({
          symbol: params.symbol,
          windowHours: params.windowHours,
        })
      : null

  const cachedMeetsCoverage =
    cached != null && cached.length >= Math.floor(expectedBars * minCoverage)

  if (cachedMeetsCoverage) {
    bars = cached
    source = 'supabase'
  } else if (
    params.interval === '1m' &&
    params.windowHours >= LONG_1M_HORIZON_HOURS
  ) {
    const cachedCount = cached?.length ?? 0
    throw new Error(
      `Insufficient 1m cache for ${params.windowHours}h backtest: ${cachedCount}/${expectedBars} bars (${expectedBars > 0 ? ((cachedCount / expectedBars) * 100).toFixed(1) : '0'}%). Run pnpm -C frontend exec tsx scripts/cache-backtest-minute-bars.ts --symbol ${params.symbol} --window-hours ${params.windowHours}`,
    )
  } else {
    const live = await fetchBarsFromHyperliquidChunked(params)
    bars = cached ? mergeBars(cached, live) : live
    source =
      cached && cached.length > 0
        ? 'supabase'
        : params.interval === '1m'
          ? 'hyperliquid_chunked'
          : 'hyperliquid'
    if (cached && cached.length > 0 && live.length > 0) {
      source = 'hyperliquid_chunked'
    }
  }

  const coverageRatio = expectedBars > 0 ? bars.length / expectedBars : 0
  if (bars.length < 20) {
    throw new Error(`Not enough candle data for backtest (${bars.length} bars)`)
  }
  if (coverageRatio < minCoverage) {
    throw new Error(
      `Insufficient ${params.interval} coverage for ${params.windowHours}h backtest: ${bars.length}/${expectedBars} bars (${(coverageRatio * 100).toFixed(1)}%). Run pnpm -C frontend exec tsx scripts/cache-backtest-minute-bars.ts --symbol ${params.symbol} --window-hours ${params.windowHours}`,
    )
  }

  return {
    bars,
    source,
    interval: params.interval,
    windowHours: params.windowHours,
    expectedBars,
    coverageRatio,
  }
}

function intervalsForHorizon(windowHours: number): BacktestCandleInterval[] {
  const hyperliquidBarCap = 5_000
  return BACKTEST_INTERVAL_RANK.filter((interval) => {
    const expected = expectedBarCount(windowHours, interval)
    // 1m may be satisfied from Supabase cache on long horizons (HL is not backfilled for 90d).
    if (interval === '1m') return true
    return expected <= hyperliquidBarCap
  })
}

/** Pick the finest interval that meets coverage for the full horizon (1m when cache is complete). */
export async function loadFinestBacktestMarketBars(params: {
  symbol: string
  windowHours: number
  preferInterval?: BacktestCandleInterval
}): Promise<BacktestMarketBarsPayload> {
  let order = intervalsForHorizon(params.windowHours)
  if (params.preferInterval && order.includes(params.preferInterval)) {
    order = [...order].sort((a, b) => {
      if (a === params.preferInterval) return -1
      if (b === params.preferInterval) return 1
      return BACKTEST_INTERVAL_RANK.indexOf(a) - BACKTEST_INTERVAL_RANK.indexOf(b)
    })
  }

  let lastError: Error | null = null
  for (const interval of order) {
    try {
      return await loadBacktestMarketBars({
        symbol: params.symbol,
        interval,
        windowHours: params.windowHours,
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('backtest_market_bars_unavailable')
}
