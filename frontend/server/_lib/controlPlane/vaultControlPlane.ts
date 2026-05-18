import { getDb, isDbConfigured } from '../../../packages/server-core/src/index.js'
import { ensureKeeprSchema } from '../keepr/keeprSchema.js'
import { enqueueKeeperJob } from '../keeperJobs/keeperJobs.js'
import {
  addControlPlaneEvent,
  completeControlPlaneOperation,
  createControlPlaneStage,
  startControlPlaneOperation,
  transitionOperationStatus,
  transitionStageStatus,
  type OperationStatus,
} from './operations.js'
import { parseOperatorAction } from './operatorActions.js'
import { loadControlPlanePolicy } from './policy.js'

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
  updated: boolean
  stageUpdated: boolean
  operationId: string
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

function normalizeSettlementStage(value: string | undefined): string {
  const stage = String(value || '').trim()
  if (!stage) return ''
  if (!/^[a-z0-9_:-]{2,64}$/i.test(stage)) {
    throw new VaultControlPlaneError({
      statusCode: 400,
      code: 'invalid_settlement_stage',
      message: 'Invalid settlementStage',
    })
  }
  return stage
}

function validateSettledAt(params: { settledAt: string; normalizedStage: string }): void {
  if (params.normalizedStage.toLowerCase() !== 'completed') {
    throw new VaultControlPlaneError({
      statusCode: 400,
      code: 'invalid_settled_at_stage',
      message: 'settledAt may only be written when settlementStage="completed"',
    })
  }
  const parsedSettledAt = Date.parse(params.settledAt)
  if (!Number.isFinite(parsedSettledAt)) {
    throw new VaultControlPlaneError({
      statusCode: 400,
      code: 'invalid_settled_at_format',
      message: 'Invalid settledAt — expected ISO-8601 timestamp',
    })
  }
  const maxAllowedMs = Date.now() + 5 * 60 * 1000
  if (parsedSettledAt > maxAllowedMs) {
    throw new VaultControlPlaneError({
      statusCode: 400,
      code: 'invalid_settled_at_future',
      message: 'settledAt cannot be in the future',
    })
  }
}

export interface VaultControlPlane {
  provisionVaultEconomy(request: ProvisionVaultEconomyRequest): Promise<{ accepted: boolean; operationId: string; stageId?: string }>
  getVaultLifecycleStatus(vaultAddress: string): Promise<VaultLifecycleStatus | null>
  runMaintenanceCycle(vaultAddress: string): Promise<{ accepted: boolean; operationId: string; stageId?: string }>
  queueOperatorAction(request: QueueOperatorActionRequest): Promise<{ accepted: boolean; operationId: string; stageId?: string }>
  settleVault(request: SettleVaultRequest): Promise<SettleVaultResult>
}

type AsyncVerbKind = 'vault.provision' | 'vault.maintenance' | 'operator.action'

