import { describe, expect, it, vi } from 'vitest'
import { getAddress, type PublicClient } from 'viem'

import { readVaultActiveStrategies } from './vaultStrategyOnchain.js'

const VAULT = getAddress('0x1111111111111111111111111111111111111111')
const STRATEGY = getAddress('0x2222222222222222222222222222222222222222')

describe('readVaultActiveStrategies', () => {
  it('keeps active debt-bearing strategies after their weight is set to zero', async () => {
    const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      if (functionName === 'strategyList') {
        if (args?.[0] === 0n) return STRATEGY
        throw new Error('index out of bounds')
      }
      if (functionName === 'strategyWeights') return 0n
      if (functionName === 'activeStrategies') return true
      throw new Error(`unexpected read: ${functionName}`)
    })

    const strategies = await readVaultActiveStrategies({
      client: { readContract } as unknown as PublicClient,
      vault: VAULT,
    })

    expect(strategies).toEqual([{ strategy: STRATEGY, weight: 0n }])
  })
})
