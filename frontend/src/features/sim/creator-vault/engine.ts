import { DEFAULT_PARAMS, type CreatorVaultSimParams } from './defaults'
import {
  clampParams,
  createInitialState,
  type ActiveFlow,
  type CreatorVaultSimState,
  legTvlTotal,
} from './model'

function allocateLegs(
  state: CreatorVaultSimState,
  amount: number,
): Pick<CreatorVaultSimState, 'charmTvl' | 'ajnaTvl' | 'idleTvl'> {
  const legs = state.params.legs
  return {
    charmTvl: state.charmTvl + (amount * legs.charm) / 100,
    ajnaTvl: state.ajnaTvl + (amount * legs.ajna) / 100,
    idleTvl: state.idleTvl + (amount * legs.idle) / 100,
  }
}

function rebalanceLegsToNav(state: CreatorVaultSimState): CreatorVaultSimState {
  const nav = Math.max(0, state.vaultNav)
  const legs = state.params.legs
  return {
    ...state,
    charmTvl: (nav * legs.charm) / 100,
    ajnaTvl: (nav * legs.ajna) / 100,
    idleTvl: (nav * legs.idle) / 100,
  }
}

function applyGauge(
  state: CreatorVaultSimState,
  feeAmount: number,
): CreatorVaultSimState {
  if (feeAmount <= 0) return state
  const g = state.params.gauge
  return {
    ...state,
    feesBurned: state.feesBurned + (feeAmount * g.burn) / 100,
    jackpotReserve: state.jackpotReserve + (feeAmount * g.jackpot) / 100,
    creatorTreasuryAccum: state.creatorTreasuryAccum + (feeAmount * g.creatorTreasury) / 100,
    protocolAccum: state.protocolAccum + (feeAmount * g.protocol) / 100,
  }
}

function withFlow(
  state: CreatorVaultSimState,
  activeFlow: ActiveFlow,
  pulse = 1,
): CreatorVaultSimState {
  return { ...state, activeFlow, flowPulse: pulse }
}

export function setPaused(state: CreatorVaultSimState, paused: boolean): CreatorVaultSimState {
  return { ...state, paused }
}

export function setParams(
  state: CreatorVaultSimState,
  params: CreatorVaultSimParams,
): CreatorVaultSimState {
  const next = { ...state, params: clampParams(params) }
  return rebalanceLegsToNav(next)
}

export function resetSim(params: CreatorVaultSimParams = DEFAULT_PARAMS): CreatorVaultSimState {
  return createInitialState(params)
}

/** Freeze deposit/redeem (impairment / Suspect teaching control). */
export function setImpairment(
  state: CreatorVaultSimState,
  impairmentActive: boolean,
): CreatorVaultSimState {
  return withFlow(
    { ...state, impairmentActive },
    impairmentActive ? 'impairment' : 'idle',
    impairmentActive ? 1 : 0,
  )
}

/**
 * Stress redeem: burn ▢ and pull creator coin from idle first, then legs.
 * Blocked when impairment is active.
 */
export function stressRedeem(
  state: CreatorVaultSimState,
  shareAmount: number,
): CreatorVaultSimState {
  if (state.impairmentActive || shareAmount <= 0 || state.boxSupply <= 0) {
    return withFlow(state, state.impairmentActive ? 'impairment' : 'idle')
  }

  const redeemShares = Math.min(shareAmount, state.boxSupply, state.oftCirculating * 0.35 + state.idleTvl)
  if (redeemShares <= 0) return state

  const price = state.boxSupply > 0 ? state.vaultNav / state.boxSupply : 1
  const assetOut = redeemShares * price
  const nextNav = Math.max(0, state.vaultNav - assetOut)
  const nextBox = Math.max(0, state.boxSupply - redeemShares)
  const nextOft = Math.max(0, state.oftCirculating - Math.min(state.oftCirculating, redeemShares * 0.4))

  let next: CreatorVaultSimState = {
    ...state,
    vaultNav: nextNav,
    boxSupply: nextBox,
    oftCirculating: nextOft,
    totalRedeemed: state.totalRedeemed + assetOut,
  }
  next = rebalanceLegsToNav(next)
  return withFlow(next, 'redeem', 1)
}

