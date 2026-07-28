import { describe, expect, it, vi } from 'vitest'
import { encodePacked, keccak256, type Hex } from 'viem'

import {
  CREATOR_OVAULT_MODULE_STORAGE_CURRENT,
  CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT,
  CREATOR_OVAULT_MODULE_STORAGE_V2,
  CREATOR_OVAULT_MODULE_STORAGE_V3,
  CREATOR_OVAULT_MODULE_STORAGE_V4,
  CREATOR_OVAULT_MODULE_STORAGE_V5,
  DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION,
  assertCreatorOvaultModuleStorageCompatible,
} from './ovaultModuleIdentity'

const CORE = '0xfaebF89F739769A348B871289488fc1b99F53140' as const

describe('ovaultModuleIdentity', () => {
  it('uses .v5 as the v1.20.0 deploy vault fingerprint', () => {
    expect(DEPLOY_CREATOR_OVAULT_MODULE_STORAGE_VERSION).toBe(CREATOR_OVAULT_MODULE_STORAGE_V5)
    expect(CREATOR_OVAULT_MODULE_STORAGE_CURRENT).toBe(CREATOR_OVAULT_MODULE_STORAGE_V5)
    expect(CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT).toBe(
      keccak256(encodePacked(['string'], ['CreatorOVaultModuleStorage.current'])) as Hex,
    )
    expect(CREATOR_OVAULT_MODULE_STORAGE_LEGACY_CURRENT).not.toBe(CREATOR_OVAULT_MODULE_STORAGE_V5)
  })

  it('passes when module reports the same fingerprint as deploy bytecode', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_V5),
      },
      moduleAddress: CORE,
    })
    expect(result.ok).toBe(true)
  })

  it('fails with guidance when v1.20.0 bytecode is paired with v4 modules', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_V4),
      },
      moduleAddress: CORE,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/InvalidModuleAddress/i)
      expect(result.message).toMatch(/v1\.19\.3 v5 stack/i)
    }
  })

  it('fails with guidance when vault expects v4 but module is still v3', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_V3),
      },
      moduleAddress: CORE,
      vaultExpects: CREATOR_OVAULT_MODULE_STORAGE_V4,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/InvalidModuleAddress/i)
      expect(result.message).toMatch(/v3 modules/i)
    }
  })

  it('fails with guidance when vault expects v4 but phase1 still wires v2 modules', async () => {
    const result = await assertCreatorOvaultModuleStorageCompatible({
      publicClient: {
        readContract: vi.fn(async () => CREATOR_OVAULT_MODULE_STORAGE_V2),
      },
      moduleAddress: CORE,
      vaultExpects: CREATOR_OVAULT_MODULE_STORAGE_V4,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/InvalidModuleAddress/i)
      expect(result.message).toMatch(/v2 modules/i)
      expect(result.message).toMatch(/v1\.19\.1/i)
    }
  })
})
