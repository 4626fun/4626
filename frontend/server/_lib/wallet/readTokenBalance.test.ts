import { describe, expect, it, vi } from 'vitest'

// Deterministic on-chain reads: previously this test hit live Base RPC and
// asserted the canonical CSW held a nonzero USDC balance, which broke whenever
// the wallet's real balance was zero or RPC was unavailable.
const { readContract } = vi.hoisted(() => ({
  readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === 'balanceOf') return 123_456_789n
    if (functionName === 'decimals') return 6
    throw new Error(`unexpected functionName: ${functionName}`)
  }),
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(function () {
      return { readContract }
    }),
  }
})

vi.mock('../onchain/baseRpcUrl.js', () => ({
  resolveServerBaseRpcUrls: () => ['https://base-rpc.test'],
}))

import { readTokenBalance } from './readTokenBalance.js'

describe('readTokenBalance', () => {
  it('reads Base USDC balance for the canonical CSW fixture', async () => {
    const result = await readTokenBalance({
      ownerAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    })

    expect(BigInt(result.raw)).toBeGreaterThan(0n)
    expect(result.raw).toBe('123456789')
    expect(result.decimals).toBe(6)
    expect(Number.parseFloat(result.formatted)).toBeGreaterThan(0)
    expect(result.formatted).toBe('123.456789')
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'balanceOf',
        args: ['0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'],
      }),
    )
  })
})
