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
import { readSolanaHookStatusByCreatorToken } from '../onchain/solanaHookStatus.js'
import { deriveCreatorShareHookPdas } from '../onchain/creatorShareHookPdas.js'
import { SOLANA_NATIVE_MINT } from '../onchain/meteoraAlphaVaultConfig.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaPostDeployOverall = 'disabled' | 'waiting' | 'in_progress' | 'complete' | 'failed'

export type SolanaPostDeployStatus = {
  enabled: boolean
  deployComplete: boolean
  overall: SolanaPostDeployOverall
  shareMeshMapping: {
    shareOft: string
    shareMeshMint: string
    shareMeshOftStore: string | null
    status: string
    lastError: string | null
  } | null
  meteoraPool: {
    status: SolanaMeteoraPoolStatusRow['status'] | 'not_started'
    poolAddress: string | null
    tokenMintX: string | null
    tokenMintY: string | null
    quoteMint: string | null
    pairLabel: string | null
    lastError: string | null
    lastSignature: string | null
  } | null
  meteoraAlphaVault: string | null
  hookLane: {
    hookMint: string | null
    creatorConfig: string | null
    pendingEntries: string | null
    winnerRecord: string | null
  } | null
  lpSeedingNote: string
  nextStep: string | null
}

function envFlag(name: string, fallback = false): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function resolveExpectedQuoteMint(): string {
  if (envFlag('SOLANA_STRICT_SOL_PAIR', false)) return SOLANA_NATIVE_MINT
  return env('SOLANA_METEORA_POOL_QUOTE_MINT') || SOLANA_NATIVE_MINT
}

function quoteMintLabel(quoteMint: string): string {
  return quoteMint === SOLANA_NATIVE_MINT ? 'SOL' : quoteMint
}

function buildPairLabel(tokenMintX: string | null, quoteMint: string | null): string | null {
  if (!tokenMintX || !quoteMint) return null
  return `Share mesh / ${quoteMintLabel(quoteMint)}`
}

const LP_SEEDING_NOTE =
  'Pool creation is automated after deploy. Initial DLMM liquidity seeding (typically in SOL) is a separate manual step — part of the launch bundle may fund SOL used to seed the Meteora pair so the pool is tradable.'

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
  shareMeshOftStoreHint?: string | null
  hookMintHint?: string | null
  meteoraAlphaVaultHint?: string | null
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

  const expectedQuoteMint = resolveExpectedQuoteMint()
  const tokenMintX = pool?.shareMeshMint ?? (shareMeshMint.trim() || null)
  const quoteMint = pool?.quoteMint ?? expectedQuoteMint
  const hookStatus =
    creatorToken != null
      ? await readSolanaHookStatusByCreatorToken({ db: params.db, creatorToken: creatorToken.toLowerCase() })
      : null
  const hookMintHint =
    (hookStatus?.hookMint && hookStatus.hookMint.trim()) ||
    (typeof params.hookMintHint === 'string' ? params.hookMintHint.trim() : '')
  const hookPdas = hookMintHint ? deriveCreatorShareHookPdas(hookMintHint) : null
  const shareMeshOftStoreHint =
    typeof params.shareMeshOftStoreHint === 'string' ? params.shareMeshOftStoreHint.trim() : ''

  return {
    enabled,
    deployComplete,
    overall,
    shareMeshMapping: mapping
      ? {
          shareOft: mapping.shareOft,
          shareMeshMint: mapping.shareMeshMint,
          shareMeshOftStore: shareMeshOftStoreHint || null,
          status: mapping.status,
          lastError: mapping.lastError,
        }
      : shareMeshMint.trim()
        ? {
            shareOft: params.shareOft ?? '',
            shareMeshMint: shareMeshMint.trim(),
            shareMeshOftStore: shareMeshOftStoreHint || null,
            status: 'pending',
            lastError: null,
          }
        : null,
    meteoraPool:
      pool || tokenMintX
        ? {
            status: pool?.status ?? 'not_started',
            poolAddress: pool?.poolAddress ?? null,
            tokenMintX,
            tokenMintY: quoteMint,
            quoteMint,
            pairLabel: buildPairLabel(tokenMintX, quoteMint),
            lastError: pool?.lastError ?? null,
            lastSignature: pool?.lastSignature ?? null,
          }
        : {
            status: 'not_started',
            poolAddress: null,
            tokenMintX: null,
            tokenMintY: expectedQuoteMint,
            quoteMint: expectedQuoteMint,
            pairLabel: buildPairLabel(null, expectedQuoteMint),
            lastError: null,
            lastSignature: null,
          },
    meteoraAlphaVault:
      typeof params.meteoraAlphaVaultHint === 'string' && params.meteoraAlphaVaultHint.trim()
        ? params.meteoraAlphaVaultHint.trim()
        : null,
    hookLane: hookPdas
      ? {
          hookMint: hookPdas.hookMint,
          creatorConfig: hookStatus?.creatorConfig ?? hookPdas.creatorConfig,
          pendingEntries: hookStatus?.pendingEntries ?? hookPdas.pendingEntries,
          winnerRecord: hookStatus?.winnerRecord ?? hookPdas.winnerRecord,
        }
      : hookMintHint
        ? {
            hookMint: hookMintHint,
            creatorConfig: hookStatus?.creatorConfig ?? null,
            pendingEntries: hookStatus?.pendingEntries ?? null,
            winnerRecord: hookStatus?.winnerRecord ?? null,
          }
        : {
            hookMint: null,
            creatorConfig: null,
            pendingEntries: null,
            winnerRecord: null,
          },
    lpSeedingNote: LP_SEEDING_NOTE,
    nextStep,
  }
}
