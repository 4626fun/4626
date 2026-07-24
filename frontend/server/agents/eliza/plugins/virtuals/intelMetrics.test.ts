import { describe, expect, it } from 'vitest'

import { IntelMetricsTracker } from './intelMetrics.js'

describe('IntelMetricsTracker', () => {
  it('tracks per-offering success, submit failures, skip rate, and settlement lag', () => {
    const tracker = new IntelMetricsTracker()
    tracker.recordSuccess({
      offeringName: 'counterTradeAnalysis',
      latencyMs: 120,
      dataAgeMs: 4_000,
      decision: 'COUNTER',
    })
    tracker.recordSuccess({
      offeringName: 'counterTradeAnalysis',
      latencyMs: 80,
      dataAgeMs: 5_000,
      decision: 'SKIP',
    })
    tracker.recordFailure({
      offeringName: 'crowdingSnapshot',
      latencyMs: 40,
      decision: 'SKIP',
    })
    tracker.recordSubmitFailure('counterTradeAnalysis')
    tracker.recordSettlementLag(90_000, Date.parse('2026-07-12T09:00:00.000Z'))

    const snap = tracker.snapshot()
    expect(snap.offerings.counterTradeAnalysis).toMatchObject({
      success: 2,
      failure: 0,
      submitFailures: 1,
      skipCount: 1,
      lastDataAgeMs: 5_000,
    })
    expect(tracker.skipRate('counterTradeAnalysis')).toBeCloseTo(0.5)
    expect(snap.settlementLagMs).toBe(90_000)
    expect(snap.lastSettlementAt).toBe('2026-07-12T09:00:00.000Z')
  })
})
