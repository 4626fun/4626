import { describe, expect, it } from 'vitest'

import { readTokenBalance } from './readTokenBalance.js'

describe('readTokenBalance', () => {
  it('reads Base USDC balance for the canonical CSW fixture', async () => {
    const result = await readTokenBalance({
      ownerAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    })

    expect(BigInt(result.raw)).toBeGreaterThan(0n)
    expect(result.decimals).toBe(6)
    expect(Number.parseFloat(result.formatted)).toBeGreaterThan(0)
  })
})
