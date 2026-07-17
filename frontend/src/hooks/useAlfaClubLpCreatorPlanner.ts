import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { erc20Abi, getAddress, isAddress, parseUnits, type Address, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient } from 'wagmi'

import { ALFACLUB, FRIEND_KEY_ABI } from '@/lib/alfaclub/contracts'
import {
  ALFACLUB_SOCIAL_FEE_BPS,
  ALFACLUB_TRADING_FEE_BPS,
  buildLpCreatorPlannerSeries,
  defaultPlannerKeyCounts,
  evaluateLpCreatorDeposit,
  roomTypeLabel,
  type LpCreatorPlannerChartPoint,
  type LpCreatorPlannerOutcome,
  type LpCreatorPlannerRoomType,
} from '@/lib/alfaclub/lpCreatorPlanner'
import { resolveZoraCoinUsdPrice } from '@/lib/zora/coinUsdPrice'
import { fetchZoraCoin } from '@/lib/zora/client'

type PlannerSnapshot = {
  tokenId: bigint
  creatorCoin: Address
  creatorCoinDecimals: number
  creatorCoinSymbol: string
  creatorCoinName: string
  creatorCoinUsdPrice: number | null
  creatorCoinPriceBondingToken: bigint | null
  roomType: number | null
  roomTier: number | null
  totalSupply: bigint
  creator: Address | null
  primaryBuyBondingToken: bigint
  primarySellBondingToken: bigint
}

export type AlfaClubLpCreatorPlannerRoomMeta = {
  tokenId: bigint
  creatorCoin: Address
  creatorCoinDecimals: number
  creatorCoinSymbol: string
  creatorCoinName: string
  creatorCoinUsdPrice: number | null
  roomType: number | null
  roomTier: number | null
  roomTypeKey: LpCreatorPlannerRoomType
  totalSupply: bigint
  creator: Address | null
  curveBuyOneUsdc: number
  curveSellOneUsdc: number
  curveMidUsdc: number
  feeBps: number
  maxKeys: number
}

export type UseAlfaClubLpCreatorPlannerResult = {
  roomMeta: AlfaClubLpCreatorPlannerRoomMeta | null
  series: LpCreatorPlannerChartPoint[]
  selectedOutcome: LpCreatorPlannerOutcome | null
  loading: boolean
  error: Error | null
  manualOverrideInvalid: boolean
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return null
}

function toAddressOrNull(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  try {
    const normalized = getAddress(value) as Address
    return normalized === '0x0000000000000000000000000000000000000000' ? null : normalized
  } catch {
    return null
  }
}

function parseUsdPriceToUnits(value: number | null): bigint | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  const normalized = value.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 18,
  })
  try {
    return parseUnits(normalized, 18)
  } catch {
    return null
  }
}

function parseManualOverride(value: string | undefined, decimals: number): {
  amount: bigint | null
  invalid: boolean
} {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return { amount: null, invalid: false }
  try {
    return { amount: parseUnits(trimmed, decimals), invalid: false }
  } catch {
    return { amount: null, invalid: true }
  }
}

function getPlannerMaxKeys(totalSupply: bigint): number {
  if (totalSupply <= 0n) return 20
  const safeTotal = totalSupply > 20n ? 20 : Number(totalSupply)
  return Math.max(2, safeTotal)
}

function getPlannerFeeBps(roomType: number | null): number {
  return roomType === 1 ? Number(ALFACLUB_SOCIAL_FEE_BPS) : Number(ALFACLUB_TRADING_FEE_BPS)
}

