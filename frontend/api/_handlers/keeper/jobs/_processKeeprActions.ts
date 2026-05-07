import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { processKeeprActions, type KeeprActionProcessResult } from '../../../../server/_lib/keeperJobs/keeperJobRunner.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(env('KEEPER_PROCESS_KEEPR_ACTIONS_ENABLED').toLowerCase())
}

function getBaseUrl(req: VercelRequest): string {
  const configured = env('KEEPER_COORDINATION_BASE_URL')
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

  if (!enabled()) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, processed: 0, succeeded: 0, failed: 0, retried: 0 },
    } satisfies ApiEnvelope<KeeprActionProcessResult & { enabled: boolean }>)
  }

  try {
    const result = await processKeeprActions({
      baseUrl: getBaseUrl(req),
      apiKey: env('KEEPR_API_KEY'),
      limit: Number(env('KEEPER_PROCESS_KEEPR_ACTIONS_LIMIT') || 1),
      retryDelaySeconds: Number(env('KEEPER_PROCESS_KEEPR_ACTIONS_RETRY_DELAY_SECONDS') || 60),
    })
    return res.status(200).json({
      success: true,
      data: { enabled: true, ...result },
    } satisfies ApiEnvelope<KeeprActionProcessResult & { enabled: boolean }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'keeper_action_process_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
