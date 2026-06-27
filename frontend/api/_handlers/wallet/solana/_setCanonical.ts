import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  runInTransaction,
  readRequestPrincipalAddress,
  resolveAuthorizedRequestPrincipal,
  checkDurableRateLimit,
  RATE_LIMITS,
  rateLimitKey,
} from '@4626/server-core'



import { ensureWaitlistSchema } from '../../../../server/_lib/onboarding/waitlistSchema.js'

type Body = { wallet?: string }

type SetCanonicalSolanaResponse = {
  canonicalSolanaWallet: string
  operationalSolanaWallet: string | null
}

function isValidSolanaAddress(value: string): boolean {
  const s = String(value || '').trim()
  if (!s) return false
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function normalizeEvmAddress(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = normalizeEvmAddress(readRequestPrincipalAddress(req))
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('solana-set-canonical', principalAddress),
    RATE_LIMITS.solanaSetCanonical,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many canonical wallet updates' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as Body | null
  const requestedWallet = typeof body?.wallet === 'string' ? body.wallet.trim() : ''
  if (!isValidSolanaAddress(requestedWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid Solana wallet address' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureWaitlistSchema(db as any)

  const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  if (!authorizedPrincipal) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  const ownedProfile = await db.sql`
    SELECT p.id, p.solana_wallet
    FROM profiles p
    WHERE p.id = ${authorizedPrincipal.profileId}
    LIMIT 1;
  `
  const profileIdRaw = ownedProfile?.rows?.[0]?.id
  const profileId = typeof profileIdRaw === 'number' ? profileIdRaw : Number(profileIdRaw)
  if (!Number.isFinite(profileId) || profileId <= 0) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  const linkedSolana = await db.sql`
    SELECT pw.address
    FROM profile_wallets pw
    LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
    WHERE pw.profile_id = ${profileId}
      AND (
        LOWER(COALESCE(w.chain, '')) = 'solana'
        OR pw.address = ${requestedWallet}
      );
  `
  const linkedSolanaSet = new Set(
    (linkedSolana?.rows ?? [])
      .map((row: any) => (typeof row?.address === 'string' ? row.address.trim() : ''))
      .filter(Boolean),
  )
  const profileSolanaFallback =
    typeof ownedProfile?.rows?.[0]?.solana_wallet === 'string' ? ownedProfile.rows[0].solana_wallet.trim() : ''

  if (!linkedSolanaSet.has(requestedWallet) && requestedWallet !== profileSolanaFallback) {
    return res.status(403).json({
      success: false,
      error: 'Requested Solana wallet is not linked to this profile.',
    } satisfies ApiEnvelope<never>)
  }

  await runInTransaction(async (txDb) => {
    await txDb.sql`
      UPDATE profile_wallets
      SET is_canonical_solana_wallet = false, updated_at = NOW()
      WHERE profile_id = ${profileId}
        AND is_canonical_solana_wallet = true;
    `
    await txDb.sql`
      UPDATE profile_wallets
      SET is_canonical_solana_wallet = true,
          is_operational_solana_wallet = false,
          verified_at = COALESCE(verified_at, NOW()),
          updated_at = NOW()
      WHERE profile_id = ${profileId}
        AND address = ${requestedWallet};
    `
    await txDb.sql`
      UPDATE profiles
      SET canonical_solana_wallet = ${requestedWallet},
          solana_wallet = ${requestedWallet},
          updated_at = NOW()
      WHERE id = ${profileId};
    `
  })

  const operationalResult = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${profileId}
      AND is_operational_solana_wallet = true
      AND address <> ${requestedWallet}
    LIMIT 1;
  `
  const operationalAddress =
    typeof operationalResult?.rows?.[0]?.address === 'string' ? operationalResult.rows[0].address.trim() : null

  const data: SetCanonicalSolanaResponse = {
    canonicalSolanaWallet: requestedWallet,
    operationalSolanaWallet: operationalAddress,
  }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<SetCanonicalSolanaResponse>)
}
