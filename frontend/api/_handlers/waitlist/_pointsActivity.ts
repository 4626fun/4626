import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { verifyPrivyForAccounts } from '../../../server/_lib/identity/accountsIdentity.js'
import { buildAccountTrayPointsForPrivyUser } from '../../../server/_lib/onboarding/accountTrayPoints.js'
import type { PointsActivityRow } from '../../../server/_lib/onboarding/waitlistScoring.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

type WaitlistPointsActivityResponse = {
  signupId: number
  activity: PointsActivityRow[]
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('waitlist-points-activity', clientIp), {
    windowMs: 60_000,
    maxRequests: 60,
  })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureWaitlistSchema(db as any)

    const tray = await buildAccountTrayPointsForPrivyUser(
      db as any,
      context.privyUserId,
      typeof req.query?.limit === 'string' ? req.query.limit : req.query?.limit,
    )

    return res.status(200).json({
      success: true,
      data: { signupId: tray.signupId, activity: tray.activity },
    } satisfies ApiEnvelope<WaitlistPointsActivityResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
