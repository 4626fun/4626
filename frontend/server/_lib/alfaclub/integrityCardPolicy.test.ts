import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INTEGRITY_CARD_POST_GATE,
  evaluateIntegrityCardPostability,
  pickMostPostableIntegrityCardSubject,
  roomMetricsFromDirectoryItem,
  type IntegrityCardRoomMetrics,
} from './integrityCardPolicy.js'

function metrics(partial: Partial<IntegrityCardRoomMetrics>): IntegrityCardRoomMetrics {
  return {
    fundUsd: null,
    holders: null,
    pnlPctAllTime: null,
    pnlPct30d: null,
    pnl30dUsd: null,
    pnlUsd: null,
    ...partial,
  }
}

describe('roomMetricsFromDirectoryItem', () => {
  it('maps live room snapshot fields and optional HL 30d PnL', () => {
    expect(
      roomMetricsFromDirectoryItem(
        {
          tradingFundUsdc: 1_361.3,
          uniqueHolders: 39,
          pnlPctAllTime: 50.02,
          pnlPct30d: -0.31,
          pnlUsdc: 533.6,
        },
        { pnl30dUsd: 10.21 },
      ),
    ).toEqual({
      fundUsd: 1_361.3,
      holders: 39,
      pnlPctAllTime: 50.02,
      pnlPct30d: -0.31,
      pnl30dUsd: 10.21,
      pnlUsd: 533.6,
    })
  })
})

describe('evaluateIntegrityCardPostability', () => {
  it('rejects quiet #1 economics like Flip Research today', () => {
    const result = evaluateIntegrityCardPostability(
      metrics({
        fundUsd: 1_361,
        holders: 39,
        pnlPctAllTime: 50,
        pnlPct30d: -0.3,
        pnl30dUsd: 10,
        pnlUsd: 534,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.reasons).toEqual(['below_bullish_thresholds'])
  })

  it('passes on large fund', () => {
    const result = evaluateIntegrityCardPostability(
      metrics({ fundUsd: 40_000, holders: 120, pnlPctAllTime: 12 }),
    )
    expect(result.ok).toBe(true)
    expect(result.reasons).toContain('fund_threshold')
  })

  it('passes on strong 30d PnL', () => {
    const result = evaluateIntegrityCardPostability(
      metrics({ fundUsd: 8_000, pnl30dUsd: 6_500 }),
    )
    expect(result.ok).toBe(true)
    expect(result.reasons).toContain('pnl_30d_threshold')
  })

  it('passes on all-time % only with fund floor', () => {
    const weakFund = evaluateIntegrityCardPostability(
      metrics({ fundUsd: 2_000, pnlPctAllTime: 180 }),
    )
    expect(weakFund.ok).toBe(false)

    const strong = evaluateIntegrityCardPostability(
      metrics({ fundUsd: 12_000, pnlPctAllTime: 180 }),
    )
    expect(strong.ok).toBe(true)
    expect(strong.reasons).toContain('pnl_pct_all_time_threshold')
  })
})

describe('pickMostPostableIntegrityCardSubject', () => {
  it('skips non-postable candidates and picks the bulliest passer', () => {
    const picked = pickMostPostableIntegrityCardSubject([
      {
        id: 'quiet-1',
        rank: 1,
        metrics: metrics({ fundUsd: 1_300, holders: 39, pnlPctAllTime: 50, pnl30dUsd: 10 }),
      },
      {
        id: 'mid',
        rank: 4,
        metrics: metrics({ fundUsd: 28_000, holders: 80, pnlPctAllTime: 40 }),
      },
      {
        id: 'whale',
        rank: 9,
        metrics: metrics({ fundUsd: 90_000, holders: 200, pnlPctAllTime: 25, pnl30dUsd: 8_000 }),
      },
    ], DEFAULT_INTEGRITY_CARD_POST_GATE)

    expect(picked?.id).toBe('whale')
  })

  it('returns null when nobody clears the gate', () => {
    const picked = pickMostPostableIntegrityCardSubject([
      {
        id: 'a',
        rank: 1,
        metrics: metrics({ fundUsd: 1_300, pnl30dUsd: 10 }),
      },
      {
        id: 'b',
        rank: 2,
        metrics: metrics({ fundUsd: 800, pnlPctAllTime: 30 }),
      },
    ])
    expect(picked).toBeNull()
  })
})
