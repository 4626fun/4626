#!/usr/bin/env tsx
/**
 * Backfill + cache minute bars into Supabase for backtests.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/cache-backtest-minute-bars.ts
 *   pnpm -C frontend exec tsx scripts/cache-backtest-minute-bars.ts --symbol BTC --window-hours 2160 --chunk-hours 24
 *
 * Default (resume): append new bars since the latest cached minute.
 * When cache coverage for --window-hours is below target, automatically backfills the full window.
 * Force full re-fetch: add --no-resume
 * Cron / incremental only: add --incremental-only
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expectedBarCount, minCoverageRatio } from '../server/_lib/alfaclub/backtestIntervalPolicy.js'
import { getDb } from '../server/_lib/db/postgres.js'
import { getCandleSnapshot } from '../server/_lib/alfaclub/hyperliquid.js'

type CliArgs = {
  symbol: string
  interval: '1m'
  windowHours: number
  chunkHours: number
  resumeFromLast: boolean
  incrementalOnly: boolean
  dryRun: boolean
}

type CacheRow = {
  symbol: string
  market: string
  interval: '1m'
  barTimeIso: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  source: string
  fetchedAtIso: string
}

function loadEnvFile(path: string): void {
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv: string[]): CliArgs {
  const flags = new Set<string>()
  const map = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags.add(key)
    } else {
      map.set(key, next)
      i += 1
    }
  }

  const symbol = (map.get('symbol') ?? 'BTC').trim().toUpperCase()
  const windowHoursRaw = Number(map.get('window-hours') ?? 24 * 90)
  const chunkHoursRaw = Number(map.get('chunk-hours') ?? 24)

  const windowHours = Number.isFinite(windowHoursRaw) ? Math.max(1, Math.floor(windowHoursRaw)) : 24 * 90
  const chunkHours = Number.isFinite(chunkHoursRaw) ? Math.max(1, Math.floor(chunkHoursRaw)) : 24

  return {
    symbol,
    interval: '1m',
    windowHours,
    chunkHours,
    resumeFromLast: !flags.has('no-resume'),
    incrementalOnly: flags.has('incremental-only'),
    dryRun: flags.has('dry-run'),
  }
}

type CacheCoverage = {
  count: number
  expectedBars: number
  coveragePct: number
  minBarTimeMs: number | null
  maxBarTimeMs: number | null
}

async function readCacheCoverage(symbol: string, windowHours: number): Promise<CacheCoverage | null> {
  const db = await getDb().catch(() => null)
  if (!db?.query) return null

  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - windowHours * 60 * 60 * 1000)
  const expectedBars = expectedBarCount(windowHours, '1m')

  const sql = `
    SELECT
      count(*)::int AS bar_count,
      min(bar_time) AS min_bar_time,
      max(bar_time) AS max_bar_time
    FROM public.backtest_market_bars_1m
    WHERE symbol = $1
      AND interval = '1m'
      AND bar_time >= $2
      AND bar_time <= $3
  `
  const res = await db.query(sql, [symbol, startTime.toISOString(), endTime.toISOString()])
  const row = res.rows?.[0] as { bar_count?: unknown; min_bar_time?: unknown; max_bar_time?: unknown } | undefined
  const countRaw = row?.bar_count
  const count = typeof countRaw === 'number' ? countRaw : Number(countRaw ?? 0)
  const minBarTimeMs = row?.min_bar_time ? new Date(String(row.min_bar_time)).getTime() : null
  const maxBarTimeMs = row?.max_bar_time ? new Date(String(row.max_bar_time)).getTime() : null

  return {
    count: Number.isFinite(count) ? count : 0,
    expectedBars,
    coveragePct: expectedBars > 0 ? count / expectedBars : 0,
    minBarTimeMs: Number.isFinite(minBarTimeMs ?? NaN) ? minBarTimeMs : null,
    maxBarTimeMs: Number.isFinite(maxBarTimeMs ?? NaN) ? maxBarTimeMs : null,
  }
}

type FetchWindow = {
  startTimeMs: number
  endTimeMs: number
  mode: 'full' | 'incremental' | 'backfill_window'
  /** Why incremental mode was chosen (cron flag vs coverage gate). */
  incrementalReason?: 'coverage_ok' | 'cron_only'
  coverageBefore: CacheCoverage | null
}
async function resolveFetchWindow(args: CliArgs): Promise<FetchWindow> {
  const endTimeMs = Date.now()
  const targetStartMs = endTimeMs - args.windowHours * 60 * 60 * 1000
  const coverageBefore = await readCacheCoverage(args.symbol, args.windowHours)
  const minCoverage = minCoverageRatio(args.windowHours, '1m')

  if (!args.resumeFromLast) {
    return {
      startTimeMs: targetStartMs,
      endTimeMs,
      mode: 'full',
      coverageBefore,
    }
  }

  if (args.incrementalOnly) {
    const maxBarTimeMs = coverageBefore?.maxBarTimeMs ?? null
    if (maxBarTimeMs == null) {
      return { startTimeMs: targetStartMs, endTimeMs, mode: 'backfill_window', coverageBefore }
    }
    return {
      startTimeMs: Math.max(0, maxBarTimeMs + 60_000),
      endTimeMs,
      mode: 'incremental',
      incrementalReason: 'cron_only',
      coverageBefore,
    }
  }

  const coverageOk =
    coverageBefore != null &&
    coverageBefore.coveragePct >= minCoverage &&
    coverageBefore.maxBarTimeMs != null &&
    endTimeMs - coverageBefore.maxBarTimeMs <= 15 * 60 * 1000

  if (coverageOk) {
    return {
      startTimeMs: Math.max(0, coverageBefore!.maxBarTimeMs! + 60_000),
      endTimeMs,
      mode: 'incremental',
      incrementalReason: 'coverage_ok',
      coverageBefore,
    }
  }

  return {
    startTimeMs: targetStartMs,
    endTimeMs,
    mode: 'backfill_window',
    coverageBefore,
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchCandlesWithRetry(params: {
  coin: string
  interval: '1m'
  startTimeMs: number
  endTimeMs: number
  maxAttempts?: number
}) {
  const maxAttempts = params.maxAttempts ?? 3
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candles = await getCandleSnapshot({
      coin: params.coin,
      interval: params.interval,
      startTimeMs: params.startTimeMs,
      endTimeMs: params.endTimeMs,
    })
    if (candles) return candles
    if (attempt < maxAttempts) await sleep(400 * attempt)
  }
  return null
}

async function fetchMinuteBarsInChunks(args: CliArgs, window: { startTimeMs: number; endTimeMs: number }) {
  const endTimeMs = Date.now()
  const startTimeMs = window.startTimeMs
  const targetEndTimeMs = window.endTimeMs || endTimeMs
  const chunkMs = args.chunkHours * 60 * 60 * 1000
  const byTime = new Map<number, Awaited<ReturnType<typeof getCandleSnapshot>> extends (infer U)[] | null ? U : never>()

  if (startTimeMs >= targetEndTimeMs) {
    return { rows: [] as CacheRow[], chunks: 0, startTimeMs, endTimeMs: targetEndTimeMs }
  }

  let cursor = startTimeMs
  let chunks = 0
  let failedChunks = 0
  const totalChunksEstimate = Math.max(1, Math.ceil((targetEndTimeMs - startTimeMs) / chunkMs))
  console.log(
    `[cache-backtest-minute-bars] fetching ${totalChunksEstimate} chunk(s) of ${args.chunkHours}h from Hyperliquid…`,
  )
  while (cursor < targetEndTimeMs) {
    chunks += 1
    const chunkStart = cursor
    const chunkEnd = Math.min(targetEndTimeMs, cursor + chunkMs)
    if (chunks === 1 || chunks % 10 === 0 || chunks === totalChunksEstimate) {
      console.log(
        `[cache-backtest-minute-bars] chunk ${chunks}/${totalChunksEstimate} · ${new Date(chunkStart).toISOString().slice(0, 10)} → ${new Date(chunkEnd).toISOString().slice(0, 10)} · ${byTime.size} unique bars so far`,
      )
    }
    const candles = await fetchCandlesWithRetry({
      coin: args.symbol,
      interval: args.interval,
      startTimeMs: chunkStart,
      endTimeMs: chunkEnd,
    })
    if (!candles) {
      failedChunks += 1
      cursor = chunkEnd + 1
      continue
    }
    for (const candle of candles) {
      if (!Number.isFinite(candle.time)) continue
      byTime.set(candle.time, candle)
    }
    cursor = chunkEnd + 1
  }

  if (byTime.size === 0 && failedChunks > 0) {
    throw new Error(`candle_fetch_failed failedChunks=${failedChunks}`)
  }

  const rows = Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .map((candle) => ({
      symbol: args.symbol,
      market: `${args.symbol}/USDC`,
      interval: args.interval,
      barTimeIso: new Date(candle.time).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      source: 'hyperliquid',
      fetchedAtIso: new Date().toISOString(),
    } satisfies CacheRow))

  return { rows, chunks, failedChunks, startTimeMs, endTimeMs: targetEndTimeMs }
}

async function upsertRows(rows: CacheRow[]) {
  const db = await getDb()
  if (!db) throw new Error('database_not_configured — set DATABASE_URL in frontend/.env')
  if (!db.query) throw new Error('db_query_unavailable')

  const BATCH_SIZE = 1000
  let totalInserted = 0

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE)
    const values: unknown[] = []
    const placeholders: string[] = []
    for (let i = 0; i < batch.length; i += 1) {
      const row = batch[i]!
      const base = i * 11
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`,
      )
      values.push(
        row.symbol,
        row.market,
        row.interval,
        row.barTimeIso,
        row.open,
        row.high,
        row.low,
        row.close,
        row.volume,
        row.source,
        row.fetchedAtIso,
      )
    }

    const sql = `
      INSERT INTO public.backtest_market_bars_1m (
        symbol, market, interval, bar_time, open, high, low, close, volume, source, fetched_at
      )
      VALUES ${placeholders.join(',')}
      ON CONFLICT (symbol, interval, bar_time)
      DO UPDATE SET
        market = EXCLUDED.market,
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        source = EXCLUDED.source,
        fetched_at = EXCLUDED.fetched_at
    `

    await db.query(sql, values)
    totalInserted += batch.length
    console.log(`[cache-backtest-minute-bars] upserted ${totalInserted}/${rows.length}`)
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env'))
  loadEnvFile(resolve(process.cwd(), '../.env'))

  const args = parseArgs(process.argv.slice(2))
  console.log('[cache-backtest-minute-bars] args', args)

  const started = Date.now()
  const window = await resolveFetchWindow(args)
  if (window.coverageBefore) {
    console.log('[cache-backtest-minute-bars] cache_before', {
      bars: window.coverageBefore.count,
      expected: window.coverageBefore.expectedBars,
      coveragePct: Number((window.coverageBefore.coveragePct * 100).toFixed(1)),
      min: window.coverageBefore.minBarTimeMs
        ? new Date(window.coverageBefore.minBarTimeMs).toISOString()
        : null,
      max: window.coverageBefore.maxBarTimeMs
        ? new Date(window.coverageBefore.maxBarTimeMs).toISOString()
        : null,
    })
  }
  if (window.mode === 'incremental') {
    if (window.incrementalReason === 'cron_only') {
      console.log(
        '[cache-backtest-minute-bars] mode=incremental-only (cron — append since last cached bar; does not backfill gaps)',
      )
    } else {
      console.log(
        '[cache-backtest-minute-bars] mode=incremental (cache coverage OK + fresh — appending new bars only)',
      )
    }
  } else if (window.mode === 'backfill_window') {
    console.log(
      `[cache-backtest-minute-bars] mode=backfill_window (coverage below ${(minCoverageRatio(args.windowHours, '1m') * 100).toFixed(0)}% — fetching full ${args.windowHours}h window)`,
    )
  } else {
    console.log('[cache-backtest-minute-bars] mode=full (--no-resume)')
  }

  const { rows, chunks, failedChunks, startTimeMs, endTimeMs } = await fetchMinuteBarsInChunks(args, window)
  const elapsedFetchMs = Date.now() - started
  console.log('[cache-backtest-minute-bars] fetched', {
    mode: window.mode,
    chunks,
    failedChunks,
    rows: rows.length,
    from: new Date(startTimeMs).toISOString(),
    to: new Date(endTimeMs).toISOString(),
    fetchSeconds: Number((elapsedFetchMs / 1000).toFixed(2)),
  })

  if (failedChunks > 0) {
    console.warn(
      `[cache-backtest-minute-bars] warn: ${failedChunks} chunk(s) failed after retries — row count may be low; wait and re-run backfill`,
    )
  }

  if (rows.length === 0 && window.mode === 'incremental') {
    console.log('[cache-backtest-minute-bars] nothing new to upsert')
    return
  }

  if (args.dryRun) return

  const upsertStarted = Date.now()
  await upsertRows(rows)
  const elapsedUpsertMs = Date.now() - upsertStarted

  const coverageAfter = await readCacheCoverage(args.symbol, args.windowHours)
  const barsBefore = window.coverageBefore?.count ?? null
  const barsDelta =
    barsBefore != null && coverageAfter ? coverageAfter.count - barsBefore : null
  console.log('[cache-backtest-minute-bars] done', {
    rowsFetched: rows.length,
    barsDelta,
    upsertSeconds: Number((elapsedUpsertMs / 1000).toFixed(2)),
  })
  if (coverageAfter) {
    console.log('[cache-backtest-minute-bars] cache_after', {
      bars: coverageAfter.count,
      barsDelta,
      expected: coverageAfter.expectedBars,
      coveragePct: Number((coverageAfter.coveragePct * 100).toFixed(1)),
      min: coverageAfter.minBarTimeMs ? new Date(coverageAfter.minBarTimeMs).toISOString() : null,
      max: coverageAfter.maxBarTimeMs ? new Date(coverageAfter.maxBarTimeMs).toISOString() : null,
    })
    if (coverageAfter.coveragePct < minCoverageRatio(args.windowHours, '1m')) {
      console.log(
        '[cache-backtest-minute-bars] note: Hyperliquid exposes ~5k recent 1m candles (~3.5 days). 90-day 1m backtests need this cache filled over time (daily cron) or use auto finest resolution (1h for full 90d until cache is complete).',
      )
    }
  }
}

void main().catch((error) => {
  console.error(
    '[cache-backtest-minute-bars] failed:',
    error instanceof Error ? error.message : String(error),
  )
  process.exitCode = 1
})
