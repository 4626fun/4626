#!/usr/bin/env tsx
/**
 * CLI entry for gradual dual-leg rebalance backtests.
 *
 *   pnpm -C frontend exec tsx scripts/backtest-counter-rebalance.ts --symbol BTC --interval auto --window-hours 2160
 */

import { runBacktestCounterRebalanceCli } from '../server/_lib/alfaclub/backtestCounterRebalance.js'

void runBacktestCounterRebalanceCli(process.argv.slice(2)).catch((err) => {
  console.error('[backtest-counter-rebalance] failed:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
