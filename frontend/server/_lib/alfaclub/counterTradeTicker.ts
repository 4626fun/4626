/**
 * AlfaClub counter-trade in-process ticker (Railway Hermit executor).
 *
 * ## Why this exists
 *
 * The counter-trade engine's execution lane (`runArenaTrade`) shells out to
 * the dgclaw-skill CLI (`npx ts-node scripts/trade.ts ...`) inside
 * `ARENA_DGCLAW_DIR` (`/app/dgclaw-skill` in the Hermit Docker image). That
 * directory only exists on the Railway Hermit container — Vercel serverless
 * cannot execute it. The original Vercel cron-based path could therefore
 * detect fills and derive decisions but never execute: every attempt landed in
 * `alfaclub.counter_trade_action_ledger` as `failed` with
 * "Arena trading is disabled" (or would ENOENT with trading enabled).
 *
 * This ticker runs the same `runCounterTradeLoop()` inside the long-lived
 * Hermit runtime where the dgclaw CLI and validated `ARENA_*` env live.
 *
 * ## Single-executor invariant
 *
 * Exactly one runtime must execute the loop. The Vercel cron entry was
 * removed from `frontend/vercel.json` when this ticker shipped. The ticker is
 * additionally gated by `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED` (default off)
 * so a stray local/standby Hermit process does not compete with the Railway
 * primary. DB-side dedup (`counter_trade_event_ledger` unique key, cooldowns,
 * caps) makes accidental overlap safe but not free — keep one executor.
 *
 * Never throws out of the exported surface — a broken loop must not crash
 * the Hermit chat runtime.
 */

import { logger } from '../infra/logger.js'
import {
  runCounterTradeLoop,
  type CounterTradeRunResult,
} from './counterTradeRunner.js'
import { isCounterTradeRunnerEnabledByEnv } from './counterTradeEnv.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_TICK_INTERVAL_MS = 2 * 60_000
const MIN_TICK_INTERVAL_MS = 30_000

export type CounterTradeTickerState = {
  started: boolean
  reason: 'disabled' | null
  intervalMs: number
  ticks: number
  lastTickAt: string | null
  lastResult: CounterTradeRunResult | null
  lastError: string | null
}

export interface CounterTradeTickerHandle {
  stop: () => void
  runNow: () => Promise<CounterTradeRunResult | null>
  readState: () => CounterTradeTickerState
  started: boolean
  reason?: 'disabled'
}

function readTickIntervalMs(): number {
  const raw = String(process.env.ALFACLUB_COUNTER_TRADE_RUNNER_INTERVAL_MS ?? '').trim()
  if (!raw) return DEFAULT_TICK_INTERVAL_MS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TICK_INTERVAL_MS
  return Math.max(MIN_TICK_INTERVAL_MS, parsed)
}

export function startCounterTradeTicker(opts?: {
  intervalMs?: number
  /** Bypasses the env gate — tests only. */
  force?: boolean
  run?: () => Promise<CounterTradeRunResult>
}): CounterTradeTickerHandle {
  const state: CounterTradeTickerState = {
    started: false,
    reason: null,
    intervalMs: opts?.intervalMs ?? readTickIntervalMs(),
    ticks: 0,
    lastTickAt: null,
    lastResult: null,
    lastError: null,
  }

  if (!opts?.force && !isCounterTradeRunnerEnabledByEnv()) {
    state.reason = 'disabled'
    logger.info('[counter-trade-ticker] in-process loop disabled', {
      flag: 'ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED',
    })
    return {
      stop: () => {},
      runNow: async () => null,
      readState: () => ({ ...state }),
      started: false,
      reason: 'disabled',
    }
  }

  const run = opts?.run ?? runCounterTradeLoop
  let stopped = false
  let inFlight = false

  const tick = async (): Promise<CounterTradeRunResult | null> => {
    if (stopped) return null
    // Overlap guard: a slow loop pass (Hyperliquid fetches + CLI execution)
    // must not stack a second concurrent pass on the next interval.
    if (inFlight) return null
    inFlight = true
    state.ticks += 1
    state.lastTickAt = new Date().toISOString()
    try {
      const result = await run()
      state.lastResult = result
      state.lastError = null
      if (result.executed > 0 || result.failed > 0 || result.newEvents > 0) {
        logger.info('[counter-trade-ticker] tick', {
          roomId: result.roomId,
          ok: result.ok,
          reason: result.reason ?? null,
          scannedIdentities: result.scannedIdentities,
          newEvents: result.newEvents,
          executed: result.executed,
          skipped: result.skipped,
          blocked: result.blocked,
          failed: result.failed,
        })
      }
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      state.lastError = message
      logger.warn('[counter-trade-ticker] tick failed', { error: message })
      return null
    } finally {
      inFlight = false
    }
  }

  queueMicrotask(() => {
    void tick()
  })

  const handle = setInterval(() => {
    void tick()
  }, state.intervalMs)
  if (typeof (handle as { unref?: () => void }).unref === 'function') {
    ;(handle as { unref: () => void }).unref()
  }

  state.started = true
  logger.info('[counter-trade-ticker] started', { intervalMs: state.intervalMs })

  return {
    stop: () => {
      stopped = true
      clearInterval(handle)
    },
    runNow: tick,
    readState: () => ({ ...state }),
    started: true,
  }
}
