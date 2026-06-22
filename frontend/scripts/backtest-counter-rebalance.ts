#!/usr/bin/env tsx
/**
 * CLI entry for gradual dual-leg rebalance backtests.
 *
 *   pnpm -C frontend exec tsx scripts/backtest-counter-rebalance.ts --symbol BTC --interval auto --window-hours 2160
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { runBacktestCounterRebalanceCli } from '../server/_lib/alfaclub/backtestCounterRebalance.js'

// Standalone tsx scripts don't get Vite's automatic .env loading.
// Load frontend/.env so DATABASE_URL is available for the Supabase 1m cache.
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

loadEnvFile(resolve(process.cwd(), '.env'))

void runBacktestCounterRebalanceCli(process.argv.slice(2)).catch((err) => {
  console.error('[backtest-counter-rebalance] failed:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
