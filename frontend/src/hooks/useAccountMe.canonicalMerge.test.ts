import { describe, expect, it } from 'vitest'

import { mergeCanonicalWaitlistAccount } from '@/features/waitlist/waitlistFlowState'
import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

/** Pre-migration stale snapshot from accounts/me (2026-04-23 cutover). */
const LEGACY_STALE_CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'

describe('canonical account merge across hosts', () => {
  it('prefers bootstrap canonical CSW over stale accounts/me payload', () => {
    const merged = mergeCanonicalWaitlistAccount(
      {
        accountSignals: {
          canonicalCswAddress: LEGACY_STALE_CSW,
        },
      },
      {
        canonicalCswAddress: CANONICAL_CSW_ADDRESS,
      },
    )

    expect(merged.accountSignals.canonicalCswAddress).toBe(CANONICAL_CSW_ADDRESS)
  })
})
