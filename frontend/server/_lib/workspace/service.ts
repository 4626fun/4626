import type { VercelRequest } from '@vercel/node'

import { getKeeprVaultByVaultAddress, type KeeprVaultRow } from '../keepr/keeprRegistry.js'
import { getKeeprVaultAutomationByVaultAddress } from '../keepr/keeprAutomation.js'
import { listCreatorXmtpAgents, type CreatorXmtpAgentRow } from '../messaging/creatorXmtpAgents.js'
import { getDb } from '../db/postgres.js'
import { ensureTelegramTradingSchema } from '../db/schemaBootstrap.js'
import {
  createActivityEvent,
  getWorkspaceCounts,
  insertMonitoringSnapshot,
  listActivityEvents,
  listAlertEvents,
  listApprovalRequests,
  listMonitoringSnapshots,
  listNotificationPreferences,
  listStrategyTargets,
  listTaskItems,
  type WorkspaceActivityEvent,
  type WorkspaceAlertEvent,
  type WorkspaceMonitoringSnapshot,
  type WorkspaceSeverity,
  type WorkspaceStrategyTarget,
  type WorkspaceTaskItem,
} from './repository.js'
import { deriveStrategyAprSignal, type StrategyAprSignal } from './aprSignals.js'

type CheckStatus = 'pass' | 'fail' | 'warn' | 'info'
type Check = {
  id: string
  label: string
  status: CheckStatus
  details?: string
  href?: string
}
type CheckSection = {
  id: string
  title: string
  description?: string
  checks: Check[]
}

export type WorkspaceSummaryResponse = {
  vaultAddress: `0x${string}`
  groupId: string
  ownerAddress: `0x${string}`
  creatorCoinAddress: `0x${string}`
  settlement: {
    graduatedAt: string | null
    settledAt: string | null
    settlementStage: string | null
  }
  metrics: {
    strategyCount: number
    activeStrategyCount: number
    configuredTargetCount: number
    openAlerts: number
    pendingTasks: number
    pendingApprovals: number
  }
  rooms: {
    telegram: {
      linked: boolean
      chatId: string | null
      roomChatId: string | null
      enabled: boolean
      memberCount: number
    }
    xmtp: {
      linked: boolean
      agentAddress: `0x${string}` | null
      agentType: 'eoa' | 'csw' | null
      conversationId: string | null
    }
  }
  latestAlerts: WorkspaceAlertEvent[]
  latestActivity: WorkspaceActivityEvent[]
  automation: {
    enabled: boolean
    scope: string | null
    canonicalCswAddress: `0x${string}` | null
    embeddedEoaAddress: `0x${string}` | null
  }
  generatedAt: string
}

export type WorkspaceStrategyRow = {
  strategyAddress: `0x${string}`
  kind: 'ajna' | 'charm' | 'solana' | 'unknown'
  status: 'active' | 'paused' | 'inactive' | 'unknown'
  isActive: boolean | null
  currentWeightRaw: string
  targetWeightBps: number | null
  /** Operator-intended on-chain cap mirror; uint256 as decimal string, or null. */
  maxAssetsCap: string | null
  owner: `0x${string}` | null
  asset: `0x${string}` | null
  liquidityHint: string | null
  performanceHint: string | null
  aprSignal: StrategyAprSignal
  lastRebalanceAt: string | null
  availableActions: string[]
}

export type WorkspaceMonitoringResponse = {
  sections: CheckSection[]
  summary: {
    pass: number
    fail: number
    warn: number
    info: number
  }
  alerts: WorkspaceAlertEvent[]
  incidents: WorkspaceActivityEvent[]
  trend: Array<{
    timestamp: string
    fail: number
    warn: number
    pass: number
  }>
  latestSnapshotId: number | null
  generatedAt: string
}

export type WorkspaceActivityItem = {
  id: string
  source: 'workspace' | 'keepr' | 'chat'
  eventType: string
  title: string
  description: string | null
  severity: WorkspaceSeverity
  actorAddress: `0x${string}` | null
  createdAt: string
  payload: Record<string, unknown>
}

export type WorkspaceRoomsResponse = {
  telegram: {
    linked: boolean
    chatId: string | null
    roomChatId: string | null
    enabled: boolean
    minSharesRaw: string | null
    graceHours: number | null
    memberCount: number
    recentSummaries: WorkspaceActivityEvent[]
  }
  xmtp: {
    linked: boolean
    agentAddress: `0x${string}` | null
    agentType: 'eoa' | 'csw' | null
    conversationId: string | null
    recentMessages: WorkspaceActivityEvent[]
  }
  generatedAt: string
}

