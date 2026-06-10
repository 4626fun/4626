import { getDb, isDbConfigured } from '@4626/server-core'
import { ensureKeeprSchema } from '../keepr/keeprSchema.js'
import { enqueueKeeperJob } from '../keeperJobs/keeperJobs.js'
import {
  addControlPlaneEvent,
  createControlPlaneStage,
  startControlPlaneOperation,
  transitionOperationStatus,
  type OperationStatus,
} from './operations.js'
import { parseOperatorAction } from './operatorActions.js'
import { loadControlPlanePolicy } from './policy.js'
import { buildControlPlaneJobSpec, type AsyncVerbKind } from './controlPlaneJobSpecs.js'
import {
  parseSettleVaultInput,
  SettleVaultExecutionError,
} from './executors/executeSettleVault.js'
import {
  enforceMutatingDegradation,
  evaluateFreshness,
  resolveDegradationMode,
  type DegradationContext,
} from './policyDegradation.js'
import { findDeploySessionByVaultAddress } from './executors/provisionVaultEconomy.js'

type SettlementStage =
  | 'in_progress'
  | 'awaiting_migration_block'
  | 'awaiting_owner_hook_config'
  | 'invariant_failed'
  | 'completed'
  | (string & {})

export type ProvisionVaultEconomyRequest = {
  vaultAddress: string
  chainId?: number
  creatorAddress?: string
  strategyVariant?: string
  requestedBy?: string
}

export type QueueOperatorActionRequest = {
  vaultAddress: string
  actionType: string
  payload?: Record<string, unknown>
  idempotencyKey?: string
  requestedBy?: string
}

export type SettleVaultRequest = {
  vaultAddress: string
  graduatedAt?: string
  settledAt?: string
  settlementStage?: SettlementStage
  requestedBy?: string
  idempotencyKey?: string
}

export type VaultLifecycleStatus = {
  vaultAddress: string
  graduatedAt: string | null
  settledAt: string | null
  settlementStage: string | null
  settlementStageUpdatedAt: string | null
  freshness?: 'fresh' | 'stale'
  lastUpdatedAt?: string | null
  degradationMode?: 'allow_stale_read'
  warning?: string
}

export class VaultControlPlaneError extends Error {
  statusCode: number
  code: string

  constructor(params: { statusCode: number; code: string; message: string }) {
    super(params.message)
    this.statusCode = params.statusCode
    this.code = params.code
  }
}

export type SettleVaultResult = {
  accepted: boolean
  operationId: string
  stageId?: string
}

function normalizeVaultAddress(value: string): `0x${string}` {
  const normalized = String(value || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new VaultControlPlaneError({
      statusCode: 400,
      code: 'invalid_vault_address',
      message: 'Invalid vaultAddress',
    })
  }
  return normalized as `0x${string}`
}

export interface VaultControlPlane {
  provisionVaultEconomy(request: ProvisionVaultEconomyRequest): Promise<{ accepted: boolean; operationId: string; stageId?: string }>
  getVaultLifecycleStatus(vaultAddress: string): Promise<VaultLifecycleStatus | null>
  runMaintenanceCycle(vaultAddress: string): Promise<{ accepted: boolean; operationId: string; stageId?: string }>
  queueOperatorAction(request: QueueOperatorActionRequest): Promise<{ accepted: boolean; operationId: string; stageId?: string }>
  settleVault(request: SettleVaultRequest): Promise<SettleVaultResult>
}

function normalizeScopeId(params: { vaultAddress: string; chainId?: number }): string {
  return params.chainId ? `${params.vaultAddress}:${params.chainId}` : params.vaultAddress
}

async function loadDegradationContextForVault(vaultAddress: `0x${string}`): Promise<DegradationContext> {
  if (!isDbConfigured()) return { hasKeeprVault: false, isStale: true }
  await ensureKeeprSchema()
  const db = await getDb()
  if (!db) return { hasKeeprVault: false, isStale: true }
  const rows = (await db.sql`
    SELECT graduated_at, settled_at, settlement_stage_updated_at
    FROM keepr_vaults
    WHERE LOWER(vault_address) = ${vaultAddress}
    LIMIT 1;
  `) as {
    rows?: Array<{
      graduated_at: string | null
      settled_at: string | null
      settlement_stage_updated_at: string | null
    }>
  }
  const row = rows.rows?.[0]
  if (!row) return { hasKeeprVault: false, isStale: true }
  const lastUpdatedAt = row.settlement_stage_updated_at ?? row.settled_at ?? row.graduated_at ?? null
  return {
    hasKeeprVault: true,
    isStale: evaluateFreshness(lastUpdatedAt).freshness === 'stale',
  }
}

