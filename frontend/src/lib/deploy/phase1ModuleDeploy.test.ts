import { describe, expect, it, vi } from 'vitest'
import { type Address } from 'viem'

import {
  CREATOR_OVAULT_MODULE_STORAGE_V2,
  assertCreatorOvaultModuleStorageCompatible,
} from './ovaultModuleIdentity'
import {
  resolveAlignedPhase1DeployDeps,
  resolveCreate2DeployerForBatcher,
  resolveWiredCreatorOvaultModules,
} from './phase1ModuleDeploy'

const BATCHER = '0xa99058f424FB3ACC639F59355C65C40149030651' as Address
const PHASE1 = '0xcE369BE1D89634E7Ab3d6Dc0f943B2780BF2D889' as Address
const CORE_V2 = '0xfaebF89F739769A348B871289488fc1b99F53140' as Address
const CREATE2_V2 = '0xF6538d7D18AfFe5057C6f109DBEd33c851A70c7E' as Address
const LEGACY_CREATE2 = '0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7' as Address
const LEGACY_CORE = '0x9f8C2c5700A25b76759f3115B96A68f4d079CDbB' as Address
const STRATEGIES_V2 = '0xbd2E73f420FD4665013586c0128f0dEC1438F007' as Address
const ADMIN_V2 = '0x3AA2e85589EEb57cBB5BbA240E5404A51eC824a7' as Address

describe('phase1ModuleDeploy', () => {
  it('prefers phase1 module create2Deployer over batcher shell immutables', async () => {
    const publicClient = {
      readContract: vi.fn(async (args: { address: Address; functionName: string }) => {
        if (args.functionName === 'phase1Module') return PHASE1
        if (args.address === PHASE1 && args.functionName === 'create2Deployer') return CREATE2_V2
        if (args.address === BATCHER && args.functionName === 'create2Deployer') return LEGACY_CREATE2
        throw new Error(`unexpected read ${args.functionName}@${args.address}`)
      }),
    }

    const resolved = await resolveCreate2DeployerForBatcher({
      publicClient,
      batcherAddress: BATCHER,
    })
    expect(resolved).toBe(CREATE2_V2)
  })

  it('resolves wired vault modules from phase1 module', async () => {
    const publicClient = {
      readContract: vi.fn(async (args: { address: Address; functionName: string }) => {
        if (args.functionName === 'phase1Module') return PHASE1
        if (args.address === PHASE1) {
          if (args.functionName === 'vaultCoreModule') return CORE_V2
          if (args.functionName === 'vaultStrategiesModule') return STRATEGIES_V2
          if (args.functionName === 'vaultAdminModule') return ADMIN_V2
        }
        if (args.address === BATCHER && args.functionName === 'vaultCoreModule') return LEGACY_CORE
        throw new Error(`unexpected read ${args.functionName}@${args.address}`)
      }),
    }

    const wired = await resolveWiredCreatorOvaultModules({
      publicClient,
      batcherAddress: BATCHER,
    })
    expect(wired?.core).toBe(CORE_V2)
  })

  it('flags misaligned phase1 create2 deployer store pairing', async () => {
    const publicClient = {
      readContract: vi.fn(async (args: { address: Address; functionName: string }) => {
        if (args.functionName === 'phase1Module') return PHASE1
        if (args.address === PHASE1 && args.functionName === 'create2Deployer') return CREATE2_V2
        if (args.address === PHASE1 && args.functionName === 'bytecodeStore') {
          return '0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4'
        }
        if (args.address === CREATE2_V2 && args.functionName === 'store') {
          return '0x9C3e2A7bd73690d5b5DC0C47f8dB74c4dc5D1c69'
        }
        if (args.address === BATCHER && args.functionName === 'create2Deployer') return LEGACY_CREATE2
        if (args.address === LEGACY_CREATE2 && args.functionName === 'store') {
          return '0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4'
        }
        throw new Error(`unexpected read ${args.functionName}@${args.address}`)
      }),
    }

    const aligned = await resolveAlignedPhase1DeployDeps({
      publicClient,
      batcherAddress: BATCHER,
    })
    expect(aligned.ok).toBe(false)
    if (!aligned.ok) {
      expect(aligned.message).toMatch(/Phase1Module create2 deployer is not paired/)
      expect(aligned.message).toMatch(/setPhase1Module/)
    }
  })
})

describe('ovaultModuleIdentity batcher wiring', () => {
  it('reads core module fingerprint from phase1 module when batcherAddress is provided', async () => {
    const publicClient = {
      readContract: vi.fn(async (args: { address: Address; functionName: string }) => {
        if (args.functionName === 'phase1Module') return PHASE1
        if (args.address === PHASE1 && args.functionName === 'vaultCoreModule') return CORE_V2
        if (args.functionName === 'moduleStorageVersion') return CREATOR_OVAULT_MODULE_STORAGE_V2
        throw new Error(`unexpected read ${args.functionName}@${args.address}`)
      }),
    }

    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient,
      batcherAddress: BATCHER,
    })
    expect(result.ok).toBe(true)
  })
})
