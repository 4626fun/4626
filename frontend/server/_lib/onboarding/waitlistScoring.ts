import { assertValidSignupId } from './profileSignupId.js'

/**
 * Canonical waitlist score from Supabase `public.points` (see `waitlistPoints.ts`).
 * Used by leaderboard, `/api/waitlist/position`, and referrer lookups.
 *
 * Not tied to Airtable — that sync is an optional ops mirror when configured.
 * AMOE lottery bookkeeping (`amoe_entry_spend`, `amoe_twitter_daily`, …) is
 * excluded from waitlist surfaces per `amoeWaitlistPoints.ts`; only `amoe_checkin`
 * counts toward waitlist rank when written on a canonical profile.
 */

export function safeInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

/** Weighted credits for one `points` row on waitlist surfaces. */
export function weightedWaitlistPoints(source: unknown, amount: unknown): number {
  const normalizedSource = String(source ?? '').trim()
  const normalizedAmount = safeInt(amount)

  if (
    normalizedSource === 'amoe_entry_spend' ||
    normalizedSource === 'amoe_twitter_daily' ||
    normalizedSource === 'amoe_xmtp_daily' ||
    normalizedSource === 'amoe_entry_refund'
  ) {
    return 0
  }

  if (
    normalizedSource === 'waitlist_signup' ||
    normalizedSource === 'referral_passthrough' ||
    normalizedSource === 'csw_link' ||
    normalizedSource === 'amoe_checkin'
  ) {
    return normalizedAmount
  }
  if (
    normalizedSource === 'referral_signup' ||
    normalizedSource === 'referral_csw_link' ||
    normalizedSource === 'referral_qualified'
  ) {
    return Math.round(normalizedAmount * 0.6)
  }
  if (normalizedSource.startsWith('social_')) return Math.round(normalizedAmount * 0.5)
  if (normalizedSource.startsWith('bonus_') || normalizedSource === 'task') return Math.round(normalizedAmount * 0.3)
  if (
    normalizedSource === 'agent_feedback' ||
    normalizedSource === 'agent_reputation' ||
    normalizedSource === 'lens_identity' ||
    normalizedSource === 'grove_proof'
  ) {
    return Math.round(normalizedAmount * 0.4)
  }
  if (
    normalizedSource === 'link_email' ||
    normalizedSource === 'link_google' ||
    normalizedSource === 'link_apple' ||
    normalizedSource === 'link_twitter' ||
    normalizedSource === 'link_telegram' ||
    normalizedSource === 'link_tiktok' ||
    normalizedSource === 'link_external_eoa' ||
    normalizedSource === 'link_zora' ||
    normalizedSource === 'resolve_csw' ||
    normalizedSource === 'has_creator_coin'
  ) {
    return Math.round(normalizedAmount * 0.6)
  }
  return 0
}

/** Legacy per-row AMOE allowlist weights (view still exists in DB). Runtime balance/spend uses `readWaitlistPointsBreakdown`. */
export function weightedAmoeEligiblePoints(source: unknown, amount: unknown): number {
  const normalizedSource = String(source ?? '').trim()
  const normalizedAmount = safeInt(amount)

  if (normalizedSource === 'amoe_entry_spend' || normalizedSource === 'amoe_entry_refund') {
    return normalizedAmount
  }
  if (
    normalizedSource === 'amoe_twitter_daily' ||
    normalizedSource === 'amoe_xmtp_daily' ||
    normalizedSource === 'amoe_checkin' ||
    normalizedSource === 'waitlist_signup' ||
    normalizedSource === 'csw_link'
  ) {
    return normalizedAmount
  }
  if (normalizedSource === 'resolve_csw') return Math.round(normalizedAmount * 0.6)
  if (normalizedSource.startsWith('social_')) return Math.round(normalizedAmount * 0.5)
  if (normalizedSource.startsWith('bonus_') || normalizedSource === 'task') {
    return Math.round(normalizedAmount * 0.3)
  }
  if (
    normalizedSource === 'agent_feedback' ||
    normalizedSource === 'agent_reputation' ||
    normalizedSource === 'lens_identity' ||
    normalizedSource === 'grove_proof'
  ) {
    return Math.round(normalizedAmount * 0.4)
  }
  if (
    normalizedSource === 'link_email' ||
    normalizedSource === 'link_google' ||
    normalizedSource === 'link_apple' ||
    normalizedSource === 'link_telegram' ||
    normalizedSource === 'link_tiktok' ||
    normalizedSource === 'link_twitter' ||
    normalizedSource === 'link_external_eoa' ||
    normalizedSource === 'link_zora'
  ) {
    return Math.round(normalizedAmount * 0.6)
  }
  return 0
}

/** SQL `CASE` for `SUM(...)` over `points.source` / `points.amount`. Mirrors `weightedWaitlistPoints`. */
export const WAITLIST_POINTS_WEIGHT_CASE_SQL = `
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
`.trim()

type ScoringDb = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

export type WaitlistPointsBreakdown = {
  total: number
  invite: number
  signup: number
  tasks: number
  csw: number
  social: number
  bonus: number
}

