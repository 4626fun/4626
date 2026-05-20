type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[] }> }

export type WaitlistLeaderboardPointsType = 'total' | 'invite' | 'agent'

const MAX_LEADERBOARD_USERS = 2000

export type WaitlistLeaderboardRow = {
  rank: number
  signupId: number
  display: string
  cswAddress: string | null
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
  pointsAgent: number
  borderTier: number
}

export type WaitlistLeaderboardResponse = {
  page: number
  limit: number
  pointsType: WaitlistLeaderboardPointsType
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: WaitlistLeaderboardRow[]
  me: WaitlistLeaderboardRow | null
}

function safeInt(v: any): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function shortAddr(a: string | null): string | null {
  if (!a) return null
  const s = String(a)
  if (!s.startsWith('0x') || s.length < 12) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

/** Canonical asset-holding CSW only — never primary_wallet / embedded EOA. */
function resolveCanonicalCswAddress(raw: any): string | null {
  const fromColumn =
    typeof raw?.csw_address === 'string' && raw.csw_address.trim()
      ? String(raw.csw_address).trim()
      : null
  const fromSmart =
    typeof raw?.primary_smart_wallet === 'string' && raw.primary_smart_wallet.trim()
      ? String(raw.primary_smart_wallet).trim()
      : null
  const fromRollup =
    typeof raw?.canonical_csw === 'string' && raw.canonical_csw.trim()
      ? String(raw.canonical_csw).trim()
      : null
  return fromRollup ?? fromColumn ?? fromSmart
}

function toLeaderboardRow(raw: any, options?: { includeReferralCode?: boolean }): WaitlistLeaderboardRow {
  const signupId = safeInt(raw?.signup_id)
  const referralCodeRaw = typeof raw?.referral_code === 'string' ? String(raw.referral_code) : null
  const cswRaw = resolveCanonicalCswAddress(raw)
  const personaRaw = typeof raw?.persona === 'string' ? String(raw.persona).trim() : ''
  const display =
    shortAddr(cswRaw) ?? (personaRaw.length > 0 ? personaRaw : `user#${signupId}`)
  const referralCode = options?.includeReferralCode ? referralCodeRaw : null
  return {
    rank: safeInt(raw?.rank),
    signupId,
    display,
    cswAddress: cswRaw,
    referralCode,
    pointsTotal: safeInt(raw?.total_points),
    pointsInvite: safeInt(raw?.invite_points),
    pointsAgent: safeInt(raw?.agent_points),
    borderTier: safeInt(raw?.border_tier),
  }
}

export async function getWaitlistLeaderboardData(params: {
  db: Db
  page: number
  limit: number
  pointsType: WaitlistLeaderboardPointsType
  authorizedProfileId: number | null
}): Promise<WaitlistLeaderboardResponse> {
  const { db, page, limit, pointsType, authorizedProfileId } = params
  const offset = (page - 1) * limit

  const totalCountResult = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM profiles p
    WHERE p.email IS NOT NULL
      AND p.merged_into_profile_id IS NULL;
  `

  const totalCount = safeInt(totalCountResult?.rows?.[0]?.c)
  const totalPages = Math.max(1, Math.ceil(Math.max(1, totalCount) / limit))
  const hasMore = page < totalPages

  const rows = await db.sql`
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
        )::int AS points_total
      FROM points
      GROUP BY signup_id
    ),
    eligible AS (
      SELECT
        p.id,
        COALESCE(NULLIF(p.csw_address, ''), NULLIF(p.primary_smart_wallet, '')) AS canonical_csw,
        p.referral_code,
        p.border_tier,
        p.persona
      FROM profiles p
      WHERE p.email IS NOT NULL
        AND p.merged_into_profile_id IS NULL
      ORDER BY p.id ASC
      LIMIT ${MAX_LEADERBOARD_USERS}
    ),
    scored AS (
      SELECT
        e.id::bigint AS signup_id,
        e.canonical_csw,
        e.referral_code,
        e.border_tier,
        e.persona,
        COALESCE(pt.points_total, 0)::int AS total_points,
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
      GROUP BY e.id, e.canonical_csw, e.referral_code, e.border_tier, e.persona, pt.points_total
    ),
    ranked AS (
      SELECT
        signup_id,
        canonical_csw,
        referral_code,
        border_tier,
        persona,
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
    SELECT rank, signup_id, canonical_csw, referral_code, border_tier, persona, total_points, invite_points, agent_points
    FROM ranked
    ORDER BY rank ASC
    OFFSET ${offset}
    LIMIT ${limit};
  `

  const leaderboard: WaitlistLeaderboardRow[] = Array.isArray(rows?.rows)
    ? rows.rows.map((raw: any) => toLeaderboardRow(raw, { includeReferralCode: false }))
    : []

  let me: WaitlistLeaderboardRow | null = null
  if (authorizedProfileId != null) {
    const meQuery = await db.sql`
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
          )::int AS points_total
        FROM points
        GROUP BY signup_id
      ),
      eligible AS (
        SELECT
          p.id,
          COALESCE(NULLIF(p.csw_address, ''), NULLIF(p.primary_smart_wallet, '')) AS canonical_csw,
          p.referral_code,
          p.border_tier,
          p.persona
        FROM profiles p
        WHERE p.email IS NOT NULL
          AND p.merged_into_profile_id IS NULL
        ORDER BY p.id ASC
        LIMIT ${MAX_LEADERBOARD_USERS}
      ),
      scored AS (
        SELECT
          e.id::bigint AS signup_id,
          e.canonical_csw,
          e.referral_code,
          e.border_tier,
          e.persona,
          COALESCE(pt.points_total, 0)::int AS total_points,
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
        GROUP BY e.id, e.canonical_csw, e.referral_code, e.border_tier, e.persona, pt.points_total
      ),
      ranked AS (
        SELECT
          signup_id,
          canonical_csw,
          referral_code,
          border_tier,
          persona,
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
      SELECT rank, signup_id, canonical_csw, referral_code, border_tier, persona, total_points, invite_points, agent_points
      FROM ranked
      WHERE signup_id = ${authorizedProfileId}
      LIMIT 1;
    `
    const raw = meQuery?.rows?.[0] ?? null
    me = raw ? toLeaderboardRow(raw, { includeReferralCode: true }) : null
  }

  return { page, limit, pointsType, totalCount, totalPages, hasMore, leaderboard, me }
}
