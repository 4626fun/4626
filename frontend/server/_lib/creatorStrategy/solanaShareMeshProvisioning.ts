import type { Address } from 'viem'
import { getAddress } from 'viem'

import { getDbForCron, isDbConfigured } from '../db/postgres.js'
import { enqueueKeeperJob } from '../keeperJobs/keeperJobs.js'
import { expandCreatorFeatureKeys } from './bundleEntitlements.js'
import { listActivationsForCreator } from './activations.js'

const PROVISION_CREATOR_PATH = '/api/keeper/solana/provision-creator'

export type SolanaShareMeshProvisioningEnqueueResult = {
  enqueued: boolean
  jobId: number | null
  reason?: string
}

function isEnabled(): boolean {
  const raw = String(process.env.SOLANA_SHARE_MESH_PROVISIONING_ENABLED ?? '1').trim().toLowerCase()
  return !['0', 'false', 'no'].includes(raw)
}

async function readActiveFeatureKeys(db: { sql: any }, creatorToken: Address): Promise<string[]> {
  const rows = await listActivationsForCreator(db as any, creatorToken)
  const rawKeys: string[] = []
  for (const row of rows) {
    if (row.status !== 'active' && row.status !== 'pending') continue
    if (!row.paymentVerifiedAt) continue
    rawKeys.push(row.featureKey)
  }
  return Array.from(expandCreatorFeatureKeys(rawKeys))
}

export async function creatorHasSolanaShareMeshEntitlement(
  creatorToken: Address,
): Promise<boolean> {
  if (!isDbConfigured()) return false
  const db = await getDbForCron()
  if (!db) return false
  const keys = await readActiveFeatureKeys(db, creatorToken)
  return keys.includes('solana_ovault_mesh') || keys.includes('solana_meteora_alpha_vault')
}

function isSolanaPubkey(value: unknown): value is string {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function buildProvisionCreatorDedupeKey(params: {
  creatorToken: Address
  trigger: 'payment' | 'post_deploy'
  shareMeshMint?: string | null
}): string {
  const mint = typeof params.shareMeshMint === 'string' ? params.shareMeshMint.trim() : ''
  if (isSolanaPubkey(mint)) {
    return `solana-provision-pool:${mint.toLowerCase()}`
  }
  return `solana-provision:${params.creatorToken.toLowerCase()}:${params.trigger}`
}

export async function enqueueSolanaShareMeshProvisioning(params: {
  creatorToken: Address
  activationId: number
  paymentSource: string
  trigger: 'payment' | 'post_deploy'
  vaultAddress?: Address | null
  deploySessionId?: string | null
  shareMeshMint?: string | null
  shareOft?: string | null
}): Promise<SolanaShareMeshProvisioningEnqueueResult> {
  if (!isEnabled()) {
    return { enqueued: false, jobId: null, reason: 'disabled' }
  }
  if (!isDbConfigured()) {
    return { enqueued: false, jobId: null, reason: 'database_not_configured' }
  }
  const db = await getDbForCron()
  if (!db) {
    return { enqueued: false, jobId: null, reason: 'database_unavailable' }
  }

  const creatorToken = getAddress(params.creatorToken)
  const entitled = await creatorHasSolanaShareMeshEntitlement(creatorToken)
  if (!entitled) {
    return { enqueued: false, jobId: null, reason: 'no_solana_entitlement' }
  }

  const shareMeshMint = isSolanaPubkey(params.shareMeshMint) ? params.shareMeshMint.trim() : null
  const shareOft =
    typeof params.shareOft === 'string' && /^0x[a-fA-F0-9]{40}$/.test(params.shareOft.trim())
      ? getAddress(params.shareOft.trim() as Address)
      : null
  const dedupeKey = buildProvisionCreatorDedupeKey({
    creatorToken,
    trigger: params.trigger,
    shareMeshMint,
  })
  const job = await enqueueKeeperJob({
    kind: 'internal_api',
    source: shareMeshMint ? 'creator-strategy.solana-share-mesh-pool' : 'creator-strategy.solana-share-mesh',
    dedupeKey,
    priority: params.trigger === 'payment' ? 40 : 60,
    payload: {
      path: PROVISION_CREATOR_PATH,
      method: 'POST',
      body: {
        creatorToken,
        activationId: params.activationId,
        paymentSource: params.paymentSource,
        trigger: params.trigger,
        vaultAddress: params.vaultAddress ?? null,
        deploySessionId: params.deploySessionId ?? null,
        ...(shareMeshMint ? { shareMeshMint } : null),
        ...(shareOft ? { shareOft } : null),
      },
    },
    maxAttempts: shareMeshMint ? 5 : 3,
  })

  return { enqueued: true, jobId: job.id }
}