async function queueAsyncVerb(input: {
  operationKind: AsyncVerbKind
  vaultAddress: `0x${string}`
  scopeId: string
  lockScope: string
  lockKey: string
  requestedBy?: string
  idempotencyKey?: string
  payload: Record<string, unknown>
}) {
  const policy = loadControlPlanePolicy()
  for (const warning of policy.criticalWarnings) {
    console.error('[control-plane/policy] critical warning', { warning })
  }

  const verb =
    input.operationKind === 'vault.provision'
      ? 'provisionVaultEconomy'
      : input.operationKind === 'vault.maintenance'
        ? 'runMaintenanceCycle'
        : input.operationKind === 'vault.settle'
          ? 'settleVault'
          : 'queueOperatorAction'

  let degradationContext: DegradationContext
  if (input.operationKind === 'vault.provision') {
    const session = await findDeploySessionByVaultAddress(input.vaultAddress)
    degradationContext = { hasDeploySession: Boolean(session) }
  } else {
    degradationContext = await loadDegradationContextForVault(input.vaultAddress)
  }

  const degradation = enforceMutatingDegradation({
    verb,
    context: degradationContext,
  })
  if (degradation.blocked) {
    throw new VaultControlPlaneError({
      statusCode: 409,
      code: degradation.message ?? 'operation_blocked',
      message: degradation.message ?? 'Operation blocked by policy',
    })
  }

  const jobSpec = buildControlPlaneJobSpec({
    operationKind: input.operationKind,
    operationId: '',
    stageId: '',
    vaultAddress: input.vaultAddress,
    payload: input.payload,
  })

  const operation = await startControlPlaneOperation({
    operationKind: input.operationKind,
    vaultAddress: input.vaultAddress,
    scopeType: 'vault',
    scopeId: input.scopeId,
    lockScope: input.lockScope,
    lockKey: input.lockKey,
    requestedBy: input.requestedBy,
    idempotencyKey: input.idempotencyKey,
    schemaVersion: 'v1',
    policyVersion: policy.policyVersion,
    input: input.payload,
  })
  if (!operation.persisted) {
    throw new VaultControlPlaneError({
      statusCode: 503,
      code: 'control_plane_schema_not_ready',
      message: 'Control plane tracking unavailable until migrations 048 and 049 are applied',
    })
  }
  await transitionOperationStatus({
    operationId: operation.operationId,
    nextStatus: 'queued',
    reason: 'queued_for_keeper_execution',
    actor: input.requestedBy ?? 'system',
  })
  const stage = await createControlPlaneStage({
    operationId: operation.operationId,
    stageKind: jobSpec.stageKind,
    status: 'queued',
    input: {
      queueKind: 'internal_api',
      operationKind: input.operationKind,
      path: jobSpec.path,
    },
  })

  const jobBody = {
    ...jobSpec.body,
    operationId: operation.operationId,
    stageId: stage.stageId,
    requestedBy: input.requestedBy ?? null,
  }

  const degradationMode = resolveDegradationMode(verb)
  const runAtDelaySeconds =
    degradationMode === 'queue_for_retry' && input.operationKind === 'vault.maintenance' ? 30 : 0

  await enqueueKeeperJob({
    operationId: operation.operationId,
    stageId: stage.stageId,
    kind: 'internal_api',
    source: 'control-plane',
    dedupeKey: `${input.operationKind}:${input.lockKey}`,
    runAt: runAtDelaySeconds > 0 ? new Date(Date.now() + runAtDelaySeconds * 1000).toISOString() : undefined,
    payload: {
      path: jobSpec.path,
      method: 'POST',
      body: jobBody,
    },
  })
  await addControlPlaneEvent({
    operationId: operation.operationId,
    stageId: stage.stageId,
    eventType: 'queue.job_enqueued',
    message: 'Execution job queued',
    data: {
      queueKind: 'internal_api',
      path: jobSpec.path,
      lockKey: input.lockKey,
      policyVersion: policy.policyVersion,
      degradationMode,
      ...(runAtDelaySeconds > 0 ? { runAtDelaySeconds } : null),
    },
  })
  return { operationId: operation.operationId, stageId: stage.stageId }
}

