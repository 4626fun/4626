import { describe, expect, it, vi } from 'vitest'
import { encodePacked, keccak256, type Hex } from 'viem'

import {
  CREATOR_OVAULT_MODULE_STORAGE_CURRENT,
  CREATOR_OVAULT_MODULE_STORAGE_V2,
  DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION,
  assertCreatorOvaultModuleStorageCompatible,
} from './ovaultModuleIdentity'

const CORE = '0x9f8C2c5700A25b76759f3115B96A68f4d079CDbB' as const

describe('ovaultModuleIdentity', () => {
  it('uses .current as deploy vault fingerprint', () => {
    expect(DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION).toBe(CREATOR_OVAULT_MODULE_STORAGE_CURRENT)
    expect(CREATOR_OVAULT_MODULE_STORAGE_CURRENT).toBe(
      keccak256(encodePacked(['string'], ['CreatorOVaultModuleStorage.current'])) as Hex,
    )
    expect(CREATOR_OVAULT_MODULE_STORAGE_V2).not.toBe(CREATOR_OVAULT_MODULE_STORAGE_CURRENT)
  })

  it('passes when module reports the same fingerprint as deploy bytecode', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_CURRENT),
      },
      moduleAddress: CORE,
    })
    expect(result.ok).toBe(true)
  })

  it('fails with guidance when vault expects v2 but module is .current', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_CURRENT),
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
