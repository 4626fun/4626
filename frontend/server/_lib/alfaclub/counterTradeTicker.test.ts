import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resolveCounterTradeTickerEffectiveness,
  startCounterTradeTicker,
} from './counterTradeTicker.js'
import type { CounterTradeRunResult } from './counterTradeRunner.js'

function okResult(overrides: Partial<CounterTradeRunResult> = {}): CounterTradeRunResult {
  return {
    ok: true,
    roomId: '1659',
    scannedIdentities: 0,
    scannedEvents: 0,
    newEvents: 0,
    executed: 0,
    skipped: 0,
    blocked: 0,
    failed: 0,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('startCounterTradeTicker', () => {
  it('does not start when ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED is unset', () => {
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED', '')
    const handle = startCounterTradeTicker()
    expect(handle.started).toBe(false)
    expect(handle.reason).toBe('disabled')
    expect(handle.readState().reason).toBe('disabled')
    handle.stop()
  })

  it('runs the loop when forced and records state', async () => {
    const run = vi.fn(async () => okResult({ executed: 1, newEvents: 1 }))
    const handle = startCounterTradeTicker({ force: true, intervalMs: 60_000, run })
    const result = await handle.runNow()
    expect(result?.executed).toBe(1)
    expect(run).toHaveBeenCalled()
    const state = handle.readState()
    expect(state.started).toBe(true)
    expect(state.lastResult?.executed).toBe(1)
    expect(state.lastError).toBeNull()
    handle.stop()
  })

  it('skips overlapping ticks while a pass is in flight', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const run = vi.fn(async () => {
      await gate
      return okResult()
    })
    const handle = startCounterTradeTicker({ force: true, intervalMs: 60_000, run })
    const first = handle.runNow()
    const second = await handle.runNow()
    expect(second).toBeNull()
    release()
    await first
    expect(run).toHaveBeenCalledTimes(1)
    handle.stop()
  })

  it('captures loop errors without throwing', async () => {
    const run = vi.fn(async () => {
      throw new Error('boom')
    })
    const handle = startCounterTradeTicker({ force: true, intervalMs: 60_000, run })
    const result = await handle.runNow()
    expect(result).toBeNull()
    expect(handle.readState().lastError).toBe('boom')
    handle.stop()
  })
})

describe('resolveCounterTradeTickerEffectiveness', () => {
  it('reports disabled and not-yet-ticked runners accurately', () => {
    expect(resolveCounterTradeTickerEffectiveness({
      started: false,
      reason: 'disabled',
      intervalMs: 120_000,
      ticks: 0,
      lastTickAt: null,
      lastResult: null,
      lastError: null,
    })).toEqual({ effective: false, reason: 'disabled' })

    expect(resolveCounterTradeTickerEffectiveness({
      started: true,
      reason: null,
      intervalMs: 120_000,
      ticks: 0,
      lastTickAt: null,
      lastResult: null,
      lastError: null,
    })).toEqual({ effective: false, reason: 'awaiting_first_tick' })
  })

  it('reports the last tick failure', () => {
    expect(resolveCounterTradeTickerEffectiveness({
      started: true,
      reason: null,
      intervalMs: 120_000,
      ticks: 1,
      lastTickAt: '2026-07-17T13:00:00.000Z',
      lastResult: null,
      lastError: 'boom',
    })).toEqual({ effective: false, reason: 'last_tick_failed' })
  })

  it('reports a blocking loop reason as ineffective', () => {
    expect(resolveCounterTradeTickerEffectiveness({
      started: true,
      reason: null,
      intervalMs: 120_000,
      ticks: 1,
      lastTickAt: '2026-07-17T13:00:00.000Z',
      lastResult: okResult({ reason: 'disabled' }),
      lastError: null,
    })).toEqual({
      effective: false,
      reason: 'disabled',
    })
  })

  it('reports a successful room-1659 split_by_action tick as effective', () => {
    expect(resolveCounterTradeTickerEffectiveness({
      started: true,
      reason: null,
      intervalMs: 120_000,
      ticks: 1,
      lastTickAt: '2026-07-17T13:00:00.000Z',
      lastResult: okResult({ roomId: '1659', skipped: 1, executed: 1 }),
      lastError: null,
    })).toEqual({
      effective: true,
      reason: null,
    })
  })

  it('reports a successful working loop as effective', () => {
    expect(resolveCounterTradeTickerEffectiveness({
      started: true,
      reason: null,
      intervalMs: 120_000,
      ticks: 1,
      lastTickAt: '2026-07-17T13:00:00.000Z',
      lastResult: okResult(),
      lastError: null,
    })).toEqual({
      effective: true,
      reason: null,
    })
  })
})
