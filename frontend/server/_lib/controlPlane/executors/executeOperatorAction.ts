import { getDb, isDbConfigured } from '@4626/server-core'
import { ensureKeeprSchema } from '../../keepr/keeprSchema.js'
import { executeKeeprStrategyAction } from '../../../keepr/strategyActionExecutor.js'
import type { OperatorAction } from '../operatorActions.js'
import {
  executeVaultReport,
  executeVaultSweep,
  executeVaultTend,
  KeeperVaultActionError,
} from './keeperVaultActions.js'

export class OperatorActionExecutionError extends Error {
  code: string
  retryable: boolean

  constructor(message: string, params?: { code?: string; retryable?: boolean }) {
    super(message)
    this.code = params?.code ?? 'operator_action_failed'
    this.retryable = params?.retryable ?? true
  }
}

export type ExecuteOperatorActionResult = {
  actionType: string
  executed: boolean
  result: Record<string, unknown>
}

async function executeSolanaReconcile(action: Extract<OperatorAction, { type: 'solana.reconcile' }>) {
  if (!isDbConfigured()) {
    return {
      workflow: action.workflow,
      action: action.action,
      checkpointKey: action.checkpointKey,
      status: 'skipped_unconfigured',
      executed: false,
    }
  }
  await ensureKeeprSchema()
  const db = await getDb()
  if (!db) {
    return {
      workflow: action.workflow,
      action: action.action,
      checkpointKey: action.checkpointKey,
      status: 'skipped_unconfigured',
      executed: false,
    }
  }

  const prior = await db.sql`
    SELECT status, response_json
    FROM keepr_workflow_checkpoints
    WHERE workflow = ${action.workflow} AND checkpoint_key = ${action.checkpointKey}
    LIMIT 1;
  `
  const priorRow = prior.rows?.[0] as { status?: string; response_json?: unknown } | undefined
  if (priorRow?.status === 'completed') {
    return {
      workflow: action.workflow,
      action: action.action,
      checkpointKey: action.checkpointKey,
      status: 'already_processed',
      executed: false,
      upstreamResponse: priorRow.response_json,
    }
  }

  const solanaOrchestratorUrl = (process.env.SOLANA_ORCHESTRATOR_URL ?? '').trim().replace(/\/$/, '')
  if (!solanaOrchestratorUrl) {
    return {
      workflow: action.workflow,
      action: action.action,
      checkpointKey: action.checkpointKey,
      status: 'skipped_unconfigured',
      executed: false,
      reason: 'solana_orchestrator_not_configured',
    }
  }

  const upstream = await fetch(`${solanaOrchestratorUrl}/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      workflow: action.workflow,
      action: action.action,
      checkpointKey: action.checkpointKey,
    }),
  })
  const upstreamResponse = await upstream.json().catch(() => null)
  const status = upstream.ok ? 'completed' : 'failed'

  await db.sql`
    INSERT INTO keepr_workflow_checkpoints (workflow, checkpoint_key, status, response_json, updated_at)
    VALUES (
      ${action.workflow},
      ${action.checkpointKey},
      ${status === 'completed' ? 'completed' : 'failed'},
      ${JSON.stringify(upstreamResponse ?? {})}::jsonb,
      NOW()
    )
    ON CONFLICT (workflow, checkpoint_key) DO UPDATE SET
      status = EXCLUDED.status,
      response_json = EXCLUDED.response_json,
      updated_at = NOW();
  `

  if (!upstream.ok) {
    throw new OperatorActionExecutionError(`solana_reconcile_failed:${upstream.status}`, {
      code: 'solana_reconcile_failed',
      retryable: true,
    })
  }

  return {
    workflow: action.workflow,
    action: action.action,
    checkpointKey: action.checkpointKey,
    status,
    executed: true,
    upstreamResponse,
  }
}

export async function executeOperatorAction(input: {
  vaultAddress: `0x${string}`
  action: OperatorAction
}): Promise<ExecuteOperatorActionResult> {
  const { action, vaultAddress } = input

  switch (action.type) {
    case 'vault.tend': {
      const result = await executeVaultTend(vaultAddress)
      return { actionType: action.type, executed: true, result }
    }
    case 'vault.report': {
      const result = await executeVaultReport(vaultAddress)
      return { actionType: action.type, executed: true, result }
    }
    case 'vault.sweep': {
      const result = await executeVaultSweep({ ccaStrategyAddress: action.ccaStrategyAddress })
      return { actionType: action.type, executed: true, result }
    }
    case 'strategy.ajna.rebucket': {
      const keeprResult = await executeKeeprStrategyAction({
        vaultAddress,
        actionType: 'strategy.ajna.rebucket',
        action: {
          action: 'strategy.ajna.rebucket',
          actionType: 'strategy.ajna.rebucket',
          vaultAddress: action.vaultAddress,
          targetBucket: action.targetBucket,
          method: 'setMinBucketIndex',
          ...(action.authAddress
            ? { authAddress: action.authAddress, targetAddress: action.authAddress }
            : null),
          ...(action.strategyAddress ? { strategyAddress: action.strategyAddress } : null),
        },
      })
      if (!keeprResult.success) {
        throw new OperatorActionExecutionError(keeprResult.error ?? 'ajna_rebucket_failed', {
          code: keeprResult.error ?? 'ajna_rebucket_failed',
          retryable: keeprResult.retryable,
        })
      }
      return {
        actionType: action.type,
        executed: true,
        result: { ...(keeprResult.details ?? {}) },
      }
    }
    case 'strategy.charm.rebalance': {
      const keeprResult = await executeKeeprStrategyAction({
        vaultAddress,
        actionType: 'strategy.charm.rebalance',
        action: {
          charmVaultAddress: action.charmVaultAddress,
          vaultAddress: action.vaultAddress,
        },
      })
      if (!keeprResult.success) {
        throw new OperatorActionExecutionError(keeprResult.error ?? 'charm_rebalance_failed', {
          code: keeprResult.error ?? 'charm_rebalance_failed',
          retryable: keeprResult.retryable,
        })
      }
      return {
        actionType: action.type,
        executed: true,
        result: {
          ...(keeprResult.details ?? {}),
        },
      }
    }
    case 'solana.reconcile': {
      const result = await executeSolanaReconcile(action)
      return {
        actionType: action.type,
        executed: Boolean((result as { executed?: boolean }).executed),
        result: result as Record<string, unknown>,
      }
    }
    default:
      throw new OperatorActionExecutionError('unsupported_operator_action_type', {
        code: 'unsupported_operator_action_type',
        retryable: false,
      })
  }
}

export { KeeperVaultActionError }
