/**
 * AlfaClub key-defense math.
 *
 * Models the FriendKey bonding curve (FriendDotSpace/contracts:
 * `BondingCurveLib.sol`, `FriendKeyV2.sol`, `FriendRoomManager.sol`) plus the
 * AlfaClub app-layer distribution rules (66%-of-all-keys vote, 24h stake lock,
 * performance fees, 10% reserve) to answer: how many of your own room keys
 * should you hold/stake so others cannot profitably dissolve the room and
 * walk away with the trading fund you donated to.
 *
 * All app-layer constants (vote threshold, perf fees, reserve) are
 * parameterized via {@link DistributionPolicy} so they can be retuned if
 * AlfaClub changes policy. On-chain curve constants (divisors, trade fees)
 * mirror the deployed contracts.
 *
 * Conservative worst case modeled throughout: every key you do not hold is
 * hostile and staked >24h (eligible to vote distribute and to be paid).
 */

export type AlfaRoomType = 'trading' | 'social'
export type AlfaRoomTier = 'casual' | 'club' | 'exclusive'

/** Bonding curve divisor `d`: key #i costs `i² / d` USDC. */
export function curveDivisor(roomType: AlfaRoomType, roomTier: AlfaRoomTier): number {
  switch (roomType) {
    case 'trading':
      switch (roomTier) {
        case 'casual':
          return 4000
        case 'club':
          return 40
        case 'exclusive':
          return 4
        default: {
          const exhaustive: never = roomTier
          throw new Error(`Unknown room tier: ${String(exhaustive)}`)
        }
      }
    case 'social':
      switch (roomTier) {
        case 'casual':
          return 8000
        case 'club':
          return 80
        case 'exclusive':
          return 8
        default: {
          const exhaustive: never = roomTier
          throw new Error(`Unknown room tier: ${String(exhaustive)}`)
        }
      }
    default: {
      const exhaustive: never = roomType
      throw new Error(`Unknown room type: ${String(exhaustive)}`)
    }
  }
}

/** Total trade fee fraction each way (dev + creator + pool). */
export function tradeFeeFraction(roomType: AlfaRoomType): number {
  switch (roomType) {
    case 'trading':
      return 0.1 // 2% dev + 2% creator + 6% pool
    case 'social':
      return 0.04 // 2% dev + 2% creator, no pool fee
    default: {
      const exhaustive: never = roomType
      throw new Error(`Unknown room type: ${String(exhaustive)}`)
    }
  }
}

/** Fraction of each trade routed to the room's staking pool (the pot). */
export function poolFeeFraction(roomType: AlfaRoomType): number {
  switch (roomType) {
    case 'trading':
      return 0.06
    case 'social':
      return 0 // no staking pool / trading fund
    default: {
      const exhaustive: never = roomType
      throw new Error(`Unknown room type: ${String(exhaustive)}`)
    }
  }
}

/**
 * Baseline trading-fund estimate for a room: the pool fees accrued from the
 * buys that put the current key supply into circulation — 6% of the curve
 * cost of keys 0..S−1 for trading rooms (0 for social rooms).
 */
export function poolFeeBaselineUsdc(
  roomType: AlfaRoomType,
  roomTier: AlfaRoomTier,
  keySupply: number,
): number {
  return (
    poolFeeFraction(roomType) * curveCost(0, keySupply, curveDivisor(roomType, roomTier))
  )
}

/** AlfaClub app-layer distribution policy (retunable defaults). */
export type DistributionPolicy = {
  /** Distribute-votes needed as a fraction of ALL keys (staked + unstaked). */
  voteThresholdFraction: number
  /** Fraction of post-fee funds kept as trading reserve. */
  reserveFraction: number
  /** Creator performance fee fraction of the pot. */
  creatorPerformanceFeeFraction: number
  /** Protocol performance fee fraction of the pot. */
  protocolPerformanceFeeFraction: number
}

export const DEFAULT_DISTRIBUTION_POLICY: DistributionPolicy = {
  voteThresholdFraction: 0.66,
  reserveFraction: 0.1,
  creatorPerformanceFeeFraction: 0.15,
  protocolPerformanceFeeFraction: 0.05,
}

