import { PublicKey } from '@solana/web3.js'
import { getAddress, isAddress, type Address } from 'viem'

import { getDbForCron, isDbConfigured } from '@4626/server-core'

import { enqueueSolanaShareMeshProvisioning } from '../creatorStrategy/solanaShareMeshProvisioning.js'
import { enqueueKeeperJob } from '../keeperJobs/keeperJobs.js'
import { upsertSolanaShareMeshMapping } from '../onchain/solanaShareMeshMappings.js'

export type SolanaDeployMode = 'b1' | 'b2'
export type SolanaDeployB2Stage = 'b1' | 'post_lz'

export function parseSolanaDeploySessionMeshConfig(value: unknown): {
  enabled: boolean
  mode: SolanaDeployMode | null
  shareMeshMint: string | null
  b2Stage: SolanaDeployB2Stage | null
} {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
  if (raw.enabled !== true) {
    return { enabled: false, mode: null, shareMeshMint: null, b2Stage: null }
  }
  const mode = raw.mode === 'b1' || raw.mode === 'b2' ? raw.mode : null
  const mintRaw = typeof raw.shareMeshMint === 'string' ? raw.shareMeshMint.trim() : ''
  let shareMeshMint: string | null = null
  if (mintRaw) {
    try {
      const canonical = new PublicKey(mintRaw).toBase58()
      shareMeshMint = canonical === mintRaw ? canonical : null
    } catch {
      shareMeshMint = null
    }
  }
  return {
    enabled: true,
    mode,
    shareMeshMint,
    b2Stage: mode === 'b2' ? 'post_lz' : mode === 'b1' ? 'b1' : null,
  }
}

export async function persistAndQueueSolanaDeploySessionMapping(params: {
  sessionId: string
  creatorToken: string
  shareOft: string
  solanaOvault: unknown
}): Promise<{
  shareMeshMint: string
  mode: SolanaDeployMode
  b2Stage: SolanaDeployB2Stage
}> {
  const config = parseSolanaDeploySessionMeshConfig(params.solanaOvault)
  if (!config.enabled) throw new Error('solana_deploy_mapping_not_enabled')
  if (!config.mode || !config.b2Stage) throw new Error('solana_deploy_mapping_mode_missing')
  if (!config.shareMeshMint) throw new Error('solana_deploy_mapping_mint_missing_or_invalid')
  if (!isAddress(params.creatorToken)) throw new Error('solana_deploy_mapping_creator_invalid')
  if (!isAddress(params.shareOft)) throw new Error('solana_deploy_mapping_share_oft_invalid')
  if (!isDbConfigured()) throw new Error('solana_deploy_mapping_database_not_configured')
  const db = await getDbForCron()
  if (!db) throw new Error('solana_deploy_mapping_database_unavailable')

  const creatorToken = getAddress(params.creatorToken as Address)
  const shareOft = getAddress(params.shareOft as Address)
  const mapping = await upsertSolanaShareMeshMapping({
    db: db as any,
    creatorToken,
    shareOft,
    shareMeshMint: config.shareMeshMint,
    sourceSessionId: params.sessionId,
  })

  await enqueueKeeperJob({
    kind: 'internal_api',
    source: 'deploy-session-ovault-mesh',
    dedupeKey: `solana-reconcile:solana-share-mesh-sync:shareoft:${mapping.shareOft.toLowerCase()}`,
    payload: {
      path: '/api/keeper/solana/reconcile',
      body: {
        workflow: 'solana-share-mesh-sync',
        action: 'sync_mapping',
        checkpointKey: `shareoft:${mapping.shareOft.toLowerCase()}`,
        payload: {
          creatorToken: mapping.creatorToken,
          shareOft: mapping.shareOft,
          shareMeshMint: mapping.shareMeshMint,
          sourceSessionId: params.sessionId,
          b2Stage: config.b2Stage,
        },
      },
    },
    maxAttempts: 5,
  })

  const provision = await enqueueSolanaShareMeshProvisioning({
    creatorToken,
    activationId: 0,
    paymentSource: 'post_deploy',
    trigger: 'post_deploy',
    deploySessionId: params.sessionId,
    shareOft: mapping.shareOft,
    shareMeshMint: mapping.shareMeshMint,
    b2Stage: config.b2Stage,
  })
  if (!provision.enqueued) {
    throw new Error(`solana_deploy_mapping_provision_queue_failed:${provision.reason ?? 'unknown'}`)
  }

  return {
    shareMeshMint: mapping.shareMeshMint,
    mode: config.mode,
    b2Stage: config.b2Stage,
  }
}
