import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type WaitlistPositionResponse = {
  email: string | null
  signupId: number
  profileCompletedAt: string | null

  referralCode: string | null
  borderTier: number

  points: {
    total: number
    invite: number
    signup: number
    tasks: number
    csw: number       // Points from CSW linking
    social: number    // Points from verified social actions
    bonus: number     // Points from honor system actions
  }

  rank: {
    invite: number | null
    total: number | null
  }

  totalCount: number
  totalAheadInvite: number | null
  percentileInvite: number | null

  referrals: {
    qualifiedCount: number   // Referrals who linked CSW
    pendingCount: number     // Referrals who only signed up
    pendingCountCapped: number
    pendingCap: number
  }
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function safeInt(v: any): number {
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
  const rateLimit = checkRateLimit(rateLimitKey('waitlist-position', clientIp), { windowMs: 60_000, maxRequests: 60 })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const emailParam = typeof (req.query as any)?.email === 'string' ? String((req.query as any).email) : ''
  const walletParam = typeof (req.query as any)?.wallet === 'string' ? String((req.query as any).wallet).trim().toLowerCase() : ''
  
  const email = normalizeEmail(emailParam)
  const wallet = walletParam
  
  // Must provide either valid email or valid wallet
  const hasValidEmail = isValidEmail(email)
  const hasValidWallet = isValidEvmAddress(wallet)
  const principalAddress = readRequestPrincipalAddress(req)
  
  if (!hasValidEmail && !hasValidWallet) {
    return res.status(400).json({ success: false, error: 'Invalid email or wallet' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  // Query by email first, then by wallet
  let me
  if (hasValidEmail) {
    me = await db.sql`
      SELECT
        id, email, referral_code, profile_completed_at, border_tier,
        primary_wallet, embedded_wallet, primary_embedded_eoa, csw_address, primary_smart_wallet, base_sub_account
      FROM profiles
      WHERE email = ${email}
      LIMIT 1;
    `
  }
  
  // If no result by email, try by wallet
  if ((!me?.rows?.length) && hasValidWallet) {
    me = await db.sql`
      SELECT
        p.id, p.email, p.referral_code, p.profile_completed_at, p.border_tier,
        p.primary_wallet, p.embedded_wallet, p.primary_embedded_eoa, p.csw_address, p.primary_smart_wallet, p.base_sub_account
      FROM profiles p
      WHERE LOWER(p.primary_wallet) = ${wallet}
         OR LOWER(p.embedded_wallet) = ${wallet}
         OR LOWER(p.primary_embedded_eoa) = ${wallet}
         OR LOWER(p.csw_address) = ${wallet}
         OR LOWER(p.primary_smart_wallet) = ${wallet}
         OR LOWER(p.base_sub_account) = ${wallet}
         OR EXISTS (
           SELECT 1
           FROM profile_wallets pw
           WHERE pw.profile_id = p.id
             AND LOWER(pw.address) = ${wallet}
         )
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at ASC NULLS LAST, p.id ASC
      LIMIT 1;
    `
  }
  const row = me?.rows?.[0] ?? null
  const signupIdRaw = typeof row?.id === 'number' ? row.id : row?.id ? Number(row.id) : null
  const signupId = typeof signupIdRaw === 'number' && Number.isFinite(signupIdRaw) ? Math.floor(signupIdRaw) : null
  if (!signupId) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistPositionResponse | null>)
  }

  // All lookups must be owner-authorized to prevent profile enumeration.
  if (!principalAddress) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistPositionResponse | null>)
  }
  const principal = principalAddress.toLowerCase()
  const ownsByInlineField =
    (typeof row?.primary_wallet === 'string' && row.primary_wallet.toLowerCase() === principal) ||
    (typeof row?.embedded_wallet === 'string' && row.embedded_wallet.toLowerCase() === principal) ||
    (typeof row?.primary_embedded_eoa === 'string' && row.primary_embedded_eoa.toLowerCase() === principal) ||
    (typeof row?.csw_address === 'string' && row.csw_address.toLowerCase() === principal) ||
    (typeof row?.primary_smart_wallet === 'string' && row.primary_smart_wallet.toLowerCase() === principal) ||
    (typeof row?.base_sub_account === 'string' && row.base_sub_account.toLowerCase() === principal)

  let ownsByMappedWallet = false
  if (!ownsByInlineField) {
    const ownedQ = await db.sql`
      SELECT 1
      FROM profile_wallets
      WHERE profile_id = ${signupId}
        AND LOWER(address) = ${principal}
      LIMIT 1;
    `
    ownsByMappedWallet = Boolean(ownedQ?.rows?.[0])
  }

  if (!ownsByInlineField && !ownsByMappedWallet) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistPositionResponse | null>)
  }

  const resolvedEmail = typeof row?.email === 'string' ? normalizeEmail(String(row.email)) : email
  const exposedEmail = hasValidEmail ? resolvedEmail : null
  const profileCompletedAt = row?.profile_completed_at ? String(row.profile_completed_at) : null
  const referralCode = typeof row?.referral_code === 'string' ? String(row.referral_code) : null
  const borderTier = safeInt(row?.border_tier)

  const pointsAgg = await db.sql`
    SELECT
      COALESCE(SUM(amount), 0)::int AS total,
      COALESCE(SUM(CASE WHEN source IN ('referral_qualified', 'referral_signup', 'referral_csw_link') THEN amount ELSE 0 END), 0)::int AS invite,
      COALESCE(SUM(CASE WHEN source = 'waitlist_signup' THEN amount ELSE 0 END), 0)::int AS signup,
      COALESCE(SUM(CASE WHEN source = 'task' THEN amount ELSE 0 END), 0)::int AS tasks,
      COALESCE(SUM(CASE WHEN source = 'csw_link' THEN amount ELSE 0 END), 0)::int AS csw,
      COALESCE(SUM(CASE WHEN source LIKE 'social_%' THEN amount ELSE 0 END), 0)::int AS social,
      COALESCE(SUM(CASE WHEN source LIKE 'bonus_%' THEN amount ELSE 0 END), 0)::int AS bonus
    FROM points
    WHERE signup_id = ${signupId};
  `
  const p = pointsAgg?.rows?.[0] ?? {}
  const points = {
    total: safeInt(p.total),
    invite: safeInt(p.invite),
    signup: safeInt(p.signup),
    tasks: safeInt(p.tasks),
    csw: safeInt(p.csw),
    social: safeInt(p.social),
    bonus: safeInt(p.bonus),
  }

  // Referral breakdown (pending vs qualified).
  // Qualified = referrals who linked CSW
  const qualifiedQ = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${signupId}
      AND is_valid = TRUE
      AND (status = 'csw_linked' OR status = 'qualified' OR qualified_at IS NOT NULL);
  `
  const qualifiedCount = safeInt(qualifiedQ?.rows?.[0]?.c)

  // Pending = referrals who only signed up (haven't linked CSW yet)
  const pendingQ = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${signupId}
      AND is_valid = TRUE
      AND NOT (status = 'csw_linked' OR status = 'qualified' OR qualified_at IS NOT NULL);
  `
  const pendingCount = safeInt(pendingQ?.rows?.[0]?.c)
  const pendingCap = 10
  const pendingCountCapped = Math.min(pendingCount, pendingCap)

  // Leaderboard rank (invite and total) among profile-complete profiles.
  const totalCountQ = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM profiles
    WHERE profile_completed_at IS NOT NULL;
  `
  const totalCount = Math.max(0, safeInt(totalCountQ?.rows?.[0]?.c))

  const inviteRankQ = await db.sql`
    WITH eligible AS (
      SELECT id
      FROM profiles
      WHERE profile_completed_at IS NOT NULL
    ),
    scored AS (
      SELECT
        e.id AS signup_id,
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
      FROM eligible e
      LEFT JOIN points l ON l.signup_id = e.id
      GROUP BY e.id
    ),
    ranked AS (
      SELECT
        signup_id,
        ROW_NUMBER() OVER (ORDER BY invite_points DESC, total_points DESC, agent_points DESC, signup_id ASC)::int AS rank_invite
      FROM scored
    )
    SELECT rank_invite
    FROM ranked
    WHERE signup_id = ${signupId}
    LIMIT 1;
  `
  const inviteRank = typeof inviteRankQ?.rows?.[0]?.rank_invite === 'number' ? (inviteRankQ.rows[0].rank_invite as number) : null

  const totalRankQ = await db.sql`
    WITH eligible AS (
      SELECT id
      FROM profiles
      WHERE profile_completed_at IS NOT NULL
    ),
    scored AS (
      SELECT
        e.id AS signup_id,
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
      FROM eligible e
      LEFT JOIN points l ON l.signup_id = e.id
      GROUP BY e.id
    ),
    ranked AS (
      SELECT
        signup_id,
        ROW_NUMBER() OVER (ORDER BY total_points DESC, invite_points DESC, agent_points DESC, signup_id ASC)::int AS rank_total
      FROM scored
    )
    SELECT rank_total
    FROM ranked
    WHERE signup_id = ${signupId}
    LIMIT 1;
  `
  const totalRank = typeof totalRankQ?.rows?.[0]?.rank_total === 'number' ? (totalRankQ.rows[0].rank_total as number) : null

  const totalAheadInvite = typeof inviteRank === 'number' && inviteRank > 0 ? inviteRank - 1 : null
  const percentileInvite =
    typeof inviteRank === 'number' && inviteRank > 0 && totalCount > 0 ? Math.min(100, Math.max(1, Math.round((inviteRank / totalCount) * 100))) : null

  const data: WaitlistPositionResponse = {
    email: exposedEmail,
    signupId,
    profileCompletedAt,
    referralCode,
    borderTier,
    points,
    rank: { invite: inviteRank, total: totalRank },
    totalCount,
    totalAheadInvite,
    percentileInvite,
    referrals: { qualifiedCount, pendingCount, pendingCountCapped, pendingCap },
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistPositionResponse>)
}

