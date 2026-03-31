type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[] }> }

export type ReferralsPeriod = 'weekly' | 'all_time'

export type ReferralsWeekBounds = {
  start: Date
  end: Date
}

export type ReferralsTopRow = {
  rank: number
  referralCode: string
  conversions: number
  primaryWallet: string | null
}

export function maskReferralCode(value: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  if (normalized.length <= 4) return '****'
  return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
}

export function getWeekBoundsUtc(now = new Date()): ReferralsWeekBounds {
  // Monday 00:00 UTC → next Monday 00:00 UTC
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const day = d.getUTCDay() // 0=Sun,1=Mon
  const diffToMon = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - diffToMon)
  const start = d
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function getReferrerProfileByAddressOrCode(
  db: Db,
  params: { address: string; referralCode: string }
): Promise<{ signupId: number | null; referralCode: string | null }> {
  const { address, referralCode } = params
  const me =
    address.length > 0
      ? await db.sql`
          SELECT id, referral_code
          FROM profiles
          WHERE (
            LOWER(primary_wallet) = ${address}
            OR LOWER(embedded_wallet) = ${address}
            OR LOWER(csw_address) = ${address}
            OR LOWER(base_sub_account) = ${address}
          )
          LIMIT 1;
        `
      : referralCode.trim().length > 0
        ? await db.sql`
            SELECT id, referral_code
            FROM profiles
            WHERE referral_code = ${referralCode.trim().toUpperCase()}
            LIMIT 1;
          `
        : null

  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  const resolvedReferralCode = typeof row?.referral_code === 'string' ? (row.referral_code as string) : null
  return { signupId, referralCode: resolvedReferralCode }
}

export async function getReferralsMeStats(
  db: Db,
  signupId: number,
  week: ReferralsWeekBounds
): Promise<{
  weeklyConversions: number
  allTimeConversions: number
  weeklyRank: number | null
  allTimeRank: number | null
}> {
  const { start, end } = week

  const weekly = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${signupId}
      AND is_valid = TRUE
      AND created_at >= ${start.toISOString()}
      AND created_at < ${end.toISOString()};
  `
  const weeklyConversions = typeof weekly?.rows?.[0]?.c === 'number' ? (weekly.rows?.[0].c as number) : 0

  const allTime = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${signupId}
      AND is_valid = TRUE;
  `
  const allTimeConversions = typeof allTime?.rows?.[0]?.c === 'number' ? (allTime.rows?.[0].c as number) : 0

  const rankWeekly = await db.sql`
    WITH referrers AS (
      SELECT id
      FROM profiles
      WHERE referral_code IS NOT NULL
    ),
    conversions AS (
      SELECT referrer_signup_id, COUNT(*)::int AS conversions
      FROM referral_conversions
      WHERE is_valid = TRUE
        AND created_at >= ${start.toISOString()}
        AND created_at < ${end.toISOString()}
      GROUP BY referrer_signup_id
    ),
    clicks AS (
      SELECT referrer_signup_id,
        COUNT(DISTINCT COALESCE(ip_hash, ua_hash))::int AS unique_clicks
      FROM referral_clicks
      WHERE is_bot_suspected = FALSE
        AND created_at >= ${start.toISOString()}
        AND created_at < ${end.toISOString()}
      GROUP BY referrer_signup_id
    ),
    scored AS (
      SELECT r.id,
        COALESCE(conv.conversions, 0)::int AS conversions,
        COALESCE(clk.unique_clicks, 0)::int AS unique_clicks
      FROM referrers r
      LEFT JOIN conversions conv ON conv.referrer_signup_id = r.id
      LEFT JOIN clicks clk ON clk.referrer_signup_id = r.id
    ),
    ranked AS (
      SELECT id, conversions,
        DENSE_RANK() OVER (ORDER BY conversions DESC, unique_clicks DESC, id ASC)::int AS rank
      FROM scored
    )
    SELECT rank FROM ranked WHERE id = ${signupId} LIMIT 1;
  `
  const weeklyRank = typeof rankWeekly?.rows?.[0]?.rank === 'number' ? (rankWeekly.rows?.[0].rank as number) : null

  const rankAll = await db.sql`
    WITH referrers AS (
      SELECT id
      FROM profiles
      WHERE referral_code IS NOT NULL
    ),
    conversions AS (
      SELECT referrer_signup_id, COUNT(*)::int AS conversions
      FROM referral_conversions
      WHERE is_valid = TRUE
      GROUP BY referrer_signup_id
    ),
    clicks AS (
      SELECT referrer_signup_id,
        COUNT(DISTINCT COALESCE(ip_hash, ua_hash))::int AS unique_clicks
      FROM referral_clicks
      WHERE is_bot_suspected = FALSE
      GROUP BY referrer_signup_id
    ),
    scored AS (
      SELECT r.id,
        COALESCE(conv.conversions, 0)::int AS conversions,
        COALESCE(clk.unique_clicks, 0)::int AS unique_clicks
      FROM referrers r
      LEFT JOIN conversions conv ON conv.referrer_signup_id = r.id
      LEFT JOIN clicks clk ON clk.referrer_signup_id = r.id
    ),
    ranked AS (
      SELECT id, conversions,
        DENSE_RANK() OVER (ORDER BY conversions DESC, unique_clicks DESC, id ASC)::int AS rank
      FROM scored
    )
    SELECT rank FROM ranked WHERE id = ${signupId} LIMIT 1;
  `
  const allTimeRank = typeof rankAll?.rows?.[0]?.rank === 'number' ? (rankAll.rows?.[0].rank as number) : null

  return {
    weeklyConversions,
    allTimeConversions,
    weeklyRank,
    allTimeRank,
  }
}

