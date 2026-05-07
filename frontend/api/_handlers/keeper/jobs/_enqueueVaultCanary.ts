import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { enqueueKeeperJob, type KeeperJob } from '../../../../server/_lib/keeperJobs/keeperJobs.js'

type VaultCanaryResponse = {
  enabled: boolean
  jobs: KeeperJob[]
  reason?: string
}

const VALID_ACTIONS = new Set(['tend', 'report'])

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function envAddress(name: string): `0x${string}` | null {
  const value = env(name).toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(value) ? (value as `0x${string}`) : null
}

function readActions(): Array<'tend' | 'report'> {
  const raw = env('KEEPER_VAULT_CANARY_ACTIONS')
  if (!raw) return []
  const out: Array<'tend' | 'report'> = []
  for (const part of raw.split(/[\s,]+/g)) {
    const action = part.trim().toLowerCase()
    if (VALID_ACTIONS.has(action) && !out.includes(action as 'tend' | 'report')) {
      out.push(action as 'tend' | 'report')
    }
  }
  return out
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

  const vaultAddress = envAddress('KEEPER_VAULT_CANARY_VAULT_ADDRESS')
  if (!vaultAddress) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], reason: 'not_configured' },
    } satisfies ApiEnvelope<VaultCanaryResponse>)
  }

  const actions = readActions()
  if (actions.length === 0) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], reason: 'no_actions_configured' },
    } satisfies ApiEnvelope<VaultCanaryResponse>)
  }

  const jobs: KeeperJob[] = []
  for (const action of actions) {
    jobs.push(
      await enqueueKeeperJob({
        kind: 'internal_api',
        dedupeKey: `vault-${action}-canary:${vaultAddress}`,
        source: 'keeper-vault-canary',
        payload: {
          path: `/api/cre/keeper/${action}`,
          body: { vaultAddress },
        },
        maxAttempts: 3,
      }),
    )
  }

  return res.status(200).json({
    success: true,
    data: { enabled: true, jobs },
  } satisfies ApiEnvelope<VaultCanaryResponse>)
}
