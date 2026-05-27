import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  readRequestPrincipalAddress,
} from '../../../packages/server-core/src/index.js'

import { isAuthorizedWalletForProfile } from '../../../server/_lib/wallet/canonicalWalletResolver.js'



import { readWaitlistPositionForSignupId } from '../../../server/_lib/onboarding/waitlistPositionForProfile.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

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
  const authorized = await isAuthorizedWalletForProfile({
    db: db as any,
    profileId: signupId,
    address: principalAddress,
  })
  if (!authorized) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistPositionResponse | null>)
  }

  const resolvedEmail = typeof row?.email === 'string' ? normalizeEmail(String(row.email)) : email
  const exposedEmail = hasValidEmail ? resolvedEmail : null

  const snapshot = await readWaitlistPositionForSignupId(db as any, signupId)
  const data: WaitlistPositionResponse = {
    email: exposedEmail,
    signupId: snapshot.signupId,
    profileCompletedAt: snapshot.profileCompletedAt,
    referralCode: snapshot.referralCode,
    borderTier: snapshot.borderTier,
    points: snapshot.points,
    rank: snapshot.rank,
    totalCount: snapshot.totalCount,
    totalAheadInvite: snapshot.totalAheadInvite,
    percentileInvite: snapshot.percentileInvite,
    referrals: snapshot.referrals,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistPositionResponse>)
}
