import { describe, expect, it, vi } from 'vitest'

import { waitForEmbeddedOwnerOnChain } from './ownerInstallConfirmation'

const CSW = '0xAb6d5C10b03300326cd7fab7267ae192842967b5' as const
const EOA = '0x1111111111111111111111111111111111111111' as const

describe('waitForEmbeddedOwnerOnChain', () => {
  it('returns true only after isOwnerAddress confirms the embedded EOA', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      waitForEmbeddedOwnerOnChain({
        publicClient: {
          getBytecode: vi.fn().mockResolvedValue('0x1234'),
          readContract,
        } as never,
        cswAddress: CSW,
        ownerAddress: EOA,
        attempts: 2,
        delayMs: 0,
        sleep,
      }),
    ).resolves.toBe(true)
    expect(readContract).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('does not treat a submitted transaction as completion when ownership stays false', async () => {
    await expect(
      waitForEmbeddedOwnerOnChain({
        publicClient: {
          getBytecode: vi.fn().mockResolvedValue('0x1234'),
          readContract: vi.fn().mockResolvedValue(false),
        } as never,
        cswAddress: CSW,
        ownerAddress: EOA,
        attempts: 2,
        delayMs: 0,
        sleep: vi.fn().mockResolvedValue(undefined),
      }),
    ).resolves.toBe(false)
  })
})
