import { randomUUID } from 'node:crypto'

export type ConfirmationClass =
  | 'none'
  | 'policy_only'
  | 'human_required'
  | 'human_plus_policy'

export type ControlActorType =
  | 'telegram_user'
  | 'session_user'
  | 'machine'
  | 'runtime'
  | 'system'

export type ControlCapabilityScope = {
  chain_id?: number
  vault_address?: `0x${string}`
  market_id?: string
  queue?: string
  group_id?: string
  account_address?: `0x${string}`
  creator_coin_address?: `0x${string}`
  token_class?: string
  actor_binding?: {
    telegram_user_id?: string
    chat_id?: string
    canonical_wallet?: `0x${string}`
  }
}

export type ControlCapabilityLimits = {
  amount_ceiling?: {
    unit: 'eth' | 'usd' | 'shares' | 'wei' | string
    value: number
  }
  ttl_seconds?: number
  allowed_targets?: string[]
  metadata?: Record<string, unknown>
}

export type ControlCapability = {
  capability_id: string
  actor_type: ControlActorType
  actor_id: string
  subsystem: string
  action: string
  scope: ControlCapabilityScope
  limits: ControlCapabilityLimits
  confirmation_class: ConfirmationClass
  issued_at: string
  expires_at: string
  issued_by: string
  metadata: Record<string, unknown>
}

export type ActionProposal = {
  proposal_id: string
  capability_id: string
  subsystem: string
  action: string
  intent: Record<string, unknown>
  rationale: string
  bounds: Record<string, unknown>
  correlation_id: string
  created_at: string
  requested_confirmation_class: ConfirmationClass
  metadata: Record<string, unknown>
}

export type ProposalExecutionContext = {
  source: string
  actor_type: ControlActorType
  actor_id: string
  telegram_user_id?: string
  chat_id?: string
  message_id?: number | null
  canonical_wallet?: `0x${string}` | null
}

export type ConfirmationEvidence = {
  confirmation_class: ConfirmationClass
  approved: boolean
  approved_at?: string | null
  approval_actor_id?: string | null
  token_id?: string | null
  token_consumed_at?: string | null
}

export type PolicyDenyCode =
  | 'capability_missing'
  | 'capability_expired'
  | 'proposal_expired'
  | 'actor_mismatch'
  | 'subsystem_mismatch'
  | 'action_mismatch'
  | 'scope_mismatch'
  | 'amount_exceeded'
  | 'target_not_allowed'
  | 'confirmation_missing'
  | 'confirmation_rejected'
  | 'confirmation_actor_mismatch'
  | 'replay_detected'

export type PolicyCheckResult =
  | {
      allowed: true
      checked_at: string
      capability_id: string
      proposal_id: string
      confirmation_class: ConfirmationClass
    }
  | {
      allowed: false
      checked_at: string
      capability_id: string
      proposal_id: string
      confirmation_class: ConfirmationClass
      deny_code: PolicyDenyCode
      reason: string
      details?: Record<string, unknown>
    }

export type ControlAuditEventType =
  | 'proposal.created'
  | 'proposal.denied'
  | 'confirmation.accepted'
  | 'confirmation.rejected'
  | 'policy.denied'
  | 'execution.started'
  | 'execution.succeeded'
  | 'execution.failed'

export type ControlAuditEvent = {
  event_id: string
  event_type: ControlAuditEventType
  proposal_id: string
  capability_id: string
  actor_type: ControlActorType
  actor_id: string
  subsystem: string
  action: string
  status: 'allow' | 'deny' | 'success' | 'failed'
  correlation_id: string
  reason?: string | null
  error_code?: string | null
  error_message?: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function addSeconds(isoDate: string, seconds: number): string {
  const base = Date.parse(isoDate)
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return new Date(base + safeSeconds * 1_000).toISOString()
}

export function createCapabilityId(prefix = 'cap'): string {
  return `${prefix}_${randomUUID()}`
}

export function createProposalId(prefix = 'prop'): string {
  return `${prefix}_${randomUUID()}`
}

export function createEventId(prefix = 'evt'): string {
  return `${prefix}_${randomUUID()}`
}

export function toSafeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function toTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

export function normalizeAddressOrNull(value: unknown): `0x${string}` | null {
  const normalized = toSafeLower(value)
  return isAddressLike(normalized) ? (normalized as `0x${string}`) : null
}

export function normalizeConfirmationClass(input: unknown): ConfirmationClass {
  const value = toSafeLower(input)
  if (value === 'none') return 'none'
  if (value === 'policy_only') return 'policy_only'
  if (value === 'human_required') return 'human_required'
  if (value === 'human_plus_policy') return 'human_plus_policy'
  return 'policy_only'
}

export function hasExpired(isoDate: string, now = Date.now()): boolean {
  const value = Date.parse(isoDate)
  return Number.isFinite(value) ? value <= now : true
}

export function createControlCapability(input: {
  actor_type: ControlActorType
  actor_id: string
  subsystem: string
  action: string
  scope?: ControlCapabilityScope
  limits?: ControlCapabilityLimits
  confirmation_class: ConfirmationClass
  issued_by: string
  issued_at?: string
  expires_at?: string
  metadata?: Record<string, unknown>
}): ControlCapability {
  const issuedAt = input.issued_at ?? nowIso()
  const ttlSeconds = Number(input.limits?.ttl_seconds ?? 0)
  const expiresAt =
    input.expires_at ??
    (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? addSeconds(issuedAt, ttlSeconds) : addSeconds(issuedAt, 120))

  return {
    capability_id: createCapabilityId(),
    actor_type: input.actor_type,
    actor_id: toTrimmed(input.actor_id),
    subsystem: toTrimmed(input.subsystem),
    action: toTrimmed(input.action),
    scope: input.scope ?? {},
    limits: input.limits ?? {},
    confirmation_class: input.confirmation_class,
    issued_at: issuedAt,
    expires_at: expiresAt,
    issued_by: toTrimmed(input.issued_by),
    metadata: input.metadata ?? {},
  }
}

export function createActionProposal(input: {
  capability_id: string
  subsystem: string
  action: string
  intent: Record<string, unknown>
  rationale?: string
  bounds?: Record<string, unknown>
  correlation_id: string
  requested_confirmation_class: ConfirmationClass
  created_at?: string
  metadata?: Record<string, unknown>
}): ActionProposal {
  return {
    proposal_id: createProposalId(),
    capability_id: toTrimmed(input.capability_id),
    subsystem: toTrimmed(input.subsystem),
    action: toTrimmed(input.action),
    intent: input.intent ?? {},
    rationale: toTrimmed(input.rationale) || 'operator_requested',
    bounds: input.bounds ?? {},
    correlation_id: toTrimmed(input.correlation_id),
    created_at: input.created_at ?? nowIso(),
    requested_confirmation_class: input.requested_confirmation_class,
    metadata: input.metadata ?? {},
  }
}
