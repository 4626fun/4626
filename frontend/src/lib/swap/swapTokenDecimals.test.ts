import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CONTRACTS } from '@/config/contracts'
import { BASE_CHAIN_ID } from '@/lib/uniswap/swapUtils'
import { assertSwapSpendBalancePreflight } from '@/hooks/useSwapExecution'
import { fetchSwapAssetBalanceViaApi } from '@/lib/swap/useSwapAssetBalance'

import { resolveSwapTokenDecimals } from './swapTokenDecimals'

vi.mock('@/lib/swap/useSwapAssetBalance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/swap/useSwapAssetBalance')>()
  return {
    ...actual,
    fetchSwapAssetBalanceViaApi: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(fetchSwapAssetBalanceViaApi).mockReset()
})

const WALLET = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const

describe('resolveSwapTokenDecimals', () => {
  it('returns 6 for Base USDC even when RPC decimals read fails', async () => {
    const decimals = await resolveSwapTokenDecimals({
      token: CONTRACTS.usdc,
      chainId: BASE_CHAIN_ID,
      publicClient: {
        readContract: async () => {
          throw new Error('rpc_unavailable')
        },
      },
    })
    expect(decimals).toBe(6)
  })
})

describe('assertSwapSpendBalancePreflight USDC', () => {
  it('allows a typical USDC sell when balance is sufficient', async () => {
    await expect(
      assertSwapSpendBalancePreflight({
        publicClient: {
          getBalance: async () => 0n,
          readContract: async ({ functionName }) => {
            if (functionName === 'balanceOf') return 889_174_848n
            throw new Error('unexpected')
          },
        },
        executionAddress: WALLET,
        tokenIn: CONTRACTS.usdc,
        amountInUnits: '8.892',
        wrapNativeEthForCanonical: false,
        getTokenDecimals: (token) => resolveSwapTokenDecimals({ token, chainId: BASE_CHAIN_ID }),
      }),
    ).resolves.toBeUndefined()
  })

  it('uses API balance when browser RPC balanceOf returns zero', async () => {
    vi.mocked(fetchSwapAssetBalanceViaApi).mockResolvedValueOnce({
      raw: 889_174_848n,
      decimals: 6,
      formatted: '889.174848',
    })

    await expect(
      assertSwapSpendBalancePreflight({
        publicClient: {
          getBalance: async () => 0n,
          readContract: async () => 0n,
        },
        executionAddress: WALLET,
        tokenIn: CONTRACTS.usdc,
        amountInUnits: '1',
        wrapNativeEthForCanonical: false,
        getTokenDecimals: (token) => resolveSwapTokenDecimals({ token, chainId: BASE_CHAIN_ID }),
      }),
    ).resolves.toBeUndefined()
  })

  it('rejects USDC sells when decimals are misread as 18', async () => {
    await expect(
      assertSwapSpendBalancePreflight({
        publicClient: {
          getBalance: async () => 0n,
          readContract: async ({ functionName }) => {
            if (functionName === 'balanceOf') return 889_174_848n
            throw new Error('unexpected')
          },
        },
        executionAddress: WALLET,
        tokenIn: CONTRACTS.usdc,
        amountInUnits: '8.892',
        wrapNativeEthForCanonical: false,
        getTokenDecimals: async () => 18,
      }),
    ).rejects.toThrow(/Insufficient token balance/)
  })
})
