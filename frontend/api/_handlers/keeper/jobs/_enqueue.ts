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
} from '../../../../packages/server-core/src/index.js'
import { enqueueKeeperJob, type KeeperJob } from '../../../../server/_lib/keeperJobs/keeperJobs.js'

type EnqueueBody = {
  kind?: string
  payload?: Record<string, unknown>
  source?: string | null
  dedupeKey?: string | null
  priority?: number | null
  runAt?: string | null
  maxAttempts?: number | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(rateLimitKey('keeper:jobs:enqueue', getClientIp(req)), RATE_LIMITS.keeperDecisionsWrite)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  const body = (await readBoundedJsonObjectBody<EnqueueBody>(req, { maxBytes: 65_536 })) ?? {}
  try {
    const job = await enqueueKeeperJob({
      kind: body.kind ?? '',
      payload: body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {},
      source: body.source,
      dedupeKey: body.dedupeKey,
      priority: body.priority,
      runAt: body.runAt,
      maxAttempts: body.maxAttempts,
    })
    return res.status(200).json({ success: true, data: { job } } satisfies ApiEnvelope<{ job: KeeperJob }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'keeper_job_enqueue_failed'
    const status = message.startsWith('invalid_') ? 400 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
