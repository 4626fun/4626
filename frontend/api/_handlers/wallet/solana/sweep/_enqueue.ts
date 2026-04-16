import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipalAddress,
  resolveAuthorizedRequestPrincipal,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'



import { ensureWaitlistSchema } from '../../../../../server/_lib/onboarding/waitlistSchema.js'
import { enqueueSolanaSweepJob } from '../../../../../server/_lib/onchain/solanaSweepJobs.js'
import { resolveCanonicalSolanaWalletByProfileId } from '../../../../../server/_lib/wallet/canonicalSolanaResolver.js'

type Body = {
  minLamports?: number | string
}

type EnqueueSweepResponse = {
  jobId: number
  status: string
  canonicalSolanaWallet: string
  operationalSolanaWallet: string
  minLamports: string
}

function normalizePrincipalAddress(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : ''
}

function isSolanaAddress(value: unknown): value is string {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) return false
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function parseOptionalMinLamports(value: unknown): bigint | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = BigInt(value.trim())
      return parsed >= 0n ? parsed : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = normalizePrincipalAddress(readRequestPrincipalAddress(req))
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('solana-sweep-enqueue', principalAddress),
    RATE_LIMITS.solanaSweepEnqueue,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many sweep requests' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as Body | null
  const minLamports = parseOptionalMinLamports(body?.minLamports)

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureWaitlistSchema(db as any)

  const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  if (!authorizedPrincipal) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  const profileResult = await db.sql`
    SELECT p.id, p.operational_solana_wallet
    FROM profiles p
    WHERE p.id = ${authorizedPrincipal.profileId}
    LIMIT 1;
  `
  const profileRow = profileResult?.rows?.[0] as any
  const profileIdRaw = profileRow?.id
  const profileId = typeof profileIdRaw === 'number' ? profileIdRaw : Number(profileIdRaw)
  if (!Number.isFinite(profileId) || profileId <= 0) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  const canonicalWallet = await resolveCanonicalSolanaWalletByProfileId(db as any, profileId)
  if (!isSolanaAddress(canonicalWallet)) {
    return res.status(409).json({
      success: false,
      error: 'Canonical Solana wallet is not configured for this profile.',
    } satisfies ApiEnvelope<never>)
  }

  let operationalWallet = typeof profileRow?.operational_solana_wallet === 'string' ? profileRow.operational_solana_wallet.trim() : ''
  if (!isSolanaAddress(operationalWallet)) {
    const opRes = await db.sql`
      SELECT pw.address
      FROM profile_wallets pw
      LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
      WHERE pw.profile_id = ${profileId}
        AND pw.is_operational_solana_wallet = true
        AND (LOWER(COALESCE(w.chain, '')) = 'solana' OR w.chain IS NULL)
      LIMIT 1;
    `
    operationalWallet = typeof opRes?.rows?.[0]?.address === 'string' ? opRes.rows[0].address.trim() : ''
  }
  if (!isSolanaAddress(operationalWallet)) {
    return res.status(409).json({
      success: false,
      error: 'Operational Solana wallet is not configured for this profile.',
    } satisfies ApiEnvelope<never>)
  }

  if (canonicalWallet === operationalWallet) {
    return res.status(409).json({
      success: false,
      error: 'Canonical and operational Solana wallets must be different.',
    } satisfies ApiEnvelope<never>)
  }

  const job = await enqueueSolanaSweepJob({
    db: db as any,
    profileId,
    canonicalWallet,
    operationalWallet,
    minLamports,
  })

  const data: EnqueueSweepResponse = {
    jobId: job.id,
    status: job.status,
    canonicalSolanaWallet: canonicalWallet,
    operationalSolanaWallet: operationalWallet,
    minLamports: String(job.min_lamports),
  }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<EnqueueSweepResponse>)
}
