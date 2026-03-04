import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { isCswOwner } from '../../../server/_lib/cswOwner.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, ensureWaitlistPointsSchema, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'
import { checkRateLimit, rateLimitKey, getClientIp } from '../../../server/_lib/rateLimit.js'

type Body = { email?: string }

type ProfileCompleteResponse = {
  email: string
  profileCompleted: boolean
  qualifiedReferral: boolean
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limiting: 10 profile completions per minute per IP
  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('profile-complete', clientIp), { windowMs: 60_000, maxRequests: 10 })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
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

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)

  await ensureWaitlistSchema(db as any)
  await ensureWaitlistPointsSchema(db as any)

  // Mark profile completed (idempotent).
  const updated = await db.sql`
    UPDATE profiles
    SET profile_completed_at = COALESCE(profile_completed_at, NOW()), updated_at = NOW()
    WHERE email = ${email}
      AND (
        LOWER(primary_wallet) = ${principalAddress}
        OR LOWER(embedded_wallet) = ${principalAddress}
        OR LOWER(csw_address) = ${principalAddress}
        OR LOWER(primary_smart_wallet) = ${principalAddress}
        OR LOWER(base_sub_account) = ${principalAddress}
      )
    RETURNING id, profile_completed_at;
  `
  const row = updated?.rows?.[0] ?? null
  let signupId = typeof row?.id === 'number' ? (row.id as number) : null
  let profileCompleted = Boolean(row?.profile_completed_at)
  if (!signupId) {
    const exists = await db.sql`
      SELECT id, csw_address
      FROM profiles
      WHERE email = ${email}
      LIMIT 1;
    `
    const existingRow = exists?.rows?.[0]
    if (existingRow?.id) {
      // Principal wallet didn't match legacy profile columns.
      // First, allow any wallet already linked to the same profile via profile_wallets.
      const existingId = Number(existingRow.id)
      try {
        const linkedWallet = await db.sql`
          SELECT 1
          FROM profile_wallets
          WHERE profile_id = ${existingId}
            AND LOWER(address) = ${principalAddress}
          LIMIT 1;
        `
        if (linkedWallet?.rows?.[0]) {
          const linkedUpdate = await db.sql`
            UPDATE profiles
            SET profile_completed_at = COALESCE(profile_completed_at, NOW()), updated_at = NOW()
            WHERE id = ${existingId}
            RETURNING id, profile_completed_at;
          `
          signupId = existingId
          profileCompleted = Boolean(linkedUpdate?.rows?.[0]?.profile_completed_at)
        }
      } catch {
        // `profile_wallets` may be unavailable on older schemas. Continue to CSW-owner fallback.
      }

      // Final fallback: check if principal wallet is an owner of the profile's linked CSW.
      const cswAddr = typeof existingRow.csw_address === 'string' ? existingRow.csw_address.trim() : ''
      if (!signupId && cswAddr && /^0x[a-fA-F0-9]{40}$/.test(cswAddr)) {
        try {
          const owned = await isCswOwner(principalAddress, cswAddr)
          if (owned) {
            const ownerUpdate = await db.sql`
              UPDATE profiles
              SET profile_completed_at = COALESCE(profile_completed_at, NOW()), updated_at = NOW()
              WHERE id = ${existingId}
              RETURNING id, profile_completed_at;
            `
            signupId = existingId
            profileCompleted = Boolean(ownerUpdate?.rows?.[0]?.profile_completed_at)
          }
        } catch {
          // On-chain check failed; fall through to 403
        }
      }
      if (!signupId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this profile. Sign in with the same wallet you used for the waitlist, or with a wallet that owns your linked CSW.',
        } satisfies ApiEnvelope<never>)
      }
    }
    // Not on waitlist (yet). Return success with a clear state so the client can ignore.
    const data: ProfileCompleteResponse = { email, profileCompleted: false, qualifiedReferral: false }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ProfileCompleteResponse>)
  }

  // If this signup has a referrer conversion, qualify it and award points to the referrer (idempotent via ledger).
  const conv = await db.sql`
    SELECT id, referrer_signup_id, is_valid, status, qualified_at
    FROM referral_conversions
    WHERE invitee_signup_id = ${signupId}
    LIMIT 1;
  `
  const c = conv?.rows?.[0] ?? null
  const convId = typeof c?.id === 'number' ? (c.id as number) : null
  const referrerSignupId = typeof c?.referrer_signup_id === 'number' ? (c.referrer_signup_id as number) : null
  const isValid = c?.is_valid === true
  const isAlreadyQualified = (typeof c?.status === 'string' && String(c.status) === 'qualified') || Boolean(c?.qualified_at)

  let qualifiedReferral = false
  if (convId && referrerSignupId && isValid && !isAlreadyQualified) {
    await db.sql`
      UPDATE referral_conversions
      SET status = 'qualified', qualified_at = COALESCE(qualified_at, NOW())
      WHERE id = ${convId};
    `
    await awardWaitlistPoints({
      db,
      signupId: referrerSignupId,
      source: 'referral_qualified',
      sourceId: `conversion:${convId}`,
      amount: WAITLIST_POINTS.qualifiedReferral,
    })
    qualifiedReferral = true
  }

  const data: ProfileCompleteResponse = { email, profileCompleted, qualifiedReferral }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ProfileCompleteResponse>)
}
