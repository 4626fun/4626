import { describe, expect, it } from 'vitest'

import { classifyDeployPopulation, evaluateDeployEligibility } from './deployEligibility'

const CSW = '0x00000000000000000000000000000000000000aa'

describe('classifyDeployPopulation', () => {
  it('returns email-only when canonical CSW is missing', () => {
    expect(
      classifyDeployPopulation({
        canonicalCswAddress: null,
        canonicalIdentityType: 'eoa',
      }),
    ).toBe('email-only')
  })

  it('returns zora-eoa-owner when Zora linked and EOA owners exist', () => {
    expect(
      classifyDeployPopulation({
        canonicalCswAddress: CSW,
        canonicalIdentityType: 'contract',
        zoraLinked: true,
        onchainEoaOwnerCount: 1,
      }),
    ).toBe('zora-eoa-owner')
  })

  it('returns base-app-passkey for base-app-linked accounts', () => {
    expect(
      classifyDeployPopulation({
        canonicalCswAddress: CSW,
        canonicalIdentityType: 'contract',
        executionTrack: 'none-yet',
        baseAppLinked: true,
      }),
    ).toBe('base-app-passkey')
  })

  it('prefers zora-eoa-owner when embedded EOA owns parent CSW despite none-yet track', () => {
    expect(
      classifyDeployPopulation({
        canonicalCswAddress: CSW,
        canonicalIdentityType: 'contract',
        executionTrack: 'none-yet',
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
      }),
    ).toBe('zora-eoa-owner')
  })
})

describe('evaluateDeployEligibility', () => {
  it('blocks base-app-passkey deploy with honest copy', () => {
    const result = evaluateDeployEligibility({
      canonicalCswAddress: CSW,
      canonicalIdentityType: 'contract',
      executionTrack: 'none-yet',
      baseAppLinked: true,
    })
    expect(result.code).toBe('base-app-deploy-blocked')
    expect(result.canProceedWithDeploySession).toBe(false)
    expect(result.showOwnerApprovalPanel).toBe(false)
    expect(result.blockerMessage).toContain('not supported in the browser')
  })

  it('allows zora-eoa-owner when legacy owner install is ready', () => {
    const result = evaluateDeployEligibility({
      canonicalCswAddress: CSW,
      canonicalIdentityType: 'contract',
      zoraLinked: true,
      onchainEoaOwnerCount: 1,
      executionTrack: 'legacy-owner-install',
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
    })
    expect(result.code).toBe('ready')
    expect(result.canProceedWithDeploySession).toBe(true)
    expect(result.showOwnerApprovalPanel).toBe(true)
  })

  it('blocks zora-passkey-only wallets', () => {
    const result = evaluateDeployEligibility({
      canonicalCswAddress: CSW,
      canonicalIdentityType: 'contract',
      zoraLinked: true,
      onchainEoaOwnerCount: 0,
    })
    expect(result.code).toBe('zora-passkey-deploy-blocked')
    expect(result.canProceedWithDeploySession).toBe(false)
  })
})
