import { enqueueKeeperJob } from '../keeperJobs/keeperJobs.js'
import { listRelayEnabledShareMeshMints } from './solanaCreatorRelayConfig.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export async function enqueueSolanaRelayConfigSync(params: {
  db: Db
  reason: string
}): Promise<{ enqueued: boolean; jobId: number | null; enabledMints: string[] }> {
  const orchestratorUrl = String(process.env.SOLANA_ORCHESTRATOR_URL ?? '').trim()
  if (!orchestratorUrl) {
    return { enqueued: false, jobId: null, enabledMints: [] }
  }

  const enabledMints = await listRelayEnabledShareMeshMints({ db: params.db })
  const dedupeKey = `solana-reconcile:sync-relay-config:${enabledMints.join(',') || 'none'}`
  const job = await enqueueKeeperJob({
    kind: 'internal_api',
    source: 'solana-relay-config-sync',
    dedupeKey,
    priority: 70,
    payload: {
      path: '/api/keeper/solana/reconcile',
      body: {
        workflow: 'solana-relay-config-sync',
        action: 'sync_relay_config',
        checkpointKey: `relay-config:${enabledMints.length}:${enabledMints[0] ?? 'none'}`,
        payload: {
          enabledMints,
          reason: params.reason,
        },
      },
    },
    maxAttempts: 5,
  })

  return { enqueued: true, jobId: job.id, enabledMints }
}

export async function enqueueSolanaB2ReadinessVerification(params: {
  creatorToken: string
  shareMeshMint?: string | null
  deploySessionId?: string | null
  autoEnableRelay?: boolean
}): Promise<{ enqueued: boolean; jobId: number | null }> {
  const creatorToken = params.creatorToken.trim().toLowerCase()
  const shareMeshMint =
    typeof params.shareMeshMint === 'string' ? params.shareMeshMint.trim() : ''
  const dedupeKey = shareMeshMint
    ? `solana-b2-readiness:${shareMeshMint}`
    : `solana-b2-readiness:${creatorToken}`

  const job = await enqueueKeeperJob({
    kind: 'internal_api',
    source: 'solana-b2-readiness',
    dedupeKey,
    priority: 65,
    payload: {
      path: '/api/keeper/solana/verify-b2-readiness',
      method: 'POST',
      body: {
        creatorToken,
        ...(shareMeshMint ? { shareMeshMint } : null),
        ...(params.deploySessionId ? { deploySessionId: params.deploySessionId } : null),
        ...(params.autoEnableRelay ? { autoEnableRelay: true } : null),
      },
    },
    maxAttempts: 5,
  })

  return { enqueued: true, jobId: job.id }
}
