import { describe, expect, it } from 'vitest'

import {
  buildWaitlistExcludedSignerAddresses,
  formatWaitlistShortAddress,
  isWaitlistAddressLabel,
  resolveWaitlistIdentityLookupAddress,
  resolveWaitlistWelcomeCopy,
  sanitizeWaitlistZoraHandle,
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
        walletReturnAddress: '0xabc1230000000000000000000000000000000000',
      }),
    ).toEqual({ prefix: 'Welcome back', label: '@akita' })
  })

  it('rejects address-like zora handles and falls through to basename', () => {
    expect(sanitizeWaitlistZoraHandle('0xceca12345678901234567890123456789085e9')).toBeNull()
    expect(sanitizeWaitlistZoraHandle('0xceca…85e9')).toBeNull()
    expect(sanitizeWaitlistZoraHandle('capestate.base.eth')).toBeNull()
    expect(
      resolveWaitlistWelcomeCopy({
        zoraHandle: '0xceca12345678901234567890123456789085e9',
        identityDisplayName: 'akita.base.eth',
        identitySource: 'basename',
        linkedEoaAddress: '0xabc1230000000000000000000000000000000000',
      }),
    ).toEqual({ prefix: 'Welcome back', label: 'akita' })
  })

  it('prefers basename from accountSignals over polluted zora handle', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        zoraHandle: 'capestate.base.eth',
        basename: 'capestate.base.eth',
        email: 'user@example.com',
      }),
    ).toEqual({ prefix: 'Welcome back', label: 'capestate' })
  })

  it('rejects zora identity when the resolved display name is an address', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        identityDisplayName: '0xceca…85e9',
        identitySource: 'zora',
        linkedEoaAddress: '0xabc1230000000000000000000000000000000000',
      }),
    ).toEqual({ prefix: 'Welcome', label: '0xabc1…0000' })
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

  it('prefers linked external wallet over canonical CSW for address fallback', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        linkedEoaAddress: '0xabc1230000000000000000000000000000000000',
        cswAddress: '0xdef4560000000000000000000000000000000000',
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

  it('sanitizes zora handles and rejects address-shaped values', () => {
    expect(sanitizeWaitlistZoraHandle('akita')).toBe('akita')
    expect(sanitizeWaitlistZoraHandle('@akita')).toBe('akita')
    expect(sanitizeWaitlistZoraHandle('0xceca12345678901234567890123456789085e9')).toBeNull()
    expect(sanitizeWaitlistZoraHandle('0xceca…85e9')).toBeNull()
  })

  it('resolves identity lookup address in profile-seed order', () => {
    expect(
      resolveWaitlistIdentityLookupAddress({
        zoraCrossAppAddress: '0x1111111111111111111111111111111111111111',
        linkedEoaAddress: '0x2222222222222222222222222222222222222222',
        cswAddress: '0x4444444444444444444444444444444444444444',
      }),
    ).toBe('0x1111111111111111111111111111111111111111')

    expect(
      resolveWaitlistIdentityLookupAddress({
        linkedEoaAddress: '0x2222222222222222222222222222222222222222',
        walletReturnAddress: '0x3333333333333333333333333333333333333333',
        returningViaWallet: true,
      }),
    ).toBe('0x2222222222222222222222222222222222222222')
  })

  it('never uses the Privy embedded EOA for welcome fallback', () => {
    const embedded = '0xceca12345678901234567890123456789085e9'
    const excluded = buildWaitlistExcludedSignerAddresses({
      privyEmbeddedEoaAddress: embedded,
    })

    expect(
      resolveWaitlistWelcomeCopy({
        cswAddress: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
        excludedAddresses: excluded,
        email: 'akitav2@proton.me',
      }),
    ).toEqual({ prefix: 'Welcome back', label: 'akitav2' })
  })

  it('does not use session cookie address when not returning via wallet', () => {
    const embedded = '0xceca12345678901234567890123456789085e9'

    expect(
      resolveWaitlistWelcomeCopy({
        walletReturnAddress: embedded,
        cswAddress: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
        email: 'akitav2@proton.me',
        returningViaWallet: false,
      }),
    ).toEqual({ prefix: 'Welcome back', label: 'akitav2' })
  })

  it('uses wallet return address for returning wallet sign-in', () => {
    expect(
      resolveWaitlistWelcomeCopy({
        walletReturnAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
        returningViaWallet: true,
      }),
    ).toEqual({ prefix: 'Welcome back', label: '0xB05C…0FdD' })
  })

  it('skips excluded embedded addresses for identity lookup', () => {
    const embedded = '0xceca12345678901234567890123456789085e9'
    const external = '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
    const excluded = buildWaitlistExcludedSignerAddresses({
      privyEmbeddedEoaAddress: embedded,
    })

    expect(
      resolveWaitlistIdentityLookupAddress({
        walletReturnAddress: embedded,
        linkedEoaAddress: external,
        excludedAddresses: excluded,
      }),
    ).toBe(external)
  })

  it('uses canonical CSW for identity lookup when no zora or external wallet', () => {
    const csw = '0xab6d5c10b03300326cd7fab7267ae192842967b5'

    expect(
      resolveWaitlistIdentityLookupAddress({
        cswAddress: csw,
      }),
    ).toBe(csw)
  })
})
