import { describe, expect, it } from 'vitest'

import { resolveDoneStepDeployAccessState } from './_waitlistDeployAccess'

describe('resolveDoneStepDeployAccessState', () => {
  it('returns ready when isBypassAdmin is true (no wallet needed)', () => {
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: true, verifiedWallet: null })).toEqual({
      state: 'ready',
      addressToCheck: null,
    })
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: true, verifiedWallet: undefined })).toEqual({
      state: 'ready',
      addressToCheck: null,
    })
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: true, verifiedWallet: '0x1234567890123456789012345678901234567890' })).toEqual({
      state: 'ready',
      addressToCheck: null,
    })
  })

  it('returns waitlist when verifiedWallet is missing or invalid', () => {
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: false, verifiedWallet: null })).toEqual({
      state: 'waitlist',
      addressToCheck: null,
    })
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: false, verifiedWallet: undefined })).toEqual({
      state: 'waitlist',
      addressToCheck: null,
    })
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: false, verifiedWallet: '' })).toEqual({
      state: 'waitlist',
      addressToCheck: null,
    })
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: false, verifiedWallet: '0x123' })).toEqual({
      state: 'waitlist',
      addressToCheck: null,
    })
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: false, verifiedWallet: 'not-an-address' })).toEqual({
      state: 'waitlist',
      addressToCheck: null,
    })
  })

  it('returns checking with lowercased address when verifiedWallet is valid', () => {
    const result = resolveDoneStepDeployAccessState({
      isBypassAdmin: false,
      verifiedWallet: '0x1234567890123456789012345678901234567890',
    })
    expect(result.state).toBe('checking')
    expect(result.addressToCheck).toBe('0x1234567890123456789012345678901234567890')
  })

  it('returns checking with lowercased address when verifiedWallet is mixed case (EIP-55 checksummed)', () => {
    const result = resolveDoneStepDeployAccessState({
      isBypassAdmin: false,
      verifiedWallet: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    })
    expect(result.state).toBe('checking')
    expect(result.addressToCheck).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })
})
