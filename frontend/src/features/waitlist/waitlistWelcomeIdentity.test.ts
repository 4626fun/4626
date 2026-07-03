import { describe, expect, it } from 'vitest'

import {
  formatWaitlistShortAddress,
  isWaitlistAddressLabel,
  resolveWaitlistWelcomeCopy,
} from './waitlistWelcomeIdentity'

describe('waitlistWelcomeIdentity', () => {
  it('formats short addresses for welcome fallback labels', () => {
    expect(formatWaitlistShortAddress('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD')).toBe('0xB05C…0FdD')
  })

  it('prefers zora handle over basename and address', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        zoraHandle: 'akita',
        identityDisplayName: 'akita.base.eth',
        identitySource: 'basename',
        sessionAddress: '0xabc1230000000000000000000000000000000000',
      }),
    ).toEqual({ prefix: 'Welcome back', label: '@akita' })
  })

  it('uses basename or ens before the wallet address', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        identityDisplayName: 'akita.base.eth',
        identitySource: 'basename',
        linkedEoaAddress: '0xabc1230000000000000000000000000000000000',
      }),
    ).toEqual({ prefix: 'Welcome back', label: 'akita' })
  })

  it('shows full ens names', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        identityDisplayName: 'vitalik.eth',
        identitySource: 'ens',
        linkedEoaAddress: '0xabc1230000000000000000000000000000000000',
      }),
    ).toEqual({ prefix: 'Welcome back', label: 'vitalik.eth' })
  })

  it('falls back to the external wallet address when no public identity exists', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        linkedEoaAddress: '0xabc1230000000000000000000000000000000000',
      }),
    ).toEqual({ prefix: 'Welcome', label: '0xabc1…0000' })
  })

  it('uses welcome back for returning wallet sign-in even with address-only identity', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        linkedEoaAddress: '0xabc1230000000000000000000000000000000000',
        returningViaWallet: true,
      }),
    ).toEqual({ prefix: 'Welcome back', label: '0xabc1…0000' })
  })

  it('detects address labels', () => {
    expect(isWaitlistAddressLabel('0xabc1…0000')).toBe(true)
    expect(isWaitlistAddressLabel('@akita')).toBe(false)
  })
})
