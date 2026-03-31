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

import { isAuthorizedWalletForProfile } from '../../../server/_lib/canonicalWalletResolver.js'

import { normalizeReferralCode } from '../../../server/_lib/referrals.js'


import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { ensureWaitlistPointsSchema } from '../../../server/_lib/waitlistPoints.js'

type LedgerEntry = {
  source: string
  sourceId: string | null
  amount: number
  createdAt: string
}

type WaitlistLedgerResponse = {
  signupId: number
  referralCode: string | null
  totalPoints: number
  entries: LedgerEntry[]
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
  const rateLimit = checkRateLimit(rateLimitKey('waitlist-ledger', clientIp), {
    windowMs: 60_000,
    maxRequests: 60,
  })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const refParam = typeof (req.query as any)?.ref === 'string' ? String((req.query as any).ref) : ''
  const emailParam = typeof (req.query as any)?.email === 'string' ? String((req.query as any).email) : ''

  const referralCode = refParam ? normalizeReferralCode(refParam) : ''
  if (refParam && !referralCode) {
    return res.status(400).json({ success: false, error: 'Invalid referral code' } satisfies ApiEnvelope<never>)
  }

  const email = normalizeEmail(emailParam)
  if (!referralCode && !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)
  await ensureWaitlistPointsSchema(db as any)

  const principalAddress = readRequestPrincipalAddress(req)

  const me = referralCode
    ? await db.sql`
        SELECT
          id,
          referral_code,
          primary_wallet,
          embedded_wallet,
          primary_embedded_eoa,
          csw_address,
          primary_smart_wallet,
          base_sub_account
        FROM profiles
        WHERE referral_code = ${referralCode}
        LIMIT 1;
      `
    : await db.sql`
        SELECT
          id,
          referral_code,
          primary_wallet,
          embedded_wallet,
          primary_embedded_eoa,
          csw_address,
          primary_smart_wallet,
          base_sub_account
        FROM profiles
        WHERE email = ${email}
        LIMIT 1;
      `

  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  if (!signupId) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistLedgerResponse | null>)
  }

  // Require owner authorization to prevent email/ref-code profile enumeration.
  if (!principalAddress || !isValidEvmAddress(principalAddress)) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistLedgerResponse | null>)
  }
  const authorized = await isAuthorizedWalletForProfile({
    db: db as any,
    profileId: signupId,
    address: principalAddress,
  })
  if (!authorized) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistLedgerResponse | null>)
  }

  const referralCodeOut = typeof row?.referral_code === 'string' ? String(row.referral_code) : null

  const totalAgg = await db.sql`
    SELECT COALESCE(
      ROUND(
        SUM(
          CASE
            WHEN source = 'amoe_entry_spend' THEN amount
            WHEN source = 'amoe_twitter_daily' THEN amount * 1.00
            WHEN source = 'waitlist_signup' THEN amount * 1.00
            WHEN source = 'csw_link' THEN amount * 1.00
            WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
            WHEN source LIKE 'social_%' THEN amount * 0.50
            WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
            WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
            WHEN source IN ('link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram', 'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin')
              THEN amount * 0.60
            ELSE amount * 0.30
          END
        )
      ),
      0
    )::int AS total
    FROM points
    WHERE signup_id = ${signupId};
  `
  const totalPoints = safeInt(totalAgg?.rows?.[0]?.total)

  const ledger = await db.sql`
    SELECT source, source_id, amount, created_at
    FROM points
    WHERE signup_id = ${signupId}
    ORDER BY created_at DESC
    LIMIT 200;
  `

  const entries: LedgerEntry[] = (ledger?.rows ?? []).map((row: any) => ({
    source: typeof row?.source === 'string' ? row.source : 'unknown',
    sourceId: typeof row?.source_id === 'string' ? row.source_id : null,
    amount: safeInt(row?.amount),
    createdAt: row?.created_at ? String(row.created_at) : '',
  }))

  const data: WaitlistLedgerResponse = { signupId, referralCode: referralCodeOut, totalPoints, entries }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistLedgerResponse>)
}
