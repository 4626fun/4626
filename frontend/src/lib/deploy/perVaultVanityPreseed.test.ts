import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  lookupPreseededShareOftSalt,
  lookupPreseededVanityVersionPlan,
  normalizePreseedBaseVersion,
  type PerVaultVanityPreseedManifest,
} from './perVaultVanityPreseed'

const CREATE2_DEPLOYER = getAddress('0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7')
const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const OWNER = getAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')
const BATCHER = getAddress('0xa99058f424FB3ACC639F59355C65C40149030651')

const testManifest: PerVaultVanityPreseedManifest = {
  schema: 1,
  chainId: 8453,
  plans: [
    {
      id: 'akita-v1.14.0-default',
      create2Deployer: CREATE2_DEPLOYER,
      creatorToken: CREATOR,
      owner: OWNER,
      batcher: BATCHER,
      baseVersion: 'v1.14.0',
      vaultName: 'AKITA Vault',
      vaultSymbol: 'vAKITA',
      shareName: 'AKITA Share',
      shareSymbol: 'AKITA',
      vaultPrefix: '4626',
      shareSuffix: '4626',
      batcherMode: 'salt',
      deploymentVersion: 'v1.14.0-vqvt',
      versionSearchOutcome: 'combined_match',
      shareOftSalt: '0xf03a6e8e57a0a03eeb597e4f217833623dddf4634d115dcba9e865f2a2c7eb4f',
    },
  ],
}

const baseLookupParams = {
  create2Deployer: CREATE2_DEPLOYER,
  creatorToken: CREATOR,
  owner: OWNER,
  batcherAddress: BATCHER,
  chainId: 8453,
  vaultName: 'AKITA Vault',
  vaultSymbol: 'vAKITA',
  shareName: 'AKITA Share',
  shareSymbol: 'AKITA',
  baseVersion: 'v1.14.0',
  vaultPrefix: '4626',
  shareSuffix: '4626',
  supportsPhase1WithSalt: true,
}

describe('normalizePreseedBaseVersion', () => {
  it('strips dry-run and vanity suffixes', () => {
    expect(normalizePreseedBaseVersion('v1.14.0-dryrun')).toBe('v1.14.0')
    expect(normalizePreseedBaseVersion('v1.14.0-vqvt')).toBe('v1.14.0')
    expect(normalizePreseedBaseVersion('v1.14.0-dryrun-vwgs')).toBe('v1.14.0')
  })

  it('returns the input when no semver prefix is present', () => {
    expect(normalizePreseedBaseVersion('custom-release')).toBe('custom-release')
  })
})

describe('perVaultVanityPreseed', () => {
  it('returns a grounded version plan when identity fields match', () => {
    expect(lookupPreseededVanityVersionPlan(baseLookupParams, testManifest)).toEqual({
      deploymentVersion: 'v1.14.0-vqvt',
      outcome: 'combined_match',
      planId: 'akita-v1.14.0-default',
    })
  })

  it('matches preseed plans when baseVersion carries dry-run suffix', () => {
    expect(
      lookupPreseededVanityVersionPlan(
        { ...baseLookupParams, baseVersion: 'v1.14.0-dryrun' },
        testManifest,
      ),
    ).toEqual({
      deploymentVersion: 'v1.14.0-vqvt',
      outcome: 'combined_match',
      planId: 'akita-v1.14.0-default',
    })
  })

  it('ignores plans when batcher mode does not match', () => {
    expect(
      lookupPreseededVanityVersionPlan(
        { ...baseLookupParams, supportsPhase1WithSalt: false },
        testManifest,
      ),
    ).toBeNull()
  })

  it('returns a grounded share oft salt for salt-enabled batchers', () => {
    expect(
      lookupPreseededShareOftSalt(
        {
          create2Deployer: CREATE2_DEPLOYER,
          creatorToken: CREATOR,
          owner: OWNER,
          batcherAddress: BATCHER,
          chainId: 8453,
          vaultName: 'AKITA Vault',
          vaultSymbol: 'vAKITA',
          shareName: 'AKITA Share',
          shareSymbol: 'AKITA',
          baseVersion: 'v1.14.0-dryrun',
          shareOftVanitySuffix: '4626',
          deploymentVersion: 'v1.14.0-vqvt',
          supportsPhase1WithSalt: true,
        },
        testManifest,
      ),
    ).toBe('0xf03a6e8e57a0a03eeb597e4f217833623dddf4634d115dcba9e865f2a2c7eb4f')
  })
})