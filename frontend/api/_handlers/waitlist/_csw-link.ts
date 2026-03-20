import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { isAuthorizedWalletForProfile } from '../../../server/_lib/canonicalWalletResolver.js'
import { isCswOwner, verifyCswProvenance } from '../../../server/_lib/cswOwner.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'
import { checkRateLimit, RATE_LIMITS, rateLimitKey, getClientIp } from '../../../server/_lib/rateLimit.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'

type Body = {
  email?: string
  cswAddress?: string
  primaryWallet?: string
}

type CswLinkResponse = {
  email: string
  cswAddress: string
  awarded: boolean
  points: number
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limiting: 10 CSW link attempts per minute per IP
  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('csw-link', clientIp), RATE_LIMITS.cswLink)
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  
  const emailRaw = typeof body?.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const cswAddress = typeof body?.cswAddress === 'string' ? body.cswAddress.trim() : ''
  if (!isValidEvmAddress(cswAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid CSW address' } satisfies ApiEnvelope<never>)
  }

  const primaryWallet = typeof body?.primaryWallet === 'string' ? body.primaryWallet.trim() : ''

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  
  await ensureWaitlistSchema(db as any)

  // Find the signup
  const me = await db.sql`
    SELECT id, primary_wallet, embedded_wallet, csw_address
    FROM profiles
    WHERE email = ${email}
    LIMIT 1;
  `
  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  
  if (!signupId) {
    return res.status(404).json({ success: false, error: 'Waitlist entry not found' } satisfies ApiEnvelope<never>)
  }

  const authorized = await isAuthorizedWalletForProfile({
    db: db as any,
    profileId: signupId,
    address: principalAddress,
  })
  if (!authorized) {
    return res.status(403).json({ success: false, error: 'Not authorized to update this profile' } satisfies ApiEnvelope<never>)
  }

  try {
    const isGenuineCsw = await verifyCswProvenance(cswAddress)
    if (!isGenuineCsw) {
      return res.status(403).json({ success: false, error: 'Wallet ownership verification failed' } satisfies ApiEnvelope<never>)
    }
    const ok = await isCswOwner(principalAddress, cswAddress)
    if (!ok) {
      return res.status(403).json({ success: false, error: 'Wallet ownership verification failed' } satisfies ApiEnvelope<never>)
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message ? String(err.message) : 'Failed to verify wallet ownership',
    } satisfies ApiEnvelope<never>)
  }

  // Check if this CSW is already linked to a different profile (prevent hijacking)
  const existingLink = await db.sql`
    SELECT id, email FROM profiles
    WHERE LOWER(csw_address) = ${cswAddress.toLowerCase()} AND id != ${signupId}
    LIMIT 1;
  `
  if (existingLink?.rows?.length > 0) {
    return res.status(409).json({ success: false, error: 'This wallet is already linked to another account' } satisfies ApiEnvelope<never>)
  }

  // Update the signup with the CSW address (store in dedicated csw_address column)
  await db.sql`
    UPDATE profiles
    SET csw_address = COALESCE(csw_address, ${cswAddress}),
        primary_wallet = COALESCE(primary_wallet, ${primaryWallet && isValidEvmAddress(primaryWallet) ? primaryWallet : cswAddress}),
        updated_at = NOW()
    WHERE id = ${signupId};
  `

  // Award CSW link points (idempotent via ledger unique key)
  // Use csw: prefix to match format in _waitlist.ts
  await awardWaitlistPoints({
    db,
    signupId,
    source: 'csw_link',
    sourceId: `csw:${cswAddress.toLowerCase()}`,
    amount: WAITLIST_POINTS.linkCsw,
  })

  // Also award referrer bonus if this user was referred
  const referrerResult = await db.sql`
    SELECT referred_by_signup_id
    FROM profiles
    WHERE id = ${signupId} AND referred_by_signup_id IS NOT NULL
    LIMIT 1;
  `
  const referrerId = typeof referrerResult?.rows?.[0]?.referred_by_signup_id === 'number'
    ? (referrerResult.rows[0].referred_by_signup_id as number)
    : null

  if (referrerId) {
    // Award referrer the CSW link bonus
    await awardWaitlistPoints({
      db,
      signupId: referrerId,
      source: 'referral_csw_link',
      sourceId: `invitee:${signupId}`,
      amount: WAITLIST_POINTS.referralCswLink,
    })

    // Update conversion status
    await db.sql`
      UPDATE referral_conversions
      SET status = 'csw_linked', qualified_at = NOW()
      WHERE invitee_signup_id = ${signupId} AND qualified_at IS NULL;
    `
  }

  const data: CswLinkResponse = {
    email,
    cswAddress,
    awarded: true,
    points: WAITLIST_POINTS.linkCsw,
  }
  
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<CswLinkResponse>)
}
