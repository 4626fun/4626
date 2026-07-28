import { describe, expect, it, vi } from 'vitest'
import { getAddress, toFunctionSelector, type PublicClient } from 'viem'

import {
  canAdapterSelfDrain,
  readAjnaTrackedBucketLp,
} from './ensureAjnaEmergencyReadiness.js'

const ADAPTER = getAddress('0x1111111111111111111111111111111111111111')
const OTHER = getAddress('0x2222222222222222222222222222222222222222')
const INNER = getAddress('0x3333333333333333333333333333333333333333')

describe('ajna emergency adapter selectors', () => {
  it('pins drain / move selectors used for bytecode gates', () => {
    expect(toFunctionSelector('drainBucketsToBuffer()')).toBe('0xc7cc300d')
    expect(toFunctionSelector('moveToBuffer(uint256,uint256)')).toBe('0x070b49ba')
    expect(toFunctionSelector('moveFromBuffer(uint256,uint256)')).toBe('0xd6506540')
  })

  it('requires active adapter authorization before trusting self-drain', () => {
    expect(
      canAdapterSelfDrain({
        hasDrainSelector: true,
        paused: false,
        swapper: ADAPTER,
        adapter: ADAPTER,
      }),
    ).toBe(true)
    expect(
      canAdapterSelfDrain({
        hasDrainSelector: true,
        paused: true,
        swapper: ADAPTER,
        adapter: ADAPTER,
      }),
    ).toBe(false)
    expect(
      canAdapterSelfDrain({
        hasDrainSelector: true,
        paused: false,
        swapper: OTHER,
        adapter: ADAPTER,
      }),
    ).toBe(false)
  })

  it('reports only buckets with residual LP', async () => {
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      if (functionName === 'getBuckets') return [100n, 200n]
      if (functionName === 'bucketLp') return args?.[0] === 100n ? 0n : 9n
      throw new Error(`unexpected read: ${functionName}`)
    })

    await expect(
      readAjnaTrackedBucketLp({
        publicClient: { readContract } as unknown as PublicClient,
        innerVault: INNER,
      }),
    ).resolves.toEqual([{ bucket: 200n, lp: 9n }])
  })
})
