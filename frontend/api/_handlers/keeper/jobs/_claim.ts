import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  handleOptions,
  rateLimitKey,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
} from '@4626/server-core'
import {
  claimDueKeeperJobs,
  releaseExpiredKeeperJobClaims,
  type KeeperJob,
} from '../../../../server/_lib/keeperJobs/keeperJobs.js'

type ClaimBody = {
  workerId?: string
  limit?: number | null
  leaseSeconds?: number | null
  kinds?: string[] | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(rateLimitKey('keeper:jobs:claim', getClientIp(req)), RATE_LIMITS.keeperDecisionsWrite)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  const body = (await readBoundedJsonObjectBody<ClaimBody>(req, { maxBytes: 16_384 })) ?? {}
  try {
    const releasedExpiredClaims = await releaseExpiredKeeperJobClaims()
    const jobs = await claimDueKeeperJobs({
      workerId: body.workerId ?? '',
      limit: body.limit,
      leaseSeconds: body.leaseSeconds,
      kinds: body.kinds,
    })
    return res.status(200).json({
      success: true,
      data: { jobs, count: jobs.length, releasedExpiredClaims },
    } satisfies ApiEnvelope<{ jobs: KeeperJob[]; count: number; releasedExpiredClaims: number }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'keeper_job_claim_failed'
    const status = message.startsWith('invalid_') ? 400 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
