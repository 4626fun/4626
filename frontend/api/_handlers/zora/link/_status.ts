import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'
import { extractZoraCrossAppAccounts, verifyPrivyForAccounts } from '../../../../server/_lib/accountsIdentity.js'

type ZoraLinkStatusResponse = {
  zoraLinked: boolean
  zoraCrossAppAccounts: Array<{ address: string; providerAppId: string }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('zora-link-status', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    const zoraCrossAppAccounts = extractZoraCrossAppAccounts(context.privyUser)
    const data: ZoraLinkStatusResponse = {
      zoraLinked: zoraCrossAppAccounts.length > 0,
      zoraCrossAppAccounts,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ZoraLinkStatusResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to read Zora link status'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