async function readPlannerSnapshot(
  publicClient: PublicClient,
  tokenId: bigint,
  creatorCoin: Address,
): Promise<PlannerSnapshot> {
  const [roomTypeRaw, roomTierRaw, totalSupply, creatorRaw, primaryBuyBondingToken, primarySellBondingToken] =
    await Promise.all([
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
      publicClient.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'totalSupply',
        args: [tokenId],
      }),
      publicClient
        .readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: 'creatorByTokenId',
          args: [tokenId],
        })
        .catch(() => null),
      publicClient.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'getBuyPriceAfterFee',
        args: [tokenId, 1n],
      }),
      publicClient.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'getSellPriceAfterFee',
        args: [tokenId, 1n],
      }),
    ])

  const [creatorCoinDecimalsRaw, creatorCoinSymbolRaw, creatorCoinNameRaw, zoraCoin] = await Promise.all([
    publicClient
      .readContract({
        address: creatorCoin,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      .catch(() => 18),
    publicClient
      .readContract({
        address: creatorCoin,
        abi: erc20Abi,
        functionName: 'symbol',
      })
      .catch(() => 'CREATOR'),
    publicClient
      .readContract({
        address: creatorCoin,
        abi: erc20Abi,
        functionName: 'name',
      })
      .catch(() => 'Creator Coin'),
    fetchZoraCoin(creatorCoin, base.id).catch(() => null),
  ])

  const creatorCoinUsdPrice = resolveZoraCoinUsdPrice(zoraCoin)
  return {
    tokenId,
    creatorCoin,
    creatorCoinDecimals:
      typeof creatorCoinDecimalsRaw === 'number' ? creatorCoinDecimalsRaw : Number(creatorCoinDecimalsRaw),
    creatorCoinSymbol: typeof creatorCoinSymbolRaw === 'string' ? creatorCoinSymbolRaw : 'CREATOR',
    creatorCoinName: typeof creatorCoinNameRaw === 'string' ? creatorCoinNameRaw : 'Creator Coin',
    creatorCoinUsdPrice,
    creatorCoinPriceBondingToken: parseUsdPriceToUnits(creatorCoinUsdPrice),
    roomType: toNullableNumber(roomTypeRaw),
    roomTier: toNullableNumber(roomTierRaw),
    totalSupply,
    creator: toAddressOrNull(creatorRaw),
    primaryBuyBondingToken,
    primarySellBondingToken,
  }
}

export function useAlfaClubLpCreatorPlanner(params: {
  tokenId: bigint
  creatorCoin: string
  selectedKeys: number
  manualCreatorCoinAmount?: string
}): UseAlfaClubLpCreatorPlannerResult {
  const publicClient = usePublicClient({ chainId: base.id })
  const normalizedCreatorCoin = useMemo(() => {
    if (!isAddress(params.creatorCoin)) return null
    return getAddress(params.creatorCoin) as Address
  }, [params.creatorCoin])

  const snapshotQuery = useQuery({
    queryKey: [
      'alfaclub-lp-creator-planner',
      params.tokenId.toString(),
      normalizedCreatorCoin?.toLowerCase() ?? '',
    ],
    enabled: Boolean(publicClient && normalizedCreatorCoin && params.tokenId > 0n),
    staleTime: 20_000,
    queryFn: async () => {
      if (!publicClient || !normalizedCreatorCoin || params.tokenId <= 0n) {
        throw new Error('Room token ID and creator coin are required')
      }
      return readPlannerSnapshot(publicClient, params.tokenId, normalizedCreatorCoin)
    },
  })

  const roomMeta = useMemo<AlfaClubLpCreatorPlannerRoomMeta | null>(() => {
    const snapshot = snapshotQuery.data
    if (!snapshot) return null
    const curveBuyOneUsdc = Number(snapshot.primaryBuyBondingToken) / 1_000_000
    const curveSellOneUsdc = Number(snapshot.primarySellBondingToken) / 1_000_000
    const maxKeys = getPlannerMaxKeys(snapshot.totalSupply)
    return {
      tokenId: snapshot.tokenId,
      creatorCoin: snapshot.creatorCoin,
      creatorCoinDecimals: snapshot.creatorCoinDecimals,
      creatorCoinSymbol: snapshot.creatorCoinSymbol,
      creatorCoinName: snapshot.creatorCoinName,
      creatorCoinUsdPrice: snapshot.creatorCoinUsdPrice,
      roomType: snapshot.roomType,
      roomTier: snapshot.roomTier,
      roomTypeKey: roomTypeLabel(snapshot.roomType),
      totalSupply: snapshot.totalSupply,
      creator: snapshot.creator,
      curveBuyOneUsdc,
      curveSellOneUsdc,
      curveMidUsdc: (curveBuyOneUsdc + curveSellOneUsdc) / 2,
      feeBps: getPlannerFeeBps(snapshot.roomType),
      maxKeys,
    }
  }, [snapshotQuery.data])

  const series = useMemo<LpCreatorPlannerChartPoint[]>(() => {
    const snapshot = snapshotQuery.data
    if (!snapshot?.creatorCoinPriceBondingToken) return []
    return buildLpCreatorPlannerSeries({
      primaryBuyBondingToken: snapshot.primaryBuyBondingToken,
      primarySellBondingToken: snapshot.primarySellBondingToken,
      creatorCoinPriceBondingToken: snapshot.creatorCoinPriceBondingToken,
      creatorCoinDecimals: snapshot.creatorCoinDecimals,
      roomType: snapshot.roomType,
      keyCounts: defaultPlannerKeyCounts(getPlannerMaxKeys(snapshot.totalSupply)),
    })
  }, [snapshotQuery.data])

  const manualOverride = useMemo(
    () =>
      snapshotQuery.data
        ? parseManualOverride(params.manualCreatorCoinAmount, snapshotQuery.data.creatorCoinDecimals)
        : { amount: null, invalid: false },
    [params.manualCreatorCoinAmount, snapshotQuery.data],
  )

  const selectedOutcome = useMemo<LpCreatorPlannerOutcome | null>(() => {
    const snapshot = snapshotQuery.data
    if (!snapshot?.creatorCoinPriceBondingToken || manualOverride.invalid) return null
    const maxKeys = roomMeta?.maxKeys ?? 20
    const selectedKeys = Math.max(2, Math.min(maxKeys, Math.floor(params.selectedKeys)))
    try {
      return evaluateLpCreatorDeposit({
        keyAmount: BigInt(selectedKeys),
        primaryBuyBondingToken: snapshot.primaryBuyBondingToken,
        primarySellBondingToken: snapshot.primarySellBondingToken,
        creatorCoinPriceBondingToken: snapshot.creatorCoinPriceBondingToken,
        creatorCoinDecimals: snapshot.creatorCoinDecimals,
        roomType: snapshot.roomType,
        creatorCoinAmountRaw: manualOverride.amount,
      })
    } catch {
      return null
    }
  }, [manualOverride.amount, manualOverride.invalid, params.selectedKeys, roomMeta?.maxKeys, snapshotQuery.data])

  return {
    roomMeta,
    series,
    selectedOutcome,
    loading: snapshotQuery.isLoading || snapshotQuery.isFetching,
    error: snapshotQuery.error instanceof Error ? snapshotQuery.error : null,
    manualOverrideInvalid: manualOverride.invalid,
  }
}
