import type { VercelRequest, VercelResponse } from '@vercel/node'

import vaultReport from '../../status/_vaultReport.js'
import {
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/vault/report', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-vault-report', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.vaultRead,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  // Support both query-style and path-style routing.
  const vault = (typeof req.query?.vault === 'string' ? req.query.vault : typeof req.query?.address === 'string' ? req.query.address : '').trim()
  if (vault && !req.query.vault) req.query.vault = vault
  return await vaultReport(req, res)
}
