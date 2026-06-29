import { encodePacked, getAddress, isAddress, keccak256, type Address, type Hex } from 'viem'

// NOTE: this module is in the api→src allowlist (server-shared). Imports must be
// Node-ESM-safe: relative with explicit .js extension, never `@/` aliases.
import {
  CREATOR_OVAULT_ADMIN_MODULE,
  CREATOR_OVAULT_CORE_MODULE,
  CREATOR_OVAULT_STRATEGIES_MODULE,
} from '../../config/contracts.defaults.js'
import { resolveWiredCreatorOvaultModules } from './phase1ModuleDeploy.js'

/** Live batcher + store deploy fingerprint (CreatorOVaultModuleStorage.v2). */
export const CREATOR_OVAULT_MODULE_STORAGE_V2 = keccak256(
  encodePacked(['string'], ['CreatorOVaultModuleStorage.v2']),
) as Hex

/** Impairment-side-pocket module stack (not yet paired with v1.13.0 deploy bytecode). */
export const CREATOR_OVAULT_MODULE_STORAGE_V3 = keccak256(
  encodePacked(['string'], ['CreatorOVaultModuleStorage.v3']),
) as Hex

/** Pre-v1.12.1 modules still on-chain for grandfathered vaults only. */
export const CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT = keccak256(
  encodePacked(['string'], ['CreatorOVaultModuleStorage.current']),
) as Hex

/** Must match live mainnet CreatorOVault module deployments wired on the split Phase-1 batcher. */
export const CREATOR_OVAULT_MODULE_STORAGE_CURRENT = CREATOR_OVAULT_MODULE_STORAGE_V3

/** Fingerprint embedded in frontend deploy bytecode (CreatorOVault creation code). */
export const DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION = CREATOR_OVAULT_MODULE_STORAGE_V3

const MODULE_IDENTITY_ABI = [
  {
    type: 'function',
    name: 'moduleStorageVersion',
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const

export type OVaultModuleStoragePreflight = {
  ok: true
} | {
  ok: false
  message: string
  vaultExpects: Hex
  moduleAddress: Address
  moduleReports: Hex
}

type ModuleReadClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

export async function assertCreatorOvaultModuleStorageCompatible(params: {
  publicClient: ModuleReadClient
  batcherAddress?: Address
  moduleAddress?: Address
  vaultExpects?: Hex
}): Promise<OVaultModuleStoragePreflight> {
  let moduleAddress = params.moduleAddress
  if (!moduleAddress && params.batcherAddress && isAddress(params.batcherAddress)) {
    const wired = await resolveWiredCreatorOvaultModules({
      publicClient: params.publicClient,
      batcherAddress: getAddress(params.batcherAddress),
    })
    moduleAddress = wired?.core
  }
  moduleAddress = getAddress(moduleAddress ?? CREATOR_OVAULT_CORE_MODULE)
  const vaultExpects = params.vaultExpects ?? DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION

  if (!isAddress(moduleAddress)) {
    return {
      ok: false,
      message: 'CreatorOVault core module address is invalid.',
      vaultExpects,
      moduleAddress,
      moduleReports: '0x' as Hex,
    }
  }

  let moduleReports: Hex
  try {
    moduleReports = (await params.publicClient.readContract({
      address: moduleAddress,
      abi: MODULE_IDENTITY_ABI,
      functionName: 'moduleStorageVersion',
    })) as Hex
  } catch {
    return {
      ok: false,
      message:
        `CreatorOVault core module ${moduleAddress} does not expose moduleStorageVersion(). ` +
        'Rotate to a module-compatible deployment batcher.',
      vaultExpects,
      moduleAddress,
      moduleReports: '0x' as Hex,
    }
  }

  if (moduleReports.toLowerCase() !== vaultExpects.toLowerCase()) {
    const expectsV3 = vaultExpects.toLowerCase() === CREATOR_OVAULT_MODULE_STORAGE_V3.toLowerCase()
    const moduleIsLegacyCurrent =
      moduleReports.toLowerCase() === CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT.toLowerCase()
    const moduleIsV2 =
      moduleReports.toLowerCase() === CREATOR_OVAULT_MODULE_STORAGE_V2.toLowerCase()
    const hint =
      expectsV3 && moduleIsV2
        ? ' Deploy bytecode expects CreatorOVaultModuleStorage.v3 (v1.14.0) but the live batcher Phase1Module still wires v2 modules. ' +
          'Protocol ops must call setPhase1Module with the v1.14.0 v3 Phase1Module before greenfield deploy. ' +
          'Hard-refresh the app so CREATE2 prediction reads Phase1Module immutables (not batcher-shell getters).'
        : expectsV3 && moduleIsLegacyCurrent
          ? ' Deploy bytecode expects CreatorOVaultModuleStorage.v3 but the live batcher still wires .current modules. ' +
            'Deploy fresh v3 modules and rotate the batcher, or re-seed deploy bytecode to match live wiring.'
          : ' Re-seed deploy bytecode or rotate batcher/module wiring so vault and modules share one moduleStorageVersion fingerprint.'
    return {
      ok: false,
      message:
        `CreatorOVault module storage mismatch (InvalidModuleAddress risk): vault deploy expects ${vaultExpects}, ` +
        `but batcher core module ${moduleAddress} reports ${moduleReports}.${hint}`,
      vaultExpects,
      moduleAddress,
      moduleReports,
    }
  }

  return { ok: true }
}

export const DEFAULT_BATCHER_OVAULT_MODULES = {
  core: CREATOR_OVAULT_CORE_MODULE,
  strategies: CREATOR_OVAULT_STRATEGIES_MODULE,
  admin: CREATOR_OVAULT_ADMIN_MODULE,
} as const
