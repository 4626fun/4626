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
  /** Canonical public points total (waitlist, leaderboard, tray, lottery). */
  points: number
  tier: number
}

export function normalizeAccountScore(input: {
  points?: unknown
  tier?: unknown
}): NormalizedAccountScore {
  const points = normalizeNonNegativeInt(input.points)
  const tierRaw = normalizeNonNegativeInt(input.tier)
  const tierFromPoints = waitlistTierFromPoints(points)
  const tier = tierRaw === tierFromPoints ? tierRaw : tierFromPoints
  return { points, tier }
}

export function buildAccountScoreFromBreakdown(
  breakdown: WaitlistPointsBreakdown,
): NormalizedAccountScore {
  return normalizeAccountScore({ points: breakdown.total })
}
