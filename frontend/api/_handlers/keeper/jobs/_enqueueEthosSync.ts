import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { enqueueKeeperJob, type KeeperJob } from '../../../../server/_lib/keeperJobs/keeperJobs.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'

type EthosSyncEnqueueResponse = {
  enabled: boolean
  job: KeeperJob | null
  reason?: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(env('KEEPER_ETHOS_SYNC_ENQUEUE_ENABLED').toLowerCase())
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
      data: { enabled: false, job: null, reason: 'disabled' },
    } satisfies ApiEnvelope<EthosSyncEnqueueResponse>)
  }

  const job = await enqueueKeeperJob({
    kind: 'internal_api',
    dedupeKey: 'ethos-sync:default',
    source: 'keeper-ethos-sync',
    payload: {
      path: '/api/keeper/ethos-sync',
      body: {},
    },
    maxAttempts: 3,
  })

  return res.status(200).json({
    success: true,
    data: { enabled: true, job },
  } satisfies ApiEnvelope<EthosSyncEnqueueResponse>)
}