/**
 * Fraction of the pot actually paid out to eligible stakers on distribution.
 * Default policy: (1 − 0.15 − 0.05) × (1 − 0.10) = 0.72.
 */
export function netPayoutFactor(policy: DistributionPolicy = DEFAULT_DISTRIBUTION_POLICY): number {
  const afterPerfFees =
    1 - policy.creatorPerformanceFeeFraction - policy.protocolPerformanceFeeFraction
  return Math.max(0, afterPerfFees) * Math.max(0, 1 - policy.reserveFraction)
}

// ---------------------------------------------------------------------------
// Bonding curve
// ---------------------------------------------------------------------------

/** Σ_{i=1}^{n} i² (0 for n ≤ 0). Safe in float for n ≤ ~150k. */
function sumOfSquares(n: number): number {
  if (n <= 0) return 0
  return (n * (n + 1) * (2 * n + 1)) / 6
}

/**
 * Raw curve cost (before fees, in USDC) to buy `amount` keys starting at
 * `supply` existing keys: Σ_{i=supply}^{supply+amount−1} i² / d.
 * Matches `BondingCurveLib.getPrice` semantics (key #0 is free).
 */
export function curveCost(supply: number, amount: number, divisor: number): number {
  if (amount <= 0) return 0
  const s = Math.max(0, Math.floor(supply))
  const a = Math.floor(amount)
  return (sumOfSquares(s + a - 1) - sumOfSquares(s - 1)) / divisor
}

/** Cost including buy-side trade fee. */
export function buyCostAfterFee(
  supply: number,
  amount: number,
  divisor: number,
  feeFraction: number,
): number {
  return curveCost(supply, amount, divisor) * (1 + feeFraction)
}

/** Proceeds of selling `amount` keys from `supply`, net of sell-side fee. */
export function sellProceedsAfterFee(
  supply: number,
  amount: number,
  divisor: number,
  feeFraction: number,
): number {
  if (amount <= 0 || supply <= 0) return 0
  const a = Math.min(Math.floor(amount), Math.floor(supply))
  return curveCost(supply - a, a, divisor) * (1 - feeFraction)
}

// ---------------------------------------------------------------------------
// Veto math
// ---------------------------------------------------------------------------

/**
 * Minimum keys (of the CURRENT supply `S`) you must hold so existing holders
 * alone can never reach the vote threshold: k > (1 − T)·S.
 * For T = 0.66 this is floor(0.34·S) + 1.
 */
export function vetoHold(
  keySupply: number,
  policy: DistributionPolicy = DEFAULT_DISTRIBUTION_POLICY,
): number {
  const t = policy.voteThresholdFraction
  // Need S − k < T·S  ⟺  k > (1 − T)·S; smallest integer strictly above.
  return Math.floor((1 - t) * keySupply) + 1
}

/**
 * Keys you'd need to BUY (gap `g`) to gain veto, accounting for your buys
 * increasing total supply: hostile = S − k must stay below T·(S + g).
 * For T = 0.66: g > hostile/0.66 − S.
 */
export function keysToBuyForVeto(
  keySupply: number,
  yourKeys: number,
  policy: DistributionPolicy = DEFAULT_DISTRIBUTION_POLICY,
): number {
  const t = policy.voteThresholdFraction
  const hostile = keySupply - yourKeys
  if (hostile < t * keySupply) return 0
  // Smallest integer g with hostile < T·(S + g)  ⟺  g > hostile/T − S.
  return Math.max(0, Math.floor(hostile / t - keySupply) + 1)
}

/**
 * Minimum keys a SINGLE, uncoordinated attacker must buy to control the vote
 * threshold by themselves.
 *
 * We assume other holders are independent actors who do not coordinate with the
 * attacker, so the attacker cannot borrow anyone else's votes. They must dilute
 * the supply by minting fresh keys until the keys they personally control are
 * at least `T` of the new total:
 *
 *   (e + a) ≥ T·(S + a)   ⟺   a ≥ (T·S − e) / (1 − T)
 *
 * where S is the current supply, e is the keys the attacker already holds
 * (0 for a fresh outside buyer), and a is the keys they must buy. Because each
 * buy also inflates the denominator, the required buys grow steeply: for
 * T = 0.66 a fresh attacker on a 59-key room must buy 115 keys to reach 66%.
 *
 * Every key the attacker already owns lowers the requirement by 1/(1 − T) buys
 * (≈ 2.94 at T = 0.66), so an existing holder turning hostile needs fewer keys
 * than an outsider starting from zero.
 */
