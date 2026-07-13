import { useQuery } from '@tanstack/react-query'
import { erc20Abi, getAddress, type Address, type PublicClient } from 'viem'

import {
  ALFA_CREATOR_KEY_LP_FACTORY_ABI,
  ALFA_CREATOR_KEY_POOL_ABI,
  ALFACLUB,
  FRIEND_KEY_ABI,
} from '@/lib/alfaclub/contracts'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MAX_DIRECTORY_POOLS = 100

export type AlfaClubLiquidityPoolSummary = {
  pool: Address
  creatorCoin: Address
  tokenId: bigint
  feeBps: number
  roomType: number | null
  roomTier: number | null
  roomCreator: Address | null
  creatorCoinName: string
  creatorCoinSymbol: string
  creatorCoinDecimals: number
  creatorCoinReserve: bigint
  keyReserve: bigint
  lpTotalSupply: bigint
}

export type AlfaClubLiquidityPoolDirectory = {
  pools: AlfaClubLiquidityPoolSummary[]
  totalPoolCount: number
  isTruncated: boolean
}

function toSafeCount(value: bigint): number {
  if (value <= 0n) return 0
  const capped = value > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : value
  return Number(capped)
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return null
}

function toAddressOrNull(value: unknown): Address | null {
  if (typeof value !== 'string' || value.toLowerCase() === ZERO_ADDRESS) return null
  try {
    return getAddress(value) as Address
  } catch {
    return null
  }
}

export function formatAlfaClubPoolFee(feeBps: number): string {
  const percent = feeBps / 100
  return `${percent.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`
}

export function filterAlfaClubLiquidityPools(
  pools: AlfaClubLiquidityPoolSummary[],
  search: string,
): AlfaClubLiquidityPoolSummary[] {
  const query = search.trim().toLowerCase()
  if (!query) return pools
  return pools.filter((pool) => {
    return (
      pool.creatorCoinName.toLowerCase().includes(query) ||
      pool.creatorCoinSymbol.toLowerCase().includes(query) ||
      pool.tokenId.toString().includes(query) ||
      pool.creatorCoin.toLowerCase().includes(query) ||
      pool.pool.toLowerCase().includes(query)
    )
  })
}

export function filterAlfaClubLiquidityPoolsByRoomId(
  pools: AlfaClubLiquidityPoolSummary[],
  roomId: string,
): AlfaClubLiquidityPoolSummary[] {
  if (!/^\d+$/.test(roomId)) return []
  const tokenId = BigInt(roomId)
  return pools.filter((pool) => pool.tokenId === tokenId)
}

export async function readAlfaClubLiquidityPools(
  publicClient: PublicClient,
  factory: Address,
): Promise<AlfaClubLiquidityPoolDirectory> {
  const totalRaw = await publicClient.readContract({
    address: factory,
    abi: ALFA_CREATOR_KEY_LP_FACTORY_ABI,
    functionName: 'allPoolsLength',
  })
  const totalPoolCount = toSafeCount(totalRaw)
  const requestedCount = Math.min(totalPoolCount, MAX_DIRECTORY_POOLS)
  if (requestedCount === 0) {
    return { pools: [], totalPoolCount, isTruncated: false }
  }

  const poolAddresses = (await publicClient.multicall({
    allowFailure: false,
    contracts: Array.from({ length: requestedCount }, (_, index) => ({
        address: factory,
        abi: ALFA_CREATOR_KEY_LP_FACTORY_ABI,
        functionName: 'allPools' as const,
        args: [BigInt(index)],
      })),
  })).map((address) => getAddress(address) as Address)

  const poolCoreReads = (await publicClient.multicall({
    allowFailure: false,
    contracts: poolAddresses.flatMap((pool) => [
      { address: pool, abi: ALFA_CREATOR_KEY_POOL_ABI, functionName: 'creatorCoin' as const },
      { address: pool, abi: ALFA_CREATOR_KEY_POOL_ABI, functionName: 'keyTokenId' as const },
      { address: pool, abi: ALFA_CREATOR_KEY_POOL_ABI, functionName: 'feeBps' as const },
      { address: pool, abi: ALFA_CREATOR_KEY_POOL_ABI, functionName: 'getReserves' as const },
      { address: pool, abi: ALFA_CREATOR_KEY_POOL_ABI, functionName: 'totalSupply' as const },
    ]),
  })) as unknown[]

  const pools = await Promise.all(
    poolAddresses.map(async (pool, index): Promise<AlfaClubLiquidityPoolSummary> => {
      const offset = index * 5
      const creatorCoinRaw = poolCoreReads[offset] as Address
      const tokenId = poolCoreReads[offset + 1] as bigint
      const feeBpsRaw = poolCoreReads[offset + 2] as number
      const reserves = poolCoreReads[offset + 3] as readonly [bigint, bigint]
      const lpTotalSupply = poolCoreReads[offset + 4] as bigint
      const creatorCoin = getAddress(creatorCoinRaw) as Address

      const [nameRaw, symbolRaw, decimalsRaw, roomTypeRaw, roomTierRaw, roomCreatorRaw] = await Promise.all([
        publicClient
          .readContract({ address: creatorCoin, abi: erc20Abi, functionName: 'name' })
          .catch(() => 'Creator Coin'),
        publicClient
          .readContract({ address: creatorCoin, abi: erc20Abi, functionName: 'symbol' })
          .catch(() => 'CREATOR'),
        publicClient
          .readContract({ address: creatorCoin, abi: erc20Abi, functionName: 'decimals' })
          .catch(() => 18),
        publicClient
          .readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'roomTypes',
            args: [tokenId],
          })
          .catch(() => null),
        publicClient
          .readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'roomTiers',
            args: [tokenId],
          })
          .catch(() => null),
        publicClient
          .readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'creatorByTokenId',
            args: [tokenId],
          })
          .catch(() => null),
      ])

      return {
        pool,
        creatorCoin,
        tokenId,
        feeBps: Number(feeBpsRaw),
        roomType: toNullableNumber(roomTypeRaw),
        roomTier: toNullableNumber(roomTierRaw),
        roomCreator: toAddressOrNull(roomCreatorRaw),
        creatorCoinName: typeof nameRaw === 'string' ? nameRaw : 'Creator Coin',
        creatorCoinSymbol: typeof symbolRaw === 'string' ? symbolRaw : 'CREATOR',
        creatorCoinDecimals: typeof decimalsRaw === 'number' ? decimalsRaw : Number(decimalsRaw),
        creatorCoinReserve: reserves[0],
        keyReserve: reserves[1],
        lpTotalSupply,
      }
    }),
  )

  return {
    pools,
    totalPoolCount,
    isTruncated: totalPoolCount > requestedCount,
  }
}

export function useAlfaClubLiquidityPools(publicClient: PublicClient | undefined, factory: Address | null) {
  const factoryReady = Boolean(factory && factory.toLowerCase() !== ZERO_ADDRESS)
  return useQuery({
    queryKey: ['alfaclub-liquidity-pools', factory?.toLowerCase() ?? ''],
    enabled: Boolean(publicClient && factoryReady),
    staleTime: 20_000,
    queryFn: async () => {
      if (!publicClient || !factory) throw new Error('AlfaClub liquidity factory is unavailable')
      return readAlfaClubLiquidityPools(publicClient, factory)
    },
  })
}
