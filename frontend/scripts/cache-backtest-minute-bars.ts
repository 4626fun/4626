#!/usr/bin/env tsx
/**
 * Backfill + cache minute bars into Supabase for backtests.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/cache-backtest-minute-bars.ts
 *   pnpm -C frontend exec tsx scripts/cache-backtest-minute-bars.ts --symbol BTC --window-hours 2160 --chunk-hours 24
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getDb } from '../server/_lib/db/postgres.js'
import { getCandleSnapshot } from '../server/_lib/alfaclub/hyperliquid.js'

type CliArgs = {
  symbol: string
  interval: '1m'
  windowHours: number
  chunkHours: number
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
    dryRun: flags.has('dry-run'),
  }
}

async function fetchMinuteBarsInChunks(args: CliArgs) {
  const endTimeMs = Date.now()
  const startTimeMs = endTimeMs - args.windowHours * 60 * 60 * 1000
  const chunkMs = args.chunkHours * 60 * 60 * 1000
  const byTime = new Map<number, Awaited<ReturnType<typeof getCandleSnapshot>> extends (infer U)[] | null ? U : never>()

  let cursor = startTimeMs
  let chunks = 0
  while (cursor < endTimeMs) {
    chunks += 1
    const chunkStart = cursor
    const chunkEnd = Math.min(endTimeMs, cursor + chunkMs)
    const candles = await getCandleSnapshot({
      coin: args.symbol,
      interval: args.interval,
      startTimeMs: chunkStart,
      endTimeMs: chunkEnd,
    })
    if (!candles) {
      throw new Error(`candle_fetch_failed chunk=${chunks} start=${new Date(chunkStart).toISOString()}`)
    }
    for (const candle of candles) {
      if (!Number.isFinite(candle.time)) continue
      byTime.set(candle.time, candle)
    }
    cursor = chunkEnd + 1
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

  return { rows, chunks, startTimeMs, endTimeMs }
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
  const { rows, chunks, startTimeMs, endTimeMs } = await fetchMinuteBarsInChunks(args)
  const elapsedFetchMs = Date.now() - started
  console.log('[cache-backtest-minute-bars] fetched', {
    chunks,
    rows: rows.length,
    from: new Date(startTimeMs).toISOString(),
    to: new Date(endTimeMs).toISOString(),
    fetchSeconds: Number((elapsedFetchMs / 1000).toFixed(2)),
  })

  if (args.dryRun) return

  const upsertStarted = Date.now()
  await upsertRows(rows)
  const elapsedUpsertMs = Date.now() - upsertStarted
  console.log('[cache-backtest-minute-bars] done', {
    rows: rows.length,
    upsertSeconds: Number((elapsedUpsertMs / 1000).toFixed(2)),
  })
}

void main().catch((error) => {
  console.error(
    '[cache-backtest-minute-bars] failed:',
    error instanceof Error ? error.message : String(error),
  )
  process.exitCode = 1
})
