import { describe, expect, it, vi } from 'vitest'
import { encodePacked, keccak256, type Hex } from 'viem'

import {
  CREATOR_OVAULT_MODULE_STORAGE_CURRENT,
  CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT,
  CREATOR_OVAULT_MODULE_STORAGE_V2,
  DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION,
  assertCreatorOvaultModuleStorageCompatible,
} from './ovaultModuleIdentity'

const CORE = '0xfaebF89F739769A348B871289488fc1b99F53140' as const

describe('ovaultModuleIdentity', () => {
  it('uses .v2 as deploy vault fingerprint after v1.12.1 module rotation', () => {
    expect(DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION).toBe(CREATOR_OVAULT_MODULE_STORAGE_V2)
    expect(CREATOR_OVAULT_MODULE_STORAGE_CURRENT).toBe(CREATOR_OVAULT_MODULE_STORAGE_V2)
    expect(CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT).toBe(
      keccak256(encodePacked(['string'], ['CreatorOVaultModuleStorage.current'])) as Hex,
    )
    expect(CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT).not.toBe(CREATOR_OVAULT_MODULE_STORAGE_V2)
  })

  it('passes when module reports the same fingerprint as deploy bytecode', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_V2),
      },
      moduleAddress: CORE,
    })
    expect(result.ok).toBe(true)
  })

  it('fails with guidance when vault expects v2 but module is legacy .current', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT),
      },
      moduleAddress: CORE,
      vaultExpects: CREATOR_OVAULT_MODULE_STORAGE_V2,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/InvalidModuleAddress/i)
      expect(result.message).toMatch(/v2/i)
    }
  })
})
