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
import { completeKeeperJob, type KeeperJob, type KeeperJobStatus } from '../../../../server/_lib/keeperJobs/keeperJobs.js'

type CompleteBody = {
  id?: number
  workerId?: string
  status?: Extract<KeeperJobStatus, 'succeeded' | 'failed' | 'retry'>
  error?: string | null
  result?: Record<string, unknown> | null
  retryDelaySeconds?: number | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(rateLimitKey('keeper:jobs:complete', getClientIp(req)), RATE_LIMITS.keeperDecisionsWrite)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  const body = (await readBoundedJsonObjectBody<CompleteBody>(req, { maxBytes: 65_536 })) ?? {}
  try {
    const job = await completeKeeperJob({
      id: Number(body.id),
      workerId: body.workerId ?? '',
      status: body.status ?? 'failed',
      error: body.error,
      result: body.result && typeof body.result === 'object' && !Array.isArray(body.result) ? body.result : null,
      retryDelaySeconds: body.retryDelaySeconds,
    })
    if (!job) {
      return res.status(409).json({
        success: false,
        error: 'keeper_job_not_claimed_by_worker',
      } satisfies ApiEnvelope<never>)
    }
    return res.status(200).json({ success: true, data: { job } } satisfies ApiEnvelope<{ job: KeeperJob }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'keeper_job_complete_failed'
    const status = message.startsWith('invalid_') ? 400 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
