import { describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import { readEmbeddedOwnerOnSubAccount } from './subAccountOwnerInstall'

const SUB = '0x1111111111111111111111111111111111111111' as const
const EMBED = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const

describe('subAccountOwnerInstall', () => {
  it('readEmbeddedOwnerOnSubAccount returns true when embedded EOA is owner', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(true)
    const publicClient = {
      readContract,
      getBytecode: vi.fn().mockResolvedValue('0x6001'),
    } as any

    const result = await readEmbeddedOwnerOnSubAccount({
      publicClient,
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
    })

    expect(result).toBe(true)
  })

  it('readEmbeddedOwnerOnSubAccount returns null when contract is not deployed', async () => {
    const publicClient = {
      readContract: vi.fn(),
      getBytecode: vi.fn().mockResolvedValue('0x'),
    } as any

    const result = await readEmbeddedOwnerOnSubAccount({
      publicClient,
      subAccountAddress: SUB,
      embeddedEoaAddress: EMBED,
    })

    expect(result).toBeNull()
  })
})
