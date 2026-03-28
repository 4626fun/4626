import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { resolveAuthorizedRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type PointsType = 'total' | 'invite' | 'agent'

const MAX_LEADERBOARD_USERS = 1000

type LeaderboardRow = {
  rank: number
  signupId: number
  display: string
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
  pointsAgent: number
  borderTier: number
}

type LeaderboardResponse = {
  page: number
  limit: number
  pointsType: PointsType
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardRow[]
  me: LeaderboardRow | null
}

function safeInt(v: any): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function emailUsername(email: string | null): string | null {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail.includes('@')) return null
  const localPart = normalizedEmail.split('@')[0] ?? ''
  return localPart.trim() || null
}

function isLegacyGeneratedReferralCode(value: string | null): boolean {
  return typeof value === 'string' && /^C[0-9A-Z]+$/.test(value)
}

function shortAddr(a: string | null): string | null {
  if (!a) return null
  const s = String(a)
  if (!s.startsWith('0x') || s.length < 12) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

function toLeaderboardRow(raw: any): LeaderboardRow {
  const signupId = safeInt(raw?.signup_id)
  const referralCode = typeof raw?.referral_code === 'string' ? String(raw.referral_code) : null
  const wallet = shortAddr(typeof raw?.primary_wallet === 'string' ? raw.primary_wallet : null)
  const emailHandle = emailUsername(typeof raw?.email === 'string' ? raw.email : null)
  const display = !isLegacyGeneratedReferralCode(referralCode)
    ? referralCode ?? emailHandle ?? wallet ?? `user#${signupId}`
    : emailHandle ?? referralCode ?? wallet ?? `user#${signupId}`
  return {
    rank: safeInt(raw?.rank),
    signupId,
    display,
    referralCode,
    pointsTotal: safeInt(raw?.total_points),
    pointsInvite: safeInt(raw?.invite_points),
    pointsAgent: safeInt(raw?.agent_points),
    borderTier: safeInt(raw?.border_tier),
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const rawPage = typeof (req.query as any)?.page === 'string' ? Number((req.query as any).page) : NaN
  const rawLimit = typeof (req.query as any)?.limit === 'string' ? Number((req.query as any).limit) : NaN
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 10

  const pointsTypeParam = typeof (req.query as any)?.pointsType === 'string' ? String((req.query as any).pointsType).toLowerCase() : ''
  const pointsType: PointsType = pointsTypeParam === 'total' ? 'total' : pointsTypeParam === 'agent' ? 'agent' : 'invite'

  const offset = (page - 1) * limit

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const totalCountResult = await db.sql`
    WITH eligible AS (
      SELECT id, primary_wallet, embedded_wallet
      FROM profiles
      WHERE profile_completed_at IS NOT NULL
      ORDER BY id ASC
      LIMIT ${MAX_LEADERBOARD_USERS}
    ),
    eligible_with_key AS (
      SELECT
        id,
        COALESCE(NULLIF(primary_wallet, ''), NULLIF(embedded_wallet, '')) AS wallet_key
      FROM eligible
    ),
    wallet_rollup AS (
      SELECT wallet_key
      FROM eligible_with_key
      WHERE wallet_key IS NOT NULL
      GROUP BY wallet_key
    )
    SELECT COUNT(*)::int AS c
    FROM wallet_rollup;
  `

  const totalCount = safeInt(totalCountResult?.rows?.[0]?.c)
  const totalPages = Math.max(1, Math.ceil(Math.max(1, totalCount) / limit))
  const hasMore = page < totalPages

  const rows = await db.sql`
    WITH eligible AS (
      SELECT id, email, primary_wallet, embedded_wallet, referral_code, border_tier
      FROM profiles
      WHERE profile_completed_at IS NOT NULL
      ORDER BY id ASC
      LIMIT ${MAX_LEADERBOARD_USERS}
    ),
    eligible_with_key AS (
      SELECT
        id,
        email,
        COALESCE(NULLIF(primary_wallet, ''), NULLIF(embedded_wallet, '')) AS wallet_key,
        referral_code,
        border_tier
      FROM eligible
    ),
    wallet_rollup AS (
      SELECT
        wallet_key,
        MIN(id)::bigint AS canonical_signup_id,
        MAX(referral_code) FILTER (WHERE referral_code IS NOT NULL) AS referral_code,
        COALESCE(MAX(border_tier), 0)::int AS border_tier
      FROM eligible_with_key
      WHERE wallet_key IS NOT NULL
      GROUP BY wallet_key
    ),
    scored AS (
      SELECT
        w.canonical_signup_id::bigint AS signup_id,
        MAX(e.email) FILTER (WHERE e.email IS NOT NULL) AS email,
        w.wallet_key AS primary_wallet,
        w.referral_code,
        w.border_tier,
        COALESCE(SUM(l.amount), 0)::int AS total_points,
        COALESCE(
          SUM(
            CASE
              WHEN l.source IN ('referral_qualified', 'referral_signup', 'referral_csw_link') THEN l.amount
              ELSE 0
            END
          ),
          0
        )::int AS invite_points,
        COALESCE(SUM(CASE WHEN l.source IN ('agent_feedback', 'agent_reputation') THEN l.amount ELSE 0 END), 0)::int AS agent_points
      FROM wallet_rollup w
      LEFT JOIN eligible_with_key e ON e.wallet_key = w.wallet_key
      LEFT JOIN points l ON l.signup_id = e.id
      GROUP BY w.canonical_signup_id, w.wallet_key, w.referral_code, w.border_tier
    ),
    ranked AS (
      SELECT
        signup_id,
        email,
        primary_wallet,
        referral_code,
        border_tier,
        total_points,
        invite_points,
        agent_points,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE
              WHEN ${pointsType} = 'invite' THEN invite_points
              WHEN ${pointsType} = 'agent' THEN agent_points
              ELSE total_points
            END DESC,
            CASE
              WHEN ${pointsType} = 'invite' THEN total_points
              WHEN ${pointsType} = 'agent' THEN total_points
              ELSE invite_points
            END DESC,
            CASE
              WHEN ${pointsType} = 'invite' THEN agent_points
              WHEN ${pointsType} = 'agent' THEN invite_points
              ELSE agent_points
            END DESC,
            signup_id ASC
        )::int AS rank
      FROM scored
    )
    SELECT rank, signup_id, email, primary_wallet, referral_code, border_tier, total_points, invite_points, agent_points
    FROM ranked
    ORDER BY rank ASC
    OFFSET ${offset}
    LIMIT ${limit};
  `

  const leaderboard: LeaderboardRow[] = Array.isArray(rows?.rows) ? rows.rows.map((raw: any) => toLeaderboardRow(raw)) : []

  const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  let me: LeaderboardRow | null = null
  if (authorizedPrincipal) {
    const meProfile = await db.sql`
      SELECT
        COALESCE(NULLIF(primary_wallet, ''), NULLIF(embedded_wallet, '')) AS wallet_key
      FROM profiles
      WHERE id = ${authorizedPrincipal.profileId}
      LIMIT 1;
    `
    const walletKey = typeof meProfile?.rows?.[0]?.wallet_key === 'string' ? String(meProfile.rows[0].wallet_key).trim() : ''
    if (walletKey) {
      const meQuery = await db.sql`
        WITH eligible AS (
          SELECT id, email, primary_wallet, embedded_wallet, referral_code, border_tier
          FROM profiles
          WHERE profile_completed_at IS NOT NULL
          ORDER BY id ASC
          LIMIT ${MAX_LEADERBOARD_USERS}
        ),
        eligible_with_key AS (
          SELECT
            id,
            email,
            COALESCE(NULLIF(primary_wallet, ''), NULLIF(embedded_wallet, '')) AS wallet_key,
            referral_code,
            border_tier
          FROM eligible
        ),
        wallet_rollup AS (
          SELECT
            wallet_key,
            MIN(id)::bigint AS canonical_signup_id,
            MAX(referral_code) FILTER (WHERE referral_code IS NOT NULL) AS referral_code,
            COALESCE(MAX(border_tier), 0)::int AS border_tier
          FROM eligible_with_key
          WHERE wallet_key IS NOT NULL
          GROUP BY wallet_key
        ),
        scored AS (
      SELECT
        w.canonical_signup_id::bigint AS signup_id,
        MAX(e.email) FILTER (WHERE e.email IS NOT NULL) AS email,
        w.wallet_key AS primary_wallet,
        w.referral_code,
        w.border_tier,
            COALESCE(SUM(l.amount), 0)::int AS total_points,
            COALESCE(
              SUM(
                CASE
                  WHEN l.source IN ('referral_qualified', 'referral_signup', 'referral_csw_link') THEN l.amount
                  ELSE 0
                END
              ),
              0
            )::int AS invite_points,
            COALESCE(SUM(CASE WHEN l.source IN ('agent_feedback', 'agent_reputation') THEN l.amount ELSE 0 END), 0)::int AS agent_points
          FROM wallet_rollup w
          LEFT JOIN eligible_with_key e ON e.wallet_key = w.wallet_key
          LEFT JOIN points l ON l.signup_id = e.id
          GROUP BY w.canonical_signup_id, w.wallet_key, w.referral_code, w.border_tier
        ),
        ranked AS (
          SELECT
            signup_id,
            email,
            primary_wallet,
            referral_code,
            border_tier,
            total_points,
            invite_points,
            agent_points,
            ROW_NUMBER() OVER (
              ORDER BY
                CASE
                  WHEN ${pointsType} = 'invite' THEN invite_points
                  WHEN ${pointsType} = 'agent' THEN agent_points
                  ELSE total_points
                END DESC,
                CASE
                  WHEN ${pointsType} = 'invite' THEN total_points
                  WHEN ${pointsType} = 'agent' THEN total_points
                  ELSE invite_points
                END DESC,
                CASE
                  WHEN ${pointsType} = 'invite' THEN agent_points
                  WHEN ${pointsType} = 'agent' THEN invite_points
                  ELSE agent_points
                END DESC,
                signup_id ASC
            )::int AS rank
          FROM scored
        )
        SELECT rank, signup_id, email, primary_wallet, referral_code, border_tier, total_points, invite_points, agent_points
        FROM ranked
        WHERE LOWER(primary_wallet) = LOWER(${walletKey})
        LIMIT 1;
      `
      const raw = meQuery?.rows?.[0] ?? null
      me = raw ? toLeaderboardRow(raw) : null
    }
  }

  const data: LeaderboardResponse = { page, limit, pointsType, totalCount, totalPages, hasMore, leaderboard, me }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<LeaderboardResponse>)
}
