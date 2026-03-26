import { getDb } from '../postgres.js'
import { ensureWorkspaceSchema } from './schema.js'

export type WorkspaceSeverity = 'info' | 'warn' | 'critical'

export type WorkspaceStrategyTarget = {
  vaultAddress: `0x${string}`
  strategyAddress: `0x${string}`
  targetWeightBps: number
  status: string
  updatedBy: `0x${string}` | null
  updatedSource: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type WorkspaceMonitoringSnapshot = {
  id: number
  vaultAddress: `0x${string}`
  snapshotKind: string
  payload: Record<string, unknown>
  source: string
  createdAt: string
}

export type WorkspaceAlertEvent = {
  id: number
  vaultAddress: `0x${string}`
  source: string
  severity: WorkspaceSeverity
  kind: string
  title: string
  message: string | null
  details: Record<string, unknown>
  status: string
  dedupeKey: string | null
  relatedTaskId: number | null
  createdBy: `0x${string}` | null
  acknowledgedBy: `0x${string}` | null
  acknowledgedAt: string | null
  resolvedBy: `0x${string}` | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type WorkspaceApprovalRequest = {
  id: number
  vaultAddress: `0x${string}`
  actionType: string
  payload: Record<string, unknown>
  source: string
  severity: string
  status: string
  requestedBy: `0x${string}` | null
  signerAddress: `0x${string}` | null
  deadlineAt: string | null
  decidedBy: `0x${string}` | null
  decidedAt: string | null
  decisionReason: string | null
  linkedTaskId: number | null
  createdAt: string
  updatedAt: string
}

export type WorkspaceTaskItem = {
  id: number
  vaultAddress: `0x${string}`
  title: string
  description: string | null
  source: string
  severity: WorkspaceSeverity
  status: string
  actionType: string | null
  actionPayload: Record<string, unknown>
  relatedAlertId: number | null
  relatedApprovalId: number | null
  roomRef: string | null
  threadRef: string | null
  assigneeWallet: `0x${string}` | null
  dueAt: string | null
  snoozedUntil: string | null
  createdBy: `0x${string}` | null
  updatedBy: `0x${string}` | null
  createdAt: string
  updatedAt: string
}

export type WorkspaceActivityEvent = {
  id: number
  vaultAddress: `0x${string}`
  eventType: string
  actorAddress: `0x${string}` | null
  source: string
  title: string
  description: string | null
  severity: WorkspaceSeverity
  payload: Record<string, unknown>
  relatedTaskId: number | null
  relatedApprovalId: number | null
  relatedAlertId: number | null
  createdAt: string
}

export type WorkspaceNotificationPreference = {
  vaultAddress: `0x${string}`
  principalAddress: `0x${string}`
  telegramEnabled: boolean
  xmtpEnabled: boolean
  emailEnabled: boolean
  minSeverity: string
  channels: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type WorkspaceAuditLog = {
  id: number
  vaultAddress: `0x${string}`
  actorAddress: `0x${string}` | null
  actorRole: string | null
  source: string
  action: string
  targetType: string | null
  targetId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  details: Record<string, unknown>
  createdAt: string
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddressLike(normalized) ? (normalized as `0x${string}`) : null
}

function normalizeRequiredAddress(value: unknown, fieldName: string): `0x${string}` {
  const out = normalizeAddress(value)
  if (!out) throw new Error(`invalid_${fieldName}`)
  return out
}

function toIso(value: unknown): string | null {
  if (!value) return null
  try {
    return new Date(String(value)).toISOString()
  } catch {
    return null
  }
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeSeverity(value: unknown): WorkspaceSeverity {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'critical') return 'critical'
  if (normalized === 'warn' || normalized === 'warning') return 'warn'
  return 'info'
}

function normalizeLimit(value: number | undefined, max = 100): number {
  const fallback = 20
  if (!Number.isFinite(Number(value))) return fallback
  const parsed = Math.floor(Number(value))
  if (parsed < 1) return 1
  if (parsed > max) return max
  return parsed
}

async function withDb() {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureWorkspaceSchema()
  return db
}

function mapStrategyTarget(row: any): WorkspaceStrategyTarget {
  return {
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    strategyAddress: normalizeRequiredAddress(row.strategy_address, 'strategy_address'),
    targetWeightBps: Number(row.target_weight_bps ?? 0),
    status: String(row.status ?? 'active'),
    updatedBy: normalizeAddress(row.updated_by),
    updatedSource: typeof row.updated_source === 'string' ? row.updated_source : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapMonitoringSnapshot(row: any): WorkspaceMonitoringSnapshot {
  return {
    id: Number(row.id ?? 0),
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    snapshotKind: String(row.snapshot_kind ?? 'vault_report'),
    payload: asJsonRecord(row.payload_json),
    source: String(row.source ?? 'workspace'),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  }
}

function mapAlertEvent(row: any): WorkspaceAlertEvent {
  return {
    id: Number(row.id ?? 0),
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    source: String(row.source ?? 'workspace'),
    severity: normalizeSeverity(row.severity),
    kind: String(row.kind ?? 'unknown'),
    title: String(row.title ?? 'Alert'),
    message: typeof row.message === 'string' ? row.message : null,
    details: asJsonRecord(row.details_json),
    status: String(row.status ?? 'open'),
    dedupeKey: typeof row.dedupe_key === 'string' ? row.dedupe_key : null,
    relatedTaskId: Number.isFinite(Number(row.related_task_id)) ? Number(row.related_task_id) : null,
    createdBy: normalizeAddress(row.created_by),
    acknowledgedBy: normalizeAddress(row.acknowledged_by),
    acknowledgedAt: toIso(row.acknowledged_at),
    resolvedBy: normalizeAddress(row.resolved_by),
    resolvedAt: toIso(row.resolved_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapApprovalRequest(row: any): WorkspaceApprovalRequest {
  return {
    id: Number(row.id ?? 0),
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    actionType: String(row.action_type ?? 'unknown'),
    payload: asJsonRecord(row.payload_json),
    source: String(row.source ?? 'workspace'),
    severity: String(row.severity ?? 'medium'),
    status: String(row.status ?? 'pending'),
    requestedBy: normalizeAddress(row.requested_by),
    signerAddress: normalizeAddress(row.signer_address),
    deadlineAt: toIso(row.deadline_at),
    decidedBy: normalizeAddress(row.decided_by),
    decidedAt: toIso(row.decided_at),
    decisionReason: typeof row.decision_reason === 'string' ? row.decision_reason : null,
    linkedTaskId: Number.isFinite(Number(row.linked_task_id)) ? Number(row.linked_task_id) : null,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapTaskItem(row: any): WorkspaceTaskItem {
  return {
    id: Number(row.id ?? 0),
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    title: String(row.title ?? 'Task'),
    description: typeof row.description === 'string' ? row.description : null,
    source: String(row.source ?? 'workspace'),
    severity: normalizeSeverity(row.severity),
    status: String(row.status ?? 'pending'),
    actionType: typeof row.action_type === 'string' ? row.action_type : null,
    actionPayload: asJsonRecord(row.action_payload_json),
    relatedAlertId: Number.isFinite(Number(row.related_alert_id)) ? Number(row.related_alert_id) : null,
    relatedApprovalId: Number.isFinite(Number(row.related_approval_id)) ? Number(row.related_approval_id) : null,
    roomRef: typeof row.room_ref === 'string' ? row.room_ref : null,
    threadRef: typeof row.thread_ref === 'string' ? row.thread_ref : null,
    assigneeWallet: normalizeAddress(row.assignee_wallet),
    dueAt: toIso(row.due_at),
    snoozedUntil: toIso(row.snoozed_until),
    createdBy: normalizeAddress(row.created_by),
    updatedBy: normalizeAddress(row.updated_by),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapActivityEvent(row: any): WorkspaceActivityEvent {
  return {
    id: Number(row.id ?? 0),
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    eventType: String(row.event_type ?? 'event'),
    actorAddress: normalizeAddress(row.actor_address),
    source: String(row.source ?? 'workspace'),
    title: String(row.title ?? 'Activity'),
    description: typeof row.description === 'string' ? row.description : null,
    severity: normalizeSeverity(row.severity),
    payload: asJsonRecord(row.payload_json),
    relatedTaskId: Number.isFinite(Number(row.related_task_id)) ? Number(row.related_task_id) : null,
    relatedApprovalId: Number.isFinite(Number(row.related_approval_id)) ? Number(row.related_approval_id) : null,
    relatedAlertId: Number.isFinite(Number(row.related_alert_id)) ? Number(row.related_alert_id) : null,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  }
}

function mapNotificationPreference(row: any): WorkspaceNotificationPreference {
  return {
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    principalAddress: normalizeRequiredAddress(row.principal_address, 'principal_address'),
    telegramEnabled: row.telegram_enabled === true,
    xmtpEnabled: row.xmtp_enabled === true,
    emailEnabled: row.email_enabled === true,
    minSeverity: typeof row.min_severity === 'string' ? row.min_severity : 'warn',
    channels: asJsonRecord(row.channels_json),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  }
}

function mapAuditLog(row: any): WorkspaceAuditLog {
  return {
    id: Number(row.id ?? 0),
    vaultAddress: normalizeRequiredAddress(row.vault_address, 'vault_address'),
    actorAddress: normalizeAddress(row.actor_address),
    actorRole: typeof row.actor_role === 'string' ? row.actor_role : null,
    source: String(row.source ?? 'workspace'),
    action: String(row.action ?? 'action'),
    targetType: typeof row.target_type === 'string' ? row.target_type : null,
    targetId: typeof row.target_id === 'string' ? row.target_id : null,
    before: row.before_json && typeof row.before_json === 'object' ? asJsonRecord(row.before_json) : null,
    after: row.after_json && typeof row.after_json === 'object' ? asJsonRecord(row.after_json) : null,
    details: asJsonRecord(row.details_json),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  }
}

export async function listStrategyTargets(vaultAddress: `0x${string}`): Promise<WorkspaceStrategyTarget[]> {
  const db = await withDb()
  const normalizedVault = normalizeRequiredAddress(vaultAddress, 'vault_address')
  const result = await db.sql`
    SELECT *
    FROM workspace_strategy_targets
    WHERE vault_address = ${normalizedVault}
    ORDER BY updated_at DESC;
  `
  return (result.rows ?? []).map(mapStrategyTarget)
}

export async function upsertStrategyTarget(params: {
  vaultAddress: `0x${string}`
  strategyAddress: `0x${string}`
  targetWeightBps: number
  status?: string
  updatedBy?: `0x${string}` | null
  updatedSource?: string | null
  notes?: string | null
}): Promise<WorkspaceStrategyTarget> {
  const db = await withDb()
  const vaultAddress = normalizeRequiredAddress(params.vaultAddress, 'vault_address')
  const strategyAddress = normalizeRequiredAddress(params.strategyAddress, 'strategy_address')
  const targetWeightBps = Math.max(0, Math.min(10_000, Math.floor(Number(params.targetWeightBps))))
  const status = typeof params.status === 'string' && params.status.trim() ? params.status.trim() : 'active'
  const updatedBy = normalizeAddress(params.updatedBy)
  const updatedSource = typeof params.updatedSource === 'string' ? params.updatedSource : null
  const notes = typeof params.notes === 'string' ? params.notes : null
  const result = await db.sql`
    INSERT INTO workspace_strategy_targets (
      vault_address,
      strategy_address,
      target_weight_bps,
      status,
      updated_by,
      updated_source,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      ${vaultAddress},
      ${strategyAddress},
      ${targetWeightBps},
      ${status},
      ${updatedBy},
      ${updatedSource},
      ${notes},
      NOW(),
      NOW()
    )
    ON CONFLICT (vault_address, strategy_address) DO UPDATE
    SET
      target_weight_bps = EXCLUDED.target_weight_bps,
      status = EXCLUDED.status,
      updated_by = EXCLUDED.updated_by,
      updated_source = EXCLUDED.updated_source,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_strategy_target_upsert_failed')
  return mapStrategyTarget(row)
}

export async function insertMonitoringSnapshot(params: {
  vaultAddress: `0x${string}`
  snapshotKind?: string
  payload: Record<string, unknown>
  source?: string
}): Promise<WorkspaceMonitoringSnapshot> {
  const db = await withDb()
  const result = await db.sql`
    INSERT INTO workspace_monitoring_snapshots (
      vault_address,
      snapshot_kind,
      payload_json,
      source,
      created_at
    )
    VALUES (
      ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')},
      ${params.snapshotKind?.trim() || 'vault_report'},
      ${asJsonRecord(params.payload)},
      ${params.source?.trim() || 'workspace'},
      NOW()
    )
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_snapshot_insert_failed')
  return mapMonitoringSnapshot(row)
}

export async function listMonitoringSnapshots(params: {
  vaultAddress: `0x${string}`
  limit?: number
}): Promise<WorkspaceMonitoringSnapshot[]> {
  const db = await withDb()
  const result = await db.sql`
    SELECT *
    FROM workspace_monitoring_snapshots
    WHERE vault_address = ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')}
    ORDER BY created_at DESC
    LIMIT ${normalizeLimit(params.limit, 200)};
  `
  return (result.rows ?? []).map(mapMonitoringSnapshot)
}

export async function createAlertEvent(params: {
  vaultAddress: `0x${string}`
  source: string
  severity?: WorkspaceSeverity
  kind: string
  title: string
  message?: string | null
  details?: Record<string, unknown>
  status?: string
  dedupeKey?: string | null
  relatedTaskId?: number | null
  createdBy?: `0x${string}` | null
}): Promise<WorkspaceAlertEvent> {
  const db = await withDb()
  const result = await db.sql`
    INSERT INTO workspace_alert_events (
      vault_address,
      source,
      severity,
      kind,
      title,
      message,
      details_json,
      status,
      dedupe_key,
      related_task_id,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')},
      ${params.source.trim()},
      ${normalizeSeverity(params.severity)},
      ${params.kind.trim()},
      ${params.title.trim()},
      ${params.message?.trim() || null},
      ${asJsonRecord(params.details)},
      ${params.status?.trim() || 'open'},
      ${params.dedupeKey?.trim() || null},
      ${Number.isFinite(Number(params.relatedTaskId)) ? Number(params.relatedTaskId) : null},
      ${normalizeAddress(params.createdBy)},
      NOW(),
      NOW()
    )
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_alert_insert_failed')
  return mapAlertEvent(row)
}

export async function listAlertEvents(params: {
  vaultAddress: `0x${string}`
  status?: string | null
  limit?: number
}): Promise<WorkspaceAlertEvent[]> {
  const db = await withDb()
  const status = typeof params.status === 'string' && params.status.trim() ? params.status.trim() : null
  const result = await db.sql`
    SELECT *
    FROM workspace_alert_events
    WHERE vault_address = ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')}
      AND (${status}::text IS NULL OR status = ${status})
    ORDER BY created_at DESC
    LIMIT ${normalizeLimit(params.limit, 200)};
  `
  return (result.rows ?? []).map(mapAlertEvent)
}

export async function updateAlertStatus(params: {
  id: number
  status: string
  actor?: `0x${string}` | null
}): Promise<WorkspaceAlertEvent | null> {
  const db = await withDb()
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) throw new Error('invalid_alert_id')
  const status = params.status.trim()
  const actor = normalizeAddress(params.actor)
  const isAcknowledged = status === 'acknowledged'
  const isResolved = status === 'resolved'
  const result = await db.sql`
    UPDATE workspace_alert_events
    SET
      status = ${status},
      acknowledged_by = CASE WHEN ${isAcknowledged} THEN ${actor} ELSE acknowledged_by END,
      acknowledged_at = CASE WHEN ${isAcknowledged} THEN NOW() ELSE acknowledged_at END,
      resolved_by = CASE WHEN ${isResolved} THEN ${actor} ELSE resolved_by END,
      resolved_at = CASE WHEN ${isResolved} THEN NOW() ELSE resolved_at END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `
  const row = result.rows?.[0]
  return row ? mapAlertEvent(row) : null
}

export async function createApprovalRequest(params: {
  vaultAddress: `0x${string}`
  actionType: string
  payload?: Record<string, unknown>
  source?: string
  severity?: string
  status?: string
  requestedBy?: `0x${string}` | null
  signerAddress?: `0x${string}` | null
  deadlineAt?: string | Date | null
  linkedTaskId?: number | null
}): Promise<WorkspaceApprovalRequest> {
  const db = await withDb()
  const result = await db.sql`
    INSERT INTO workspace_approvals (
      vault_address,
      action_type,
      payload_json,
      source,
      severity,
      status,
      requested_by,
      signer_address,
      deadline_at,
      linked_task_id,
      created_at,
      updated_at
    )
    VALUES (
      ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')},
      ${params.actionType.trim()},
      ${asJsonRecord(params.payload)},
      ${params.source?.trim() || 'workspace'},
      ${params.severity?.trim() || 'medium'},
      ${params.status?.trim() || 'pending'},
      ${normalizeAddress(params.requestedBy)},
      ${normalizeAddress(params.signerAddress)},
      ${toIso(params.deadlineAt)},
      ${Number.isFinite(Number(params.linkedTaskId)) ? Number(params.linkedTaskId) : null},
      NOW(),
      NOW()
    )
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_approval_insert_failed')
  return mapApprovalRequest(row)
}

export async function listApprovalRequests(params: {
  vaultAddress: `0x${string}`
  status?: string | null
  limit?: number
}): Promise<WorkspaceApprovalRequest[]> {
  const db = await withDb()
  const status = typeof params.status === 'string' && params.status.trim() ? params.status.trim() : null
  const result = await db.sql`
    SELECT *
    FROM workspace_approvals
    WHERE vault_address = ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')}
      AND (${status}::text IS NULL OR status = ${status})
    ORDER BY created_at DESC
    LIMIT ${normalizeLimit(params.limit, 200)};
  `
  return (result.rows ?? []).map(mapApprovalRequest)
}

export async function getApprovalRequestById(id: number): Promise<WorkspaceApprovalRequest | null> {
  const db = await withDb()
  const result = await db.sql`
    SELECT *
    FROM workspace_approvals
    WHERE id = ${id}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapApprovalRequest(row) : null
}

export async function updateApprovalDecision(params: {
  id: number
  status: 'approved' | 'rejected' | 'cancelled' | 'executed'
  decidedBy?: `0x${string}` | null
  decisionReason?: string | null
}): Promise<WorkspaceApprovalRequest | null> {
  const db = await withDb()
  const result = await db.sql`
    UPDATE workspace_approvals
    SET
      status = ${params.status},
      decided_by = ${normalizeAddress(params.decidedBy)},
      decided_at = NOW(),
      decision_reason = ${params.decisionReason?.trim() || null},
      updated_at = NOW()
    WHERE id = ${Number(params.id)}
    RETURNING *;
  `
  const row = result.rows?.[0]
  return row ? mapApprovalRequest(row) : null
}

export async function createTaskItem(params: {
  vaultAddress: `0x${string}`
  title: string
  description?: string | null
  source?: string
  severity?: WorkspaceSeverity
  status?: string
  actionType?: string | null
  actionPayload?: Record<string, unknown>
  relatedAlertId?: number | null
  relatedApprovalId?: number | null
  roomRef?: string | null
  threadRef?: string | null
  assigneeWallet?: `0x${string}` | null
  dueAt?: string | Date | null
  snoozedUntil?: string | Date | null
  createdBy?: `0x${string}` | null
  updatedBy?: `0x${string}` | null
}): Promise<WorkspaceTaskItem> {
  const db = await withDb()
  const result = await db.sql`
    INSERT INTO workspace_task_state (
      vault_address,
      title,
      description,
      source,
      severity,
      status,
      action_type,
      action_payload_json,
      related_alert_id,
      related_approval_id,
      room_ref,
      thread_ref,
      assignee_wallet,
      due_at,
      snoozed_until,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (
      ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')},
      ${params.title.trim()},
      ${params.description?.trim() || null},
      ${params.source?.trim() || 'workspace'},
      ${normalizeSeverity(params.severity)},
      ${params.status?.trim() || 'pending'},
      ${params.actionType?.trim() || null},
      ${asJsonRecord(params.actionPayload)},
      ${Number.isFinite(Number(params.relatedAlertId)) ? Number(params.relatedAlertId) : null},
      ${Number.isFinite(Number(params.relatedApprovalId)) ? Number(params.relatedApprovalId) : null},
      ${params.roomRef?.trim() || null},
      ${params.threadRef?.trim() || null},
      ${normalizeAddress(params.assigneeWallet)},
      ${toIso(params.dueAt)},
      ${toIso(params.snoozedUntil)},
      ${normalizeAddress(params.createdBy)},
      ${normalizeAddress(params.updatedBy ?? params.createdBy)},
      NOW(),
      NOW()
    )
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_task_insert_failed')
  return mapTaskItem(row)
}

export async function listTaskItems(params: {
  vaultAddress: `0x${string}`
  status?: string | null
  limit?: number
}): Promise<WorkspaceTaskItem[]> {
  const db = await withDb()
  const status = typeof params.status === 'string' && params.status.trim() ? params.status.trim() : null
  const result = await db.sql`
    SELECT *
    FROM workspace_task_state
    WHERE vault_address = ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')}
      AND (${status}::text IS NULL OR status = ${status})
    ORDER BY created_at DESC
    LIMIT ${normalizeLimit(params.limit, 300)};
  `
  return (result.rows ?? []).map(mapTaskItem)
}

export async function getTaskItemById(id: number): Promise<WorkspaceTaskItem | null> {
  const db = await withDb()
  const result = await db.sql`
    SELECT *
    FROM workspace_task_state
    WHERE id = ${id}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapTaskItem(row) : null
}

export async function updateTaskItem(params: {
  id: number
  status?: string
  assigneeWallet?: `0x${string}` | null
  snoozedUntil?: string | Date | null
  dueAt?: string | Date | null
  updatedBy?: `0x${string}` | null
  description?: string | null
}): Promise<WorkspaceTaskItem | null> {
  const db = await withDb()
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) throw new Error('invalid_task_id')
  const current = await getTaskItemById(id)
  if (!current) return null
  const status = params.status?.trim() || current.status
  const assigneeWallet = params.assigneeWallet === undefined ? current.assigneeWallet : normalizeAddress(params.assigneeWallet)
  const snoozedUntil = params.snoozedUntil === undefined ? current.snoozedUntil : toIso(params.snoozedUntil)
  const dueAt = params.dueAt === undefined ? current.dueAt : toIso(params.dueAt)
  const updatedBy = normalizeAddress(params.updatedBy) ?? current.updatedBy
  const description = params.description === undefined ? current.description : params.description?.trim() || null

  const result = await db.sql`
    UPDATE workspace_task_state
    SET
      status = ${status},
      assignee_wallet = ${assigneeWallet},
      snoozed_until = ${snoozedUntil},
      due_at = ${dueAt},
      updated_by = ${updatedBy},
      description = ${description},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `
  const row = result.rows?.[0]
  return row ? mapTaskItem(row) : null
}

export async function createActivityEvent(params: {
  vaultAddress: `0x${string}`
  eventType: string
  actorAddress?: `0x${string}` | null
  source?: string
  title: string
  description?: string | null
  severity?: WorkspaceSeverity
  payload?: Record<string, unknown>
  relatedTaskId?: number | null
  relatedApprovalId?: number | null
  relatedAlertId?: number | null
}): Promise<WorkspaceActivityEvent> {
  const db = await withDb()
  const result = await db.sql`
    INSERT INTO workspace_activity_events (
      vault_address,
      event_type,
      actor_address,
      source,
      title,
      description,
      severity,
      payload_json,
      related_task_id,
      related_approval_id,
      related_alert_id,
      created_at
    )
    VALUES (
      ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')},
      ${params.eventType.trim()},
      ${normalizeAddress(params.actorAddress)},
      ${params.source?.trim() || 'workspace'},
      ${params.title.trim()},
      ${params.description?.trim() || null},
      ${normalizeSeverity(params.severity)},
      ${asJsonRecord(params.payload)},
      ${Number.isFinite(Number(params.relatedTaskId)) ? Number(params.relatedTaskId) : null},
      ${Number.isFinite(Number(params.relatedApprovalId)) ? Number(params.relatedApprovalId) : null},
      ${Number.isFinite(Number(params.relatedAlertId)) ? Number(params.relatedAlertId) : null},
      NOW()
    )
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_activity_insert_failed')
  return mapActivityEvent(row)
}

export async function listActivityEvents(params: {
  vaultAddress: `0x${string}`
  limit?: number
}): Promise<WorkspaceActivityEvent[]> {
  const db = await withDb()
  const result = await db.sql`
    SELECT *
    FROM workspace_activity_events
    WHERE vault_address = ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')}
    ORDER BY created_at DESC
    LIMIT ${normalizeLimit(params.limit, 500)};
  `
  return (result.rows ?? []).map(mapActivityEvent)
}

export async function upsertNotificationPreference(params: {
  vaultAddress: `0x${string}`
  principalAddress: `0x${string}`
  telegramEnabled?: boolean
  xmtpEnabled?: boolean
  emailEnabled?: boolean
  minSeverity?: string
  channels?: Record<string, unknown>
}): Promise<WorkspaceNotificationPreference> {
  const db = await withDb()
  const existing = await listNotificationPreferences({
    vaultAddress: params.vaultAddress,
    principalAddress: params.principalAddress,
    limit: 1,
  })
  const current = existing[0]
  const telegramEnabled = typeof params.telegramEnabled === 'boolean'
    ? params.telegramEnabled
    : current?.telegramEnabled ?? true
  const xmtpEnabled = typeof params.xmtpEnabled === 'boolean'
    ? params.xmtpEnabled
    : current?.xmtpEnabled ?? true
  const emailEnabled = typeof params.emailEnabled === 'boolean'
    ? params.emailEnabled
    : current?.emailEnabled ?? false
  const minSeverity = params.minSeverity?.trim() || current?.minSeverity || 'warn'
  const channels = asJsonRecord(params.channels ?? current?.channels ?? {})

  const result = await db.sql`
    INSERT INTO workspace_notification_preferences (
      vault_address,
      principal_address,
      telegram_enabled,
      xmtp_enabled,
      email_enabled,
      min_severity,
      channels_json,
      created_at,
      updated_at
    )
    VALUES (
      ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')},
      ${normalizeRequiredAddress(params.principalAddress, 'principal_address')},
      ${telegramEnabled},
      ${xmtpEnabled},
      ${emailEnabled},
      ${minSeverity},
      ${channels},
      NOW(),
      NOW()
    )
    ON CONFLICT (vault_address, principal_address) DO UPDATE
    SET
      telegram_enabled = EXCLUDED.telegram_enabled,
      xmtp_enabled = EXCLUDED.xmtp_enabled,
      email_enabled = EXCLUDED.email_enabled,
      min_severity = EXCLUDED.min_severity,
      channels_json = EXCLUDED.channels_json,
      updated_at = NOW()
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_notification_upsert_failed')
  return mapNotificationPreference(row)
}

export async function listNotificationPreferences(params: {
  vaultAddress: `0x${string}`
  principalAddress?: `0x${string}`
  limit?: number
}): Promise<WorkspaceNotificationPreference[]> {
  const db = await withDb()
  const principal = params.principalAddress ? normalizeRequiredAddress(params.principalAddress, 'principal_address') : null
  const result = await db.sql`
    SELECT *
    FROM workspace_notification_preferences
    WHERE vault_address = ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')}
      AND (${principal}::text IS NULL OR principal_address = ${principal})
    ORDER BY updated_at DESC
    LIMIT ${normalizeLimit(params.limit, 200)};
  `
  return (result.rows ?? []).map(mapNotificationPreference)
}

export async function appendAuditLog(params: {
  vaultAddress: `0x${string}`
  actorAddress?: `0x${string}` | null
  actorRole?: string | null
  source: string
  action: string
  targetType?: string | null
  targetId?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  details?: Record<string, unknown>
}): Promise<WorkspaceAuditLog> {
  const db = await withDb()
  const result = await db.sql`
    INSERT INTO workspace_audit_logs (
      vault_address,
      actor_address,
      actor_role,
      source,
      action,
      target_type,
      target_id,
      before_json,
      after_json,
      details_json,
      created_at
    )
    VALUES (
      ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')},
      ${normalizeAddress(params.actorAddress)},
      ${params.actorRole?.trim() || null},
      ${params.source.trim()},
      ${params.action.trim()},
      ${params.targetType?.trim() || null},
      ${params.targetId?.trim() || null},
      ${params.before ? asJsonRecord(params.before) : null},
      ${params.after ? asJsonRecord(params.after) : null},
      ${asJsonRecord(params.details)},
      NOW()
    )
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('workspace_audit_insert_failed')
  return mapAuditLog(row)
}

export async function listAuditLogs(params: {
  vaultAddress: `0x${string}`
  limit?: number
}): Promise<WorkspaceAuditLog[]> {
  const db = await withDb()
  const result = await db.sql`
    SELECT *
    FROM workspace_audit_logs
    WHERE vault_address = ${normalizeRequiredAddress(params.vaultAddress, 'vault_address')}
    ORDER BY created_at DESC
    LIMIT ${normalizeLimit(params.limit, 500)};
  `
  return (result.rows ?? []).map(mapAuditLog)
}

export async function getWorkspaceCounts(vaultAddress: `0x${string}`): Promise<{
  openAlerts: number
  pendingTasks: number
  pendingApprovals: number
}> {
  const db = await withDb()
  const normalizedVault = normalizeRequiredAddress(vaultAddress, 'vault_address')
  const [alerts, tasks, approvals] = await Promise.all([
    db.sql`
      SELECT COUNT(*)::int AS count
      FROM workspace_alert_events
      WHERE vault_address = ${normalizedVault} AND status IN ('open', 'acknowledged');
    `,
    db.sql`
      SELECT COUNT(*)::int AS count
      FROM workspace_task_state
      WHERE vault_address = ${normalizedVault} AND status IN ('pending', 'in_progress', 'snoozed');
    `,
    db.sql`
      SELECT COUNT(*)::int AS count
      FROM workspace_approvals
      WHERE vault_address = ${normalizedVault} AND status = 'pending';
    `,
  ])
  return {
    openAlerts: Number(alerts.rows?.[0]?.count ?? 0),
    pendingTasks: Number(tasks.rows?.[0]?.count ?? 0),
    pendingApprovals: Number(approvals.rows?.[0]?.count ?? 0),
  }
}
