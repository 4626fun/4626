import { getAbiItem, getAddress, toFunctionSelector, type Address, type Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { DEPLOYMENT_BATCHER_ABI } from '../../pages/deploy/deployVaultAbis'
import { CURRENT_DEPLOYMENT_BATCHER_SELECTORS } from './deploymentBatcherSelectors'
import { CREATOR_OVAULT_MODULE_STORAGE_V5 } from './ovaultModuleIdentity'
import {
  parseCreatorVaultBatcherCapabilities,
  readCreatorVaultBatcherInfra,
} from './deploymentBatcherInfra'

describe('deploymentBatcherInfra', () => {
  it.each([
    ['deployPhase1', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1],
    ['deployPhase1WithSalt', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1WithSalt],
    ['deployPhase1Core', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1Core],
    ['deployPhase1CoreWithSalt', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt],
    ['finalizePhase1', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1],
    ['finalizePhase1WithSalt', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt],
    ['finalizePhase2WithPermit2', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase2WithPermit2],
  ] as const)('%s selector matches the current deploy ABI', (functionName, expectedSelector) => {
    const abiItem = getAbiItem({ abi: DEPLOYMENT_BATCHER_ABI, name: functionName })
    expect(toFunctionSelector(abiItem)).toBe(expectedSelector)
  })

  it('detects salt-enabled selectors on a genuine no-module batcher', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${[
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
      ].join('')}`,
      phase1ModuleConfigured: false,
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(true)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(false)
  })

  it('marks salt overrides disabled when bytecode exposes the guard error selector', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${[
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
        'e7fdf838',
      ].join('')}`,
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(false)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(true)
  })

  it('reads restrictive salt semantics from the delegatecall Phase-1 module', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${[
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
      ].join('')}`,
      phase1ModuleBytecode: toFunctionSelector('InvalidShareOftSaltOverride()'),
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(false)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(true)
  })

  it('fails closed when the configured Phase-1 module bytecode cannot be read', async () => {
    const batcher = getAddress('0x1111111111111111111111111111111111111111')
    const phase1 = getAddress('0x2222222222222222222222222222222222222222')
    const deployer = getAddress('0x3333333333333333333333333333333333333333')
    const store = getAddress('0x4444444444444444444444444444444444444444')
    const core = getAddress('0x5555555555555555555555555555555555555555')
    const strategies = getAddress('0x6666666666666666666666666666666666666666')
    const admin = getAddress('0x7777777777777777777777777777777777777777')
    const shellBytecode = `0x${[
      CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
      CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
    ].join('')}` as Hex
    const readContract = vi.fn(async (args: { address: Address; functionName: string }) => {
      if (args.functionName === 'phase1Module') return phase1
      if (args.address === phase1 && args.functionName === 'create2Deployer') return deployer
      if (args.address === phase1 && args.functionName === 'bytecodeStore') return store
      if (args.address === phase1 && args.functionName === 'vaultCoreModule') return core
      if (args.address === phase1 && args.functionName === 'vaultStrategiesModule') return strategies
      if (args.address === phase1 && args.functionName === 'vaultAdminModule') return admin
      if (args.address === deployer && args.functionName === 'store') return store
      if (args.address === core && args.functionName === 'moduleStorageVersion') {
        return CREATOR_OVAULT_MODULE_STORAGE_V5
      }
      throw new Error(`unexpected read ${args.functionName}@${args.address}`)
    })
    const publicClient = {
      readContract,
      getBytecode: vi.fn(async ({ address }: { address: Address }) => {
        if (address === batcher) {
          return shellBytecode
        }
        if (address === phase1) {
          throw new Error('phase1 getBytecode RPC failure')
        }
        throw new Error(`unexpected bytecode read ${address}`)
      }),
      multicall: vi.fn(async () => [
        { status: 'success', result: getAddress('0x8888888888888888888888888888888888888888') },
        { status: 'success', result: getAddress('0x9999999999999999999999999999999999999999') },
        { status: 'success', result: getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') },
      ]),
    }

    const result = await readCreatorVaultBatcherInfra({
      publicClient,
      batcherAddress: batcher,
      fallbacks: {
        create2Deployer: null,
        bytecodeStore: null,
        protocolTreasury: null,
        registry: null,
        chainlinkEthUsd: null,
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(publicClient.getBytecode).toHaveBeenCalledWith({ address: phase1 })
    expect(result.infra.capabilities.saltOverridesDisabledByBatcher).toBe(true)
    expect(result.infra.capabilities.supportsPhase1WithSalt).toBe(false)
  })

  it('fails closed when repeated phase1Module reads could disagree', async () => {
    const batcher = getAddress('0x1111111111111111111111111111111111111111')
    const phase1 = getAddress('0x2222222222222222222222222222222222222222')
    const shellDeployer = getAddress('0x3333333333333333333333333333333333333333')
    const shellStore = getAddress('0x4444444444444444444444444444444444444444')
    const moduleDeployer = getAddress('0x5555555555555555555555555555555555555555')
    const moduleStore = getAddress('0x6666666666666666666666666666666666666666')
    const core = getAddress('0x7777777777777777777777777777777777777777')
    const strategies = getAddress('0x8888888888888888888888888888888888888888')
    const admin = getAddress('0x9999999999999999999999999999999999999999')
    const shellBytecode = `0x${[
      toFunctionSelector('phase1Module()').slice(2),
      CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
      CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
    ].join('')}` as Hex
    let phase1ModuleReads = 0
    const readContract = vi.fn(async (args: { address: Address; functionName: string }) => {
      if (args.functionName === 'phase1Module') {
        phase1ModuleReads += 1
        if (phase1ModuleReads === 1 || phase1ModuleReads === 3) {
          throw new Error('transient RPC failure')
        }
        return phase1
      }
      if (args.address === batcher && args.functionName === 'create2Deployer') return shellDeployer
      if (args.address === batcher && args.functionName === 'bytecodeStore') return shellStore
      if (args.address === phase1 && args.functionName === 'create2Deployer') return moduleDeployer
      if (args.address === phase1 && args.functionName === 'bytecodeStore') return moduleStore
      if (args.address === phase1 && args.functionName === 'vaultCoreModule') return core
      if (args.address === phase1 && args.functionName === 'vaultStrategiesModule') return strategies
      if (args.address === phase1 && args.functionName === 'vaultAdminModule') return admin
      if (args.address === shellDeployer && args.functionName === 'store') return shellStore
      if (args.address === core && args.functionName === 'moduleStorageVersion') {
        return CREATOR_OVAULT_MODULE_STORAGE_V5
      }
      throw new Error(`unexpected read ${args.functionName}@${args.address}`)
    })
    const publicClient = {
      readContract,
      getBytecode: vi.fn(async ({ address }: { address: Address }) => {
        if (address === batcher) {
          return shellBytecode
        }
        if (address === phase1) {
          return '0x6000' as Hex
        }
        throw new Error(`unexpected bytecode read ${address}`)
      }),
      multicall: vi.fn(async () => [
        { status: 'success', result: getAddress('0x8888888888888888888888888888888888888888') },
        { status: 'success', result: getAddress('0x9999999999999999999999999999999999999999') },
        { status: 'success', result: getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') },
      ]),
    }

    const result = await readCreatorVaultBatcherInfra({
      publicClient,
      batcherAddress: batcher,
      fallbacks: {
        create2Deployer: null,
        bytecodeStore: null,
        protocolTreasury: null,
        registry: null,
        chainlinkEthUsd: null,
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/phase1Module/i)
    }
    expect(phase1ModuleReads).toBe(1)
  })
})