export function attackerKeysToPassVote(
  keySupply: number,
  attackerExistingKeys = 0,
  policy: DistributionPolicy = DEFAULT_DISTRIBUTION_POLICY,
): number {
  const t = policy.voteThresholdFraction
  const oneMinusT = 1 - t
  if (oneMinusT <= 0) return Number.POSITIVE_INFINITY
  const e = Math.max(0, Math.floor(attackerExistingKeys))
  const needed = (t * keySupply - e) / oneMinusT
  return Math.max(0, Math.ceil(needed - 1e-9))
}

// ---------------------------------------------------------------------------
// Raid economics
// ---------------------------------------------------------------------------

export type RaidScenarioInputs = {
  roomType: AlfaRoomType
  roomTier: AlfaRoomTier
  /** Current total key supply S (including your keys). */
  keySupply: number
  /** Keys you hold (and stake) that never vote distribute. */
  yourKeys: number
  /** Trading fund balance B in USDC at distribution time. */
  potUsdc: number
  /**
   * Keys the lone attacker already controls before this attack (default 0 for a
   * fresh outside buyer). An existing holder turning hostile starts with e > 0,
   * needs fewer buys to reach the threshold, and is paid out on all e + a keys.
   */
  attackerExistingKeys?: number
  policy?: DistributionPolicy
}

export type RaidPoint = {
  /** Keys the attacker buys fresh from the curve. */
  keysBought: number
  /** Room-fee USDC added to the pot by those attack buys before distribution. */
  poolFeeAddedUsdc: number
  /** Pot size right before distribution after attack-buy fees are added. */
  potSizeUsdc: number
  /** Distribution amount per key at this attack size. */
  distributedPerKeyUsdc: number
  /** Marginal buy cost (with buy fee) for the last key in this attack size. */
  marginalBuyCostPerKeyUsdc: number
  /** Average buy cost (with buy fee) across all bought keys. */
  averageBuyCostPerKeyUsdc: number
  /** Attacker payout from the distribution (their bought keys' share). */
  payoutUsdc: number
  /** Round-trip fee cost sunk on the curve (buy fee + sell fee legs). */
  feeCostUsdc: number
  /** payout − feeCost. */
  profitUsdc: number
}

/**
 * Worst-case profit for an outside attacker who buys `keysBought` keys,
 * stakes 24h, votes distribute (alongside every hostile existing key),
 * collects their pro-rata payout, then sells the keys back.
 *
 * Curve legs cancel (sell returns what the buy paid on the curve); the sunk
 * cost is the two fee legs ≈ 2φ·c(S, a). Payout counts only the BOUGHT keys'
 * share — existing holders' payouts are not attacker profit.
 *
 * Important: the attacker buy itself can increase the pot before distribution
 * through the room pool-fee lane (6% on trading rooms). That fee-generated
 * increment is included in payout math here.
 */
