import { formatUnits } from 'viem'

import {
  ALFACLUB_BPS,
  buildAlfaClubSeedCandidate,
  quoteAlfaClubPoolBuy,
  quoteAlfaClubPoolSell,
} from './lpSeedMath.js'

export const ALFACLUB_TRADING_FEE_BPS = 690n
export const ALFACLUB_SOCIAL_FEE_BPS = 3n

export type LpCreatorPlannerRoomType = 'trading' | 'social' | 'unknown'

export type LpCreatorPlannerOutcome = {
  keys: number
  creatorCoinAmount: number
  creatorCoinPerKey: number
  creatorCoinUsd: number
  curveMidUsdc: number
  curveBuyOneUsdc: number
  curveSellOneUsdc: number
  lpBuyOneUsdc: number
  lpSellOneUsdc: number
  lpBuyOneCoin: number
  lpSellOneCoin: number
  buyImpactBps: number
  sellImpactBps: number
  buyPrefersLp: boolean
  sellPrefersLp: boolean
  feeBps: number
}

export type LpCreatorPlannerChartPoint = {
  keys: number
  creatorCoinAmount: number
  creatorCoinUsd: number
  curveMidUsdc: number
  lpBuyOneUsdc: number
  lpSellOneUsdc: number
  buyPrefersLp: boolean
  sellPrefersLp: boolean
}

function feeBpsForRoomType(roomType: number | null | undefined): bigint {
  if (roomType === 0) return ALFACLUB_TRADING_FEE_BPS
  if (roomType === 1) return ALFACLUB_SOCIAL_FEE_BPS
  return ALFACLUB_TRADING_FEE_BPS
}

export function roomTypeLabel(roomType: number | null | undefined): LpCreatorPlannerRoomType {
  if (roomType === 0) return 'trading'
  if (roomType === 1) return 'social'
  return 'unknown'
}

function toNumber(amount: bigint, decimals: number): number {
  return Number(formatUnits(amount, decimals))
}

function usdcFromBonding(amount: bigint): number {
  return toNumber(amount, 6)
}

/**
 * Evaluate one (keys, creator-coin) deposit against the room bonding curve.
 * `creatorCoinAmountRaw` null → auto curve-match via `buildAlfaClubSeedCandidate`.
 */
