import { describe, expect, it } from 'vitest'

import { mergeCanonicalWaitlistAccount } from '@/features/waitlist/waitlistFlowState'

describe('canonical account merge across hosts', () => {
  it('prefers bootstrap canonical CSW over stale accounts/me payload', () => {
    const merged = mergeCanonicalWaitlistAccount(
      {
        accountSignals: {
          canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
        },
      },
      {
        canonicalCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      },
    )

    expect(merged.accountSignals.canonicalCswAddress).toBe(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
  })
})
