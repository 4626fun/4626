import { describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

vi.mock('@/config/contracts', () => ({
  CONTRACTS: {
    registry: '0x888506B92181c57A2fD06516FFFb6F375b7A4626',
  },
}))

import { resolveCreatorTradeTokenAddress } from './vaultResolve'

describe('resolveCreatorTradeTokenAddress', () => {
  it('normalizes vault-like addresses to the creator coin when the registry has a mapping', async () => {
    const creatorToken = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    const publicClient = {
      multicall: vi.fn().mockResolvedValue([
        { status: 'failure', result: undefined },
        { status: 'success', result: creatorToken },
      ]),
    } as any

    const resolved = await resolveCreatorTradeTokenAddress(
      publicClient,
      '0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f',
    )

    expect(resolved).toBe(creatorToken)
  })

  it('falls back to the provided token address when no creator-coin mapping exists', async () => {
    const tokenAddress = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    const publicClient = {
      multicall: vi.fn().mockResolvedValue([
        { status: 'failure', result: undefined },
        { status: 'success', result: '0x0000000000000000000000000000000000000000' },
      ]),
    } as any

    const resolved = await resolveCreatorTradeTokenAddress(publicClient, tokenAddress)

    expect(resolved).toBe(tokenAddress)
  })

  it('returns null for invalid addresses without touching the chain client', async () => {
    const publicClient = {
      multicall: vi.fn(),
    } as any

    const resolved = await resolveCreatorTradeTokenAddress(publicClient, 'not-an-address')

    expect(resolved).toBeNull()
    expect(publicClient.multicall).not.toHaveBeenCalled()
  })
})