/** Canonical waitlist total + category buckets for one profile. */
export async function readWaitlistPointsBreakdown(
  db: ScoringDb,
  signupId: number,
): Promise<WaitlistPointsBreakdown> {
  const validId = assertValidSignupId(signupId)
  const pointsAgg = await db.sql`
    SELECT
      (
        SELECT COALESCE(
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
        )::int
        FROM points
        WHERE signup_id = ${validId}
      ) AS total,
      COALESCE(ROUND(SUM(CASE WHEN source IN ('referral_qualified', 'referral_signup', 'referral_csw_link') THEN amount * 0.60 ELSE 0 END)), 0)::int AS invite,
      COALESCE(ROUND(SUM(CASE WHEN source = 'waitlist_signup' THEN amount * 1.00 ELSE 0 END)), 0)::int AS signup,
      COALESCE(ROUND(SUM(CASE WHEN source = 'task' THEN amount * 0.30 ELSE 0 END)), 0)::int AS tasks,
      COALESCE(ROUND(SUM(CASE WHEN source = 'csw_link' THEN amount * 1.00 ELSE 0 END)), 0)::int AS csw,
      COALESCE(ROUND(SUM(CASE WHEN source LIKE 'social_%' THEN amount * 0.50 ELSE 0 END)), 0)::int AS social,
      COALESCE(ROUND(SUM(CASE WHEN source LIKE 'bonus_%' THEN amount * 0.30 ELSE 0 END)), 0)::int AS bonus
    FROM points
    WHERE signup_id = ${validId};
  `
  const row = pointsAgg.rows?.[0] ?? {}
  return {
    total: safeInt(row.total),
    invite: safeInt(row.invite),
    signup: safeInt(row.signup),
    tasks: safeInt(row.tasks),
    csw: safeInt(row.csw),
    social: safeInt(row.social),
    bonus: safeInt(row.bonus),
  }
}

/**
 * Public points balance for lottery spend and `/api/v1/lottery/amoe/credits`.
 * Same weighted total as waitlist tiers, leaderboard, and tray (`points.total`).
 */
export async function readAmoeEligibleCreditsForSignupId(
  db: ScoringDb,
  signupId: number,
): Promise<number> {
  const breakdown = await readWaitlistPointsBreakdown(db, signupId)
  return breakdown.total
}

export function labelForPointsSource(source: string): string {
  const normalized = source.trim()
  if (normalized === 'waitlist_signup') return 'Waitlist signup'
  if (normalized === 'referral_passthrough') return 'Referral bonus'
  if (normalized === 'referral_signup') return 'Referral signup'
  if (normalized === 'referral_csw_link') return 'Referral CSW link'
  if (normalized === 'referral_qualified') return 'Qualified referral'
  if (normalized === 'csw_link') return 'CSW linked'
  if (normalized === 'amoe_checkin') return 'Daily check-in'
  if (normalized === 'amoe_twitter_daily') return 'Daily X check-in'
  if (normalized === 'amoe_xmtp_daily') return 'Daily XMTP check-in'
  if (normalized === 'amoe_entry_spend') return 'Lottery entry'
  if (normalized === 'amoe_entry_refund') return 'Lottery entry refund'
  if (normalized === 'resolve_csw') return 'CSW resolved'
  if (normalized === 'has_creator_coin') return 'Creator coin'
  if (normalized === 'task') return 'Task'
  if (normalized.startsWith('social_')) return 'Social action'
  if (normalized.startsWith('bonus_')) return 'Bonus'
  if (normalized === 'link_email') return 'Email linked'
  if (normalized === 'link_google') return 'Google linked'
  if (normalized === 'link_apple') return 'Apple linked'
  if (normalized === 'link_twitter') return 'X linked'
  if (normalized === 'link_telegram') return 'Telegram linked'
  if (normalized === 'link_tiktok') return 'TikTok linked'
  if (normalized === 'link_external_eoa') return 'Wallet linked'
  if (normalized === 'link_zora') return 'Zora linked'
  if (normalized === 'agent_feedback') return 'Agent feedback'
  if (normalized === 'agent_reputation') return 'Agent reputation'
  if (normalized === 'lens_identity') return 'Lens identity'
  if (normalized === 'grove_proof') return 'Grove proof'
  return normalized.replace(/_/g, ' ')
}

export type PointsActivityRow = {
  id: string
  source: string
  label: string
  amount: number
  waitlistPoints: number
  createdAt: string
}

export async function listPointsActivityForSignupId(
  db: ScoringDb,
  signupId: number,
  limit = 30,
): Promise<PointsActivityRow[]> {
  const validId = assertValidSignupId(signupId)
  const cappedLimit = Math.min(Math.max(1, Math.floor(limit)), 100)
  const result = await db.sql`
    SELECT id, source, amount, created_at
    FROM points
    WHERE signup_id = ${validId}
    ORDER BY created_at DESC, id DESC
    LIMIT ${cappedLimit};
  `
  return (result.rows ?? []).map((row) => {
    const source = String(row.source ?? '').trim()
    const amount = safeInt(row.amount)
    return {
      id: String(row.id ?? ''),
      source,
      label: labelForPointsSource(source),
      amount,
      waitlistPoints: weightedWaitlistPoints(source, amount),
      createdAt: row.created_at ? String(row.created_at) : '',
    }
  })
}