export function createVaultControlPlane(): VaultControlPlane {
  return {
    async provisionVaultEconomy(request) {
      const vaultAddress = normalizeVaultAddress(request.vaultAddress)
      const queued = await queueAsyncVerb({
        operationKind: 'vault.provision',
        vaultAddress,
        scopeId: normalizeScopeId({ vaultAddress, chainId: request.chainId }),
        lockScope: 'vault.provision',
        lockKey: [
          String(request.creatorAddress ?? '').trim().toLowerCase() || 'unknown_creator',
          String(request.chainId ?? 'unknown_chain'),
          String(request.strategyVariant ?? 'default_strategy'),
        ].join(':'),
        requestedBy: request.requestedBy,
        payload: {
          chainId: request.chainId ?? null,
          creatorAddress: request.creatorAddress ?? null,
          strategyVariant: request.strategyVariant ?? null,
        },
      })
      return {
        accepted: true,
        operationId: queued.operationId,
        stageId: queued.stageId,
      }
    },

    async getVaultLifecycleStatus(vaultAddress) {
      const normalizedVaultAddress = normalizeVaultAddress(vaultAddress)
      if (!isDbConfigured()) return null
      await ensureKeeprSchema()
      const db = await getDb()
      if (!db) return null
      const rows = (await db.sql`
        SELECT graduated_at, settled_at, settlement_stage, settlement_stage_updated_at
        FROM keepr_vaults
        WHERE LOWER(vault_address) = ${normalizedVaultAddress}
        LIMIT 1;
      `) as {
        rows?: Array<{
          graduated_at: string | null
          settled_at: string | null
          settlement_stage: string | null
          settlement_stage_updated_at: string | null
        }>
      }
      const row = rows.rows?.[0]
      if (!row) return null
      const lastUpdatedAt = row.settlement_stage_updated_at ?? row.settled_at ?? row.graduated_at ?? null
      const { freshness, ageMinutes } = evaluateFreshness(lastUpdatedAt)
      const degradationMode = resolveDegradationMode('getVaultLifecycleStatus')
      return {
        vaultAddress: normalizedVaultAddress,
        graduatedAt: row.graduated_at,
        settledAt: row.settled_at,
        settlementStage: row.settlement_stage,
        settlementStageUpdatedAt: row.settlement_stage_updated_at,
        freshness,
        lastUpdatedAt,
        ...(freshness === 'stale' && degradationMode === 'allow_stale_read'
          ? {
              degradationMode: 'allow_stale_read' as const,
              warning: `lifecycle_data_stale:${ageMinutes ?? 'unknown'}m`,
            }
          : null),
      }
    },

    async runMaintenanceCycle(vaultAddress) {
      const normalizedVaultAddress = normalizeVaultAddress(vaultAddress)
      const queued = await queueAsyncVerb({
        operationKind: 'vault.maintenance',
        vaultAddress: normalizedVaultAddress,
        scopeId: normalizedVaultAddress,
        lockScope: 'vault.maintenance',
        lockKey: normalizedVaultAddress,
        payload: { mode: 'standard' },
      })
      return {
        accepted: true,
        operationId: queued.operationId,
        stageId: queued.stageId,
      }
    },

    async queueOperatorAction(request) {
      const normalizedVaultAddress = normalizeVaultAddress(request.vaultAddress)
      let action
      try {
        action = parseOperatorAction({
          type: request.actionType,
          vaultAddress: normalizedVaultAddress,
          ...(request.payload ?? {}),
        })
      } catch (error) {
        throw new VaultControlPlaneError({
          statusCode: 400,
          code: 'invalid_action_payload',
          message: error instanceof Error ? error.message : 'Invalid action payload',
        })
      }
      const queued = await queueAsyncVerb({
        operationKind: 'operator.action',
        vaultAddress: normalizedVaultAddress,
        scopeId: normalizedVaultAddress,
        lockScope: 'operator.action',
        lockKey: `${normalizedVaultAddress}:${action.type}`,
        requestedBy: request.requestedBy,
        idempotencyKey: request.idempotencyKey,
        payload: {
          actionType: action.type,
          action,
        },
      })
      return {
        accepted: true,
        operationId: queued.operationId,
        stageId: queued.stageId,
      }
    },

    async settleVault(request) {
      const vaultAddress = normalizeVaultAddress(request.vaultAddress)
      let parsed
      try {
        parsed = parseSettleVaultInput({
          vaultAddress,
          graduatedAt: request.graduatedAt,
          settledAt: request.settledAt,
          settlementStage: request.settlementStage,
        })
      } catch (error) {
        if (error instanceof SettleVaultExecutionError) {
          throw new VaultControlPlaneError({
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
          })
        }
        throw error
      }

      const queued = await queueAsyncVerb({
        operationKind: 'vault.settle',
        vaultAddress,
        scopeId: vaultAddress,
        lockScope: 'vault.settle',
        lockKey: vaultAddress,
        requestedBy: request.requestedBy,
        idempotencyKey: request.idempotencyKey,
        payload: {
          graduatedAt: parsed.graduatedAt || null,
          settledAt: parsed.settledAt || null,
          settlementStage: parsed.normalizedStage || null,
        },
      })

      return {
        accepted: true,
        operationId: queued.operationId,
        stageId: queued.stageId,
      }
    },
  }
}
