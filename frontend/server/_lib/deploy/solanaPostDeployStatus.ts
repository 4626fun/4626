import { getAddress, isAddress, type Address } from 'viem'

import {
  listSolanaShareMeshMappingsForCreator,
  type SolanaShareMeshMapping,
} from '../onchain/solanaShareMeshMappings.js'
import {
  readSolanaMeteoraPoolStatusByShareMeshMint,
  readSolanaShareMeshMappingBySessionId,
  type SolanaMeteoraPoolStatusRow,
} from '../onchain/solanaMeteoraPoolStatus.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaPostDeployOverall = 'disabled' | 'waiting' | 'in_progress' | 'complete' | 'failed'

export type SolanaPostDeployStatus = {
  enabled: boolean
  deployComplete: boolean
  overall: SolanaPostDeployOverall
  shareMeshMapping: {
    shareOft: string
    shareMeshMint: string
    status: string
    lastError: string | null
  } | null
  meteoraPool: {
    status: SolanaMeteoraPoolStatusRow['status'] | 'not_started'
    poolAddress: string | null
    lastError: string | null
    lastSignature: string | null
  } | null
  nextStep: string | null
}

function envFlag(name: string, fallback = false): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readOptionalAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw as Address)
}

function pickMapping(
  sessionMapping: Awaited<ReturnType<typeof readSolanaShareMeshMappingBySessionId>>,
  creatorMappings: SolanaShareMeshMapping[],
): SolanaShareMeshMapping | null {
  if (sessionMapping) {
    return {
      id: 0,
      creatorToken: sessionMapping.creatorToken,
      shareOft: sessionMapping.shareOft,
      shareMeshMint: sessionMapping.shareMeshMint,
      sourceSessionId: null,
      status: sessionMapping.status as SolanaShareMeshMapping['status'],
      applyAttemptCount: 0,
      lastError: sessionMapping.lastError,
      appliedAt: null,
      createdAt: '',
      updatedAt: '',
    }
  }
  return (
    creatorMappings.find((row) => row.status === 'applied') ??
    creatorMappings.find((row) => row.status === 'pending') ??
    creatorMappings[0] ??
    null
  )
}

function deriveOverall(params: {
  enabled: boolean
  deployComplete: boolean
  mapping: SolanaShareMeshMapping | null
  pool: SolanaMeteoraPoolStatusRow | null
}): { overall: SolanaPostDeployOverall; nextStep: string | null } {
  if (!params.enabled) {
    return {
      overall: 'disabled',
      nextStep: 'Solana share-mesh lane is not enabled for this deploy.',
    }
  }
  if (!params.deployComplete) {
    return {
      overall: 'waiting',
      nextStep: 'Complete Phase 4 and cleanup before Solana post-deploy automation runs.',
    }
  }
  if (!params.mapping) {
    return {
      overall: 'in_progress',
      nextStep: 'Waiting for the share-mesh mint mapping to be recorded after finalize.',
    }
  }
  if (params.mapping.status === 'failed') {
    return {
      overall: 'failed',
      nextStep: params.mapping.lastError ?? 'Share-mesh mapping sync failed. Retry via keeper or ops runbook.',
    }
  }
  if (!params.pool) {
    return {
      overall: 'in_progress',
      nextStep: 'Meteora DLMM pool provisioning has not started yet. Keeper jobs usually pick this up within a few minutes.',
    }
  }
  if (params.pool.status === 'creating' || params.pool.status === 'pending') {
    return {
      overall: 'in_progress',
      nextStep: 'Creating the Meteora DLMM pool on Solana…',
    }
  }
  if (params.pool.status === 'created') {
    return {
      overall: 'complete',
      nextStep: 'Pool created. Seed initial DLMM liquidity before expecting reliable swaps or browse surfaces.',
    }
  }
  if (params.pool.status === 'skipped') {
    return {
      overall: 'complete',
      nextStep: params.pool.lastError ?? 'Meteora pool provisioning was skipped (automation disabled or unconfigured).',
    }
  }
  return {
    overall: 'failed',
    nextStep: params.pool.lastError ?? 'Meteora pool provisioning failed. Check keeper logs and solana_meteora_pool_status.',
  }
}

export async function readSolanaPostDeployStatus(params: {
  db: Db
  sessionId: string
  deployStep: string
  deployState: string
  creatorToken?: string | null
  shareOft?: string | null
  shareMeshMintHint?: string | null
  ovaultEnabled?: boolean
}): Promise<SolanaPostDeployStatus> {
  const automationEnabled = envFlag('SOLANA_METEORA_POOL_PROVISIONING_ENABLED', false)
  const meshEnabled = params.ovaultEnabled !== false
  const enabled = meshEnabled && automationEnabled
  const deployComplete =
    params.deployState === 'completed' ||
    params.deployStep === 'completed' ||
    params.deployStep === 'cleanup_sent'

  const sessionMapping = await readSolanaShareMeshMappingBySessionId({
    db: params.db,
    sessionId: params.sessionId,
  })
  const creatorToken =
    readOptionalAddress(params.creatorToken) ??
    readOptionalAddress(sessionMapping?.creatorToken) ??
    null
  const creatorMappings =
    creatorToken != null
      ? await listSolanaShareMeshMappingsForCreator({ db: params.db, creatorToken, limit: 5 })
      : []
  const mapping = pickMapping(sessionMapping, creatorMappings)

  const shareMeshMint =
    (typeof params.shareMeshMintHint === 'string' && params.shareMeshMintHint.trim()) ||
    mapping?.shareMeshMint ||
    ''
  const pool =
    shareMeshMint.trim().length > 0
      ? await readSolanaMeteoraPoolStatusByShareMeshMint({ db: params.db, shareMeshMint })
      : null

  const { overall, nextStep } = deriveOverall({
    enabled,
    deployComplete,
    mapping,
    pool,
  })

  return {
    enabled,
    deployComplete,
    overall,
    shareMeshMapping: mapping
      ? {
          shareOft: mapping.shareOft,
          shareMeshMint: mapping.shareMeshMint,
          status: mapping.status,
          lastError: mapping.lastError,
        }
      : null,
    meteoraPool: pool
      ? {
          status: pool.status,
          poolAddress: pool.poolAddress,
          lastError: pool.lastError,
          lastSignature: pool.lastSignature,
        }
      : mapping
        ? { status: 'not_started', poolAddress: null, lastError: null, lastSignature: null }
        : null,
    nextStep,
  }
}
