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

import { verifyPrivyRequest } from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import { resolvePrimaryProfileIdForPrivyUser } from '../../../server/_lib/identity/profileIdForPrivyUser.js'
import {
  listPointsActivityForSignupId,
  type PointsActivityRow,
} from '../../../server/_lib/onboarding/waitlistScoring.js'
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

  let privyUserId: string
  try {
    const context = await verifyPrivyRequest({ db: db as any, req })
    privyUserId = context.privyUserId
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return res.status(401).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)
  const signupId = await resolvePrimaryProfileIdForPrivyUser(db as any, privyUserId)
  if (!signupId) {
    return res.status(200).json({
      success: true,
      data: { signupId: 0, activity: [] },
    } satisfies ApiEnvelope<WaitlistPointsActivityResponse>)
  }

  const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : 30
  const activity = await listPointsActivityForSignupId(db as any, signupId, limitRaw)

  return res.status(200).json({
    success: true,
    data: { signupId, activity },
  } satisfies ApiEnvelope<WaitlistPointsActivityResponse>)
}