export function raidProfit(inputs: RaidScenarioInputs, keysBought: number): RaidPoint {
  const { roomType, roomTier, keySupply, potUsdc } = inputs
  const policy = inputs.policy ?? DEFAULT_DISTRIBUTION_POLICY
  const divisor = curveDivisor(roomType, roomTier)
  const fee = tradeFeeFraction(roomType)
  const poolFee = poolFeeFraction(roomType)
  const a = Math.max(0, Math.floor(keysBought))
  const existing = Math.max(0, Math.floor(inputs.attackerExistingKeys ?? 0))
  const rawCurveCost = curveCost(keySupply, a, divisor)
  const rawMarginalCurveCost = a > 0 ? curveCost(keySupply + a - 1, 1, divisor) : 0
  const buyCostWithFee = rawCurveCost * (1 + fee)
  const feeCostUsdc = 2 * fee * rawCurveCost
  const poolFeeAddedUsdc = poolFee * rawCurveCost
  const potAfterAttackBuy = Math.max(0, potUsdc) + poolFeeAddedUsdc
  const eligibleAfterBuy = keySupply + a // worst case: every key staked & eligible
  const distributedPerKeyUsdc =
    eligibleAfterBuy > 0 ? (netPayoutFactor(policy) * potAfterAttackBuy) / eligibleAfterBuy : 0
  // The attacker is paid on every key they control after the buy (e + a). Only
  // the freshly bought keys carry this attack's incremental round-trip fee.
  const payoutKeys = existing + a
  const payoutUsdc =
    payoutKeys > 0 && eligibleAfterBuy > 0 ? distributedPerKeyUsdc * payoutKeys : 0
  return {
    keysBought: a,
    poolFeeAddedUsdc,
    potSizeUsdc: potAfterAttackBuy,
    distributedPerKeyUsdc,
    marginalBuyCostPerKeyUsdc: rawMarginalCurveCost * (1 + fee),
    averageBuyCostPerKeyUsdc: a > 0 ? buyCostWithFee / a : 0,
    payoutUsdc,
    feeCostUsdc,
    profitUsdc: payoutUsdc - feeCostUsdc,
  }
}

export type RaidAnalysis = {
  /** Minimum keys an attacker must buy to pass the vote past your keys. */
  minAttackKeys: number
  /** Cost (after buy fee) of those minimum attack keys. */
  minAttackKeysCostUsdc: number
  /** Most profitable attack found, or null if no attack size is profitable. */
  bestAttack: RaidPoint | null
  /** True when no attack size yields positive profit. */
  raidUnprofitable: boolean
  /** Profit curve sampled from minAttackKeys upward (for charting). */
  curve: RaidPoint[]
}

const RAID_SCAN_HARD_CAP = 100_000

/**
 * Scans attack sizes from the minimum viable raid upward until fee cost alone
 * dominates the maximum possible payout envelope, reporting the best attack
 * and a chartable profit curve.
 */
export function analyzeRaid(inputs: RaidScenarioInputs, maxCurvePoints = 120): RaidAnalysis {
  const policy = inputs.policy ?? DEFAULT_DISTRIBUTION_POLICY
  const divisor = curveDivisor(inputs.roomType, inputs.roomTier)
  const fee = tradeFeeFraction(inputs.roomType)
  const poolFee = poolFeeFraction(inputs.roomType)
  const factor = netPayoutFactor(policy)
  const maxPayoutFromExistingPot = factor * Math.max(0, inputs.potUsdc)

  const attackerExisting = Math.max(0, Math.floor(inputs.attackerExistingKeys ?? 0))
  const minAttackKeys = Math.max(
    1,
    attackerKeysToPassVote(inputs.keySupply, attackerExisting, policy),
  )
  const minAttackKeysCostUsdc = buyCostAfterFee(inputs.keySupply, minAttackKeys, divisor, fee)

  let bestAttack: RaidPoint | null = null
  const sampled: RaidPoint[] = []
  let lastScanned = minAttackKeys
  for (let a = minAttackKeys; a <= minAttackKeys + RAID_SCAN_HARD_CAP; a += 1) {
    const point = raidProfit(inputs, a)
    lastScanned = a
    if (!bestAttack || point.profitUsdc > bestAttack.profitUsdc) bestAttack = point
    // Safe early-stop bound:
    // max profit <= payout(existing pot) + payout(from generated pool fees) - fee legs
    //            <= maxPayoutFromExistingPot + factor*poolFee*c(S,a) - 2*fee*c(S,a)
    //            = maxPayoutFromExistingPot - (2*fee - factor*poolFee)*c(S,a)
    // If this upper bound is already negative, larger attacks cannot recover.
    const rawCurveCost = curveCost(inputs.keySupply, a, divisor)
    const damping = 2 * fee - factor * poolFee
    if (damping > 0 && damping * rawCurveCost > maxPayoutFromExistingPot) break
  }

  // Sample the curve for charting: from minAttackKeys to a bit past where
  // profit goes (and stays) negative, capped at maxCurvePoints.
  const span = Math.max(1, lastScanned - minAttackKeys + 1)
  const step = Math.max(1, Math.ceil(span / maxCurvePoints))
  for (let a = minAttackKeys; a <= lastScanned; a += step) {
    sampled.push(raidProfit(inputs, a))
  }

  const raidUnprofitable = !bestAttack || bestAttack.profitUsdc <= 0
  return {
    minAttackKeys,
    minAttackKeysCostUsdc,
    bestAttack: bestAttack && bestAttack.profitUsdc > 0 ? bestAttack : null,
    raidUnprofitable,
    curve: sampled,
  }
}

