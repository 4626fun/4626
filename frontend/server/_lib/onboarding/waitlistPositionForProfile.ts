import { assertValidSignupId } from './profileSignupId.js'
import { waitlistTierFromPoints } from './accountScore.js'
import { readWaitlistPointsBreakdown } from './waitlistScoring.js'

type ScoringDb = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

function safeInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

export type WaitlistProfilePointsBreakdown = {
  total: number
  invite: number
  signup: number
  tasks: number
  csw: number
  social: number
  bonus: number
}

export type WaitlistProfilePositionSnapshot = {
  signupId: number
  profileCompletedAt: string | null
  referralCode: string | null
  borderTier: number
  points: WaitlistProfilePointsBreakdown
  tier: number
  rank: {
    invite: number | null
    total: number | null
  }
  totalCount: number
  totalAheadInvite: number | null
  percentileInvite: number | null
  referrals: {
    qualifiedCount: number
    pendingCount: number
    pendingCountCapped: number
    pendingCap: number
  }
}

/** Privy-resolved profile waitlist position (rank, breakdown, referrals). */
export async function readWaitlistPositionForSignupId(
  db: ScoringDb,
  signupId: number,
): Promise<WaitlistProfilePositionSnapshot> {
  const validId = assertValidSignupId(signupId)
  const profileRow = await db.sql`
    SELECT referral_code, profile_completed_at, border_tier
    FROM profiles
    WHERE id = ${validId}
    LIMIT 1;
  `
  const row = profileRow.rows?.[0] ?? {}
  const profileCompletedAt = row.profile_completed_at ? String(row.profile_completed_at) : null
  const referralCode = typeof row.referral_code === 'string' ? String(row.referral_code) : null
  const borderTier = safeInt(row.border_tier)

  const breakdown = await readWaitlistPointsBreakdown(db, validId)
  const points: WaitlistProfilePointsBreakdown = {
    total: breakdown.total,
    invite: breakdown.invite,
    signup: breakdown.signup,
    tasks: breakdown.tasks,
    csw: breakdown.csw,
    social: breakdown.social,
    bonus: breakdown.bonus,
  }

  const qualifiedQ = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${validId}
      AND is_valid = TRUE
      AND (status = 'csw_linked' OR status = 'qualified' OR qualified_at IS NOT NULL);
  `
  const qualifiedCount = safeInt(qualifiedQ.rows?.[0]?.c)

  const pendingQ = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${validId}
      AND is_valid = TRUE
      AND NOT (status = 'csw_linked' OR status = 'qualified' OR qualified_at IS NOT NULL);
  `
  const pendingCount = safeInt(pendingQ.rows?.[0]?.c)
  const pendingCap = 10
  const pendingCountCapped = Math.min(pendingCount, pendingCap)

  const totalCountQ = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM profiles
    WHERE email IS NOT NULL
      AND merged_into_profile_id IS NULL;
  `
  const totalCount = Math.max(0, safeInt(totalCountQ.rows?.[0]?.c))

  const inviteRankQ = await db.sql`
    WITH point_totals AS (
      SELECT
        signup_id,
        COALESCE(
          ROUND(
            SUM(
              CASE
                WHEN source IN ('amoe_entry_spend', 'amoe_twitter_daily', 'amoe_xmtp_daily', 'amoe_entry_refund') THEN 0
                WHEN source IN ('waitlist_signup', 'referral_passthrough', 'csw_link', 'amoe_checkin') THEN amount * 1.00
                WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
                WHEN source LIKE 'social_%' THEN amount * 0.50
                WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
                WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
                WHEN source IN (
                  'link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram',
                  'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin'
                ) THEN amount * 0.60
                ELSE 0
              END
            )
          ),
          0
        )::int AS total_points
      FROM points
      GROUP BY signup_id
    ),
    eligible AS (
      SELECT id
      FROM profiles
      WHERE email IS NOT NULL
        AND merged_into_profile_id IS NULL
    ),
    scored AS (
      SELECT
        e.id AS signup_id,
        COALESCE(pt.total_points, 0)::int AS total_points,
        COALESCE(
          ROUND(SUM(
            CASE
              WHEN l.source = 'referral_passthrough' THEN l.amount * 1.00
              WHEN l.source IN ('referral_qualified', 'referral_signup', 'referral_csw_link') THEN l.amount * 0.60
              ELSE 0
            END
          )),
          0
        )::int AS invite_points,
        COALESCE(
          ROUND(SUM(
            CASE
              WHEN l.source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN l.amount * 0.40
              ELSE 0
            END
          )),
          0
        )::int AS agent_points
      FROM eligible e
      LEFT JOIN point_totals pt ON pt.signup_id = e.id
      LEFT JOIN points l ON l.signup_id = e.id
      GROUP BY e.id, pt.total_points
    ),
    ranked AS (
      SELECT
        signup_id,
        ROW_NUMBER() OVER (ORDER BY invite_points DESC, total_points DESC, agent_points DESC, signup_id ASC)::int AS rank_invite
      FROM scored
    )
    SELECT rank_invite
    FROM ranked
    WHERE signup_id = ${validId}
    LIMIT 1;
  `
  const inviteRank =
    typeof inviteRankQ.rows?.[0]?.rank_invite === 'number'
      ? (inviteRankQ.rows[0].rank_invite as number)
      : null

  const totalRankQ = await db.sql`
    WITH point_totals AS (
      SELECT
        signup_id,
        COALESCE(
          ROUND(
            SUM(
              CASE
                WHEN source IN ('amoe_entry_spend', 'amoe_twitter_daily', 'amoe_xmtp_daily', 'amoe_entry_refund') THEN 0
                WHEN source IN ('waitlist_signup', 'referral_passthrough', 'csw_link', 'amoe_checkin') THEN amount * 1.00
                WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
                WHEN source LIKE 'social_%' THEN amount * 0.50
                WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
                WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
                WHEN source IN (
                  'link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram',
                  'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin'
                ) THEN amount * 0.60
                ELSE 0
              END
            )
          ),
          0
        )::int AS total_points
      FROM points
      GROUP BY signup_id
    ),
    eligible AS (
      SELECT id
      FROM profiles
      WHERE email IS NOT NULL
        AND merged_into_profile_id IS NULL
    ),
    scored AS (
      SELECT
        e.id AS signup_id,
        COALESCE(pt.total_points, 0)::int AS total_points,
        COALESCE(
          ROUND(SUM(
            CASE
              WHEN l.source = 'referral_passthrough' THEN l.amount * 1.00
              WHEN l.source IN ('referral_qualified', 'referral_signup', 'referral_csw_link') THEN l.amount * 0.60
              ELSE 0
            END
          )),
          0
        )::int AS invite_points,
        COALESCE(
          ROUND(SUM(
            CASE
              WHEN l.source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN l.amount * 0.40
              ELSE 0
            END
          )),
          0
        )::int AS agent_points
      FROM eligible e
      LEFT JOIN point_totals pt ON pt.signup_id = e.id
      LEFT JOIN points l ON l.signup_id = e.id
      GROUP BY e.id, pt.total_points
    ),
    ranked AS (
      SELECT
        signup_id,
        ROW_NUMBER() OVER (ORDER BY total_points DESC, invite_points DESC, agent_points DESC, signup_id ASC)::int AS rank_total
      FROM scored
    )
    SELECT rank_total
    FROM ranked
    WHERE signup_id = ${validId}
    LIMIT 1;
  `
  const totalRank =
    typeof totalRankQ.rows?.[0]?.rank_total === 'number'
      ? (totalRankQ.rows[0].rank_total as number)
      : null

  const totalAheadInvite = typeof inviteRank === 'number' && inviteRank > 0 ? inviteRank - 1 : null
  const percentileInvite =
    typeof inviteRank === 'number' && inviteRank > 0 && totalCount > 0
      ? Math.min(100, Math.max(1, Math.round((inviteRank / totalCount) * 100)))
      : null

  return {
    signupId: validId,
    profileCompletedAt,
    referralCode,
    borderTier,
    points,
    tier: waitlistTierFromPoints(points.total),
    rank: { invite: inviteRank, total: totalRank },
    totalCount,
    totalAheadInvite,
    percentileInvite,
    referrals: {
      qualifiedCount,
      pendingCount,
      pendingCountCapped,
      pendingCap,
    },
  }
}
