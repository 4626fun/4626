export const ALFACLUB_BPS = 10_000n

export type AlfaClubSeedCandidate = {
  keyAmount: bigint
  creatorCoinAmount: bigint
  primaryMidBondingToken: bigint
  creatorCoinPerKey: bigint
  oneKeyBuy: bigint
  oneKeySell: bigint
  oneKeyBuyImpactBps: bigint
  oneKeySellImpactBps: bigint
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('denominator_must_be_positive')
  return numerator === 0n ? 0n : ((numerator - 1n) / denominator) + 1n
}

function impactBps(actual: bigint, reference: bigint): bigint {
  if (reference <= 0n) return 0n
  const delta = actual >= reference ? actual - reference : reference - actual
  return (delta * ALFACLUB_BPS) / reference
}

export function quoteAlfaClubPoolBuy(params: {
  creatorCoinReserve: bigint
  keyReserve: bigint
  keyAmount: bigint
  feeBps: bigint
}): bigint {
  if (params.keyAmount <= 0n || params.keyAmount >= params.keyReserve) {
    throw new Error('insufficient_key_reserve')
  }
  const afterFee = ceilDiv(
    params.creatorCoinReserve * params.keyAmount,
    params.keyReserve - params.keyAmount,
  )
  return ceilDiv(afterFee * ALFACLUB_BPS, ALFACLUB_BPS - params.feeBps)
}

export function quoteAlfaClubPoolSell(params: {
  creatorCoinReserve: bigint
  keyReserve: bigint
  keyAmount: bigint
  feeBps: bigint
}): bigint {
  if (params.keyAmount <= 0n || params.keyReserve <= 0n) {
    throw new Error('insufficient_key_reserve')
  }
  const grossOut =
    (params.creatorCoinReserve * params.keyAmount) /
    (params.keyReserve + params.keyAmount)
  return grossOut - (grossOut * params.feeBps) / ALFACLUB_BPS
}

export function buildAlfaClubSeedCandidate(params: {
  primaryBuyBondingToken: bigint
  primarySellBondingToken: bigint
  creatorCoinPriceBondingToken: bigint
  bondingTokenScale?: bigint
  creatorCoinPriceScale?: bigint
  creatorCoinDecimals: number
  keyAmount: bigint
  feeBps: bigint
}): AlfaClubSeedCandidate {
  if (
    params.primaryBuyBondingToken <= 0n ||
    params.primarySellBondingToken <= 0n ||
    params.creatorCoinPriceBondingToken <= 0n ||
    params.keyAmount <= 1n
  ) {
    throw new Error('seed_inputs_must_be_positive')
  }
  if (!Number.isInteger(params.creatorCoinDecimals) || params.creatorCoinDecimals < 0) {
    throw new Error('invalid_creator_coin_decimals')
  }
  if (params.feeBps < 0n || params.feeBps >= ALFACLUB_BPS) {
    throw new Error('invalid_fee_bps')
  }

  const primaryMidBondingToken =
    (params.primaryBuyBondingToken + params.primarySellBondingToken) / 2n
  const creatorCoinScale = 10n ** BigInt(params.creatorCoinDecimals)
  const bondingTokenScale = params.bondingTokenScale ?? 1n
  const creatorCoinPriceScale = params.creatorCoinPriceScale ?? bondingTokenScale
  if (bondingTokenScale <= 0n || creatorCoinPriceScale <= 0n) {
    throw new Error('invalid_price_scale')
  }
  const creatorCoinPerKey =
    (primaryMidBondingToken * creatorCoinScale * creatorCoinPriceScale) /
    (bondingTokenScale * params.creatorCoinPriceBondingToken)
  const creatorCoinAmount = creatorCoinPerKey * params.keyAmount
  const oneKeyBuy = quoteAlfaClubPoolBuy({
    creatorCoinReserve: creatorCoinAmount,
    keyReserve: params.keyAmount,
    keyAmount: 1n,
    feeBps: params.feeBps,
  })
  const oneKeySell = quoteAlfaClubPoolSell({
    creatorCoinReserve: creatorCoinAmount,
    keyReserve: params.keyAmount,
    keyAmount: 1n,
    feeBps: params.feeBps,
  })

  return {
    keyAmount: params.keyAmount,
    creatorCoinAmount,
    primaryMidBondingToken,
    creatorCoinPerKey,
    oneKeyBuy,
    oneKeySell,
    oneKeyBuyImpactBps: impactBps(oneKeyBuy, creatorCoinPerKey),
    oneKeySellImpactBps: impactBps(oneKeySell, creatorCoinPerKey),
  }
}