const RAIDPROOF_GAP_SCAN_CAP = 5000

/**
 * Smallest number of EXTRA keys `g` you'd need to buy (raising both your
 * holding and the supply) so that no outside attack is profitable.
 * Returns null when not achievable within the scan cap.
 */
export function minRaidproofExtraKeys(inputs: RaidScenarioInputs): number | null {
  for (let g = 0; g <= RAIDPROOF_GAP_SCAN_CAP; g += 1) {
    const analysis = analyzeRaid(
      {
        ...inputs,
        keySupply: inputs.keySupply + g,
        yourKeys: inputs.yourKeys + g,
      },
      1, // best-attack only; skip chart sampling work
    )
    if (analysis.raidUnprofitable) return g
  }
  return null
}

/**
 * Largest pot B at which no outside raid is profitable for the given
 * holdings (binary search; raid profit is monotone increasing in B).
 */
export function maxSafePotUsdc(inputs: Omit<RaidScenarioInputs, 'potUsdc'>): number {
  let lo = 0
  let hi = 1_000_000_000
  if (analyzeRaid({ ...inputs, potUsdc: hi }, 1).raidUnprofitable) return hi
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2
    if (analyzeRaid({ ...inputs, potUsdc: mid }, 1).raidUnprofitable) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

// ---------------------------------------------------------------------------
// Self-insurance
// ---------------------------------------------------------------------------

export type SelfInsuranceInputs = {
  /** Trading fund balance before your donation. */
  potUsdc: number
  /** Your planned donation D added to the pot. */
  donationUsdc: number
  /** Eligible staked keys held by OTHERS at distribution time. */
  stakedOtherKeys: number
  /** Fraction r of the donation you want back from the payout alone. */
  targetRecoveryFraction: number
  policy?: DistributionPolicy
}

export type SelfInsuranceResult = {
  /** Minimum keys you must hold staked, or null when structurally impossible. */
  requiredKeys: number | null
  /** Highest recovery fraction approachable as your key count grows. */
  maxAchievableRecoveryFraction: number
}

/**
 * Minimum staked keys `k` so a distribution pays you back at least
 * r·D: netFactor·(B+D)·k/(E_others + k) ≥ r·D
 * ⟺ k ≥ E_others·r·D / (netFactor·(B+D) − r·D), impossible when the
 * denominator is ≤ 0 (each donated dollar returns at most netFactor× your
 * stake share — donations are never 100% recoverable from the payout alone
 * unless the pre-existing pot subsidizes you).
 */
export function selfInsuranceHold(inputs: SelfInsuranceInputs): SelfInsuranceResult {
  const policy = inputs.policy ?? DEFAULT_DISTRIBUTION_POLICY
  const factor = netPayoutFactor(policy)
  const potAfterDonation = Math.max(0, inputs.potUsdc) + Math.max(0, inputs.donationUsdc)
  const netPot = factor * potAfterDonation
  const target = inputs.targetRecoveryFraction * Math.max(0, inputs.donationUsdc)
  const maxAchievableRecoveryFraction =
    inputs.donationUsdc > 0 ? netPot / inputs.donationUsdc : Number.POSITIVE_INFINITY

  if (target <= 0) return { requiredKeys: 0, maxAchievableRecoveryFraction }
  const denominator = netPot - target
  if (denominator <= 0) return { requiredKeys: null, maxAchievableRecoveryFraction }
  if (inputs.stakedOtherKeys <= 0) return { requiredKeys: 1, maxAchievableRecoveryFraction }
  const required = (inputs.stakedOtherKeys * target) / denominator
  return {
    requiredKeys: Math.max(1, Math.ceil(required - 1e-9)),
    maxAchievableRecoveryFraction,
  }
}

export type RecoveryBreakdown = {
  /** What a distribution event would pay you (keys staked >24h). */
  distributionPayoutUsdc: number
  /** Net proceeds if you then sold all your keys back to the curve. */
  keySaleValueUsdc: number
  totalUsdc: number
  /** distributionPayout / donation (NaN-safe: 0 when no donation). */
  donationRecoveryFraction: number
}

export type RecoveryInputs = {
  roomType: AlfaRoomType
  roomTier: AlfaRoomTier
  keySupply: number
  yourKeys: number
  potUsdc: number
  donationUsdc: number
  stakedOtherKeys: number
  policy?: DistributionPolicy
}

/** What you'd actually get back if a distribution fired (worst-case framing). */
export function recoveryBreakdown(inputs: RecoveryInputs): RecoveryBreakdown {
  const policy = inputs.policy ?? DEFAULT_DISTRIBUTION_POLICY
  const divisor = curveDivisor(inputs.roomType, inputs.roomTier)
  const fee = tradeFeeFraction(inputs.roomType)
  const potAfterDonation = Math.max(0, inputs.potUsdc) + Math.max(0, inputs.donationUsdc)
  const eligible = Math.max(0, inputs.stakedOtherKeys) + Math.max(0, inputs.yourKeys)
  const distributionPayoutUsdc =
    eligible > 0 && inputs.yourKeys > 0
      ? netPayoutFactor(policy) * potAfterDonation * (inputs.yourKeys / eligible)
      : 0
  const keySaleValueUsdc = sellProceedsAfterFee(inputs.keySupply, inputs.yourKeys, divisor, fee)
  return {
    distributionPayoutUsdc,
    keySaleValueUsdc,
    totalUsdc: distributionPayoutUsdc + keySaleValueUsdc,
    donationRecoveryFraction:
      inputs.donationUsdc > 0 ? distributionPayoutUsdc / inputs.donationUsdc : 0,
  }
}

// ---------------------------------------------------------------------------
// Aggregate evaluation (drives the calculator UI)
// ---------------------------------------------------------------------------

export type KeyDefenseVerdict = 'safe' | 'economically-protected' | 'at-risk' | 'not-applicable'

export type KeyDefenseInputs = {
  roomType: AlfaRoomType
  roomTier: AlfaRoomTier
  keySupply: number
  yourKeys: number
  potUsdc: number
  donationUsdc: number
  /** Eligible staked keys held by others (worst-case default: S − k). */
  stakedOtherKeys?: number
  targetRecoveryFraction?: number
  policy?: DistributionPolicy
}

export type KeyDefenseEvaluation = {
  verdict: KeyDefenseVerdict
  hasVeto: boolean
  vetoTargetKeys: number
  vetoKeysToBuy: number
  vetoKeysToBuyCostUsdc: number
  raid: RaidAnalysis
  raidproofExtraKeys: number | null
  raidproofExtraKeysCostUsdc: number | null
  maxSafePotUsdc: number
  selfInsurance: SelfInsuranceResult
  selfInsuranceKeysToBuy: number | null
  selfInsuranceKeysToBuyCostUsdc: number | null
  recovery: RecoveryBreakdown
  netPayoutFactor: number
}

/**
 * Full evaluation for the calculator. For social rooms (no staking pool / no
 * trading fund on-chain) returns verdict 'not-applicable' with curve-value
 * context only.
 */
export function evaluateKeyDefense(inputs: KeyDefenseInputs): KeyDefenseEvaluation {
  const policy = inputs.policy ?? DEFAULT_DISTRIBUTION_POLICY
  const divisor = curveDivisor(inputs.roomType, inputs.roomTier)
  const fee = tradeFeeFraction(inputs.roomType)
  const keySupply = Math.max(0, Math.floor(inputs.keySupply))
  const yourKeys = Math.max(0, Math.min(Math.floor(inputs.yourKeys), keySupply))
  const stakedOtherKeys = Math.max(
    0,
    Math.floor(inputs.stakedOtherKeys ?? keySupply - yourKeys),
  )
  const targetRecoveryFraction = inputs.targetRecoveryFraction ?? 1

  const recovery = recoveryBreakdown({
    roomType: inputs.roomType,
    roomTier: inputs.roomTier,
    keySupply,
    yourKeys,
    potUsdc: inputs.potUsdc,
    donationUsdc: inputs.donationUsdc,
    stakedOtherKeys,
    policy,
  })

  const selfInsurance = selfInsuranceHold({
    potUsdc: inputs.potUsdc,
    donationUsdc: inputs.donationUsdc,
    stakedOtherKeys,
    targetRecoveryFraction,
    policy,
  })
  const selfInsuranceKeysToBuy =
    selfInsurance.requiredKeys === null
      ? null
      : Math.max(0, selfInsurance.requiredKeys - yourKeys)
  const selfInsuranceKeysToBuyCostUsdc =
    selfInsuranceKeysToBuy === null
      ? null
      : buyCostAfterFee(keySupply, selfInsuranceKeysToBuy, divisor, fee)

  const vetoTargetKeys = vetoHold(keySupply, policy)
  const vetoKeysToBuy = keysToBuyForVeto(keySupply, yourKeys, policy)
  const hasVeto = vetoKeysToBuy === 0
  const vetoKeysToBuyCostUsdc = buyCostAfterFee(keySupply, vetoKeysToBuy, divisor, fee)

  if (inputs.roomType === 'social') {
    // No staking pool / trading fund — dissolution risk N/A.
    const emptyRaid: RaidAnalysis = {
      minAttackKeys: 0,
      minAttackKeysCostUsdc: 0,
      bestAttack: null,
      raidUnprofitable: true,
      curve: [],
    }
    return {
      verdict: 'not-applicable',
      hasVeto,
      vetoTargetKeys,
      vetoKeysToBuy,
      vetoKeysToBuyCostUsdc,
      raid: emptyRaid,
      raidproofExtraKeys: 0,
      raidproofExtraKeysCostUsdc: 0,
      maxSafePotUsdc: Number.POSITIVE_INFINITY,
      selfInsurance,
      selfInsuranceKeysToBuy,
      selfInsuranceKeysToBuyCostUsdc,
      recovery,
      netPayoutFactor: netPayoutFactor(policy),
    }
  }

  const raidScenario: RaidScenarioInputs = {
    roomType: inputs.roomType,
    roomTier: inputs.roomTier,
    keySupply,
    yourKeys,
    potUsdc: Math.max(0, inputs.potUsdc) + Math.max(0, inputs.donationUsdc),
    policy,
  }
  const raid = analyzeRaid(raidScenario)
  const raidproofExtraKeys = raid.raidUnprofitable ? 0 : minRaidproofExtraKeys(raidScenario)
  const raidproofExtraKeysCostUsdc =
    raidproofExtraKeys === null
      ? null
      : buyCostAfterFee(keySupply, raidproofExtraKeys, divisor, fee)
  const safePot = maxSafePotUsdc({
    roomType: inputs.roomType,
    roomTier: inputs.roomTier,
    keySupply,
    yourKeys,
    policy,
  })

  let verdict: KeyDefenseVerdict
  if (raid.raidUnprofitable) {
    verdict = hasVeto ? 'safe' : 'economically-protected'
  } else {
    verdict = 'at-risk'
  }

  return {
    verdict,
    hasVeto,
    vetoTargetKeys,
    vetoKeysToBuy,
    vetoKeysToBuyCostUsdc,
    raid,
    raidproofExtraKeys,
    raidproofExtraKeysCostUsdc,
    maxSafePotUsdc: safePot,
    selfInsurance,
    selfInsuranceKeysToBuy,
    selfInsuranceKeysToBuyCostUsdc,
    recovery,
    netPayoutFactor: netPayoutFactor(policy),
  }
}
