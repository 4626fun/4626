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
} from '../../../packages/server-core/src/index.js'

import { verifyPrivyForAccounts } from '../../../server/_lib/identity/accountsIdentity.js'
import {
  buildAccountTrayPointsForPrivyUser,
  type AccountTrayPointsPayload,
} from '../../../server/_lib/onboarding/accountTrayPoints.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

export type { AccountTrayPointsPayload as AccountTrayPointsResponse }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('accounts-me-points', clientIp), {
    windowMs: 60_000,
    maxRequests: 60,
  })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureWaitlistSchema(db as any)

    const data = await buildAccountTrayPointsForPrivyUser(
      db as any,
      context.privyUserId,
      typeof req.query?.limit === 'string' ? req.query.limit : req.query?.limit,
    )

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AccountTrayPointsPayload>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load points'
    const status =
      /token|unauthorized|forbidden|privy/i.test(message) ||
      message === 'Missing Privy auth token'
        ? 401
        : message === 'invalid_signup_id' ||
            message.startsWith('account_tray_points_')
          ? 500
          : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
