import { encodePacked, getAddress, isAddress, keccak256, type Address, type Hex } from 'viem'

import {
  CREATOR_OVAULT_ADMIN_MODULE,
  CREATOR_OVAULT_CORE_MODULE,
  CREATOR_OVAULT_STRATEGIES_MODULE,
} from '@/config/contracts.defaults'

/** Must match live mainnet CreatorOVault module deployments wired on the split Phase-1 batcher. */
export const CREATOR_OVAULT_MODULE_STORAGE_CURRENT = keccak256(
  encodePacked(['string'], ['CreatorOVaultModuleStorage.current']),
) as Hex

/** Greenfield target after fresh v2 modules + batcher cutover — not live on mainnet batcher yet. */
export const CREATOR_OVAULT_MODULE_STORAGE_V2 = keccak256(
  encodePacked(['string'], ['CreatorOVaultModuleStorage.v2']),
) as Hex

/** Fingerprint embedded in frontend deploy bytecode (CreatorOVault creation code). */
export const DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION = CREATOR_OVAULT_MODULE_STORAGE_V2

const MODULE_IDENTITY_ABI = [
  {
    type: 'function',
    name: 'moduleStorageVersion',
    stateMutability: 'view',
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

export async function assertCreatorOvaultModuleStorageCompatible(params: {
  publicClient: {
    readContract: (args: {
      address: Address
      abi: typeof MODULE_IDENTITY_ABI
      functionName: 'moduleStorageVersion'
    }) => Promise<unknown>
  }
  moduleAddress?: Address
  vaultExpects?: Hex
}): Promise<OVaultModuleStoragePreflight> {
  const moduleAddress = getAddress(params.moduleAddress ?? CREATOR_OVAULT_CORE_MODULE)
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
    const expectsV2 = vaultExpects.toLowerCase() === CREATOR_OVAULT_MODULE_STORAGE_V2.toLowerCase()
    const moduleIsCurrent =
      moduleReports.toLowerCase() === CREATOR_OVAULT_MODULE_STORAGE_CURRENT.toLowerCase()
    const hint =
      expectsV2 && moduleIsCurrent
        ? ' Deploy bytecode expects CreatorOVaultModuleStorage.v2 but the live batcher still wires .current modules. ' +
          'Re-seed CreatorOVault creation bytecode with the .current fingerprint or deploy fresh v2 modules and rotate the batcher.'
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
