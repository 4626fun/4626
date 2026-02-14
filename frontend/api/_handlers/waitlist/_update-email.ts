import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { checkRateLimit, RATE_LIMITS, rateLimitKey, getClientIp } from '../../../server/_lib/rateLimit.js'

type Body = { currentEmail?: string; newEmail?: string }

type UpdateEmailResponse = {
  email: string
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isSyntheticEmail(v: string): boolean {
  return v.endsWith('@noemail.4626.fun')
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limiting: 5 email updates per minute per IP
  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('update-email', clientIp), { windowMs: 60_000, maxRequests: 5 })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  // Authentication required - verify caller owns the profile
  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  const currentEmail = normalizeEmail(typeof body?.currentEmail === 'string' ? body.currentEmail : '')
  const newEmail = normalizeEmail(typeof body?.newEmail === 'string' ? body.newEmail : '')

  if (!isValidEmail(currentEmail) || !isValidEmail(newEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  if (!isSyntheticEmail(currentEmail)) {
    return res.status(400).json({ success: false, error: 'Email update is not available.' } satisfies ApiEnvelope<never>)
  }

  if (currentEmail === newEmail) {
    const data: UpdateEmailResponse = { email: newEmail }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  // Verify the authenticated principal owns this profile (check primary_wallet, embedded_wallet, or csw_address)
  const ownershipCheck = await db.sql`
    SELECT id FROM profiles
    WHERE email = ${currentEmail}
      AND (LOWER(primary_wallet) = ${principalAddress} 
           OR LOWER(embedded_wallet) = ${principalAddress}
           OR LOWER(csw_address) = ${principalAddress})
    LIMIT 1;
  `
  if (!ownershipCheck?.rows?.[0]) {
    return res.status(403).json({ success: false, error: 'Not authorized to update this profile' } satisfies ApiEnvelope<never>)
  }

  // Atomic update with NOT EXISTS to prevent TOCTOU race
  const updated = await db.sql`
    UPDATE profiles
    SET email = ${newEmail}, contact_preference = 'email', updated_at = NOW()
    WHERE email = ${currentEmail}
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE email = ${newEmail})
    RETURNING id, email;
  `
  const row = updated?.rows?.[0] ?? null
  if (!row?.id) {
    // Could be: profile not found, or email already taken (race condition)
    const conflict = await db.sql`SELECT id FROM profiles WHERE email = ${newEmail} LIMIT 1;`
    if (conflict?.rows?.[0]) {
      return res.status(409).json({ success: false, error: 'Email already in use.' } satisfies ApiEnvelope<never>)
    }
    return res.status(404).json({ success: false, error: 'Signup not found.' } satisfies ApiEnvelope<never>)
  }

  const data: UpdateEmailResponse = { email: String(row.email ?? newEmail) }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
}
