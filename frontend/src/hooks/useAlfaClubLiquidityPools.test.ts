import { describe, expect, it, vi } from 'vitest'
import { getAddress, type Address, type PublicClient } from 'viem'

import {
  filterAlfaClubLiquidityPools,
  formatAlfaClubPoolFee,
  readAlfaClubLiquidityPools,
  type AlfaClubLiquidityPoolSummary,
} from './useAlfaClubLiquidityPools'

const FACTORY = '0x1000000000000000000000000000000000000000' as Address
const POOL = '0x2000000000000000000000000000000000000000' as Address
const CREATOR_COIN = '0x3000000000000000000000000000000000000000' as Address
const ROOM_CREATOR = '0x4000000000000000000000000000000000000000' as Address

type ReadRequest = {
  address: Address
  functionName: string
  args?: readonly unknown[]
}

function makePool(overrides: Partial<AlfaClubLiquidityPoolSummary> = {}): AlfaClubLiquidityPoolSummary {
  return {
    pool: POOL,
    creatorCoin: CREATOR_COIN,
    tokenId: 1659n,
    feeBps: 690,
    roomType: 0,
    roomTier: 1,
    roomCreator: ROOM_CREATOR,
    creatorCoinName: 'Akita Creator Coin',
    creatorCoinSymbol: 'AKITA',
    creatorCoinDecimals: 18,
    creatorCoinReserve: 10_000n,
    keyReserve: 25n,
    lpTotalSupply: 500n,
    ...overrides,
  }
}

describe('AlfaClub liquidity pool directory', () => {
  it('formats each immutable fee tier without hardcoding trading fees', () => {
    expect(formatAlfaClubPoolFee(690)).toBe('6.9%')
    expect(formatAlfaClubPoolFee(3)).toBe('0.03%')
  })

  it('filters by creator coin, token ID, and pool address', () => {
    const pools = [makePool()]
    expect(filterAlfaClubLiquidityPools(pools, 'akita')).toEqual(pools)
    expect(filterAlfaClubLiquidityPools(pools, '1659')).toEqual(pools)
    expect(filterAlfaClubLiquidityPools(pools, POOL.slice(-8))).toEqual(pools)
    expect(filterAlfaClubLiquidityPools(pools, 'missing')).toEqual([])
  })

  it('returns an empty directory without issuing empty multicalls', async () => {
    const readContract = vi.fn().mockResolvedValue(0n)
    const multicall = vi.fn()
    const client = { readContract, multicall } as unknown as PublicClient

    await expect(readAlfaClubLiquidityPools(client, FACTORY)).resolves.toEqual({
      pools: [],
      totalPoolCount: 0,
      isTruncated: false,
    })
    expect(multicall).not.toHaveBeenCalled()
  })

  it('resolves factory pools into actionable pair summaries', async () => {
    const readContract = vi.fn(async (request: ReadRequest): Promise<unknown> => {
      switch (request.functionName) {
        case 'allPoolsLength':
          return 1n
        case 'allPools':
          return POOL
        case 'creatorCoin':
          return CREATOR_COIN
        case 'keyTokenId':
          return 1659n
        case 'feeBps':
          return 690
        case 'getReserves':
          return [12_000n, 24n] as const
        case 'totalSupply':
          return 4_000n
        case 'name':
          return 'Akita Creator Coin'
        case 'symbol':
          return 'AKITA'
        case 'decimals':
          return 18
        case 'roomTypes':
          return 0
        case 'roomTiers':
          return 1
        case 'creatorByTokenId':
          return ROOM_CREATOR
        default:
          throw new Error(`Unexpected read ${request.functionName}`)
      }
    })
    const multicall = vi.fn(async ({ contracts }: { contracts: ReadRequest[] }) => {
      return Promise.all(contracts.map((request) => readContract(request)))
    })
    const client = { readContract, multicall } as unknown as PublicClient

    const result = await readAlfaClubLiquidityPools(client, FACTORY)

    expect(result).toEqual({
      totalPoolCount: 1,
      isTruncated: false,
      pools: [
        expect.objectContaining({
          pool: getAddress(POOL),
          creatorCoin: getAddress(CREATOR_COIN),
          tokenId: 1659n,
          feeBps: 690,
          roomType: 0,
          roomTier: 1,
          roomCreator: getAddress(ROOM_CREATOR),
          creatorCoinName: 'Akita Creator Coin',
          creatorCoinSymbol: 'AKITA',
          creatorCoinReserve: 12_000n,
          keyReserve: 24n,
          lpTotalSupply: 4_000n,
        }),
      ],
    })
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: FACTORY,
        functionName: 'allPoolsLength',
      }),
    )
    expect(multicall).toHaveBeenCalledTimes(2)
  })
})
