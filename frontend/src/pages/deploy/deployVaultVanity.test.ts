import { describe, expect, it } from 'vitest'

import {
  buildShareOftVanityUserWarning,
  resolveDeploymentVersionSearchMaxTries,
  resolveDeploymentVersionSearchTargets,
} from './deployVaultHelpers'

describe('deploy vanity version search', () => {
  it('uses full try budget when salt overrides are unavailable', () => {
    expect(
      resolveDeploymentVersionSearchMaxTries({
        hasVaultPrefix: true,
        hasShareSuffix: true,
        supportsPhase1WithSalt: false,
        vaultVanityMaxTries: 250_000,
        shareOftVanityMaxTries: 1_000_000,
      }),
    ).toBe(250_000)
  })

  it('caps combined search when salt overrides can satisfy share suffix', () => {
    expect(
      resolveDeploymentVersionSearchMaxTries({
        hasVaultPrefix: true,
        hasShareSuffix: true,
        supportsPhase1WithSalt: true,
        vaultVanityMaxTries: 250_000,
        shareOftVanityMaxTries: 1_000_000,
      }),
    ).toBe(10_000)
  })

  it('searches share suffix only on salt-disabled batchers', () => {
    expect(
      resolveDeploymentVersionSearchTargets({
        vaultVanityPrefix: '4626',
        shareOftVanitySuffix: '4626',
        supportsPhase1WithSalt: false,
      }),
    ).toEqual({ vaultPrefix: null, shareSuffix: '4626' })
  })

  it('searches vault prefix when salt overrides handle share suffix', () => {
    expect(
      resolveDeploymentVersionSearchTargets({
        vaultVanityPrefix: '4626',
        shareOftVanitySuffix: '4626',
        supportsPhase1WithSalt: true,
      }),
    ).toEqual({ vaultPrefix: '4626', shareSuffix: null })
  })

  it('suppresses warning when share suffix matches on salt-disabled batcher', () => {
    expect(
      buildShareOftVanityUserWarning({
        shareOftVanitySuffix: '4626',
        vaultVanityPrefix: '4626',
        saltOverrideDisabled: true,
        versionSearchOutcome: 'combined_match',
      }),
    ).toBeNull()
  })
})
