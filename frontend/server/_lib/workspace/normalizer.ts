import type { RuntimeDecision, RuntimeRecord } from '../cre/runtimeBridge.js'
import { getDb } from '../db/postgres.js'
import {
  createAlertEvent,
  createTaskItem,
  updateTaskItem,
  createActivityEvent,
  type WorkspaceSeverity,
} from './repository.js'

type AnyObject = Record<string, unknown>

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddressLike(normalized) ? (normalized as `0x${string}`) : null
}

function asObject(value: unknown): AnyObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as AnyObject
}

function inferSeverity(input: {
  kind?: string | null
  status?: string | null
  text?: string | null
}): WorkspaceSeverity {
  const probe = `${input.kind ?? ''} ${input.status ?? ''} ${input.text ?? ''}`.toLowerCase()
  if (probe.includes('critical') || probe.includes('panic') || probe.includes('fatal') || probe.includes('fail')) {
    return 'critical'
  }
  if (probe.includes('warn') || probe.includes('degraded') || probe.includes('retry')) return 'warn'
  return 'info'
}

function extractVaultAddress(payload: AnyObject): `0x${string}` | null {
  return (
    normalizeAddress(payload.vaultAddress) ??
    normalizeAddress(payload.vault) ??
    normalizeAddress(payload.targetVaultAddress)
  )
}

export async function normalizeRuntimeRecordForWorkspace(params: {
  record: RuntimeRecord
}): Promise<{ created: boolean; vaultAddress?: `0x${string}`; taskId?: number; alertId?: number }> {
  const payload = asObject(params.record.payload)
  const vaultAddress = extractVaultAddress(payload)
  if (!vaultAddress) return { created: false }

  const severity = inferSeverity({
    kind: params.record.kind,
    status: String(payload.status ?? ''),
    text: JSON.stringify(payload).slice(0, 200),
  })

  const activity = await createActivityEvent({
    vaultAddress,
    eventType: `cre.record.${params.record.workflow}.${params.record.kind}`,
    source: 'cre.runtime.record',
    title: `CRE record: ${params.record.workflow}/${params.record.kind}`,
    description: typeof payload.message === 'string' ? payload.message : null,
    severity,
    payload: {
      workflow: params.record.workflow,
      kind: params.record.kind,
      idempotencyKey: params.record.idempotencyKey,
      source: params.record.source,
      payload,
    },
  })

  if (severity === 'info') {
    return { created: true, vaultAddress }
  }

  const task = await createTaskItem({
    vaultAddress,
    title: `Review CRE ${params.record.kind}`,
    description: `Investigate runtime record ${params.record.workflow}/${params.record.kind}`,
    source: 'cre.runtime.record',
    severity,
    status: 'pending',
    actionType: 'cre.record.review',
    actionPayload: {
      recordId: params.record.id,
      idempotencyKey: params.record.idempotencyKey,
    },
  })

  const alert = await createAlertEvent({
    vaultAddress,
    source: 'cre.runtime.record',
    severity,
    kind: params.record.kind,
    title: `CRE ${severity === 'critical' ? 'critical' : 'warning'}: ${params.record.kind}`,
    message: typeof payload.message === 'string' ? payload.message : null,
    details: {
      workflow: params.record.workflow,
      idempotencyKey: params.record.idempotencyKey,
      payload,
      activityId: activity.id,
    },
    relatedTaskId: task.id,
  })

  await updateTaskItem({
    id: task.id,
    description: `Investigate runtime record ${params.record.workflow}/${params.record.kind} (alert #${alert.id})`,
  })

  return {
    created: true,
    vaultAddress,
    taskId: task.id,
    alertId: alert.id,
  }
}

