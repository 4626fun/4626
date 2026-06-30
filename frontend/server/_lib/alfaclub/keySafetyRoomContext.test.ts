import { describe, expect, it } from 'vitest'

import { computeHostKeyShare } from './alfaclubStakeReads.js'
import {
  combineTreasuryTotalUsd,
  resolveAttackModelPotUsdc,
  resolveSuggestedPotUsdc,
  resolveTreasuryWallet,
} from './keySafetyRoomContext.js'

describe('computeHostKeyShare', () => {
  it('sums wallet and staked host keys for ownership share', () => {
    expect(
      computeHostKeyShare({
        keySupply: 30,
        hostWalletKeys: 2,
        hostStakedKeys: 4,
      }),
    ).toEqual({
      hostKeys: 6,
      hostSharePercent: 20,
      stakeRatioPercent: 13,
    })
  })

  it('counts staked-only host keys when wallet balance is zero', () => {
    expect(
      computeHostKeyShare({
        keySupply: 25,
        hostWalletKeys: 0,
        hostStakedKeys: 5,
      }),
    ).toEqual({
      hostKeys: 5,
      hostSharePercent: 20,
      stakeRatioPercent: 20,
    })
  })
})

describe('resolveSuggestedPotUsdc', () => {
  it('prefers DeBank-style treasury total when available', () => {
    expect(
      resolveSuggestedPotUsdc({
        distributionPotUsdc: 120,
        feeBaselinePotUsdc: 12,
        totalTreasuryUsdc: 4030,
      }),
    ).toEqual({ suggestedPotUsdc: 4030, potSource: 'treasury' })
  })

  it('falls back to distribution fund when treasury is missing', () => {
    expect(
      resolveSuggestedPotUsdc({
        distributionPotUsdc: 657.42,
        feeBaselinePotUsdc: 12,
        totalTreasuryUsdc: null,
      }),
    ).toEqual({ suggestedPotUsdc: 657.42, potSource: 'distribution_fund' })
  })

  it('uses fee baseline when no live balances exist', () => {
    expect(
      resolveSuggestedPotUsdc({
        distributionPotUsdc: null,
        feeBaselinePotUsdc: 100.09,
        totalTreasuryUsdc: null,
      }),
    ).toEqual({ suggestedPotUsdc: 100.09, potSource: 'fee_baseline' })
  })
})

describe('resolveAttackModelPotUsdc', () => {
  it('prefers live trading fund treasury over snapshot fund and fee baseline', () => {
    expect(
      resolveAttackModelPotUsdc({
        distributionPotUsdc: 657.42,
        feeBaselinePotUsdc: 100.09,
        totalTreasuryUsdc: 9574.54,
      }),
    ).toEqual({ attackModelPotUsdc: 9574.54, attackPotSource: 'treasury' })
  })

  it('prefers snapshot distribution fund over fee baseline when treasury is missing', () => {
    expect(
      resolveAttackModelPotUsdc({
        distributionPotUsdc: 657.42,
        feeBaselinePotUsdc: 100.09,
        totalTreasuryUsdc: null,
      }),
    ).toEqual({ attackModelPotUsdc: 657.42, attackPotSource: 'distribution_fund' })
  })

  it('uses fee baseline when snapshot fund and treasury are missing', () => {
    expect(
      resolveAttackModelPotUsdc({
        distributionPotUsdc: null,
        feeBaselinePotUsdc: 100.09,
        totalTreasuryUsdc: null,
      }),
    ).toEqual({ attackModelPotUsdc: 100.09, attackPotSource: 'fee_baseline' })
  })
})

describe('resolveTreasuryWallet', () => {
  const creator = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
  const appWallet = '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2'

  it('prefers an explicit override above all other sources', () => {
    expect(
      resolveTreasuryWallet({
        tradingWalletOverride: appWallet,
        envMapWallet: '0x1111111111111111111111111111111111111111',
        snapshotTradingWallet: '0x2222222222222222222222222222222222222222',
        appWalletFromProfile: null,
        creatorAddress: creator,
      }),
    ).toEqual({ address: appWallet, source: 'override' })
  })

  it('uses the env map when no override and no snapshot wallet exist', () => {
    expect(
      resolveTreasuryWallet({
        tradingWalletOverride: null,
        envMapWallet: appWallet,
        snapshotTradingWallet: null,
        appWalletFromProfile: null,
        creatorAddress: creator,
      }),
    ).toEqual({ address: appWallet, source: 'override' })
  })

  it('falls back to the creator only when no trading wallet is known', () => {
    expect(
      resolveTreasuryWallet({
        tradingWalletOverride: null,
        envMapWallet: null,
        snapshotTradingWallet: null,
        appWalletFromProfile: creator,
        creatorAddress: creator,
      }),
    ).toEqual({ address: creator, source: 'creator_fallback' })
  })
})

describe('combineTreasuryTotalUsd', () => {
  it('sums on-chain wallet and Hyperliquid account value', () => {
    expect(combineTreasuryTotalUsd(89.12, 9574.54)).toBeCloseTo(9663.66, 2)
  })

  it('uses whichever source is available when only one is present', () => {
    expect(combineTreasuryTotalUsd(null, 9574.54)).toBe(9574.54)
    expect(combineTreasuryTotalUsd(89.12, null)).toBe(89.12)
  })
})
