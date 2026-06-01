import { describe, expect, it } from 'vitest'

import {
  buildShareOftVanityUserWarning,
  resolveDeploymentVersionSearchMaxTries,
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

  it('suppresses warning when combined vanity match succeeds on salt-disabled batcher', () => {
    expect(
      buildShareOftVanityUserWarning({
        shareOftVanitySuffix: '4626',
        vaultVanityPrefix: '4626',
        saltOverrideDisabled: true,
        versionSearchOutcome: 'combined_match',
      }),
    ).toBeNull()
  })

  it('explains share-only match without the old not-guaranteed copy', () => {
    const warning = buildShareOftVanityUserWarning({
      shareOftVanitySuffix: '4626',
      vaultVanityPrefix: '4626',
      saltOverrideDisabled: true,
      versionSearchOutcome: 'share_only_match',
    })
    expect(warning).toContain('Share suffix 4626 matched via deployment-version search')
    expect(warning).not.toContain('not guaranteed')
    expect(warning).not.toContain('Prioritizing share suffix')
  })
})