export async function normalizeRuntimeDecisionForWorkspace(params: {
  decision: RuntimeDecision
  actionId?: number | undefined
  enqueueAction?: {
    vaultAddress?: string
    groupId?: string
    actionType?: string
    action?: Record<string, unknown>
  } | null
}): Promise<{ created: boolean; vaultAddress?: `0x${string}`; approvalId?: number; taskId?: number }> {
  const decisionData = asObject(params.decision.decision)
  const enqueue = params.enqueueAction ?? null
  const vaultAddress =
    normalizeAddress(decisionData.vaultAddress) ??
    normalizeAddress(decisionData.vault) ??
    normalizeAddress(enqueue?.vaultAddress)
  if (!vaultAddress) return { created: false }

  const proposedActionType =
    (typeof enqueue?.actionType === 'string' && enqueue.actionType.trim()) ||
    (typeof decisionData.actionType === 'string' && decisionData.actionType.trim()) ||
    'decision.review'
  const severity = inferSeverity({
    status: String(params.decision.status ?? ''),
    text: JSON.stringify(decisionData).slice(0, 200),
  })
  const needsApproval =
    decisionData.requiresApproval === true ||
    proposedActionType.includes('pause') ||
    proposedActionType.includes('unwind') ||
    proposedActionType.includes('allocation')

  await createActivityEvent({
    vaultAddress,
    eventType: `cre.decision.${params.decision.workflow}`,
    source: 'cre.runtime.decision',
    title: `CRE decision: ${params.decision.workflow}`,
    description: typeof decisionData.reason === 'string' ? decisionData.reason : null,
    severity,
    payload: {
      status: params.decision.status,
      decisionId: params.decision.id,
      idempotencyKey: params.decision.idempotencyKey,
      decision: decisionData,
      actionId: params.actionId ?? null,
      enqueueAction: enqueue ?? null,
    },
  })

  const task = await createTaskItem({
    vaultAddress,
    title: needsApproval ? `Approval required: ${proposedActionType}` : `Review decision: ${proposedActionType}`,
    description:
      typeof decisionData.reason === 'string'
        ? decisionData.reason
        : `CRE decision generated an action proposal (${proposedActionType})`,
    source: 'cre.runtime.decision',
    severity: needsApproval ? 'warn' : severity,
    status: 'pending',
    actionType: proposedActionType,
    actionPayload: {
      decisionId: params.decision.id,
      idempotencyKey: params.decision.idempotencyKey,
      actionId: params.actionId ?? null,
      enqueueAction: enqueue ?? null,
      decision: decisionData,
    },
  })

  if (!needsApproval) {
    return { created: true, vaultAddress, taskId: task.id }
  }

  const { createApprovalRequest } = await import('./repository.js')
  const approval = await createApprovalRequest({
    vaultAddress,
    actionType: proposedActionType,
    payload: {
      decisionId: params.decision.id,
      actionId: params.actionId ?? null,
      enqueueAction: enqueue ?? null,
      decision: decisionData,
    },
    source: 'cre.runtime.decision',
    severity: severity === 'critical' ? 'high' : 'medium',
    status: 'pending',
    linkedTaskId: task.id,
  })

  await updateTaskItem({
    id: task.id,
    description: `${task.description ?? proposedActionType} (approval #${approval.id})`,
  })

  return { created: true, vaultAddress, approvalId: approval.id, taskId: task.id }
}

export async function normalizeKeeprActionStatusForWorkspace(params: {
  actionId: number
  status: 'executing' | 'executed' | 'failed' | 'retry'
  errorMessage?: string | null
}): Promise<{ created: boolean; vaultAddress?: `0x${string}` }> {
  const db = await getDb()
  if (!db) return { created: false }
  const result = await db.sql`
    SELECT id, vault_address, action_type, action, status, attempt_count, next_attempt_at
    FROM keepr_actions
    WHERE id = ${Number(params.actionId)}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return { created: false }
  const vaultAddress = normalizeAddress(row.vault_address)
  if (!vaultAddress) return { created: false }

  const actionType = typeof row.action_type === 'string' ? row.action_type : 'keepr.action'
  const actionPayload = asObject(row.action)
  const severity: WorkspaceSeverity =
    params.status === 'failed' ? 'critical' : params.status === 'retry' ? 'warn' : 'info'

  const activity = await createActivityEvent({
    vaultAddress,
    eventType: `keepr.action.${params.status}`,
    source: 'keepr.action',
    title: `Keepr action ${params.status}: ${actionType}`,
    description: params.errorMessage ? params.errorMessage.slice(0, 320) : null,
    severity,
    payload: {
      actionId: row.id,
      actionType,
      attemptCount: Number(row.attempt_count ?? 0),
      nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at).toISOString() : null,
      action: actionPayload,
    },
  })

  if (params.status !== 'failed' && params.status !== 'retry') {
    return { created: true, vaultAddress }
  }

  const task = await createTaskItem({
    vaultAddress,
    title: `Action ${params.status}: ${actionType}`,
    description: params.errorMessage?.slice(0, 320) || `Keepr action ${row.id} requires operator attention`,
    source: 'keepr.action',
    severity,
    status: 'pending',
    actionType,
    actionPayload: {
      actionId: row.id,
      actionType,
      error: params.errorMessage ?? null,
      status: params.status,
      action: actionPayload,
    },
  })

  await createAlertEvent({
    vaultAddress,
    source: 'keepr.action',
    severity,
    kind: actionType,
    title: `Keepr action ${params.status}`,
    message: params.errorMessage?.slice(0, 320) || null,
    details: {
      actionId: row.id,
      actionType,
      status: params.status,
      activityId: activity.id,
    },
    relatedTaskId: task.id,
  })

  return { created: true, vaultAddress }
}