export function evaluateLpCreatorDeposit(params: {
  keyAmount: bigint
  primaryBuyBondingToken: bigint
  primarySellBondingToken: bigint
  creatorCoinPriceBondingToken: bigint
  creatorCoinDecimals: number
  roomType?: number | null
  creatorCoinAmountRaw?: bigint | null
}): LpCreatorPlannerOutcome {
  const feeBps = feeBpsForRoomType(params.roomType)
  const priceUsdc = toNumber(params.creatorCoinPriceBondingToken, 18)
  const curveBuyOneUsdc = usdcFromBonding(params.primaryBuyBondingToken)
  const curveSellOneUsdc = usdcFromBonding(params.primarySellBondingToken)
  const curveMidUsdc = (curveBuyOneUsdc + curveSellOneUsdc) / 2

  let creatorCoinAmountRaw: bigint
  let creatorCoinPerKeyRaw: bigint
  let oneKeyBuyRaw: bigint
  let oneKeySellRaw: bigint
  let buyImpactBps: number
  let sellImpactBps: number

  if (params.creatorCoinAmountRaw != null && params.creatorCoinAmountRaw > 0n) {
    creatorCoinAmountRaw = params.creatorCoinAmountRaw
    creatorCoinPerKeyRaw =
      params.keyAmount > 0n ? creatorCoinAmountRaw / params.keyAmount : 0n
    oneKeyBuyRaw = quoteAlfaClubPoolBuy({
      creatorCoinReserve: creatorCoinAmountRaw,
      keyReserve: params.keyAmount,
      keyAmount: 1n,
      feeBps,
    })
    oneKeySellRaw = quoteAlfaClubPoolSell({
      creatorCoinReserve: creatorCoinAmountRaw,
      keyReserve: params.keyAmount,
      keyAmount: 1n,
      feeBps,
    })
    const ref = creatorCoinPerKeyRaw > 0n ? creatorCoinPerKeyRaw : 1n
    buyImpactBps = Number(
      ((oneKeyBuyRaw >= ref ? oneKeyBuyRaw - ref : ref - oneKeyBuyRaw) * ALFACLUB_BPS) / ref,
    )
    sellImpactBps = Number(
      ((oneKeySellRaw >= ref ? oneKeySellRaw - ref : ref - oneKeySellRaw) * ALFACLUB_BPS) / ref,
    )
  } else {
    const candidate = buildAlfaClubSeedCandidate({
      primaryBuyBondingToken: params.primaryBuyBondingToken,
      primarySellBondingToken: params.primarySellBondingToken,
      creatorCoinPriceBondingToken: params.creatorCoinPriceBondingToken,
      bondingTokenScale: 10n ** 6n,
      creatorCoinPriceScale: 10n ** 18n,
      creatorCoinDecimals: params.creatorCoinDecimals,
      keyAmount: params.keyAmount,
      feeBps,
    })
    creatorCoinAmountRaw = candidate.creatorCoinAmount
    creatorCoinPerKeyRaw = candidate.creatorCoinPerKey
    oneKeyBuyRaw = candidate.oneKeyBuy
    oneKeySellRaw = candidate.oneKeySell
    buyImpactBps = Number(candidate.oneKeyBuyImpactBps)
    sellImpactBps = Number(candidate.oneKeySellImpactBps)
  }

  const lpBuyOneCoin = toNumber(oneKeyBuyRaw, params.creatorCoinDecimals)
  const lpSellOneCoin = toNumber(oneKeySellRaw, params.creatorCoinDecimals)
  const lpBuyOneUsdc = lpBuyOneCoin * priceUsdc
  const lpSellOneUsdc = lpSellOneCoin * priceUsdc
  const creatorCoinAmount = toNumber(creatorCoinAmountRaw, params.creatorCoinDecimals)

  return {
    keys: Number(params.keyAmount),
    creatorCoinAmount,
    creatorCoinPerKey: toNumber(creatorCoinPerKeyRaw, params.creatorCoinDecimals),
    creatorCoinUsd: creatorCoinAmount * priceUsdc,
    curveMidUsdc,
    curveBuyOneUsdc,
    curveSellOneUsdc,
    lpBuyOneUsdc,
    lpSellOneUsdc,
    lpBuyOneCoin,
    lpSellOneCoin,
    buyImpactBps,
    sellImpactBps,
    buyPrefersLp: lpBuyOneUsdc < curveBuyOneUsdc,
    sellPrefersLp: lpSellOneUsdc > curveSellOneUsdc,
    feeBps: Number(feeBps),
  }
}

/** Curve-matched series for the planner chart (key deposit size → coin needed + outcomes). */
export function buildLpCreatorPlannerSeries(params: {
  primaryBuyBondingToken: bigint
  primarySellBondingToken: bigint
  creatorCoinPriceBondingToken: bigint
  creatorCoinDecimals: number
  roomType?: number | null
  keyCounts: readonly number[]
}): LpCreatorPlannerChartPoint[] {
  const points: LpCreatorPlannerChartPoint[] = []
  for (const keys of params.keyCounts) {
    if (!Number.isInteger(keys) || keys < 2) continue
    try {
      const outcome = evaluateLpCreatorDeposit({
        keyAmount: BigInt(keys),
        primaryBuyBondingToken: params.primaryBuyBondingToken,
        primarySellBondingToken: params.primarySellBondingToken,
        creatorCoinPriceBondingToken: params.creatorCoinPriceBondingToken,
        creatorCoinDecimals: params.creatorCoinDecimals,
        roomType: params.roomType,
      })
      points.push({
        keys: outcome.keys,
        creatorCoinAmount: outcome.creatorCoinAmount,
        creatorCoinUsd: outcome.creatorCoinUsd,
        curveMidUsdc: outcome.curveMidUsdc,
        lpBuyOneUsdc: outcome.lpBuyOneUsdc,
        lpSellOneUsdc: outcome.lpSellOneUsdc,
        buyPrefersLp: outcome.buyPrefersLp,
        sellPrefersLp: outcome.sellPrefersLp,
      })
    } catch {
      // skip invalid points
    }
  }
  return points
}

export function defaultPlannerKeyCounts(maxKeys = 20): number[] {
  const capped = Math.max(2, Math.min(40, Math.floor(maxKeys)))
  const counts: number[] = []
  for (let k = 2; k <= capped; k += 1) counts.push(k)
  return counts
}

/** Known room → creator coin defaults for the planner (extend as rooms onboard). */
export const ROOM_CREATOR_COIN_DEFAULTS: Readonly<Record<string, `0x${string}`>> = {
  '1659': '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
}
