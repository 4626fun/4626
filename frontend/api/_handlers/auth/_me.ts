import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  readRequestPrincipalAddress,
} from '../../../packages/server-core/src/index.js'
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitKey } from '../../../server/_lib/rateLimit.js'


type MeResponse = { address: string } | null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('auth-me', getClientIp(req)),
    RATE_LIMITS.authRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const address = readRequestPrincipalAddress(req, { lowercase: false })
  return res.status(200).json({ success: true, data: address ? { address } : null } satisfies ApiEnvelope<MeResponse>)
}
