import { describe, expect, it, vi } from 'vitest'

import { awardWaitlistPoints, isWaitlistPointSource } from './waitlistPoints'

describe('waitlist points source hardening', () => {
  it('accepts referral_qualified as a valid source', () => {
    expect(isWaitlistPointSource('referral_qualified')).toBe(true)
  })

  it('rejects unknown sources in awardWaitlistPoints', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [] })),
    }

    await expect(
      awardWaitlistPoints({
        db: db as any,
        signupId: 1,
        source: 'unknown_source',
        sourceId: 'x',
        amount: 1,
      }),
    ).rejects.toThrow('invalid_waitlist_point_source')
  })
})
