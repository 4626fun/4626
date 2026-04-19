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

/**
 * Mirrors server `LINK_POINTS` + event-point values in
 * `frontend/server/_lib/identity/accountsIdentity.ts`. Keep this list
 * deduplicated on the canonical actions: link Zora gives the biggest
 * single jump; detecting a creator coin is automatic and not actionable,
 * so it isn't surfaced here.
 *
 * Ordered highest-impact first so the UI's top 2-3 suggestions move the
 * user the furthest in a single session.
 */
export const POINT_SUGGESTIONS: readonly PointSuggestion[] = [
  // Highest single-action reward: enabling 4626 signing (sub-account
  // registration on the user's canonical Coinbase Smart Wallet).
  // Architecturally the sub-account flow described in
  // docs/4626-connection-methods.md.
  { label: 'Enable 4626 signing', points: 50, hint: 'One-time', to: '/waitlist' },
  { label: 'Link Zora', points: 40, hint: 'One-time', to: '/waitlist' },
  { label: 'Link Google or Apple', points: 20, hint: 'Per platform', to: '/waitlist' },
  { label: 'Link X / Telegram / TikTok', points: 16, hint: 'Per platform', to: '/waitlist' },
  { label: 'Verify email', points: 10, hint: 'One-time' },
  { label: 'Share 4626 on X, Farcaster, or Telegram', points: 6, hint: 'Once per day', to: '/portfolio' },
  // Referral reward is dynamic — referrer earns 50% of every point the
  // referee scores via `recordReferralPassthrough` on the server. The
  // numeric `points` here is 0 because the amount is not fixed; any
  // renderer should treat 0 as "see hint" rather than a literal zero.
  { label: 'Refer a friend', points: 0, hint: 'Earn 50% of every point they score' },
] as const

/**
 * AMOE daily-share event reward. Mirrors `AMOE_CHECKIN_POINTS` in
 * `frontend/server/_lib/lottery/amoeWaitlistPoints.ts`. Surfaced so the
 * AMOE card / portfolio can render a "+N points" hint without guessing
 * the server value.
 *
 * Note: lottery entry submissions intentionally don't award waitlist
 * points — the daily social share is the base earn action; entries
 * depend on credits earned from that share.
 */
export const AMOE_POINTS = {
  /** Points awarded per successful daily share (X / Farcaster / Telegram). */
  checkin: 6,
} as const

/**
 * Per-provider point rewards. Mirrors server `LINK_POINTS` exactly so the
 * row-level "+N" badges shown next to each provider in the waitlist
 * Advanced section match the server state machine. Zora is authoritative
 * via its own step 1; the rest are secondary identity links.
 *
 * All values are even integers by convention so that referral passthrough
 * (`floor(amount × 0.5)`) is exact — see `LINK_POINTS` on the server.
 */
export const PROVIDER_POINTS: Record<string, number> = {
  email: 10,
  google: 20,
  apple: 20,
  twitter: 16,
  telegram: 16,
  tiktok: 16,
  external_eoa: 10,
  zora_cross_app: 40,
}
