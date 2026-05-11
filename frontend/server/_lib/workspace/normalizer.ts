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
