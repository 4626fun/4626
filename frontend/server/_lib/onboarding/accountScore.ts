import type { WaitlistPointsBreakdown } from './waitlistScoring.js'

/** Mirrors client `tierFromPoints` in `waitlistTiers.ts`. */
export function waitlistTierFromPoints(points: number): number {
  const safe = normalizeNonNegativeInt(points)
  if (safe >= 250) return 3
  if (safe >= 120) return 2
  if (safe >= 40) return 1
  return 0
}

export function normalizeNonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export type NormalizedAccountScore = {
  /** Canonical waitlist weighted total (leaderboard + tiers + tray headline). */
  points: number
  tier: number
  /** AMOE lottery credits (`points_amoe_eligible_balance`); never substitutes for waitlist points. */
  amoeCredits: number
  /** True when lottery credits differ from waitlist points — UI may show a secondary line. */
  lotteryCreditsDiffer: boolean
}

export function normalizeAccountScore(input: {
  points?: unknown
  tier?: unknown
  amoeCredits?: unknown
}): NormalizedAccountScore {
  const points = normalizeNonNegativeInt(input.points)
  const amoeCredits = normalizeNonNegativeInt(input.amoeCredits)
  const tierRaw = normalizeNonNegativeInt(input.tier)
  const tierFromPoints = waitlistTierFromPoints(points)
  const tier = tierRaw === tierFromPoints ? tierRaw : tierFromPoints
  return {
    points,
    tier,
    amoeCredits,
    lotteryCreditsDiffer: amoeCredits !== points,
  }
}

export function buildAccountScoreFromBreakdown(
  breakdown: WaitlistPointsBreakdown,
  amoeCredits: number,
): NormalizedAccountScore {
  return normalizeAccountScore({
    points: breakdown.total,
    amoeCredits,
  })
}
