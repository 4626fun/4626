import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { isAuthorizedWalletForProfile } from '../../../server/_lib/canonicalWalletResolver.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'
import { checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { PrivyClient } from '@privy-io/server-auth'

declare const process: { env: Record<string, string | undefined> }

type Body = { email?: string }

type VerifyXResponse = {
  email: string
  verified: boolean
  awarded: boolean
  borderTier: number
}

const TARGET_X_HANDLE = '4626fun'
const X_API_V2_BASE = 'https://api.twitter.com/2'

// Best-effort cache across warm serverless invocations.
let cachedTargetXUserId: string | null = null

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function readHeader(req: any, name: string): string | null {
  const key = name.trim().toLowerCase()
  const raw = (req?.headers?.[key] ?? req?.headers?.[name]) as unknown
  if (typeof raw === 'string') {
    const v = raw.trim()
    return v.length > 0 ? v : null
  }
  if (Array.isArray(raw)) {
    const v = String(raw[0] ?? '').trim()
    return v.length > 0 ? v : null
  }
  return null
}

function getPrivyServerAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

function getTwitterBearerToken(): string | null {
  const token = (process.env.TWITTER_BEARER_TOKEN || '').trim()
  return token.length > 0 ? token : null
}

function extractTwitterSubject(privyUser: any): string | null {
  const direct = typeof privyUser?.twitter?.subject === 'string' ? String(privyUser.twitter.subject).trim() : ''
  if (direct) return direct

  const linkedAccounts = Array.isArray(privyUser?.linkedAccounts)
    ? privyUser.linkedAccounts
    : Array.isArray(privyUser?.linked_accounts)
      ? privyUser.linked_accounts
      : []

  for (const acct of linkedAccounts) {
    const t = typeof acct?.type === 'string' ? acct.type : ''
    if (t !== 'twitter_oauth') continue
    const subject = typeof acct?.subject === 'string' ? String(acct.subject).trim() : ''
    if (subject) return subject
  }

  return null
}

function isXApiAccessLimited(status: number, text: string): boolean {
  if (status !== 403) return false
  const t = String(text || '').toLowerCase()
  // X returns this when the app has pay-per-usage credits but not endpoint access.
  return (
    t.includes('limited v1.1 endpoints') ||
    t.includes('subset of x api v2 endpoints') ||
    t.includes('"code":453') ||
    t.includes('code 453')
  )
}

async function resolveTargetXUserId(bearer: string): Promise<{ id: string | null; accessLimited: boolean }> {
  if (cachedTargetXUserId) return { id: cachedTargetXUserId, accessLimited: false }

  const url = `${X_API_V2_BASE}/users/by/username/${encodeURIComponent(TARGET_X_HANDLE)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn('[waitlist/verify-x] X API error (target lookup)', { status: res.status, text: text.slice(0, 200) })
    return { id: null, accessLimited: isXApiAccessLimited(res.status, text) }
  }

  const json = (await res.json().catch(() => null)) as any
  const id = typeof json?.data?.id === 'string' ? json.data.id.trim() : ''
  if (!id) return { id: null, accessLimited: false }
  cachedTargetXUserId = id
  return { id, accessLimited: false }
}

async function verifyXFollow(params: { twitterSubject: string }): Promise<boolean> {
  const bearer = getTwitterBearerToken()
  if (!bearer) throw new Error('twitter_bearer_token_missing')

  const target = await resolveTargetXUserId(bearer)
  // Fail closed: if we cannot resolve the target account, do not auto-verify.
  if (!target.id) return false
  const targetId = target.id

  let paginationToken: string | null = null
  const maxPages = 5
  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${X_API_V2_BASE}/users/${encodeURIComponent(params.twitterSubject)}/following`)
    url.searchParams.set('max_results', '1000')
    if (paginationToken) url.searchParams.set('pagination_token', paginationToken)

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[waitlist/verify-x] X API error (following lookup)', { status: res.status, text: text.slice(0, 200) })
      // Fail closed when X API access is limited/unavailable.
      if (isXApiAccessLimited(res.status, text)) return false
      return false
    }

    const json = (await res.json().catch(() => null)) as any
    const data = Array.isArray(json?.data) ? (json.data as any[]) : []
    for (const item of data) {
      const id = typeof item?.id === 'string' ? item.id : ''
      if (id && id === targetId) return true
    }

    const next = typeof json?.meta?.next_token === 'string' ? String(json.meta.next_token) : ''
    if (!next) return false
    paginationToken = next
  }

  return false
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limiting: 10 verifications per minute per IP
  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('verify-x', clientIp), { windowMs: 60_000, maxRequests: 10 })
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

  const privyAuthToken = readHeader(req, 'x-privy-token')
  if (!privyAuthToken) {
    return res.status(401).json({ success: false, error: 'Missing Privy auth token' } satisfies ApiEnvelope<never>)
  }

  const privyAuth = getPrivyServerAuth()
  if (!privyAuth) {
    return res.status(503).json({
      success: false,
      error: 'Privy server auth is not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).',
    } satisfies ApiEnvelope<never>)
  }

  if (!getTwitterBearerToken()) {
    return res.status(503).json({ success: false, error: 'X verification is not configured' } satisfies ApiEnvelope<never>)
  }

  // Read linked X account from Privy (server-side verified).
  let twitterSubject: string | null = null
  let verifiedPrivyUserId: string | null = null
  try {
    const client = new PrivyClient(privyAuth.appId, privyAuth.appSecret)
    const claims = await client.verifyAuthToken(privyAuthToken)
    verifiedPrivyUserId = typeof (claims as any)?.userId === 'string' ? String((claims as any).userId) : null
    const user = await client.getUserById(claims.userId)
    twitterSubject = extractTwitterSubject(user as any)
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : ''
    const lower = msg.toLowerCase()
    const isAuthish =
      lower.includes('jwt') ||
      lower.includes('token') ||
      lower.includes('signature') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden')
    return res.status(isAuthish ? 401 : 500).json({
      success: false,
      error: isAuthish ? 'Invalid Privy auth token' : 'Privy verification failed',
    } satisfies ApiEnvelope<never>)
  }

  if (!twitterSubject) {
    return res.status(400).json({ success: false, error: 'Connect X to verify' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  const me = await db.sql`
    SELECT id, border_tier, x_follow_verified_at, primary_wallet, embedded_wallet, csw_address, privy_user_id
    FROM profiles
    WHERE email = ${email}
    LIMIT 1;
  `
  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : row?.id ? Number(row.id) : null
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
  const profilePrivyUserId = typeof row?.privy_user_id === 'string' ? String(row.privy_user_id) : ''
  if (profilePrivyUserId && verifiedPrivyUserId && profilePrivyUserId !== verifiedPrivyUserId) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this profile',
    } satisfies ApiEnvelope<never>)
  }

  // Best-effort: bind profile to Privy user identity when missing.
  if (!profilePrivyUserId && verifiedPrivyUserId) {
    try {
      await db.sql`
        UPDATE profiles
        SET privy_user_id = COALESCE(privy_user_id, ${verifiedPrivyUserId}), updated_at = NOW()
        WHERE id = ${signupId};
      `
    } catch {
      // ignore
    }
  }

  const existingTier = typeof row?.border_tier === 'number' ? row.border_tier : row?.border_tier ? Number(row.border_tier) : 0
  const alreadyVerified = existingTier >= 1 || Boolean(row?.x_follow_verified_at)
  if (alreadyVerified) {
    // Best-effort: ensure points exist, but do not re-hit X API.
    let awarded = false
    try {
      const ins = await db.sql`
        INSERT INTO points (signup_id, source, source_id, amount, created_at)
        VALUES (${signupId}, 'social_x', 'x', ${WAITLIST_POINTS.x}, NOW())
        ON CONFLICT DO NOTHING
        RETURNING id;
      `
      awarded = Boolean(ins?.rows?.[0]?.id)
    } catch {
      // ignore
    }

    const data: VerifyXResponse = { email, verified: true, awarded, borderTier: Math.max(1, existingTier) }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<VerifyXResponse>)
  }

  const verified = await verifyXFollow({ twitterSubject })
  if (!verified) {
    const data: VerifyXResponse = { email, verified: false, awarded: false, borderTier: Math.max(0, existingTier) }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<VerifyXResponse>)
  }

  let awarded = false
  try {
    const pointInsert = await db.sql`
      INSERT INTO points (signup_id, source, source_id, amount, created_at)
      VALUES (${signupId}, 'social_x', 'x', ${WAITLIST_POINTS.x}, NOW())
      ON CONFLICT DO NOTHING
      RETURNING id;
    `
    awarded = Boolean(pointInsert?.rows?.[0]?.id)
  } catch {
    // Best-effort: don't block verification on points ledger issues.
    awarded = false
  }

  const updated = await db.sql`
    UPDATE profiles
    SET
      border_tier = GREATEST(COALESCE(border_tier, 0), 1),
      x_follow_verified_at = COALESCE(x_follow_verified_at, NOW()),
      updated_at = NOW()
    WHERE id = ${signupId}
    RETURNING border_tier;
  `
  const borderTierRaw = updated?.rows?.[0]?.border_tier
  const borderTier = typeof borderTierRaw === 'number' ? borderTierRaw : borderTierRaw ? Number(borderTierRaw) : 1

  const data: VerifyXResponse = { email, verified: true, awarded, borderTier }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<VerifyXResponse>)
}

