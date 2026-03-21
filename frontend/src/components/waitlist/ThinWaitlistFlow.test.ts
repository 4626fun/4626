import { describe, expect, it } from 'vitest'

import { resolveWaitlistStep } from './ThinWaitlistFlow'

describe('resolveWaitlistStep', () => {
  it('keeps unverified accounts on auth', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: false,
          accountSignals: { canonicalCswAddress: null },
        },
        ownerDelegationVerified: null,
      }),
    ).toBe('auth')
  })

  it('routes verified-email accounts without a canonical csw into wallet setup', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          accountSignals: { canonicalCswAddress: null },
        },
        ownerDelegationVerified: null,
      }),
    ).toBe('wallet')
  })

  it('keeps canonical-wallet accounts in wallet setup until owner delegation is verified', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationVerified: false,
      }),
    ).toBe('wallet')
  })

  it('routes fully linked accounts into done state', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationVerified: true,
      }),
    ).toBe('done')
  })
})
