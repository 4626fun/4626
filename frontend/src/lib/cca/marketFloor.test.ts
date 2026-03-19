import { describe, expect, it, vi } from 'vitest'

import { getZoraReferenceV3Ticks, type ReadonlyPublicClient } from './marketFloor'

const ZORA_WETH_POOL = '0x1111111111111111111111111111111111111111' as const
const ZORA_USDC_POOL = '0x2222222222222222222222222222222222222222' as const

function makeClient(
  readContract: (args: any) => Promise<any>,
): ReadonlyPublicClient {
  return {
    readContract,
    multicall: async () => [],
    getBlockNumber: async () => 0n,
    getBlock: async () => ({}),
    getLogs: async () => [],
  }
}

describe('getZoraReferenceV3Ticks', () => {
  it('throws when all TWAP windows are unavailable (OLD)', async () => {
    const readContract = vi.fn(async () => {
      throw new Error('execution reverted: OLD')
    })
    const client = makeClient(readContract)

    await expect(
      getZoraReferenceV3Ticks({
        publicClient: client,
        zoraWethV3Pool: ZORA_WETH_POOL,
        zoraUsdcV3Pool: ZORA_USDC_POOL,
        desiredDurationSec: 1800,
      }),
    ).rejects.toThrow('TWAP pricing')
  })

  it('falls back to a shorter TWAP window (never spot)', async () => {
    const readContract = vi.fn(async (args: any) => {
      if (args.functionName !== 'observe') throw new Error('unexpected function')
      const duration = Number(args.args?.[0]?.[0] ?? 0)
      if (duration === 1800) {
        throw new Error('OLD')
      }
      return [[0n, BigInt(duration * 2)], [0n, 0n]]
    })
    const client = makeClient(readContract)

    const out = await getZoraReferenceV3Ticks({
      publicClient: client,
      zoraWethV3Pool: ZORA_WETH_POOL,
      zoraUsdcV3Pool: ZORA_USDC_POOL,
      desiredDurationSec: 1800,
    })

    expect(out.durationSec).toBe(900)
    expect(out.wethTick).toBe(2)
    expect(out.usdcTick).toBe(2)
  })
})
