import { describe, expect, it } from 'vitest'

import { resolveModePreferredIdentity } from './identityResolver'

describe('resolveModePreferredIdentity', () => {
  const eoa = '0x1111111111111111111111111111111111111111'
  const smart = '0x2222222222222222222222222222222222222222'

  it('prefers account-context smart identity in SMART_WALLET mode', () => {
    const result = resolveModePreferredIdentity({
      connectedAddress: eoa,
      modeOverride: 'SMART_WALLET',
      accountContextSmartAddress: smart,
      waitlistCanonicalAddress: null,
    })

    expect(result).toEqual({
      preferredAddress: smart,
      isSmartWalletIdentity: true,
      source: 'account-context',
    })
  })

  it('falls back to waitlist canonical identity when account-context smart identity is unavailable', () => {
    const result = resolveModePreferredIdentity({
      connectedAddress: eoa,
      modeOverride: 'SMART_WALLET',
      accountContextSmartAddress: null,
      waitlistCanonicalAddress: smart,
    })

    expect(result).toEqual({
      preferredAddress: smart,
      isSmartWalletIdentity: true,
      source: 'waitlist',
    })
  })

  it('keeps connected identity in SMART_WALLET mode when no smart identity source is available', () => {
    const result = resolveModePreferredIdentity({
      connectedAddress: eoa,
      modeOverride: 'SMART_WALLET',
      accountContextSmartAddress: null,
      waitlistCanonicalAddress: null,
    })

    expect(result).toEqual({
      preferredAddress: eoa,
      isSmartWalletIdentity: false,
      source: 'connected',
    })
  })

  it('keeps connected identity in EOA mode even when smart identity sources exist', () => {
    const result = resolveModePreferredIdentity({
      connectedAddress: eoa,
      modeOverride: 'EOA',
      accountContextSmartAddress: smart,
      waitlistCanonicalAddress: smart,
    })

    expect(result).toEqual({
      preferredAddress: eoa,
      isSmartWalletIdentity: false,
      source: 'connected',
    })
  })
})
