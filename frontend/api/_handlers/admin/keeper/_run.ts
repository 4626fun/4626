import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getSessionAddress,
  handleOptions,
  isAdminAddress,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import {
  runKeeperJobTick,
  type KeeperJobTickResult,
} from '../../../../server/_lib/keeperJobs/keeperJobRunner.js'

type ManualRunBody = {
  limit?: unknown
}

function getBaseUrl(req: VercelRequest): string {
  const configured = String(process.env.KEEPER_COORDINATION_BASE_URL ?? '').trim()
  if (configured) return configured
  const host = typeof req.headers.host === 'string' ? req.headers.host : ''
  if (!host) return ''
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0]?.trim() || 'https'
  return `${proto}://${host}`
}

function resolveLimit(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(10, Math.max(1, Math.floor(n)))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const apiKey = String(process.env.KPR_API_KEY ?? '').trim()
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'KPR_API_KEY is not configured on the server',
    } satisfies ApiEnvelope<never>)
  }

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: 2_048 })
  const body = (bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw) ? bodyRaw : {}) as ManualRunBody

  try {
    const result = await runKeeperJobTick({
      baseUrl: getBaseUrl(req),
      apiKey,
      workerId: `admin-manual:${admin.toLowerCase()}`,
      limit: resolveLimit(body.limit),
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