export function tick(state: CreatorVaultSimState, dtSec: number): CreatorVaultSimState {
  if (state.paused || dtSec <= 0) {
    return {
      ...state,
      flowPulse: Math.max(0, state.flowPulse - dtSec * 2),
      activeFlow: state.flowPulse <= 0.05 ? (state.impairmentActive ? 'impairment' : 'idle') : state.activeFlow,
    }
  }

  let next = { ...state, elapsedSec: state.elapsedSec + dtSec }
  let flow: ActiveFlow = 'idle'

  // 1) Deposit creator coin → mint ▢ 1:1 (sim simplification) → allocate launch buckets + legs
  if (!next.impairmentActive && next.params.depositRate > 0) {
    const deposit = next.params.depositRate * dtSec
    if (deposit > 0) {
      const alloc = next.params.shareAllocation
      const toCca = (deposit * alloc.cca) / 100
      const toVesting = (deposit * alloc.vesting) / 100
      const toSolana = (deposit * alloc.solanaArm) / 100
      const toLp = (deposit * alloc.lpReserve) / 100

      next = {
        ...next,
        vaultNav: next.vaultNav + deposit,
        boxSupply: next.boxSupply + deposit,
        totalDeposited: next.totalDeposited + deposit,
        ccaFilled: next.ccaFilled + toCca,
        vestingHeld: next.vestingHeld + toVesting,
        solanaArmHeld: next.solanaArmHeld + toSolana,
        lpReserveHeld: next.lpReserveHeld + toLp,
      }
      next = { ...next, ...allocateLegs(next, deposit) }
      // Keep legs consistent with NAV after allocation drift
      next = rebalanceLegsToNav(next)
      flow = 'deposit'
    }
  }

  // 2) Wrap ▢ → ■ for trading (economic teaching: ■ ≠ redeem NAV by itself)
  if (next.boxSupply > 0 && next.params.wrapRatio > 0) {
    const targetOft = next.boxSupply * next.params.wrapRatio
    const wrapGap = targetOft - next.oftCirculating
    if (wrapGap > 1) {
      const wrapAmt = Math.min(wrapGap, next.boxSupply * 0.08 * dtSec + wrapGap * 0.15 * dtSec)
      next = {
        ...next,
        oftCirculating: next.oftCirculating + wrapAmt,
      }
      flow = flow === 'idle' ? 'wrap' : flow
    }
  }

  // 3) CCA progress / graduation
  if (!next.ccaGraduated) {
    if (next.ccaFilled >= next.params.ccaThreshold) {
      next = { ...next, ccaGraduated: true, ccaFilled: next.params.ccaThreshold }
      flow = 'cca'
    } else if (next.ccaFilled > 0) {
      flow = flow === 'idle' ? 'cca' : flow
    }
  }

  // 4) ■ trading → tradeFeeCollector → gauge splits (not payout lane)
  if (next.oftCirculating > 0 && next.params.tradeActivity > 0) {
    const tradeNotional =
      next.params.tradeActivity * dtSec * Math.max(5_000, next.oftCirculating * 0.002)
    const fee = (tradeNotional * next.params.tradingFeeBps) / 10_000
    next = {
      ...next,
      totalTraded: next.totalTraded + tradeNotional,
    }
    next = applyGauge(next, fee)
    // Mild NAV accretion from burn lane (PPS teaching signal)
    const burnAccretion = (fee * next.params.gauge.burn) / 100 * 0.25
    if (burnAccretion > 0) {
      next = { ...next, vaultNav: next.vaultNav + burnAccretion }
      next = rebalanceLegsToNav(next)
    }
    if (fee > 0) flow = 'tradeFee'
  }

  // 5) External creator-coin earnings → PayoutRouter burn stream (separate lane)
  if (next.params.payoutInflowRate > 0) {
    const payout = next.params.payoutInflowRate * dtSec
    next = {
      ...next,
      payoutBurnStream: next.payoutBurnStream + payout,
      // Burn stream accretes holder PPS without going through tradeFeeCollector
      vaultNav: next.vaultNav + payout * 0.85,
    }
    next = rebalanceLegsToNav(next)
    if (payout > 0 && flow === 'idle') flow = 'payout'
  }

  // 6) Solana arm pulse when holding bridged ■ allocation
  if (next.solanaArmHeld > 0 && flow === 'idle' && Math.sin(next.elapsedSec * 0.7) > 0.85) {
    flow = 'solanaArm'
  } else if (legTvlTotal(next) > 0 && flow === 'idle' && Math.sin(next.elapsedSec * 1.1) > 0.9) {
    flow = 'legs'
  }

  if (next.impairmentActive) flow = 'impairment'

  const pulseDecay = Math.max(0, next.flowPulse - dtSec * 1.2)
  const pulse = flow === 'idle' ? pulseDecay : Math.min(1, pulseDecay + 0.55)

  return withFlow(next, flow, pulse)
}

export type { CreatorVaultSimParams, CreatorVaultSimState }
