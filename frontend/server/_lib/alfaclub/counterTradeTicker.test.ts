import { afterEach, describe, expect, it, vi } from 'vitest'

import { startCounterTradeTicker } from './counterTradeTicker.js'
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
