import { describe, expect, it } from 'vitest'

import { getAddress } from 'viem'

import {
  buildDeployVanityLoadingMessage,
  buildSaltDisabledShareSuffixInfoNotice,
  buildShareOftVanityUserWarning,
  deriveShareOftVanityStartAt,
  needsCombinedSaltDisabledVanitySearch,
  resolveDeploymentVersionSearchMaxTries,
  resolveDeploymentVersionSearchTargets,
  shouldParallelizeShareSaltWithVersionSearch,
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

  it('derives deterministic share oft vanity start values', () => {
    const creatorToken = getAddress('0x1111111111111111111111111111111111111111')
    const owner = getAddress('0x2222222222222222222222222222222222222222')
    const first = deriveShareOftVanityStartAt({ creatorToken, owner, deploymentVersion: 'v1.13.0' })
    const second = deriveShareOftVanityStartAt({ creatorToken, owner, deploymentVersion: 'v1.13.0' })
    const bumped = deriveShareOftVanityStartAt({ creatorToken, owner, deploymentVersion: 'v1.13.0-v1' })
    expect(first).toBe(second)
    expect(bumped).not.toBe(first)
  })

  it('builds grinding vanity loading copy with target hints', () => {
    expect(
      buildDeployVanityLoadingMessage({
        vaultVanityPrefix: '4626',
        shareOftVanitySuffix: '4626',
      }),
    ).toBe('Grinding vanity addresses (vault prefix 0x4626, share suffix 4626)…')
    expect(buildDeployVanityLoadingMessage({ vaultVanityPrefix: null, shareOftVanitySuffix: null })).toBe(
      'Grinding vanity addresses…',
    )
  })

  it('allows parallel share salt search only on salt-enabled batchers', () => {
    expect(
      shouldParallelizeShareSaltWithVersionSearch({
        supportsPhase1WithSalt: true,
        hasVaultPrefixTarget: true,
        hasShareSuffixTarget: true,
        shareOftVanityUnsupportedByBatcher: false,
        hasManualShareOftSaltOverride: false,
      }),
    ).toBe(true)
    expect(
      shouldParallelizeShareSaltWithVersionSearch({
        supportsPhase1WithSalt: false,
        hasVaultPrefixTarget: true,
        hasShareSuffixTarget: true,
        shareOftVanityUnsupportedByBatcher: true,
        hasManualShareOftSaltOverride: false,
      }),
    ).toBe(false)
  })
})