function normalizeScopeId(params: { vaultAddress: string; chainId?: number }): string {
  return params.chainId ? `${params.vaultAddress}:${params.chainId}` : params.vaultAddress
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
  await transitionOperationStatus({
    operationId: operation.operationId,
    nextStatus: 'queued',
    reason: 'queued_for_keeper_execution',
    actor: input.requestedBy ?? 'system',
  })
  const stage = await createControlPlaneStage({
    operationId: operation.operationId,
    stageKind: 'queue.enqueue',
    status: 'queued',
    input: {
      queueKind: 'noop',
      operationKind: input.operationKind,
    },
  })
  await enqueueKeeperJob({
    operationId: operation.operationId,
    stageId: stage.stageId,
    kind: 'noop',
    source: 'control-plane',
    dedupeKey: `${input.operationKind}:${input.lockKey}`,
    payload: {
      operationId: operation.operationId,
      stageId: stage.stageId,
      operationKind: input.operationKind,
      ...input.payload,
    },
  })
  await addControlPlaneEvent({
    operationId: operation.operationId,
    stageId: stage.stageId,
    eventType: 'queue.job_enqueued',
    message: 'Execution job queued',
    data: {
      queueKind: 'noop',
      lockKey: input.lockKey,
      degradedMode: 'queue_for_retry',
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
      const rows = await db.sql<{
        graduated_at: string | null
        settled_at: string | null
        settlement_stage: string | null
        settlement_stage_updated_at: string | null
      }>`
        SELECT graduated_at, settled_at, settlement_stage, settlement_stage_updated_at
        FROM keepr_vaults
        WHERE LOWER(vault_address) = ${normalizedVaultAddress}
        LIMIT 1;
      `
      const row = rows.rows[0]
      if (!row) return null
      return {
        vaultAddress: normalizedVaultAddress,
        graduatedAt: row.graduated_at,
        settledAt: row.settled_at,
        settlementStage: row.settlement_stage,
        settlementStageUpdatedAt: row.settlement_stage_updated_at,
        freshness: 'fresh',
        lastUpdatedAt: row.settlement_stage_updated_at ?? row.settled_at ?? row.graduated_at ?? null,
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
      const operation = await startControlPlaneOperation({
        operationKind: 'vault.settle',
        vaultAddress,
        scopeType: 'vault',
        scopeId: vaultAddress,
        lockScope: 'vault.settle',
        lockKey: vaultAddress,
        requestedBy: request.requestedBy,
        idempotencyKey: request.idempotencyKey,
        schemaVersion: 'v1',
        policyVersion: loadControlPlanePolicy().policyVersion,
        input: {
          graduatedAt: request.graduatedAt ?? null,
          settledAt: request.settledAt ?? null,
          settlementStage: request.settlementStage ?? null,
        },
      })
      const stage = await createControlPlaneStage({
        operationId: operation.operationId,
        stageKind: 'operation.finalize',
        status: 'requested',
      })
      await transitionOperationStatus({
        operationId: operation.operationId,
        nextStatus: 'running',
        reason: 'settlement_started',
        actor: request.requestedBy ?? 'system',
      })
      await transitionStageStatus({
        stageId: stage.stageId,
        nextStatus: 'running',
        reason: 'settlement_started',
        actor: request.requestedBy ?? 'system',
      })
      const graduatedAt = typeof request.graduatedAt === 'string' ? request.graduatedAt.trim() : ''
      const settledAt = typeof request.settledAt === 'string' ? request.settledAt.trim() : ''
      const normalizedStage = normalizeSettlementStage(request.settlementStage)
      try {
        if (!graduatedAt && !settledAt && !normalizedStage) {
          throw new VaultControlPlaneError({
            statusCode: 400,
            code: 'missing_settlement_update_fields',
            message: 'Must provide graduatedAt, settledAt, or settlementStage',
          })
        }
        if (settledAt) {
          validateSettledAt({ settledAt, normalizedStage })
        }

        if (!isDbConfigured()) {
          throw new VaultControlPlaneError({
            statusCode: 500,
            code: 'database_not_configured',
            message: 'Database not configured',
          })
        }

        await ensureKeeprSchema()
        const db = await getDb()
        if (!db) {
          throw new VaultControlPlaneError({
            statusCode: 500,
            code: 'database_unavailable',
            message: 'Database unavailable',
          })
        }

        await db.sql`
          UPDATE keepr_vaults
          SET graduated_at = COALESCE(graduated_at, ${graduatedAt || null}::timestamptz),
              settled_at = COALESCE(settled_at, ${settledAt || null}::timestamptz),
              settlement_stage = COALESCE(${normalizedStage || null}::text, settlement_stage),
              settlement_stage_updated_at =
                CASE
                  WHEN ${normalizedStage || null}::text IS NULL THEN settlement_stage_updated_at
                  ELSE NOW()
                END,
              updated_at = NOW()
          WHERE LOWER(vault_address) = ${vaultAddress};
        `

        const result = {
          updated: true,
          stageUpdated: Boolean(normalizedStage),
          operationId: operation.operationId,
        } satisfies SettleVaultResult
        await completeControlPlaneOperation({
          operationId: operation.operationId,
          status: 'succeeded',
          result: {
            updated: result.updated,
            stageUpdated: result.stageUpdated,
          },
        })
        await transitionStageStatus({
          stageId: stage.stageId,
          nextStatus: 'succeeded',
          reason: 'settlement_completed',
          actor: request.requestedBy ?? 'system',
        })
        return result
      } catch (error) {
        await transitionStageStatus({
          stageId: stage.stageId,
          nextStatus: 'failed',
          reason: 'settlement_failed',
          actor: request.requestedBy ?? 'system',
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        await completeControlPlaneOperation({
          operationId: operation.operationId,
          status: 'failed',
          errorCode: error instanceof VaultControlPlaneError ? error.code : 'unexpected_error',
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  }
}
