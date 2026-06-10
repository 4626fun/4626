import { describe, expect, it } from 'vitest'

import {
  shouldAttemptRelayMethodAFallback,
} from '@/features/accountSetup/addUserOp/addOwnerRelayFallbackPolicy'

describe('shouldAttemptRelayMethodAFallback', () => {
  it('returns true for Base App policy-style funding errors when prefund passed', () => {
    expect(
      shouldAttemptRelayMethodAFallback(new Error('Error generating transaction'), {
        fundingPreflightOk: true,
      }),
    ).toBe(true)
  })

  it('returns false when the user dismissed the signing prompt', () => {
    expect(
      shouldAttemptRelayMethodAFallback(
        new Error('You dismissed the Base App signing prompt'),
        { fundingPreflightOk: true },
      ),
    ).toBe(false)
  })

  it('returns true for insufficient-funds surface when prefund already passed', () => {
    expect(
      shouldAttemptRelayMethodAFallback(new Error('not enough funds'), {
        fundingPreflightOk: true,
      }),
    ).toBe(true)
  })
})
