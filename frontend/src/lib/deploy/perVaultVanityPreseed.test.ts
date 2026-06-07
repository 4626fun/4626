import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  lookupPreseededShareOftSalt,
  lookupPreseededVanityVersionPlan,
  type PerVaultVanityPreseedManifest,
} from './perVaultVanityPreseed'

const CREATE2_DEPLOYER = getAddress('0x1c1596090b0e0bb35b2f7cd77e865fbee3654626')
const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const OWNER = getAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')
const BATCHER = getAddress('0xa99058f424FB3ACC639F59355C65C40149030651')

const testManifest: PerVaultVanityPreseedManifest = {
  schema: 1,
  chainId: 8453,
  plans: [
    {
      id: 'akita-v1.13.0-default',
      create2Deployer: CREATE2_DEPLOYER,
      creatorToken: CREATOR,
      owner: OWNER,
      batcher: BATCHER,
      baseVersion: 'v1.13.0',
      vaultName: 'AKITA Vault',
      vaultSymbol: 'vAKITA',
      shareName: 'AKITA Share',
      shareSymbol: 'AKITA',
      vaultPrefix: '4626',
      shareSuffix: '4626',
      batcherMode: 'salt',
      deploymentVersion: 'v1.13.0-vabc',
      versionSearchOutcome: 'combined_match',
      shareOftSalt: '0x1111111111111111111111111111111111111111111111111111111111111111',
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
  baseVersion: 'v1.13.0',
  vaultPrefix: '4626',
  shareSuffix: '4626',
  supportsPhase1WithSalt: true,
}

describe('perVaultVanityPreseed', () => {
  it('returns a grounded version plan when identity fields match', () => {
    expect(lookupPreseededVanityVersionPlan(baseLookupParams, testManifest)).toEqual({
      deploymentVersion: 'v1.13.0-vabc',
      outcome: 'combined_match',
      planId: 'akita-v1.13.0-default',
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
          baseVersion: 'v1.13.0',
          shareOftVanitySuffix: '4626',
          deploymentVersion: 'v1.13.0-vabc',
          supportsPhase1WithSalt: true,
        },
        testManifest,
      ),
    ).toBe('0x1111111111111111111111111111111111111111111111111111111111111111')
  })
})