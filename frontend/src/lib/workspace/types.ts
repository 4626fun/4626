export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER'

export type WorkspaceSeverity = 'info' | 'warn' | 'critical'

export type WorkspaceSummary = {
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
  actorRole: WorkspaceRole
}

export type WorkspaceStrategyRow = {
  strategyAddress: `0x${string}`
  kind: 'ajna' | 'charm' | 'solana' | 'unknown'
  status: 'active' | 'paused' | 'inactive' | 'unknown'
  isActive: boolean | null
  currentWeightRaw: string
  targetWeightBps: number | null
  /**
   * Operator-intended on-chain cap (`strategyMaxAssets[strategy]`) as a
   * decimal uint256 string. `null` = no cap configured in Supabase yet.
   * The on-chain value is authoritative — this is the operator-side mirror
   * surfaced by the admin UI for drift detection.
   */
  maxAssetsCap: string | null
  owner: `0x${string}` | null
  asset: `0x${string}` | null
  liquidityHint: string | null
  performanceHint: string | null
  aprSignal: {
    expectedAprBps: number | null
    confidence: 'unknown' | 'low' | 'medium' | 'high'
    source: 'keeper_report' | 'p0_placeholder' | 'none'
  }
  lastRebalanceAt: string | null
  availableActions: string[]
}

export type WorkspaceStrategiesResponse = {
  strategies: WorkspaceStrategyRow[]
  generatedAt: string
  actorRole: WorkspaceRole
}

export type WorkspaceCheckStatus = 'pass' | 'fail' | 'warn' | 'info'

export type WorkspaceCheck = {
  id: string
  label: string
  status: WorkspaceCheckStatus
  details?: string
  href?: string
}

export type WorkspaceCheckSection = {
  id: string
  title: string
  description?: string
  checks: WorkspaceCheck[]
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

export type WorkspaceMonitoringResponse = {
  sections: WorkspaceCheckSection[]
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
  actorRole: WorkspaceRole
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

export type WorkspaceActivityResponse = {
  activity: WorkspaceActivityItem[]
  generatedAt: string
  actorRole: WorkspaceRole
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
  actorRole: WorkspaceRole
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

export type WorkspaceTasksResponse = {
  tasks: WorkspaceTaskItem[]
  approvals: WorkspaceApprovalRequest[]
  generatedAt: string
  actorRole: WorkspaceRole
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

export type WorkspaceSettingsResponse = {
  notificationPreferences: WorkspaceNotificationPreference[]
  strategyTargets: Array<{
    vaultAddress: `0x${string}`
    strategyAddress: `0x${string}`
    targetWeightBps: number
    status: string
    updatedBy: `0x${string}` | null
    updatedSource: string | null
    notes: string | null
    /** Mirror of on-chain `strategyMaxAssets[strategy]`. uint256 as string; null = unset. */
    maxAssetsCap: string | null
    createdAt: string
    updatedAt: string
  }>
  thresholds: Record<string, unknown>
  automation: {
    enabled: boolean
    scope: string | null
  }
  generatedAt: string
  actorRole: WorkspaceRole
}

export type WorkspaceActionResult = {
  action: string
  [key: string]: unknown
}

export type WorkspaceTabId =
  | 'overview'
  | 'strategies'
  | 'monitoring'
  | 'activity'
  | 'rooms'
  | 'tasks'
  | 'settings'
