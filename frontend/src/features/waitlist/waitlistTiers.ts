/**
 * Waitlist tier ladder — authoritative thresholds for point-based progression.
 *
 * Mirrors the server-side `toScoreTier` in
 * `frontend/server/_lib/identity/accountsIdentity.ts` so the UI stays in sync
 * with the tier returned by `/onboarding/bootstrap`.
 *
 * Copy intentionally avoids promising product perks that aren't in place. Each
 * tier is phrased as a progression signal rather than an unlock claim.
 */

export type WaitlistTierId = 0 | 1 | 2 | 3

export type WaitlistTier = {
  id: WaitlistTierId
  name: string
  tagline: string
  pointsRequired: number
  highlights: string[]
}

export const WAITLIST_TIERS: readonly WaitlistTier[] = [
  {
    id: 0,
    name: 'Signed up',
    tagline: 'Your spot is reserved.',
    pointsRequired: 0,
    highlights: ['Email verified', 'Waitlist position saved'],
  },
  {
    id: 1,
    name: 'Profile active',
    tagline: 'Your canonical identity is linked.',
    pointsRequired: 40,
    highlights: ['Priority over unverified signups', 'Referrals start counting'],
  },
  {
    id: 2,
    name: 'Early access',
    tagline: 'Ahead of standard admission batches.',
    pointsRequired: 120,
    highlights: ['Moved ahead of tier 1 in admission queue', 'Leaderboard visibility'],
  },
  {
    id: 3,
    name: 'Top contributor',
    tagline: 'Front of the line.',
    pointsRequired: 250,
    highlights: ['First-batch admission as slots open', 'Referral multiplier stays active'],
  },
] as const

/** Derive the tier a point total falls into. Mirrors server `toScoreTier`. */
export function tierFromPoints(points: number): WaitlistTierId {
  if (!Number.isFinite(points) || points < 0) return 0
  if (points >= 250) return 3
  if (points >= 120) return 2
  if (points >= 40) return 1
  return 0
}

/** Return the tier record for a given id (always defined). */
export function getTier(id: WaitlistTierId): WaitlistTier {
  const match = WAITLIST_TIERS.find((tier) => tier.id === id)
  if (!match) throw new Error(`Unknown waitlist tier: ${id}`)
  return match
}

export type WaitlistProgress = {
  currentTier: WaitlistTier
  nextTier: WaitlistTier | null
  points: number
  pointsToNext: number
  progressPercent: number
}

/**
 * Given a point total, return structured progress data for UI rendering.
 * `progressPercent` is clamped to 0..100 and represents distance from the
 * previous tier threshold toward the next.
 */
export function computeProgress(points: number): WaitlistProgress {
  const safePoints = Number.isFinite(points) && points > 0 ? Math.floor(points) : 0
  const currentTierId = tierFromPoints(safePoints)
  const currentTier = getTier(currentTierId)
  const nextTier = WAITLIST_TIERS.find((tier) => tier.id === currentTierId + 1) ?? null

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      points: safePoints,
      pointsToNext: 0,
      progressPercent: 100,
    }
  }

  const span = Math.max(1, nextTier.pointsRequired - currentTier.pointsRequired)
  const offset = Math.max(0, safePoints - currentTier.pointsRequired)
  const rawPercent = (offset / span) * 100
  const progressPercent = Math.max(0, Math.min(100, rawPercent))
  return {
    currentTier,
    nextTier,
    points: safePoints,
    pointsToNext: Math.max(0, nextTier.pointsRequired - safePoints),
    progressPercent,
  }
}

/**
 * Curated "how to earn more points" suggestions based on `WAITLIST_POINTS` on
 * the server. Kept in sync by mirror rather than import because
 * `server/_lib/*` is not importable from `src/` (frontend boundary rule).
 *
 * When `to` is set, the suggestion renders as an internal link; when unset,
 * it renders as static text (useful for passive actions like "a referral
 * completes their profile" which the user can't directly trigger).
 */
export type PointSuggestion = {
  label: string
  points: number
  hint?: string
  /**
   * Optional in-app route that will help the user complete this action.
   * Kept as a simple path so the tiers module stays UI-framework-agnostic.
   */
  to?: string
}

export const POINT_SUGGESTIONS: readonly PointSuggestion[] = [
  { label: 'Link your Coinbase Smart Wallet', points: 10, hint: 'One-time', to: '/accounts' },
  { label: 'Refer a friend who signs up', points: 2, hint: 'Per referral' },
  { label: 'Referral links their CSW', points: 4, hint: 'Per qualified referral' },
  { label: 'Referral completes profile', points: 6, hint: 'Per qualified referral' },
  { label: 'Connect Zora', points: 2, to: '/accounts' },
  { label: 'Connect X / Discord / Telegram', points: 2, hint: 'Per platform', to: '/accounts' },
] as const
