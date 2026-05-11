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

  // Point total mirrors the AMOE-eligible credit model used by
  // waitlist/swap/account score surfaces, so this endpoint reports the
  // same user-visible total as the rest of the app.
  const pointsResult = await db.sql`
    SELECT COALESCE(credits, 0)::int AS total
    FROM points_amoe_eligible_balance
    WHERE signup_id = ${signupId}
    LIMIT 1;
  `
  let pointsTotal = safeInt(pointsResult?.rows?.[0]?.total)
  if (!pointsResult?.rows?.length) {
    // Backward-compatible fallback for environments/tests where the AMOE
    // eligibility view has not been materialized yet.
    const fallbackPointsResult = await db.sql`
      SELECT COALESCE(SUM(amount), 0)::int AS total
      FROM points
      WHERE signup_id = ${signupId};
    `
    pointsTotal = safeInt(fallbackPointsResult?.rows?.[0]?.total)
  }

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
        COALESCE(MAX(b.credits), 0)::int AS total_points
      FROM eligible e
      LEFT JOIN points l ON l.signup_id = e.id
      LEFT JOIN points_amoe_eligible_balance b ON b.signup_id = e.id
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
