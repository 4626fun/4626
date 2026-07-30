import {
  DEFAULT_PARAMS,
  type CreatorVaultSimParams,
  type GaugeSplitWeights,
  type LegWeights,
  type ShareAllocationWeights,
} from './defaults'

export type ActiveFlow =
  | 'idle'
  | 'deposit'
  | 'wrap'
  | 'cca'
  | 'legs'
  | 'solanaArm'
  | 'tradeFee'
  | 'payout'
  | 'redeem'
  | 'impairment'

export type CreatorVaultSimState = {
  params: CreatorVaultSimParams
  paused: boolean
  impairmentActive: boolean
  /** Creator coin NAV held by the vault */
  vaultNav: number
  /** ERC-4626 share supply (▢) — redeem claim */
  boxSupply: number
  /** Wrapped ■ circulating for trade / bridge (subset of economic shares) */
  oftCirculating: number
  /** Shares reserved in CCA auction arm */
  ccaFilled: number
  ccaGraduated: boolean
  vestingHeld: number
  solanaArmHeld: number
  lpReserveHeld: number
  charmTvl: number
  ajnaTvl: number
  idleTvl: number
  /** tradeFeeCollector → gauge → burn (PPS accretion via burn) */
  feesBurned: number
  jackpotReserve: number
  creatorTreasuryAccum: number
  protocolAccum: number
  /** creatorCoinPayoutRecipient → PayoutRouter → burn stream (not trade-fee) */
  payoutBurnStream: number
  /** Total creator coin deposited over the run */
  totalDeposited: number
  /** Total ■ notional traded */
  totalTraded: number
  /** Total redeemed via ▢ */
  totalRedeemed: number
  elapsedSec: number
  activeFlow: ActiveFlow
  /** 0–1 pulse for viz */
  flowPulse: number
}

export function sumWeights(weights: Record<string, number>): number {
  return Object.values(weights).reduce((sum, value) => sum + value, 0)
}

export function normalizeLegWeights(legs: LegWeights): LegWeights {
  const total = sumWeights(legs)
  if (total <= 0) return { charm: 45, ajna: 45, idle: 10 }
  return {
    charm: (legs.charm / total) * 100,
    ajna: (legs.ajna / total) * 100,
    idle: (legs.idle / total) * 100,
  }
}

export function normalizeGaugeSplit(gauge: GaugeSplitWeights): GaugeSplitWeights {
  const total = sumWeights(gauge)
  if (total <= 0) return { burn: 40, jackpot: 30, creatorTreasury: 10, protocol: 20 }
  return {
    burn: (gauge.burn / total) * 100,
    jackpot: (gauge.jackpot / total) * 100,
    creatorTreasury: (gauge.creatorTreasury / total) * 100,
    protocol: (gauge.protocol / total) * 100,
  }
}

export function normalizeShareAllocation(
  allocation: ShareAllocationWeights,
): ShareAllocationWeights {
  const total = sumWeights(allocation)
  if (total <= 0) return { cca: 30, vesting: 30, solanaArm: 30, lpReserve: 10 }
  return {
    cca: (allocation.cca / total) * 100,
    vesting: (allocation.vesting / total) * 100,
    solanaArm: (allocation.solanaArm / total) * 100,
    lpReserve: (allocation.lpReserve / total) * 100,
  }
}

export function clampParams(params: CreatorVaultSimParams): CreatorVaultSimParams {
  return {
    depositRate: Math.max(0, params.depositRate),
    tradeActivity: Math.max(0, params.tradeActivity),
    tradingFeeBps: Math.min(2_000, Math.max(0, params.tradingFeeBps)),
    ccaThreshold: Math.max(1, params.ccaThreshold),
    wrapRatio: Math.min(1, Math.max(0, params.wrapRatio)),
    payoutInflowRate: Math.max(0, params.payoutInflowRate),
    legs: normalizeLegWeights(params.legs),
    gauge: normalizeGaugeSplit(params.gauge),
    shareAllocation: normalizeShareAllocation(params.shareAllocation),
  }
}

export function createInitialState(
  params: CreatorVaultSimParams = DEFAULT_PARAMS,
): CreatorVaultSimState {
  return {
    params: clampParams(params),
    paused: false,
    impairmentActive: false,
    vaultNav: 0,
    boxSupply: 0,
    oftCirculating: 0,
    ccaFilled: 0,
    ccaGraduated: false,
    vestingHeld: 0,
    solanaArmHeld: 0,
    lpReserveHeld: 0,
    charmTvl: 0,
    ajnaTvl: 0,
    idleTvl: 0,
    feesBurned: 0,
    jackpotReserve: 0,
    creatorTreasuryAccum: 0,
    protocolAccum: 0,
    payoutBurnStream: 0,
    totalDeposited: 0,
    totalTraded: 0,
    totalRedeemed: 0,
    elapsedSec: 0,
    activeFlow: 'idle',
    flowPulse: 0,
  }
}

export function sharePrice(state: CreatorVaultSimState): number {
  if (state.boxSupply <= 0) return 1
  return state.vaultNav / state.boxSupply
}

export function ccaProgress(state: CreatorVaultSimState): number {
  const threshold = state.params.ccaThreshold
  if (threshold <= 0) return 1
  return Math.min(1, state.ccaFilled / threshold)
}

export function legTvlTotal(state: CreatorVaultSimState): number {
  return state.charmTvl + state.ajnaTvl + state.idleTvl
}
