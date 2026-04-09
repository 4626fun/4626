import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitKey,
  getClientIp,
} from '../../../../../packages/server-core/src/index.js'


import { processSolanaSweepJobs } from '../../../../../server/_lib/solanaSweepJobs.js'

type Body = {
  limit?: number
}

type ProcessSweepResponse = {
  processed: number
  succeeded: number
  retried: number
  blocked: number
  failed: number
  jobIds: number[]
}

function readBearerToken(req: VercelRequest): string {
  const header = String(req.headers.authorization ?? '').trim()
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice('bearer '.length).trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const secret = String(process.env.SOLANA_SWEEP_PROCESSOR_SECRET ?? '').trim()
  const token = readBearerToken(req)
  if (!secret || token !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('solana-sweep-process', getClientIp(req)),
    RATE_LIMITS.solanaSweepProcess,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many processor requests' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req, { maxBytes: 8_192 })
  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  const result = await processSolanaSweepJobs({
    db: db as any,
    limit: Number.isFinite(Number(body?.limit)) ? Number(body?.limit) : undefined,
  })
  const data: ProcessSweepResponse = {
    processed: result.processed,
    succeeded: result.succeeded,
    retried: result.retried,
    blocked: result.blocked,
    failed: result.failed,
    jobIds: result.jobIds,
  }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ProcessSweepResponse>)
}
