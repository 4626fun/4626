import { describe, expect, it } from 'vitest'

import {
  analyzeRaid,
  attackerKeysToPassVote,
  buyCostAfterFee,
  curveCost,
  curveDivisor,
  DEFAULT_DISTRIBUTION_POLICY,
  evaluateKeyDefense,
  keysToBuyForVeto,
  maxSafePotUsdc,
  minRaidproofExtraKeys,
  netPayoutFactor,
  poolFeeBaselineUsdc,
  poolFeeFraction,
  raidProfit,
  recoveryBreakdown,
  selfInsuranceHold,
  sellProceedsAfterFee,
  tradeFeeFraction,
  vetoHold,
} from './keyDefense'

describe('curve constants', () => {
  it('matches FriendRoomManager divisors', () => {
    expect(curveDivisor('trading', 'casual')).toBe(4000)
    expect(curveDivisor('trading', 'club')).toBe(40)
    expect(curveDivisor('trading', 'exclusive')).toBe(4)
    expect(curveDivisor('social', 'casual')).toBe(8000)
    expect(curveDivisor('social', 'club')).toBe(80)
    expect(curveDivisor('social', 'exclusive')).toBe(8)
  })

  it('matches room trade fees', () => {
    expect(tradeFeeFraction('trading')).toBe(0.1)
    expect(tradeFeeFraction('social')).toBe(0.04)
  })

  it('default policy nets 0.72 of the pot', () => {
    expect(netPayoutFactor(DEFAULT_DISTRIBUTION_POLICY)).toBeCloseTo(0.72, 10)
  })

  it('pool fee fraction is 6% for trading rooms, 0 for social', () => {
    expect(poolFeeFraction('trading')).toBe(0.06)
    expect(poolFeeFraction('social')).toBe(0)
  })
})

describe('poolFeeBaselineUsdc', () => {
  it('golden: 30 keys on a Club trading room baseline ≈ $12.83', () => {
    // 6% of curveCost(0, 30, 40) = 0.06 · (Σ i² for i=0..29)/40 = 0.06 · 213.875
    expect(poolFeeBaselineUsdc('trading', 'club', 30)).toBeCloseTo(12.8325, 10)
  })

  it('is zero for social rooms and for zero supply', () => {
    expect(poolFeeBaselineUsdc('social', 'club', 30)).toBe(0)
    expect(poolFeeBaselineUsdc('trading', 'club', 0)).toBe(0)
  })

  it('grows with supply and tier steepness', () => {
    expect(poolFeeBaselineUsdc('trading', 'exclusive', 30)).toBeGreaterThan(
      poolFeeBaselineUsdc('trading', 'club', 30),
    )
    expect(poolFeeBaselineUsdc('trading', 'club', 60)).toBeGreaterThan(
      poolFeeBaselineUsdc('trading', 'club', 30),
    )
  })
})

describe('bonding curve pricing', () => {
  it('first key is free, second costs 1/d', () => {
    expect(curveCost(0, 1, 40)).toBe(0)
    expect(curveCost(1, 1, 40)).toBeCloseTo(0.025, 10)
  })

  it('golden: 5 keys from supply 30 on a Club trading room cost 128.25 raw', () => {
    // (Σ i² for i=30..34) / 40 = (13685 − 8555) / 40
    expect(curveCost(30, 5, 40)).toBeCloseTo(128.25, 10)
    expect(buyCostAfterFee(30, 5, 40, 0.1)).toBeCloseTo(141.075, 10)
  })

  it('sell returns the curve cost of the lower span minus fee', () => {
    // Selling 5 keys at supply 35 returns curveCost(30, 5) · 0.9
    expect(sellProceedsAfterFee(35, 5, 40, 0.1)).toBeCloseTo(115.425, 10)
  })

  it('buy then sell round trip loses exactly the two fee legs', () => {
    const raw = curveCost(30, 5, 40)
    const buy = buyCostAfterFee(30, 5, 40, 0.1)
    const sell = sellProceedsAfterFee(35, 5, 40, 0.1)
    expect(buy - sell).toBeCloseTo(2 * 0.1 * raw, 10)
  })
})

