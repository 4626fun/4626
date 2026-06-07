import { describe, expect, it } from 'vitest'

import { computeCounterTradeCooldownRemainingMs } from './counterTradeRunner.js'

describe('counterTradeRunner cooldown guard', () => {
  it('returns zero when no previous execution is known', () => {
    const remaining = computeCounterTradeCooldownRemainingMs({
      lastExecutedAtMs: null,
      cooldownMs: 120_000,
      nowMs: 1_000_000,
    })
    expect(remaining).toBe(0)
  })

  it('returns remaining cooldown when still inside cooldown window', () => {
    const remaining = computeCounterTradeCooldownRemainingMs({
      lastExecutedAtMs: 1_000_000,
      cooldownMs: 120_000,
      nowMs: 1_040_000,
    })
    expect(remaining).toBe(80_000)
  })

  it('returns zero once cooldown has elapsed', () => {
    const remaining = computeCounterTradeCooldownRemainingMs({
      lastExecutedAtMs: 1_000_000,
      cooldownMs: 120_000,
      nowMs: 1_130_000,
    })
    expect(remaining).toBe(0)
  })
})

