import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { enqueueKeeperJob, type KeeperJob } from '../../../../server/_lib/keeperJobs/keeperJobs.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'

type SolanaReconcileResponse = {
  enabled: boolean
  jobs: KeeperJob[]
  reason?: string
}

const VALID_ACTIONS = new Set([
  'relay_entries',
  'settle_fees',
  'winner_relay',
  'price_monitor',
  'graduation',
  'rebalance',
])

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(env('KEEPER_SOLANA_RECONCILE_ENABLED').toLowerCase())
}

function readActions(): string[] {
  const raw = env('KEEPER_SOLANA_RECONCILE_ACTIONS')
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(/[\s,]+/g)) {
    const action = part.trim().toLowerCase().replace(/-/g, '_')
    if (VALID_ACTIONS.has(action) && !out.includes(action)) out.push(action)
  }
  return out
}

function checkpointPrefix(): string {
  const raw = env('KEEPER_SOLANA_RECONCILE_CHECKPOINT_PREFIX')
  if (!raw) return new Date().toISOString().slice(0, 10)
  return raw.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 80)
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
      data: { enabled: false, jobs: [], reason: 'disabled' },
    } satisfies ApiEnvelope<SolanaReconcileResponse>)
  }

  const workflow = env('KEEPER_SOLANA_RECONCILE_WORKFLOW') || 'solana-orchestrator'
  const actions = readActions()
  if (actions.length === 0) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], reason: 'no_actions_configured' },
    } satisfies ApiEnvelope<SolanaReconcileResponse>)
  }

  const prefix = checkpointPrefix()
  const jobs: KeeperJob[] = []
  for (const action of actions) {
    const checkpointKey = `${prefix}:${action}`
    jobs.push(
      await enqueueKeeperJob({
        kind: 'internal_api',
        dedupeKey: `solana-reconcile:${workflow}:${checkpointKey}`,
        source: 'keeper-solana-reconcile',
        payload: {
          path: '/api/keeper/solana/reconcile',
          body: {
            workflow,
            action,
            checkpointKey,
            payload: {
              source: 'keeper_jobs',
              action,
            },
          },
        },
        maxAttempts: 3,
      }),
    )
  }

  return res.status(200).json({
    success: true,
    data: { enabled: true, jobs },
  } satisfies ApiEnvelope<SolanaReconcileResponse>)
}
