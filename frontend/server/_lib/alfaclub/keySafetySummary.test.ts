import { describe, expect, it } from 'vitest'

import { evaluateKeyDefense } from '../../../src/lib/alfaclub/keyDefense.js'
import { resolveKeySafetyStatus } from './keySafetySummary.js'

describe('resolveKeySafetyStatus', () => {
  it('returns the compact status needed by room discovery', () => {
    const evaluation = evaluateKeyDefense({
      roomType: 'trading',
      roomTier: 'club',
      keySupply: 100,
      yourKeys: 20,
      potUsdc: 1_000,
      donationUsdc: 100,
      targetRecoveryFraction: 0.5,
    })

    expect(resolveKeySafetyStatus(evaluation, 1_000)).toMatch(/^(safe|caution|at-risk)$/)
  })
})
