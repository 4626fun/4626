import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { listKeeperJobs, type KeeperJob, type KeeperJobStatus } from '../../../../server/_lib/keeperJobs/keeperJobs.js'

function singleQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null
  return typeof value === 'string' ? value : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  try {
    const jobs = await listKeeperJobs({
      status: singleQueryValue(req.query.status) as KeeperJobStatus | null,
      kind: singleQueryValue(req.query.kind),
      limit: Number(singleQueryValue(req.query.limit) ?? 25),
    })
    return res.status(200).json({
      success: true,
      data: { jobs, count: jobs.length },
    } satisfies ApiEnvelope<{ jobs: KeeperJob[]; count: number }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'keeper_job_status_failed'
    const status = message.startsWith('invalid_') ? 400 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