export async function getReferralLeaderboardTop(
  db: Db,
  params: { period: ReferralsPeriod; limit: number; week: ReferralsWeekBounds }
): Promise<ReferralsTopRow[]> {
  const { period, limit, week } = params
  const { start, end } = week

  const rows =
    period === 'weekly'
      ? await db.sql`
          WITH referrers AS (
            SELECT id, referral_code, primary_wallet
            FROM profiles
            WHERE referral_code IS NOT NULL
          ),
          conversions AS (
            SELECT referrer_signup_id, COUNT(*)::int AS conversions
            FROM referral_conversions
            WHERE is_valid = TRUE
              AND created_at >= ${start.toISOString()}
              AND created_at < ${end.toISOString()}
            GROUP BY referrer_signup_id
          ),
          clicks AS (
            SELECT referrer_signup_id,
              COUNT(DISTINCT COALESCE(ip_hash, ua_hash))::int AS unique_clicks
            FROM referral_clicks
            WHERE is_bot_suspected = FALSE
              AND created_at >= ${start.toISOString()}
              AND created_at < ${end.toISOString()}
            GROUP BY referrer_signup_id
          ),
          scored AS (
            SELECT r.id, r.referral_code, r.primary_wallet,
              COALESCE(conv.conversions, 0)::int AS conversions,
              COALESCE(clk.unique_clicks, 0)::int AS unique_clicks
            FROM referrers r
            LEFT JOIN conversions conv ON conv.referrer_signup_id = r.id
            LEFT JOIN clicks clk ON clk.referrer_signup_id = r.id
          ),
          ranked AS (
            SELECT
              referral_code,
              primary_wallet,
              conversions,
              DENSE_RANK() OVER (ORDER BY conversions DESC, unique_clicks DESC, id ASC)::int AS rank
            FROM scored
          )
          SELECT rank, referral_code, conversions, primary_wallet
          FROM ranked
          ORDER BY rank ASC
          LIMIT ${limit};
        `
      : await db.sql`
          WITH referrers AS (
            SELECT id, referral_code, primary_wallet
            FROM profiles
            WHERE referral_code IS NOT NULL
          ),
          conversions AS (
            SELECT referrer_signup_id, COUNT(*)::int AS conversions
            FROM referral_conversions
            WHERE is_valid = TRUE
            GROUP BY referrer_signup_id
          ),
          clicks AS (
            SELECT referrer_signup_id,
              COUNT(DISTINCT COALESCE(ip_hash, ua_hash))::int AS unique_clicks
            FROM referral_clicks
            WHERE is_bot_suspected = FALSE
            GROUP BY referrer_signup_id
          ),
          scored AS (
            SELECT r.id, r.referral_code, r.primary_wallet,
              COALESCE(conv.conversions, 0)::int AS conversions,
              COALESCE(clk.unique_clicks, 0)::int AS unique_clicks
            FROM referrers r
            LEFT JOIN conversions conv ON conv.referrer_signup_id = r.id
            LEFT JOIN clicks clk ON clk.referrer_signup_id = r.id
          ),
          ranked AS (
            SELECT
              referral_code,
              primary_wallet,
              conversions,
              DENSE_RANK() OVER (ORDER BY conversions DESC, unique_clicks DESC, id ASC)::int AS rank
            FROM scored
          )
          SELECT rank, referral_code, conversions, primary_wallet
          FROM ranked
          ORDER BY rank ASC
          LIMIT ${limit};
        `

  if (!Array.isArray(rows?.rows)) return []
  return rows.rows.map((r: any) => ({
    rank: Number(r.rank) || 0,
    referralCode: typeof r.referral_code === 'string' ? r.referral_code : '',
    conversions: Number(r.conversions) || 0,
    primaryWallet: typeof r.primary_wallet === 'string' ? r.primary_wallet : null,
  }))
}

