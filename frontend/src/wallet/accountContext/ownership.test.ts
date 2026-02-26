import { describe, expect, it, vi } from 'vitest'

import { checkEoaOwnershipOfCsw } from './ownership'

describe('checkEoaOwnershipOfCsw', () => {
  it('returns true/false from onchain ownership call', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const publicClient = { readContract }

    const ownerParams = {
      publicClient,
      chainId: 8453,
      cswAddress: '0x1111111111111111111111111111111111111111',
      ownerAddress: '0x2222222222222222222222222222222222222222',
    }

    await expect(checkEoaOwnershipOfCsw(ownerParams)).resolves.toEqual({
      value: true,
      reason: 'ok',
    })

    await expect(checkEoaOwnershipOfCsw(ownerParams)).resolves.toEqual({
      value: false,
      reason: 'ok',
    })
  })

  it('returns null on chain mismatch', async () => {
    const result = await checkEoaOwnershipOfCsw({
      publicClient: { readContract: vi.fn() },
      chainId: 1,
      cswAddress: '0x1111111111111111111111111111111111111111',
      ownerAddress: '0x2222222222222222222222222222222222222222',
    })
    expect(result).toEqual({ value: null, reason: 'network_mismatch' })
  })

  it('returns null when contract read reverts', async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error('revert')),
    }
    const result = await checkEoaOwnershipOfCsw({
      publicClient,
      chainId: 8453,
      cswAddress: '0x1111111111111111111111111111111111111111',
      ownerAddress: '0x2222222222222222222222222222222222222222',
    })
    expect(result).toEqual({ value: null, reason: 'read_failed' })
  })
})

