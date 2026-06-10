import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  clearCookie,
  COOKIE_NONCE,
  COOKIE_SESSION,
  handleOptions,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('auth-logout', getClientIp(req)),
    RATE_LIMITS.authWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  clearCookie(req, res, COOKIE_SESSION)
  clearCookie(req, res, COOKIE_NONCE)
  return res.status(200).json({ success: true, data: true } satisfies ApiEnvelope<boolean>)
}


