import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  runKeeperJobTick,
  type KeeperJobTickResult,
} from '../../../../server/_lib/keeperJobs/keeperJobRunner.js'

function getBaseUrl(req: VercelRequest): string {
  const configured = String(process.env.KEEPER_COORDINATION_BASE_URL ?? '').trim()
  if (configured) return configured
  const host = typeof req.headers.host === 'string' ? req.headers.host : ''
  if (!host) return ''
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0]?.trim() || 'https'
  return `${proto}://${host}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ success: false, error: 'unauthorized' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await runKeeperJobTick({
      baseUrl: getBaseUrl(req),
      apiKey: String(process.env.KPR_API_KEY ?? ''),
      workerId: String(process.env.KEEPER_WORKER_ID ?? 'vercel-cron-keeper-worker'),
      limit: Number(process.env.KEEPER_WORKER_LIMIT ?? 1),
      leaseSeconds: Number(process.env.KEEPER_WORKER_LEASE_SECONDS ?? 300),
      retryDelaySeconds: Number(process.env.KEEPER_WORKER_RETRY_DELAY_SECONDS ?? 60),
    })
    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<KeeperJobTickResult>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'keeper_job_run_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
