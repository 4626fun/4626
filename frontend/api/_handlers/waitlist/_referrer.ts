import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'

import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

/**
 * Public lookup: referral code → referrer's public display name + signal.
 *
 * Used by the waitlist landing page to personalize /r/<CODE> entries with
 * "Invited by {display}" copy so the referral link doesn't feel anonymous.
 *
 * Privacy:
 * - Only returns fields that are already publicly visible via the
 *   leaderboard (display, rank, pointsTotal). Never email/wallet/PII.
 * - Display follows the same `shortAddr(primary_wallet) ?? user#<id>` rule
 *   as `toLeaderboardRow`.
 * - Rate-limited per client IP to raise the cost of code enumeration.
 * - Returns `null` for misses with 200 OK to avoid leaking code existence
 *   through the HTTP status code.
 */

type WaitlistReferrerResponse = {
  display: string
  pointsTotal: number
  rank: number | null
} | null

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
  return normalized.length > 0 ? normalized : null
}

function shortAddr(a: string | null): string | null {
  if (!a) return null
  const s = String(a)
  if (!s.startsWith('0x') || s.length < 12) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

function safeInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('waitlist-referrer', clientIp), {
    windowMs: 60_000,
    maxRequests: 60,
  })
  if (!rate.allowed) {
    res.setHeader('Retry-After', Math.ceil((rate.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawCode = typeof (req.query as any)?.code === 'string' ? String((req.query as any).code) : ''
  const code = normalizeCode(rawCode)
  if (!code) {
    return res.status(400).json({ success: false, error: 'Invalid code' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  // Resolve the profile behind the code, pulling only fields safe to expose.
  const profileResult = await db.sql`
    SELECT id, primary_wallet, embedded_wallet
    FROM profiles
    WHERE referral_code = ${code}
    LIMIT 1;
  `
  const row = profileResult?.rows?.[0] ?? null
  if (!row) {
    return res.status(200).json({
      success: true,
      data: null,
    } satisfies ApiEnvelope<WaitlistReferrerResponse>)
  }

  const signupId = safeInt(row.id)
  const wallet = typeof row.primary_wallet === 'string' && row.primary_wallet
    ? row.primary_wallet
    : typeof row.embedded_wallet === 'string' && row.embedded_wallet
      ? row.embedded_wallet
      : null
  const display = shortAddr(wallet) ?? `user#${signupId}`

  // Point total aggregation mirrors the same weights used by
  // waitlistLeaderboard / accountsIdentity so the number shown on the
  // referral landing matches what the referrer would see elsewhere.
  const pointsResult = await db.sql`
    SELECT
      COALESCE(
        ROUND(
          SUM(
            CASE
              WHEN source IN ('amoe_entry_spend', 'amoe_entry') THEN amount
              WHEN source IN ('amoe_twitter_daily', 'amoe_checkin') THEN amount * 1.00
              WHEN source = 'waitlist_signup' THEN amount * 1.00
              WHEN source = 'csw_link' THEN amount * 1.00
              WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
              WHEN source LIKE 'social_%' THEN amount * 0.50
              WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
              WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
              WHEN source IN ('link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram', 'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin')
                THEN amount * 0.60
              ELSE amount * 0.30
            END
          )
        ),
        0
      )::int AS total
    FROM points
    WHERE signup_id = ${signupId};
  `
  const pointsTotal = safeInt(pointsResult?.rows?.[0]?.total)

  // Best-effort rank. If the profile hasn't completed profile_completed_at
  // they won't have a leaderboard rank yet; return null in that case.
  const rankResult = await db.sql`
    WITH eligible AS (
      SELECT id
      FROM profiles
      WHERE profile_completed_at IS NOT NULL
    ),
    scored AS (
      SELECT
        e.id AS signup_id,
        COALESCE(
          ROUND(
            SUM(
              CASE
                WHEN l.source = 'waitlist_signup' THEN l.amount
                WHEN l.source = 'csw_link' THEN l.amount
                WHEN l.source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN l.amount * 0.60
                WHEN l.source LIKE 'social_%' THEN l.amount * 0.50
                WHEN l.source LIKE 'bonus_%' OR l.source = 'task' THEN l.amount * 0.30
                ELSE l.amount * 0.30
              END
            )
          ),
          0
        )::int AS total_points
      FROM eligible e
      LEFT JOIN points l ON l.signup_id = e.id
      GROUP BY e.id
    ),
    ranked AS (
      SELECT signup_id, ROW_NUMBER() OVER (ORDER BY total_points DESC, signup_id ASC)::int AS rank
      FROM scored
    )
    SELECT rank FROM ranked WHERE signup_id = ${signupId} LIMIT 1;
  `
  const rank = typeof rankResult?.rows?.[0]?.rank === 'number'
    ? rankResult.rows[0].rank
    : null

  const data: WaitlistReferrerResponse = {
    display,
    pointsTotal,
    rank,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistReferrerResponse>)
}

export type { WaitlistReferrerResponse }
