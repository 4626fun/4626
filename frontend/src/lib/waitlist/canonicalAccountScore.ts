import type { AccountScore } from '@/features/accountSetup/types'
import { tierFromPoints } from '@/features/waitlist/waitlistTiers'

export type PublicPointsDisplay = {
  points: number
  tier: number
}

function normalizeNonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

/** One public points total for tray, waitlist tiers, and account setup (leaderboard score). */
export function resolvePublicPointsDisplay(input: {
  score?: AccountScore | null
  /** Fallback from `/api/accounts/me/points` (tray) before `/api/accounts/me` score hydrates. */
  positionTotal?: number | null
}): PublicPointsDisplay {
  const points = input.score
    ? normalizeNonNegativeInt(input.score.points)
    : normalizeNonNegativeInt(input.positionTotal)
  const tierFromScore = input.score ? normalizeNonNegativeInt(input.score.tier) : null
  const tierForPoints = tierFromPoints(points)
  return {
    points,
    tier: tierFromScore === tierForPoints ? tierFromScore : tierForPoints,
  }
}
