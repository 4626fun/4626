import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  COOKIE_NONCE,
  ensureNonceSchema,
  handleOptions,
  makeNonce,
  makeNonceToken,
  setCookie,
  setCors,
  setNoStore,
  storeNonce,
  getDb,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'
type NonceResponse = {
  nonce: string
  nonceToken: string
  issuedAt: string
  domain: string
  uri: string
  chainId: number
}

function getNonceOrigin(req: VercelRequest): string | null {
  try {
    return new URL(getCanonicalOrigin(req)).origin
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('auth-nonce', getClientIp(req)),
    RATE_LIMITS.authRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const nonce = makeNonce()
  // FIX: FINDING-12 — bind nonce token to the requesting IP at creation time.
  const nonceToken = makeNonceToken({ nonce, ip: getClientIp(req) })
  const issuedAt = new Date().toISOString()
  const uri = getNonceOrigin(req)
  if (!uri) {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }
  const domain = new URL(uri).host

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ success: false, error: 'Nonce service unavailable' } satisfies ApiEnvelope<never>)
    }
    await ensureNonceSchema(db as any)
    await storeNonce(db as any, nonce, new Date(Date.now() + 15 * 60 * 1000))
  } catch {
    return res.status(503).json({ success: false, error: 'Nonce service unavailable' } satisfies ApiEnvelope<never>)
  }

  // Store nonce in an HttpOnly cookie so the verify step can bind signature → browser session.
  setCookie(req, res, COOKIE_NONCE, nonce, { httpOnly: true, maxAgeSeconds: 60 * 15 })

  return res.status(200).json({
    success: true,
    data: {
      nonce,
      nonceToken,
      issuedAt,
      domain,
      uri,
      chainId: 8453,
    } satisfies NonceResponse,
  } satisfies ApiEnvelope<NonceResponse>)
}
