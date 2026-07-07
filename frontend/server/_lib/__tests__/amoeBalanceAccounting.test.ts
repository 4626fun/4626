import { describe, expect, it } from 'vitest'

import { weightedAmoeEligiblePoints } from '../onboarding/waitlistScoring.js'
import { AMOE_CREDITS_PER_ENTRY } from '../lottery/lotteryAmoe.js'

/**
 * Behavioral regression for C1: burns must reduce spendable AMOE balance.
 * Uses the same per-row weights as `points_amoe_eligible_balance`.
 */
describe('AMOE balance accounting (earn N, burn M)', () => {
  function eligibleBalanceFromRows(
    rows: Array<{ source: string; amount: number }>,
  ): number {
    return rows.reduce(
      (sum, row) => sum + weightedAmoeEligiblePoints(row.source, row.amount),
      0,
    )
  }

  it('reduces balance after a single burn (200 earned, 100 burned → 100 left)', () => {
    const rows = [
      { source: 'amoe_checkin', amount: 200 },
      { source: 'amoe_entry_spend', amount: -AMOE_CREDITS_PER_ENTRY },
    ]
    expect(eligibleBalanceFromRows(rows)).toBe(100)
  })

  it('blocks a second entry when balance is insufficient after first burn', () => {
    const afterFirstBurn = eligibleBalanceFromRows([
      { source: 'amoe_checkin', amount: 150 },
      { source: 'amoe_entry_spend', amount: -AMOE_CREDITS_PER_ENTRY },
    ])
    expect(afterFirstBurn).toBe(50)
    expect(afterFirstBurn).toBeLessThan(AMOE_CREDITS_PER_ENTRY)
  })

  it('excludes referral_passthrough from AMOE spendable balance', () => {
    const balance = eligibleBalanceFromRows([
      { source: 'referral_passthrough', amount: 500 },
      { source: 'amoe_checkin', amount: 150 },
    ])
    expect(balance).toBe(150)
  })

  it('refunds restore spendable balance', () => {
    const balance = eligibleBalanceFromRows([
      { source: 'amoe_checkin', amount: 200 },
      { source: 'amoe_entry_spend', amount: -100 },
      { source: 'amoe_entry_refund', amount: 100 },
    ])
    expect(balance).toBe(200)
  })
})