export async function getProfileIdByPrincipalAddress(db: Db, address: string): Promise<number | null> {
  const mine = await db.sql`
    SELECT id
    FROM profiles
    WHERE (
      LOWER(primary_wallet) = ${address}
      OR LOWER(embedded_wallet) = ${address}
      OR LOWER(csw_address) = ${address}
      OR LOWER(base_sub_account) = ${address}
    )
    LIMIT 1;
  `
  return typeof mine?.rows?.[0]?.id === 'number' ? (mine.rows?.[0].id as number) : null
}

export async function getReferralRanksForLeaderboardMe(
  db: Db,
  myId: number,
  week: ReferralsWeekBounds
): Promise<{ weeklyRank: number | null; allTimeRank: number | null }> {
  const { start, end } = week

  const rWeekly = await db.sql`
    WITH referrers AS (
      SELECT id
      FROM profiles
      WHERE referral_code IS NOT NULL
    ),
    scored AS (
      SELECT r.id,
        COALESCE(COUNT(c.id), 0)::int AS conversions
      FROM referrers r
      LEFT JOIN referral_conversions c
        ON c.referrer_signup_id = r.id
       AND c.is_valid = TRUE
       AND c.created_at >= ${start.toISOString()}
       AND c.created_at < ${end.toISOString()}
      GROUP BY r.id
    ),
    ranked AS (
      SELECT id, DENSE_RANK() OVER (ORDER BY conversions DESC, id ASC)::int AS rank
      FROM scored
    )
    SELECT rank FROM ranked WHERE id = ${myId} LIMIT 1;
  `
  const weeklyRank = typeof rWeekly?.rows?.[0]?.rank === 'number' ? (rWeekly.rows?.[0].rank as number) : null

  const rAll = await db.sql`
    WITH referrers AS (
      SELECT id
      FROM profiles
      WHERE referral_code IS NOT NULL
    ),
    scored AS (
      SELECT r.id,
        COALESCE(COUNT(c.id), 0)::int AS conversions
      FROM referrers r
      LEFT JOIN referral_conversions c
        ON c.referrer_signup_id = r.id
       AND c.is_valid = TRUE
      GROUP BY r.id
    ),
    ranked AS (
      SELECT id, DENSE_RANK() OVER (ORDER BY conversions DESC, id ASC)::int AS rank
      FROM scored
    )
    SELECT rank FROM ranked WHERE id = ${myId} LIMIT 1;
  `
  const allTimeRank = typeof rAll?.rows?.[0]?.rank === 'number' ? (rAll.rows?.[0].rank as number) : null

  return { weeklyRank, allTimeRank }
}
