import type { VercelRequest, VercelResponse } from '@vercel/node'

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
} from '@4626/server-core'




import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

type RecipientResolution = {
  inputAddress: string
  recipientAddress: string
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

function readAddressParam(req: VercelRequest): string | null {
  const value = req.query?.address
  if (typeof value === 'string') return normalizeAddress(value)
  if (Array.isArray(value) && typeof value[0] === 'string') return normalizeAddress(value[0])
  return null
}

async function resolveCanonicalSmartWallet(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  address: string,
): Promise<string | null> {
  const match = await db.sql`
    SELECT
      p.id,
      p.primary_smart_wallet,
      p.csw_address,
      p.base_sub_account
    FROM profiles p
    WHERE LOWER(p.primary_wallet) = ${address}
       OR LOWER(p.embedded_wallet) = ${address}
       OR LOWER(p.primary_embedded_eoa) = ${address}
       OR LOWER(p.primary_smart_wallet) = ${address}
       OR LOWER(p.csw_address) = ${address}
       OR LOWER(p.base_sub_account) = ${address}
       OR p.id IN (
         SELECT profile_id
         FROM profile_wallets
         WHERE LOWER(address) = ${address}
       )
    ORDER BY p.updated_at DESC NULLS LAST, p.created_at ASC
    LIMIT 1;
  `
  const row = match.rows?.[0] ?? null
  if (!row) return null

  const profileId = Number(row.id)
  if (!Number.isFinite(profileId) || profileId <= 0) return null

  const canonicalWallet = await db.sql`
    SELECT LOWER(address) AS address
    FROM profile_wallets
    WHERE profile_id = ${profileId}
      AND is_canonical_smart_wallet = true
    ORDER BY is_primary DESC, verified_at DESC NULLS LAST, updated_at DESC NULLS LAST, address ASC
    LIMIT 1;
  `
  const canonicalFromGraph = normalizeAddress(canonicalWallet.rows?.[0]?.address)
  if (canonicalFromGraph) return canonicalFromGraph

  const fallbackCandidates = [row.primary_smart_wallet, row.csw_address, row.base_sub_account]
  for (const candidate of fallbackCandidates) {
    const normalized = normalizeAddress(candidate)
    if (normalized) return normalized
  }

  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }
  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('social-recipient', principalAddress, clientIp), {
    windowMs: 60_000,
    maxRequests: 120,
  })
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const inputAddress = readAddressParam(req)
  if (!inputAddress) {
    return res.status(400).json({
      success: false,
      error: 'address query param is required (0x...)',
    } satisfies ApiEnvelope<never>)
  }

  const fallback: RecipientResolution = {
    inputAddress,
    recipientAddress: inputAddress,
  }

  const db = await getDb()
  if (!db) {
    return res.status(200).json({ success: true, data: fallback } satisfies ApiEnvelope<RecipientResolution>)
  }

  try {
    await ensureWaitlistSchema(db as any)
    const canonicalSmartWallet = await resolveCanonicalSmartWallet(db as any, inputAddress)
    const data: RecipientResolution = {
      inputAddress,
      recipientAddress: canonicalSmartWallet ?? inputAddress,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<RecipientResolution>)
  } catch {
    return res.status(200).json({ success: true, data: fallback } satisfies ApiEnvelope<RecipientResolution>)
  }
}
