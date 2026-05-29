import { waitlistTierFromPoints } from './accountScore.js'
import { resolvePrimaryProfileIdForPrivyUser } from '@4626/server-core/identity'
import { assertValidSignupId } from './profileSignupId.js'
import { readWaitlistPositionForSignupId } from './waitlistPositionForProfile.js'
import {
  listPointsActivityForSignupId,
  readWaitlistPointsBreakdown,
  type PointsActivityRow,
} from './waitlistScoring.js'

type ScoringDb = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

const SYNTHETIC_EMAIL_SUFFIXES = ['@wallet.4626.fun', '@noemail.4626.fun'] as const

export const ACCOUNT_TRAY_POINTS_ACTIVITY_LIMIT_DEFAULT = 40
export const ACCOUNT_TRAY_POINTS_ACTIVITY_LIMIT_MAX = 100

export type AccountTrayPointsPayload = {
  signupId: number
  tier: number
  /** True when profile has a real verified email and is not tombstoned (leaderboard pool). */
  leaderboardEligible: boolean
  points: {
    total: number
    invite: number
    signup: number
    links: number
    tasks: number
    csw: number
    social: number
    checkins: number
    bonus: number
    agent: number
  }
  rank: {
    invite: number | null
    total: number | null
  }
  totalCount: number
  activity: PointsActivityRow[]
}

export const EMPTY_ACCOUNT_TRAY_POINTS: AccountTrayPointsPayload = {
  signupId: 0,
  tier: 0,
  leaderboardEligible: false,
  points: { total: 0, invite: 0, signup: 0, links: 0, tasks: 0, csw: 0, social: 0, checkins: 0, bonus: 0, agent: 0 },
  rank: { invite: null, total: null },
  totalCount: 0,
  activity: [],
}

export function clampAccountTrayPointsActivityLimit(limit: unknown): number {
  const n = typeof limit === 'number' ? limit : Number(limit)
  if (!Number.isFinite(n)) return ACCOUNT_TRAY_POINTS_ACTIVITY_LIMIT_DEFAULT
  return Math.min(Math.max(1, Math.floor(n)), ACCOUNT_TRAY_POINTS_ACTIVITY_LIMIT_MAX)
}

export { assertValidSignupId } from './profileSignupId.js'

function isLeaderboardEligibleEmail(email: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false
  return !SYNTHETIC_EMAIL_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}

export async function readProfileLeaderboardEligibility(
  db: ScoringDb,
  signupId: number,
): Promise<{ leaderboardEligible: boolean }> {
  const validId = assertValidSignupId(signupId)
  const result = await db.sql`
    SELECT email, merged_into_profile_id
    FROM profiles
    WHERE id = ${validId}
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? {}
  if (row.merged_into_profile_id != null && row.merged_into_profile_id !== '') {
    return { leaderboardEligible: false }
  }
  const email = typeof row.email === 'string' ? row.email : null
  return { leaderboardEligible: isLeaderboardEligibleEmail(email) }
}

/**
 * Canonical tray payload: one Privy-resolved profile, one weighted breakdown, optional rank.
 * Rank/totalCount are withheld unless the profile is leaderboard-eligible (verified email, live row).
 */
export async function buildAccountTrayPointsPayload(
  db: ScoringDb,
  signupId: number,
  limit: unknown,
): Promise<AccountTrayPointsPayload> {
  const validId = assertValidSignupId(signupId)
  const activityLimit = clampAccountTrayPointsActivityLimit(limit)

  const [{ leaderboardEligible }, snapshot, activity, breakdown] = await Promise.all([
    readProfileLeaderboardEligibility(db, validId),
    readWaitlistPositionForSignupId(db, validId),
    listPointsActivityForSignupId(db, validId, activityLimit),
    readWaitlistPointsBreakdown(db, validId),
  ])

  if (snapshot.signupId !== validId) {
    throw new Error('account_tray_points_profile_mismatch')
  }
  if (breakdown.total !== snapshot.points.total) {
    throw new Error('account_tray_points_breakdown_mismatch')
  }

  const tier = waitlistTierFromPoints(breakdown.total)
  if (snapshot.tier !== tier) {
    throw new Error('account_tray_points_tier_mismatch')
  }

  return {
    signupId: validId,
    tier,
    leaderboardEligible,
    points: snapshot.points,
    rank: leaderboardEligible ? snapshot.rank : { invite: null, total: null },
    totalCount: leaderboardEligible ? snapshot.totalCount : 0,
    activity,
  }
}

/** Privy-only entry: resolves canonical profile id (alias-aware), then builds tray payload. */
export async function buildAccountTrayPointsForPrivyUser(
  db: ScoringDb,
  privyUserId: string,
  limit: unknown,
): Promise<AccountTrayPointsPayload> {
  const normalizedPrivyUserId = typeof privyUserId === 'string' ? privyUserId.trim() : ''
  if (!normalizedPrivyUserId) {
    return EMPTY_ACCOUNT_TRAY_POINTS
  }
  const signupId = await resolvePrimaryProfileIdForPrivyUser(db, normalizedPrivyUserId)
  if (!signupId) {
    return EMPTY_ACCOUNT_TRAY_POINTS
  }
  return buildAccountTrayPointsPayload(db, signupId, limit)
}