describe('veto math', () => {
  it('veto hold is floor(S/2)+1 at the default 50% threshold', () => {
    expect(vetoHold(30)).toBe(16)
    expect(vetoHold(31)).toBe(16)
    expect(vetoHold(1)).toBe(1)
  })

  it('keys to buy for veto accounts for supply growth from your own buys', () => {
    // S=30, k=10: need g > S − 2k = 10 → 11 keys.
    expect(keysToBuyForVeto(30, 10)).toBe(11)
    // Verify boundary: hostile 20 < 0.5·(30+11) but not < 0.5·(30+10).
    expect(20).toBeLessThan(0.5 * 41)
    expect(20).not.toBeLessThan(0.5 * 40)
    expect(keysToBuyForVeto(30, 16)).toBe(0)
  })

  it('attacker keys to pass vote is max(0, 2k − S) at 50%', () => {
    expect(attackerKeysToPassVote(30, 16)).toBe(2)
    expect(attackerKeysToPassVote(30, 15)).toBe(0)
    expect(attackerKeysToPassVote(30, 10)).toBe(0)
  })
})

describe('raid economics', () => {
  const scenario = {
    roomType: 'trading',
    roomTier: 'club',
    keySupply: 30,
    yourKeys: 16,
    potUsdc: 5000,
  } as const

  it('golden: 2-key raid on S=30/k=16/B=$5k Club trading room', () => {
    const point = raidProfit(scenario, 2)
    // raw cost = (900+961)/40 = 46.525
    // buy adds pool fee = 0.06·46.525 = 2.7915 to pot before distribution
    // payout = 0.72·(5000 + 2.7915)·(2/32) = 225.1256...
    // fees sunk = 0.2·46.525 = 9.305
    expect(point.payoutUsdc).toBeCloseTo(225.1256175, 10)
    expect(point.feeCostUsdc).toBeCloseTo(9.305, 10)
    expect(point.profitUsdc).toBeCloseTo(215.8206175, 10)
  })

  it('includes fee-generated pot uplift for trading raids only', () => {
    const trading = raidProfit(
      {
        roomType: 'trading',
        roomTier: 'club',
        keySupply: 30,
        yourKeys: 16,
        potUsdc: 5_000,
      },
      2,
    )
    const social = raidProfit(
      {
        roomType: 'social',
        roomTier: 'club',
        keySupply: 30,
        yourKeys: 16,
        potUsdc: 5_000,
      },
      2,
    )

    expect(trading.payoutUsdc).toBeGreaterThan(social.payoutUsdc)
  })

  it('finds the profitable raid and reports min attack size', () => {
    const analysis = analyzeRaid(scenario)
    expect(analysis.minAttackKeys).toBe(2)
    expect(analysis.raidUnprofitable).toBe(false)
    expect(analysis.bestAttack).not.toBeNull()
    expect(analysis.bestAttack!.profitUsdc).toBeGreaterThanOrEqual(215.69)
    expect(analysis.curve.length).toBeGreaterThan(0)
  })

  it('empty pot is never raidable', () => {
    const analysis = analyzeRaid({ ...scenario, potUsdc: 0 })
    expect(analysis.raidUnprofitable).toBe(true)
    expect(analysis.bestAttack).toBeNull()
  })

  it('raidproof extra keys makes the raid unprofitable when reachable', () => {
    const tiny = { ...scenario, potUsdc: 50 }
    const extra = minRaidproofExtraKeys(tiny)
    expect(extra).not.toBeNull()
    const fixed = analyzeRaid({
      ...tiny,
      keySupply: tiny.keySupply + extra!,
      yourKeys: tiny.yourKeys + extra!,
    })
    expect(fixed.raidUnprofitable).toBe(true)
  })

  it('max safe pot is the raidability boundary', () => {
    const holdings = {
      roomType: 'trading',
      roomTier: 'club',
      keySupply: 30,
      yourKeys: 16,
    } as const
    const safePot = maxSafePotUsdc(holdings)
    expect(safePot).toBeGreaterThan(0)
    expect(analyzeRaid({ ...holdings, potUsdc: safePot }, 1).raidUnprofitable).toBe(true)
    expect(analyzeRaid({ ...holdings, potUsdc: safePot * 1.05 + 1 }, 1).raidUnprofitable).toBe(
      false,
    )
  })
})

