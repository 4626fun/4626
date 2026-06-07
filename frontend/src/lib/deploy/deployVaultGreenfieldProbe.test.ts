import { getAddress, type Address, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import {
  deriveDeployBaseSalt,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from '@/lib/deploy/perVaultVanityVersionSearch'

import { probeGreenfieldPhase1Deploy } from './deployVaultGreenfieldProbe'

const DEPLOYER = getAddress('0x3333333333333333333333333333333333333333')
const BATCHER = getAddress('0x4444444444444444444444444444444444444444')
const CREATOR = getAddress('0x1111111111111111111111111111111111111111')
const OWNER = getAddress('0x2222222222222222222222222222222222222222')

describe('deployVaultGreenfieldProbe', () => {
  it('returns true when predicted phase1 addresses have no bytecode', async () => {
    const vaultInitCode = '0x1234' as Hex
    const shareOftInitCode = '0x5678' as Hex
    const wrapperBytecode = '0x9abc' as Hex
    const requested = new Set<Address>()

    const greenfield = await probeGreenfieldPhase1Deploy({
      publicClient: {
        getBytecode: async ({ address }) => {
          requested.add(address)
          return '0x'
        },
      },
      create2Deployer: DEPLOYER,
      batcherAddress: BATCHER,
      creatorToken: CREATOR,
      owner: OWNER,
      chainId: 8453,
      deploymentVersion: 'v1.13.0',
      vaultInitCode,
      shareOftInitCode,
      shareSymbol: 'aki',
      wrapperBytecode,
    })

    expect(greenfield).toBe(true)
    expect(requested.size).toBe(3)

    const baseSalt = deriveDeployBaseSalt({
      creatorToken: CREATOR,
      owner: OWNER,
      chainId: 8453,
      version: 'v1.13.0',
    })
    const vaultAddress = predictCreate2AddressFromInitCode({
      create2Deployer: DEPLOYER,
      salt: saltForDeployLabel(baseSalt, 'vault'),
      initCode: vaultInitCode,
    })
    expect(requested.has(vaultAddress)).toBe(true)
  })

  it('returns false when any predicted phase1 address is already deployed', async () => {
    const vaultInitCode = '0x1234' as Hex
    const shareOftInitCode = '0x5678' as Hex
    const wrapperBytecode = '0x9abc' as Hex
    const baseSalt = deriveDeployBaseSalt({
      creatorToken: CREATOR,
      owner: OWNER,
      chainId: 8453,
      version: 'v1.13.0',
    })
    const vaultAddress = predictCreate2AddressFromInitCode({
      create2Deployer: DEPLOYER,
      salt: saltForDeployLabel(baseSalt, 'vault'),
      initCode: vaultInitCode,
    })

    const greenfield = await probeGreenfieldPhase1Deploy({
      publicClient: {
        getBytecode: async ({ address }) => (address === vaultAddress ? '0x6000' : '0x'),
      },
      create2Deployer: DEPLOYER,
      batcherAddress: BATCHER,
      creatorToken: CREATOR,
      owner: OWNER,
      chainId: 8453,
      deploymentVersion: 'v1.13.0',
      vaultInitCode,
      shareOftInitCode,
      shareSymbol: 'aki',
      wrapperBytecode,
    })

    expect(greenfield).toBe(false)
  })
})