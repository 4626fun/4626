import { beforeEach, describe, expect, it } from 'vitest'
import { evaluateCounterTradeRiskGate, __resetCounterTradeRiskStateForTests } from './counterTradeRisk.js'

const RISK_PROFILE = {
  riskPerTradeBps: 100,
  dailyLossCapBps: 300,
  maxDrawdownPauseBps: 1000,
  stopDistancePctByStrategy: {
    trend: 2.5,
    meanRevert: 1.5,
    event: 4,
  },
} as const

describe('counterTradeRisk', () => {
  beforeEach(() => {
    __resetCounterTradeRiskStateForTests()
  })

  it('sizes notional with simple stop-distance math', () => {
    const result = evaluateCounterTradeRiskGate({
      roomId: '1659',
      senderAddress: '0x1111111111111111111111111111111111111111',
      strategy: 'trend',
      equityUsd: 10_000,
      requestedNotionalUsd: 5_000,
      riskProfile: RISK_PROFILE,
      nowMs: Date.UTC(2026, 5, 15, 0, 0, 0),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 1% of 10,000 = 100 risk; stop 2.5% -> 4,000 notional cap.
    expect(result.sizedNotionalUsd).toBeCloseTo(4_000, 6)
    expect(result.riskPerTradeUsd).toBeCloseTo(100, 6)
  })

  it('blocks when daily loss cap is reached', () => {
    const sender = '0x1111111111111111111111111111111111111111'
    const roomId = '1659'
    const t0 = Date.UTC(2026, 5, 15, 0, 0, 0)
    evaluateCounterTradeRiskGate({
      roomId,
      senderAddress: sender,
      strategy: 'event',
      equityUsd: 10_000,
      requestedNotionalUsd: 1_000,
      riskProfile: RISK_PROFILE,
      nowMs: t0,
    })
    const blocked = evaluateCounterTradeRiskGate({
      roomId,
      senderAddress: sender,
      strategy: 'event',
      equityUsd: 9_700,
      requestedNotionalUsd: 1_000,
      riskProfile: RISK_PROFILE,
      nowMs: t0 + 60_000,
    })
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.reason).toBe('daily_loss_cap_reached')
  })
})
