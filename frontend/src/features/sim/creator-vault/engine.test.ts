import { describe, expect, it } from 'vitest'

import { DEFAULT_PARAMS, DEFAULT_LEG_WEIGHTS, DEFAULT_SHARE_ALLOCATION } from './defaults'
import {
  resetSim,
  setImpairment,
  setParams,
  setPaused,
  stressRedeem,
  tick,
} from './engine'
import {
  ccaProgress,
  createInitialState,
  legTvlTotal,
  normalizeLegWeights,
  normalizeShareAllocation,
  sharePrice,
  sumWeights,
} from './model'

describe('creator vault sim model', () => {
  it('keeps canonical share allocation at 30/30/30/10', () => {
    const alloc = normalizeShareAllocation(DEFAULT_SHARE_ALLOCATION)
    expect(alloc.cca).toBeCloseTo(30)
    expect(alloc.vesting).toBeCloseTo(30)
    expect(alloc.solanaArm).toBeCloseTo(30)
    expect(alloc.lpReserve).toBeCloseTo(10)
    expect(sumWeights(alloc)).toBeCloseTo(100)
  })

  it('keeps leg weights at 45/45/10 and never treats Solana as a leg', () => {
    const legs = normalizeLegWeights(DEFAULT_LEG_WEIGHTS)
    expect(legs.charm).toBeCloseTo(45)
    expect(legs.ajna).toBeCloseTo(45)
    expect(legs.idle).toBeCloseTo(10)
    expect(sumWeights(legs)).toBeCloseTo(100)
    expect('solana' in legs).toBe(false)
  })
})

describe('creator vault sim engine', () => {
  it('mints ▢ and allocates NAV across legs on deposit ticks', () => {
    let state = createInitialState()
    state = tick(state, 1)
    expect(state.totalDeposited).toBeGreaterThan(0)
    expect(state.boxSupply).toBeCloseTo(state.totalDeposited)
    expect(state.vaultNav).toBeGreaterThan(0)
    expect(legTvlTotal(state)).toBeCloseTo(state.vaultNav, 0)
    expect(state.charmTvl / state.vaultNav).toBeCloseTo(0.45, 1)
    expect(state.ajnaTvl / state.vaultNav).toBeCloseTo(0.45, 1)
    expect(state.idleTvl / state.vaultNav).toBeCloseTo(0.1, 1)
  })

  it('fills share allocation buckets toward 30/30/30/10', () => {
    let state = createInitialState()
    state = tick(state, 2)
    const deposited = state.totalDeposited
    expect(state.ccaFilled / deposited).toBeCloseTo(0.3, 1)
    expect(state.vestingHeld / deposited).toBeCloseTo(0.3, 1)
    expect(state.solanaArmHeld / deposited).toBeCloseTo(0.3, 1)
    expect(state.lpReserveHeld / deposited).toBeCloseTo(0.1, 1)
  })

  it('wraps a portion of ▢ into ■ without equating ■ to redeem NAV alone', () => {
    let state = createInitialState({
      ...DEFAULT_PARAMS,
      wrapRatio: 0.5,
      depositRate: 100_000,
      tradeActivity: 0,
      payoutInflowRate: 0,
    })
    for (let i = 0; i < 40; i++) state = tick(state, 0.25)
    expect(state.oftCirculating).toBeGreaterThan(0)
    expect(state.oftCirculating).toBeLessThanOrEqual(state.boxSupply + 1e-6)
    expect(state.oftCirculating / state.boxSupply).toBeLessThanOrEqual(0.55)
  })

  it('graduates CCA when threshold is reached', () => {
    let state = createInitialState({
      ...DEFAULT_PARAMS,
      depositRate: 1_000_000,
      ccaThreshold: 100_000,
      tradeActivity: 0,
      payoutInflowRate: 0,
    })
    for (let i = 0; i < 20; i++) state = tick(state, 0.5)
    expect(state.ccaGraduated).toBe(true)
    expect(ccaProgress(state)).toBe(1)
  })

  it('routes trade fees through gauge and keeps payout lane separate', () => {
    let state = createInitialState({
      ...DEFAULT_PARAMS,
      depositRate: 200_000,
      tradeActivity: 5,
      tradingFeeBps: 200,
      payoutInflowRate: 1_000,
      wrapRatio: 0.8,
    })
    for (let i = 0; i < 60; i++) state = tick(state, 0.2)
    const gaugeTotal =
      state.feesBurned + state.jackpotReserve + state.creatorTreasuryAccum + state.protocolAccum
    expect(gaugeTotal).toBeGreaterThan(0)
    expect(state.payoutBurnStream).toBeGreaterThan(0)
    // Payout burn stream must not be counted inside gauge totals
    expect(gaugeTotal).not.toBeCloseTo(state.payoutBurnStream)
  })

  it('blocks redeem while impairment is active', () => {
    let state = createInitialState({
      ...DEFAULT_PARAMS,
      depositRate: 100_000,
      tradeActivity: 0,
      payoutInflowRate: 0,
    })
    state = tick(state, 2)
    const before = state.boxSupply
    state = setImpairment(state, true)
    state = stressRedeem(state, before * 0.1)
    expect(state.boxSupply).toBeCloseTo(before)
    expect(state.activeFlow).toBe('impairment')
  })

  it('stress redeem reduces ▢ supply and NAV when healthy', () => {
    let state = createInitialState({
      ...DEFAULT_PARAMS,
      depositRate: 100_000,
      tradeActivity: 0,
      payoutInflowRate: 0,
      wrapRatio: 0.6,
    })
    for (let i = 0; i < 20; i++) state = tick(state, 0.5)
    const navBefore = state.vaultNav
    const boxBefore = state.boxSupply
    state = stressRedeem(state, boxBefore * 0.05)
    expect(state.boxSupply).toBeLessThan(boxBefore)
    expect(state.vaultNav).toBeLessThan(navBefore)
    expect(state.totalRedeemed).toBeGreaterThan(0)
    expect(sharePrice(state)).toBeGreaterThan(0)
  })

  it('pause freezes economic progress', () => {
    let state = createInitialState()
    state = tick(state, 1)
    const snapshot = { ...state }
    state = setPaused(state, true)
    state = tick(state, 2)
    expect(state.totalDeposited).toBeCloseTo(snapshot.totalDeposited)
    expect(state.boxSupply).toBeCloseTo(snapshot.boxSupply)
  })

  it('reset clears accumulated counters', () => {
    let state = createInitialState()
    state = tick(state, 3)
    state = resetSim()
    expect(state.vaultNav).toBe(0)
    expect(state.boxSupply).toBe(0)
    expect(state.feesBurned).toBe(0)
    expect(state.ccaGraduated).toBe(false)
  })

  it('rebalances legs when weights change via setParams', () => {
    let state = createInitialState()
    state = tick(state, 2)
    state = setParams(state, {
      ...state.params,
      legs: { charm: 70, ajna: 20, idle: 10 },
    })
    expect(state.charmTvl / state.vaultNav).toBeCloseTo(0.7, 1)
    expect(state.ajnaTvl / state.vaultNav).toBeCloseTo(0.2, 1)
  })
})
