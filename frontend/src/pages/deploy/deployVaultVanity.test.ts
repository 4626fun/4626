import { describe, expect, it } from 'vitest'

import {
  buildSaltDisabledShareSuffixInfoNotice,
  buildShareOftVanityUserWarning,
  needsCombinedSaltDisabledVanitySearch,
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

  it('searches both vault prefix and share suffix on salt-disabled batchers', () => {
    expect(
      resolveDeploymentVersionSearchTargets({
        vaultVanityPrefix: '4626',
        shareOftVanitySuffix: '4626',
        supportsPhase1WithSalt: false,
      }),
    ).toEqual({ vaultPrefix: '4626', shareSuffix: '4626' })
  })

  it('flags combined salt-disabled vanity search', () => {
    expect(
      needsCombinedSaltDisabledVanitySearch({
        supportsPhase1WithSalt: false,
        vaultPrefix: '4626',
        shareSuffix: '4626',
      }),
    ).toBe(true)
    expect(
      needsCombinedSaltDisabledVanitySearch({
        supportsPhase1WithSalt: true,
        vaultPrefix: '4626',
        shareSuffix: '4626',
      }),
    ).toBe(false)
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

  it('suppresses warning when combined vanity matches on salt-disabled batcher', () => {
    expect(
      buildShareOftVanityUserWarning({
        shareOftVanitySuffix: '4626',
        vaultVanityPrefix: '4626',
        saltOverrideDisabled: true,
        versionSearchOutcome: 'combined_match',
      }),
    ).toBeNull()
  })

  it('explains combined miss on salt-disabled batchers', () => {
    expect(
      buildSaltDisabledShareSuffixInfoNotice({
        versionSearchOutcome: 'missed_defaults',
        vaultVanityPrefix: '4626',
        shareOftVanitySuffix: '4626',
        saltOverrideDisabled: true,
        deploymentVersionUsed: 'v1.13.0-dryrun-vwgs',
      }),
    ).toContain('Could not find a deployment version matching vault prefix 0x4626 and share suffix 4626')
  })

  it('reports combined miss copy on salt-disabled batchers', () => {
    expect(
      buildShareOftVanityUserWarning({
        shareOftVanitySuffix: '4626',
        vaultVanityPrefix: '4626',
        saltOverrideDisabled: true,
        versionSearchOutcome: 'missed_defaults',
      }),
    ).toContain('Default vanity targets (0x4626 / 4626)')
  })
})