export type WorkspaceTasksResponse = {
  tasks: WorkspaceTaskItem[]
  approvals: ReturnType<typeof listApprovalRequests> extends Promise<infer T> ? T : never
  generatedAt: string
}

export type WorkspaceSettingsResponse = {
  notificationPreferences: ReturnType<typeof listNotificationPreferences> extends Promise<infer T> ? T : never
  strategyTargets: WorkspaceStrategyTarget[]
  thresholds: Record<string, unknown>
  automation: {
    enabled: boolean
    scope: string | null
  }
  generatedAt: string
}

type AnyObject = Record<string, unknown>
type WorkspaceVaultMetadata = KeeprVaultRow & {
  graduatedAt?: string | Date | null
  settledAt?: string | Date | null
  settlementStage?: string | null
}
type TelegramRoomState = {
  linked: boolean
  chatId: string | null
  roomChatId: string | null
  enabled: boolean
  minSharesRaw: string | null
  graceHours: number | null
  memberCount: number
}

const EMPTY_TELEGRAM_ROOM_STATE: TelegramRoomState = {
  linked: false,
  chatId: null,
  roomChatId: null,
  enabled: false,
  minSharesRaw: null,
  graceHours: null,
  memberCount: 0,
}

function asObject(value: unknown): AnyObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as AnyObject
}

function normalizeXmtpAgentType(value: unknown): 'eoa' | 'csw' | null {
  return value === 'eoa' || value === 'csw' ? value : null
}

