import { describe, expect, it } from 'vitest'

import { resolveWaitlistStep } from './ThinWaitlistFlow'

describe('resolveWaitlistStep', () => {
  it('keeps unverified accounts on auth', () => {
    expect(
      resolveWaitlistStep({
        emailVerified: false,
        accountSignals: { canonicalCswAddress: null },
      }),
    ).toBe('auth')
  })

  it('routes verified-email accounts without a canonical csw into wallet setup', () => {
    expect(
      resolveWaitlistStep({
        emailVerified: true,
        accountSignals: { canonicalCswAddress: null },
      }),
    ).toBe('wallet')
  })

  it('routes fully linked accounts into done state', () => {
    expect(
      resolveWaitlistStep({
        emailVerified: true,
        accountSignals: { canonicalCswAddress: '0x123' },
      }),
    ).toBe('done')
  })
})