describe('self-insurance', () => {
  it('golden: recover 50% of a $1k donation with 20 hostile staked keys', () => {
    // netPot = 720, target = 500 → k ≥ 20·500/220 = 45.45 → 46
    const result = selfInsuranceHold({
      potUsdc: 0,
      donationUsdc: 1000,
      stakedOtherKeys: 20,
      targetRecoveryFraction: 0.5,
    })
    expect(result.requiredKeys).toBe(46)
    expect(result.maxAchievableRecoveryFraction).toBeCloseTo(0.72, 10)
  })

  it('full recovery of a fresh donation is structurally impossible', () => {
    const result = selfInsuranceHold({
      potUsdc: 0,
      donationUsdc: 1000,
      stakedOtherKeys: 20,
      targetRecoveryFraction: 1,
    })
    expect(result.requiredKeys).toBeNull()
    expect(result.maxAchievableRecoveryFraction).toBeCloseTo(0.72, 10)
  })

  it('a large pre-existing pot can subsidize full recovery', () => {
    // netPot = 0.72·11000 = 7920 ≥ 1000 → recoverable with enough keys.
    const result = selfInsuranceHold({
      potUsdc: 10_000,
      donationUsdc: 1000,
      stakedOtherKeys: 20,
      targetRecoveryFraction: 1,
    })
    expect(result.requiredKeys).not.toBeNull()
    expect(result.requiredKeys).toBeGreaterThan(0)
  })
})

describe('recovery breakdown', () => {
  it('golden: S=30, k=16 staked, B=$4k + $1k donation, 14 hostile staked keys', () => {
    const result = recoveryBreakdown({
      roomType: 'trading',
      roomTier: 'club',
      keySupply: 30,
      yourKeys: 16,
      potUsdc: 4000,
      donationUsdc: 1000,
      stakedOtherKeys: 14,
    })
    // payout = 0.72·5000·(16/30) = 1920
    expect(result.distributionPayoutUsdc).toBeCloseTo(1920, 8)
    // key sale = curveCost(14, 16, 40)·0.9 = (8555 − 819)/40·0.9 = 174.06
    expect(result.keySaleValueUsdc).toBeCloseTo(174.06, 8)
    expect(result.totalUsdc).toBeCloseTo(2094.06, 8)
    expect(result.donationRecoveryFraction).toBeCloseTo(1.92, 8)
  })
})

describe('evaluateKeyDefense verdicts', () => {
  it('social rooms are not-applicable (no staking pool / trading fund)', () => {
    const result = evaluateKeyDefense({
      roomType: 'social',
      roomTier: 'club',
      keySupply: 30,
      yourKeys: 10,
      potUsdc: 0,
      donationUsdc: 0,
    })
    expect(result.verdict).toBe('not-applicable')
  })

  it('safe: veto held and raids unprofitable', () => {
    const result = evaluateKeyDefense({
      roomType: 'trading',
      roomTier: 'club',
      keySupply: 10,
      yourKeys: 9,
      potUsdc: 1,
      donationUsdc: 0,
    })
    expect(result.hasVeto).toBe(true)
    expect(result.raid.raidUnprofitable).toBe(true)
    expect(result.verdict).toBe('safe')
  })

  it('economically protected: no veto but raids unprofitable', () => {
    const result = evaluateKeyDefense({
      roomType: 'trading',
      roomTier: 'club',
      keySupply: 30,
      yourKeys: 10,
      potUsdc: 10,
      donationUsdc: 0,
    })
    expect(result.hasVeto).toBe(false)
    expect(result.raid.raidUnprofitable).toBe(true)
    expect(result.verdict).toBe('economically-protected')
  })

  it('at risk: profitable raid exists, with a raid-proof key target', () => {
    const result = evaluateKeyDefense({
      roomType: 'trading',
      roomTier: 'club',
      keySupply: 30,
      yourKeys: 10,
      potUsdc: 5000,
      donationUsdc: 0,
    })
    expect(result.verdict).toBe('at-risk')
    expect(result.raid.bestAttack).not.toBeNull()
    expect(result.raid.bestAttack!.profitUsdc).toBeGreaterThan(0)
  })

  it('clamps your keys to the supply and defaults hostile staked keys to S − k', () => {
    const result = evaluateKeyDefense({
      roomType: 'trading',
      roomTier: 'club',
      keySupply: 10,
      yourKeys: 25,
      potUsdc: 100,
      donationUsdc: 0,
    })
    expect(result.hasVeto).toBe(true)
    expect(result.recovery.distributionPayoutUsdc).toBeCloseTo(0.72 * 100, 8)
  })
})