function toIsoDate(value: unknown): string {
  const date = value instanceof Date || typeof value === 'number' || typeof value === 'string'
    ? new Date(value)
    : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function toIsoDateOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date || typeof value === 'number' || typeof value === 'string'
    ? new Date(value)
    : null
  if (!date || Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function isStrategyActive(value: unknown): boolean {
  const row = asObject(value)
  return row.isActive === true
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddressLike(normalized) ? (normalized as `0x${string}`) : null
}

function normalizeVaultAddress(vaultAddress: string): `0x${string}` {
  const normalized = normalizeAddress(vaultAddress)
  if (!normalized) throw new Error('invalid_vault_address')
  return normalized
}

function normalizeLimit(value: number | undefined, max = 200): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return Math.min(100, max)
  const rounded = Math.floor(parsed)
  if (rounded < 1) return 1
  if (rounded > max) return max
  return rounded
}

function resolveRequestOrigin(req: VercelRequest): string {
  const host =
    (Array.isArray(req.headers['x-forwarded-host'])
      ? req.headers['x-forwarded-host'][0]
      : req.headers['x-forwarded-host']) ||
    req.headers.host
  const protocol =
    (Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : req.headers['x-forwarded-proto']) || 'https'
  if (!host || typeof host !== 'string') {
    throw new Error('request_origin_unavailable')
  }
  return `${protocol}://${host}`
}

async function fetchSelfJson<T>(params: {
  req: VercelRequest
  path: string
}): Promise<T | null> {
  const origin = resolveRequestOrigin(params.req)
  const response = await fetch(`${origin}${params.path}`, {
    method: 'GET',
    headers: {
      cookie: typeof params.req.headers.cookie === 'string' ? params.req.headers.cookie : '',
      authorization: typeof params.req.headers.authorization === 'string' ? params.req.headers.authorization : '',
    },
  })
  if (!response.ok) return null
  const json = (await response.json().catch(() => null)) as AnyObject | null
  if (!json || json.success !== true || !json.data) return null
  return json.data as T
}

function summarizeChecks(sections: CheckSection[]): {
  pass: number
  fail: number
  warn: number
  info: number
} {
  let pass = 0
  let fail = 0
  let warn = 0
  let info = 0
  for (const section of sections) {
    for (const check of section.checks ?? []) {
      if (check.status === 'pass') pass += 1
      else if (check.status === 'fail') fail += 1
      else if (check.status === 'warn') warn += 1
      else info += 1
    }
  }
  return { pass, fail, warn, info }
}

function parseMonitoringSnapshotTrend(snapshots: WorkspaceMonitoringSnapshot[]) {
  return snapshots
    .map((snapshot) => {
      const sections = Array.isArray(snapshot.payload?.sections) ? (snapshot.payload.sections as CheckSection[]) : []
      const summary = summarizeChecks(sections)
      return {
        timestamp: snapshot.createdAt,
        fail: summary.fail,
        warn: summary.warn,
        pass: summary.pass,
      }
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

function normalizeStrategyStatus(params: {
  isActive: boolean | null
  kind: string
  raw: AnyObject
}): WorkspaceStrategyRow['status'] {
  if (params.isActive === false) return 'inactive'
  if (params.kind === 'ajna') {
    const paused = (params.raw.ajna as AnyObject | undefined)?.paused
    if (paused === true) return 'paused'
  }
  if (params.isActive === true) return 'active'
  return 'unknown'
}

async function readTelegramRoomState(vaultAddress: `0x${string}`): Promise<TelegramRoomState> {
  const db = await getDb()
  if (!db) {
    return { ...EMPTY_TELEGRAM_ROOM_STATE }
  }
  await ensureTelegramTradingSchema(db)
  const policyResult = await db.sql`
    SELECT chat_id, room_chat_id, enabled, min_shares_raw, grace_hours
    FROM telegram_holder_room_policies
    WHERE vault_address = ${vaultAddress}
    ORDER BY updated_at DESC
    LIMIT 1;
  `
  const policy = policyResult.rows?.[0] ?? null
  if (!policy) {
    return { ...EMPTY_TELEGRAM_ROOM_STATE }
  }
  const roomChatId = typeof policy.room_chat_id === 'string' ? policy.room_chat_id : null
  let memberCount = 0
  if (roomChatId) {
    const membersResult = await db.sql`
      SELECT COUNT(*)::int AS count
      FROM telegram_holder_room_members
      WHERE room_chat_id = ${roomChatId}
        AND status IN ('active', 'grace');
    `
    memberCount = Number(membersResult.rows?.[0]?.count ?? 0)
  }
  return {
    linked: true,
    chatId: typeof policy.chat_id === 'string' ? policy.chat_id : null,
    roomChatId,
    enabled: policy.enabled === true,
    minSharesRaw: typeof policy.min_shares_raw === 'string' ? policy.min_shares_raw : null,
    graceHours: Number.isFinite(Number(policy.grace_hours)) ? Number(policy.grace_hours) : null,
    memberCount,
  }
}

async function readSystemActivity(vaultAddress: `0x${string}`, groupId: string): Promise<WorkspaceActivityItem[]> {
  const db = await getDb()
  if (!db) return []

  const [keeprLogs, chatEvents] = await Promise.all([
    db.sql`
      SELECT id, event_type, details, actor_wallet, created_at
      FROM keepr_logs
      WHERE vault_address = ${vaultAddress}
      ORDER BY created_at DESC
      LIMIT 25;
    `,
    db.sql`
      SELECT id, event, payload, created_at
      FROM chat_command_center_events
      WHERE conversation_id = ${groupId}
      ORDER BY created_at DESC
      LIMIT 25;
    `,
  ])

  const keeprItems: WorkspaceActivityItem[] = (keeprLogs.rows ?? []).map((row) => {
    const data = asObject(row)
    return {
      id: `keepr-${String(data.id ?? '')}`,
      source: 'keepr',
      eventType: String(data.event_type ?? 'keepr.event'),
      title: `Keepr: ${String(data.event_type ?? 'event')}`,
      description: null,
      severity: 'info',
      actorAddress: normalizeAddress(data.actor_wallet),
      createdAt: toIsoDate(data.created_at),
      payload: asObject(data.details),
    }
  })

  const chatItems: WorkspaceActivityItem[] = (chatEvents.rows ?? []).map((row) => {
    const data = asObject(row)
    return {
      id: `chat-${String(data.id ?? '')}`,
      source: 'chat',
      eventType: String(data.event ?? 'chat.event'),
      title: `Chat: ${String(data.event ?? 'event')}`,
      description: null,
      severity: 'info',
      actorAddress: null,
      createdAt: toIsoDate(data.created_at),
      payload: asObject(data.payload),
    }
  })

  return [...keeprItems, ...chatItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function resolveWorkspaceSummary(params: {
  req: VercelRequest
  vaultAddress: `0x${string}`
}): Promise<WorkspaceSummaryResponse> {
  const vaultAddress = normalizeVaultAddress(params.vaultAddress)
  const vault = await getKeeprVaultByVaultAddress(vaultAddress)
  if (!vault) throw new Error('workspace_vault_not_registered')

  const [counts, strategyData, latestAlerts, latestActivity, telegramRoom, xmtpAgents, automation] = await Promise.all([
    getWorkspaceCounts(vaultAddress),
    fetchSelfJson<{ strategies?: AnyObject[] }>({
      req: params.req,
      path: `/api/v1/vault/strategies?vault=${vaultAddress}`,
    }),
    listAlertEvents({ vaultAddress, status: 'open', limit: 5 }),
    listActivityEvents({ vaultAddress, limit: 5 }),
    readTelegramRoomState(vaultAddress),
    listCreatorXmtpAgents({
      creatorAddress: vault.canonicalOwnerAddress,
      listedOnly: false,
      limit: 1,
    }).catch(() => ({ rows: [], nextCursor: null })),
    getKeeprVaultAutomationByVaultAddress(vaultAddress),
  ])

  const strategyRows = Array.isArray(strategyData?.strategies) ? strategyData?.strategies ?? [] : []
  const activeStrategyCount = strategyRows.filter(isStrategyActive).length
  const targets = await listStrategyTargets(vaultAddress)
  const topAgent: CreatorXmtpAgentRow | null = xmtpAgents.rows?.[0] ?? null
  const vaultMetadata = vault as WorkspaceVaultMetadata

  return {
    vaultAddress,
    groupId: vault.groupId,
    ownerAddress: vault.canonicalOwnerAddress,
    creatorCoinAddress: vault.creatorCoinAddress,
    settlement: {
      graduatedAt: toIsoDateOrNull(vaultMetadata.graduatedAt),
      settledAt: toIsoDateOrNull(vaultMetadata.settledAt),
      settlementStage: typeof vaultMetadata.settlementStage === 'string' ? vaultMetadata.settlementStage : null,
    },
    metrics: {
      strategyCount: strategyRows.length,
      activeStrategyCount,
      configuredTargetCount: targets.length,
      openAlerts: counts.openAlerts,
      pendingTasks: counts.pendingTasks,
      pendingApprovals: counts.pendingApprovals,
    },
    rooms: {
      telegram: {
        linked: telegramRoom.linked,
        chatId: telegramRoom.chatId,
        roomChatId: telegramRoom.roomChatId,
        enabled: telegramRoom.enabled,
        memberCount: telegramRoom.memberCount,
      },
      xmtp: {
        linked: Boolean(topAgent),
        agentAddress: topAgent?.xmtpAgentAddress ?? null,
        agentType: normalizeXmtpAgentType(topAgent?.agentType),
        conversationId: vault.groupId ?? null,
      },
    },
    latestAlerts,
    latestActivity,
    automation: {
      enabled: automation?.automationEnabled === true,
      scope: automation?.automationScope ?? null,
      canonicalCswAddress: automation?.canonicalCswAddress ?? null,
      embeddedEoaAddress: automation?.embeddedEoaAddress ?? null,
    },
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveWorkspaceStrategies(params: {
  req: VercelRequest
  vaultAddress: `0x${string}`
}): Promise<{ strategies: WorkspaceStrategyRow[]; generatedAt: string }> {
  const vaultAddress = normalizeVaultAddress(params.vaultAddress)
  const strategyData = await fetchSelfJson<{ strategies?: AnyObject[] }>({
    req: params.req,
    path: `/api/v1/vault/strategies?vault=${vaultAddress}`,
  })
  const targets = await listStrategyTargets(vaultAddress)
  const targetByStrategy = new Map<string, WorkspaceStrategyTarget>(
    targets.map((target) => [target.strategyAddress.toLowerCase(), target]),
  )
  const [activities, monitoringSnapshots] = await Promise.all([
    listActivityEvents({ vaultAddress, limit: 200 }),
    listMonitoringSnapshots({ vaultAddress, limit: 24 }),
  ])

  const strategies = (Array.isArray(strategyData?.strategies) ? strategyData?.strategies : [])
    .map((raw) => {
      const strategyAddress = normalizeAddress(raw.address)
      if (!strategyAddress) return null
      const kind = (typeof raw.kind === 'string' ? raw.kind : 'unknown') as WorkspaceStrategyRow['kind']
      const target = targetByStrategy.get(strategyAddress.toLowerCase()) ?? null
      const recentRebalance = activities.find((item) => {
        if (item.eventType !== 'strategy.rebalance') return false
        const payloadStrategy = normalizeAddress((item.payload as AnyObject)?.strategyAddress)
        return payloadStrategy === strategyAddress
      })

      return {
        strategyAddress,
        kind,
        aprSignal: deriveStrategyAprSignal({
          kind,
          isActive: typeof raw.isActive === 'boolean' ? raw.isActive : null,
          strategyAddress,
          nowIso: new Date().toISOString(),
          activityEvents: activities,
          monitoringSnapshots,
        }),
        status: normalizeStrategyStatus({
          isActive: typeof raw.isActive === 'boolean' ? raw.isActive : null,
          kind,
          raw,
        }),
        isActive: typeof raw.isActive === 'boolean' ? raw.isActive : null,
        currentWeightRaw: String(raw.weight ?? '0'),
        targetWeightBps: target?.targetWeightBps ?? null,
        maxAssetsCap: target?.maxAssetsCap ?? null,
        owner: normalizeAddress(raw.owner),
        asset: normalizeAddress(raw.asset),
        liquidityHint: kind === 'solana' ? 'Bridge/Solana route' : kind === 'charm' ? 'Uniswap V3 LP' : kind === 'ajna' ? 'Ajna lending' : null,
        performanceHint: kind === 'charm' ? 'Track rebalance cadence and fee APR' : kind === 'ajna' ? 'Track bucket health and collateral trends' : null,
        lastRebalanceAt: recentRebalance?.createdAt ?? null,
        availableActions: [
          'rebalance',
          ...(kind === 'ajna' ? ['update-min-bucket', 'pause', 'resume'] : []),
          ...(kind === 'charm' ? ['pause', 'resume', 'emergency-unwind'] : []),
          ...(kind === 'solana' ? ['status-check'] : []),
        ],
      } satisfies WorkspaceStrategyRow
    })
    .filter((row): row is WorkspaceStrategyRow => Boolean(row))

  return {
    strategies,
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveWorkspaceMonitoring(params: {
  req: VercelRequest
  vaultAddress: `0x${string}`
}): Promise<WorkspaceMonitoringResponse> {
  const vaultAddress = normalizeVaultAddress(params.vaultAddress)
  const report = await fetchSelfJson<{
    sections?: CheckSection[]
    context?: AnyObject
  }>({
    req: params.req,
    path: `/api/status/vaultReport?vault=${vaultAddress}`,
  })
  const sections = Array.isArray(report?.sections) ? report.sections : []
  const summary = summarizeChecks(sections)

  const insertedSnapshot = await insertMonitoringSnapshot({
    vaultAddress,
    snapshotKind: 'vault_report',
    source: 'status.vault_report',
    payload: {
      sections,
      context: report?.context ?? {},
      summary,
    },
  }).catch(() => null)

  const [alerts, incidents, snapshots] = await Promise.all([
    listAlertEvents({ vaultAddress, status: 'open', limit: 20 }),
    listActivityEvents({ vaultAddress, limit: 50 }).then((events) =>
      events.filter((event) => event.severity === 'warn' || event.severity === 'critical').slice(0, 20),
    ),
    listMonitoringSnapshots({ vaultAddress, limit: 24 }),
  ])

  return {
    sections,
    summary,
    alerts,
    incidents,
    trend: parseMonitoringSnapshotTrend(snapshots),
    latestSnapshotId: insertedSnapshot?.id ?? snapshots[0]?.id ?? null,
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveWorkspaceActivity(params: {
  vaultAddress: `0x${string}`
  includeSystem: boolean
  limit?: number
}): Promise<{ activity: WorkspaceActivityItem[]; generatedAt: string }> {
  const vaultAddress = normalizeVaultAddress(params.vaultAddress)
  const vault = await getKeeprVaultByVaultAddress(vaultAddress)
  if (!vault) throw new Error('workspace_vault_not_registered')

  const workspaceEvents = await listActivityEvents({
    vaultAddress,
    limit: normalizeLimit(params.limit, 300),
  })
  const workspaceItems: WorkspaceActivityItem[] = workspaceEvents.map((event) => ({
    id: `workspace-${event.id}`,
    source: 'workspace',
    eventType: event.eventType,
    title: event.title,
    description: event.description,
    severity: event.severity,
    actorAddress: event.actorAddress,
    createdAt: event.createdAt,
    payload: event.payload,
  }))

  const systemItems = params.includeSystem
    ? await readSystemActivity(vaultAddress, vault.groupId)
    : []

  return {
    activity: [...workspaceItems, ...systemItems]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, normalizeLimit(params.limit, 500)),
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveWorkspaceRooms(params: {
  vaultAddress: `0x${string}`
}): Promise<WorkspaceRoomsResponse> {
  const vaultAddress = normalizeVaultAddress(params.vaultAddress)
  const vault = await getKeeprVaultByVaultAddress(vaultAddress)
  if (!vault) throw new Error('workspace_vault_not_registered')

  const [telegramRoom, recentActivity, xmtpAgents] = await Promise.all([
    readTelegramRoomState(vaultAddress),
    listActivityEvents({ vaultAddress, limit: 100 }),
    listCreatorXmtpAgents({
      creatorAddress: vault.canonicalOwnerAddress,
      listedOnly: false,
      limit: 1,
    }).catch(() => ({ rows: [], nextCursor: null })),
  ])

  const topAgent: CreatorXmtpAgentRow | null = xmtpAgents.rows?.[0] ?? null
  return {
    telegram: {
      linked: telegramRoom.linked,
      chatId: telegramRoom.chatId,
      roomChatId: telegramRoom.roomChatId,
      enabled: telegramRoom.enabled,
      minSharesRaw: telegramRoom.minSharesRaw,
      graceHours: telegramRoom.graceHours,
      memberCount: telegramRoom.memberCount,
      recentSummaries: recentActivity
        .filter((event) => event.source.startsWith('telegram'))
        .slice(0, 10),
    },
    xmtp: {
      linked: Boolean(topAgent),
      agentAddress: topAgent?.xmtpAgentAddress ?? null,
      agentType: normalizeXmtpAgentType(topAgent?.agentType),
      conversationId: vault.groupId,
      recentMessages: recentActivity.filter((event) => event.source.startsWith('xmtp')).slice(0, 10),
    },
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveWorkspaceTasks(params: {
  vaultAddress: `0x${string}`
  taskStatus?: string | null
  approvalStatus?: string | null
}): Promise<WorkspaceTasksResponse> {
  const vaultAddress = normalizeVaultAddress(params.vaultAddress)
  const [tasks, approvals] = await Promise.all([
    listTaskItems({ vaultAddress, status: params.taskStatus ?? null, limit: 200 }),
    listApprovalRequests({ vaultAddress, status: params.approvalStatus ?? null, limit: 200 }),
  ])
  return {
    tasks,
    approvals,
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveWorkspaceSettings(params: {
  vaultAddress: `0x${string}`
  principalAddress?: `0x${string}`
}): Promise<WorkspaceSettingsResponse> {
  const vaultAddress = normalizeVaultAddress(params.vaultAddress)
  const [preferences, strategyTargets, snapshots, automation] = await Promise.all([
    listNotificationPreferences({
      vaultAddress,
      principalAddress: params.principalAddress,
      limit: 20,
    }),
    listStrategyTargets(vaultAddress),
    listMonitoringSnapshots({ vaultAddress, limit: 1 }),
    getKeeprVaultAutomationByVaultAddress(vaultAddress),
  ])

  const latestSnapshot = snapshots[0]
  const thresholds = asObject(asObject(latestSnapshot?.payload).context)

  return {
    notificationPreferences: preferences,
    strategyTargets,
    thresholds,
    automation: {
      enabled: automation?.automationEnabled === true,
      scope: automation?.automationScope ?? null,
    },
    generatedAt: new Date().toISOString(),
  }
}

export async function appendWorkspaceActionActivity(params: {
  vaultAddress: `0x${string}`
  eventType: string
  title: string
  description?: string | null
  actorAddress?: `0x${string}` | null
  source?: string
  severity?: WorkspaceSeverity
  payload?: Record<string, unknown>
  relatedTaskId?: number | null
  relatedApprovalId?: number | null
  relatedAlertId?: number | null
}) {
  return createActivityEvent({
    vaultAddress: params.vaultAddress,
    eventType: params.eventType,
    actorAddress: params.actorAddress,
    source: params.source ?? 'workspace.action',
    title: params.title,
    description: params.description ?? null,
    severity: params.severity ?? 'info',
    payload: params.payload ?? {},
    relatedTaskId: params.relatedTaskId ?? null,
    relatedApprovalId: params.relatedApprovalId ?? null,
    relatedAlertId: params.relatedAlertId ?? null,
  })
}
