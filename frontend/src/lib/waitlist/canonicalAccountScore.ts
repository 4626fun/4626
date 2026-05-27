import type { AccountScore } from '@/features/accountSetup/types'
import { tierFromPoints } from '@/features/waitlist/waitlistTiers'

export type CanonicalScoreDisplay = {
  waitlistPoints: number
  amoeCredits: number
  tier: number
  showLotteryCreditsNote: boolean
}

function normalizeNonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

/** Single client source of truth for waitlist vs lottery credit display. */
export function resolveCanonicalScoreDisplay(input: {
  score?: AccountScore | null
  /** Fallback from `/api/waitlist/position` when session score is not hydrated yet. */
  positionWaitlistTotal?: number | null
}): CanonicalScoreDisplay {
  const fromScore = input.score
  const waitlistPoints = fromScore
    ? normalizeNonNegativeInt(fromScore.points)
    : normalizeNonNegativeInt(input.positionWaitlistTotal)
  const amoeCredits = fromScore
    ? normalizeNonNegativeInt(fromScore.amoeCredits)
    : waitlistPoints
  const tier = fromScore ? normalizeNonNegativeInt(fromScore.tier) : tierFromPoints(waitlistPoints)
  const tierFromWaitlist = tierFromPoints(waitlistPoints)
  return {
    waitlistPoints,
    amoeCredits,
    tier: tier === tierFromWaitlist ? tier : tierFromWaitlist,
    showLotteryCreditsNote: amoeCredits !== waitlistPoints,
  }
}
