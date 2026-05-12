import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { enqueueKeeperJob, type KeeperJob } from '../../../../server/_lib/keeperJobs/keeperJobs.js'
import { listAjnaVaultRegistryEntries } from '../../../../server/_lib/ajnaVaultManager/registry.js'

type AjnaManagerEnqueueResponse = {
  enabled: boolean
  jobs: KeeperJob[]
  scanned: number
  reason?: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function envBool(name: string): boolean {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase())
}

function chainIdFilter(): number {
  const parsed = Number(env('KEEPER_AJNA_MANAGER_CHAIN_ID') || 8453)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8453
}

function maxVaults(): number {
  const parsed = Number(env('KEEPER_AJNA_MANAGER_LIMIT') || 25)
  return Number.isInteger(parsed) ? Math.min(250, Math.max(1, parsed)) : 25
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
  if (!envBool('KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED')) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], scanned: 0, reason: 'disabled' },
    } satisfies ApiEnvelope<AjnaManagerEnqueueResponse>)
  }

  const rows = await listAjnaVaultRegistryEntries({
    chainId: chainIdFilter(),
    statuses: ['dry_run', 'live'],
    limit: maxVaults(),
  })
  const jobs: KeeperJob[] = []
  for (const row of rows) {
    jobs.push(
      await enqueueKeeperJob({
        kind: 'internal_api',
        dedupeKey: `ajna-manager:${row.chainId}:${row.creatorToken}:${row.strategyAdapter}`,
        source: 'keeper-ajna-manager',
        payload: {
          path: '/api/keeper/ajna/rebalance',
          body: {
            chainId: row.chainId,
            creatorToken: row.creatorToken,
            strategyAdapter: row.strategyAdapter,
          },
        },
        maxAttempts: 3,
      }),
    )
  }

  return res.status(200).json({
    success: true,
    data: {
      enabled: true,
      jobs,
      scanned: rows.length,
    },
  } satisfies ApiEnvelope<AjnaManagerEnqueueResponse>)
}
