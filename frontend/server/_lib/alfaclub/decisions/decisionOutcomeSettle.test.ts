import { describe, expect, it } from 'vitest'

import {
  computeDecisionHorizonSettlement,
  sideReturnBps,
} from './decisionOutcomeSettle.js'

describe('decision outcome settlement math', () => {
  it('computes side returns and always-inverse baseline', () => {
    expect(sideReturnBps({ side: 'LONG', entry: 100, exit: 101 })).toBeCloseTo(100)
    expect(sideReturnBps({ side: 'SHORT', entry: 100, exit: 101 })).toBeCloseTo(-100)
  })

  it('settles COUNTER against the counter side after costs', () => {
    const settled = computeDecisionHorizonSettlement({
      sourceSide: 'LONG',
      decision: 'COUNTER',
      counterSide: 'SHORT',
      markAtDecision: 100,
      markAtHorizon: 98,
      estimatedCostBps: 10,
    })
    expect(settled.returnBps).toBeCloseTo(200)
    expect(settled.alwaysInverseBps).toBeCloseTo(200)
    expect(settled.netBps).toBeCloseTo(190)
  })

  it('records zero selective return for DELAY/SKIP while keeping always-inverse', () => {
    const settled = computeDecisionHorizonSettlement({
      sourceSide: 'SHORT',
      decision: 'SKIP',
      counterSide: null,
      markAtDecision: 50,
      markAtHorizon: 55,
      estimatedCostBps: 5,
    })
    expect(settled.returnBps).toBe(0)
    expect(settled.alwaysInverseBps).toBeCloseTo(1000)
    expect(settled.netBps).toBeCloseTo(-5)
  })

  it('is deterministic for identical inputs (idempotent settlement payload)', () => {
    const input = {
      sourceSide: 'LONG' as const,
      decision: 'COUNTER' as const,
      counterSide: 'SHORT' as const,
      markAtDecision: 38.42,
      markAtHorizon: 37.9,
      estimatedCostBps: 12,
    }
    expect(computeDecisionHorizonSettlement(input)).toEqual(
      computeDecisionHorizonSettlement(input),
    )
  })
})
