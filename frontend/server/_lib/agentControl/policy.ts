import {
  type ActionProposal,
  type ConfirmationClass,
  type ConfirmationEvidence,
  type ControlCapability,
  type PolicyCheckResult,
  type PolicyDenyCode,
  hasExpired,
  nowIso,
  normalizeAddressOrNull,
  toSafeLower,
  toTrimmed,
} from './types.js'
import { normalizeReplayKeys, type ReplayGuard } from './replay.js'

type PolicyAllowlist = {
  subsystems?: string[]
  actions?: string[]
  targets?: string[]
}

type PolicyContext = {
  actor_type: string
  actor_id: string
  subsystem: string
  action: string
  telegram_user_id?: string
  chat_id?: string
  canonical_wallet?: string
  token_class?: string
  chain_id?: number
  vault_address?: string
  market_id?: string
  queue?: string
  group_id?: string
  account_address?: string
  creator_coin_address?: string
  target?: string
  amount?: {
    unit: string
    value: number
  }
  confirmation: ConfirmationEvidence
  replay_key?: string | null
  now_ms?: number
}

export type EvaluatePolicyInput = {
  capability: ControlCapability | null | undefined
  proposal: ActionProposal | null | undefined
  context: PolicyContext
  allowlist?: PolicyAllowlist
  replayGuard?: ReplayGuard
}

export class ControlPolicyError extends Error {
  deny_code: PolicyDenyCode
  details?: Record<string, unknown>

  constructor(denyCode: PolicyDenyCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ControlPolicyError'
    this.deny_code = denyCode
    this.details = details
  }
}

function deny(params: {
  code: PolicyDenyCode
  reason: string
  capability_id: string
  proposal_id: string
  confirmation_class: ConfirmationClass
  details?: Record<string, unknown>
}): PolicyCheckResult {
  return {
    allowed: false,
    checked_at: nowIso(),
    capability_id: params.capability_id,
    proposal_id: params.proposal_id,
    confirmation_class: params.confirmation_class,
    deny_code: params.code,
    reason: params.reason,
    details: params.details,
  }
}

function allow(params: {
  capability_id: string
  proposal_id: string
  confirmation_class: ConfirmationClass
}): PolicyCheckResult {
  return {
    allowed: true,
    checked_at: nowIso(),
    capability_id: params.capability_id,
    proposal_id: params.proposal_id,
    confirmation_class: params.confirmation_class,
  }
}

function includesIgnoreCase(values: string[] | undefined, input: string): boolean {
  if (!Array.isArray(values) || values.length === 0) return true
  const needle = toSafeLower(input)
  return values.some((value) => toSafeLower(value) === needle)
}

function normalizeStrictness(value: ConfirmationClass): number {
  if (value === 'none') return 0
  if (value === 'policy_only') return 1
  if (value === 'human_required') return 2
  return 3
}

function resolveConfirmationClass(
  capabilityClass: ConfirmationClass,
  proposalClass: ConfirmationClass,
): ConfirmationClass {
  return normalizeStrictness(proposalClass) > normalizeStrictness(capabilityClass)
    ? proposalClass
    : capabilityClass
}

function checkScopeMismatch(
  capability: ControlCapability,
  context: PolicyContext,
): { key: string; expected: unknown; actual: unknown } | null {
  const scope = capability.scope ?? {}
  const checks: Array<[string, unknown, unknown]> = [
    ['chain_id', scope.chain_id, context.chain_id],
    ['vault_address', scope.vault_address, context.vault_address],
    ['market_id', scope.market_id, context.market_id],
    ['queue', scope.queue, context.queue],
    ['group_id', scope.group_id, context.group_id],
    ['account_address', scope.account_address, context.account_address],
    ['creator_coin_address', scope.creator_coin_address, context.creator_coin_address],
    ['token_class', scope.token_class, (context as any).token_class],
  ]
  for (const [key, expectedRaw, actualRaw] of checks) {
    if (typeof expectedRaw === 'undefined' || expectedRaw === null || expectedRaw === '') continue
    const expected = String(expectedRaw).trim().toLowerCase()
    const actual = String(actualRaw ?? '').trim().toLowerCase()
    if (!actual || expected !== actual) {
      return { key, expected: expectedRaw, actual: actualRaw }
    }
  }

  const binding = scope.actor_binding
  if (binding) {
    if (binding.telegram_user_id && toTrimmed(binding.telegram_user_id) !== toTrimmed((context as any).telegram_user_id)) {
      return {
        key: 'actor_binding.telegram_user_id',
        expected: binding.telegram_user_id,
        actual: (context as any).telegram_user_id,
      }
    }
    if (binding.chat_id && toTrimmed(binding.chat_id) !== toTrimmed((context as any).chat_id)) {
      return {
        key: 'actor_binding.chat_id',
        expected: binding.chat_id,
        actual: (context as any).chat_id,
      }
    }
    if (binding.canonical_wallet) {
      const expectedWallet = normalizeAddressOrNull(binding.canonical_wallet)
      const actualWallet = normalizeAddressOrNull((context as any).canonical_wallet)
      if (!expectedWallet || !actualWallet || expectedWallet !== actualWallet) {
        return {
          key: 'actor_binding.canonical_wallet',
          expected: binding.canonical_wallet,
          actual: (context as any).canonical_wallet,
        }
      }
    }
  }
  return null
}

function checkConfirmation(
  requiredClass: ConfirmationClass,
  confirmation: ConfirmationEvidence,
  actorId: string,
): { code: PolicyDenyCode; reason: string; details?: Record<string, unknown> } | null {
  if (requiredClass === 'none') return null

  if (requiredClass === 'policy_only') {
    if (confirmation.approved === false) {
      return { code: 'confirmation_rejected', reason: 'confirmation explicitly rejected' }
    }
    return null
  }

  if (!confirmation.approved) {
    return {
      code: 'confirmation_missing',
      reason: 'explicit human confirmation is required',
    }
  }

  if (
    confirmation.approval_actor_id &&
    toTrimmed(confirmation.approval_actor_id) !== toTrimmed(actorId)
  ) {
    return {
      code: 'confirmation_actor_mismatch',
      reason: 'confirmation actor does not match request actor',
      details: {
        approved_by: confirmation.approval_actor_id,
        actor_id: actorId,
      },
    }
  }

  if (requiredClass === 'human_plus_policy' && !toTrimmed(confirmation.token_consumed_at)) {
    const hasReplaySignal =
      Boolean(toTrimmed(confirmation.token_id)) || Boolean(toTrimmed(confirmation.approved_at))
    if (!hasReplaySignal) {
      return {
        code: 'confirmation_missing',
        reason: 'human_plus_policy requires token or approval replay signal',
      }
    }
  }

  return null
}

export function evaluatePolicy(input: EvaluatePolicyInput): PolicyCheckResult {
  const capability = input.capability
  const proposal = input.proposal
  const context = input.context

  const missingCapabilityResult = deny({
    code: 'capability_missing',
    reason: 'capability is missing',
    capability_id: 'missing',
    proposal_id: proposal?.proposal_id ?? 'missing',
    confirmation_class: proposal?.requested_confirmation_class ?? 'policy_only',
  })
  if (!capability) return missingCapabilityResult

  const missingProposalResult = deny({
    code: 'capability_missing',
    reason: 'proposal is missing',
    capability_id: capability.capability_id,
    proposal_id: 'missing',
    confirmation_class: capability.confirmation_class,
  })
  if (!proposal) return missingProposalResult

  const confirmationClass = resolveConfirmationClass(
    capability.confirmation_class,
    proposal.requested_confirmation_class,
  )

  if (capability.capability_id !== proposal.capability_id) {
    return deny({
      code: 'scope_mismatch',
      reason: 'proposal capability binding mismatch',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: {
        proposal_capability_id: proposal.capability_id,
      },
    })
  }

  if (hasExpired(capability.expires_at, input.context.now_ms)) {
    return deny({
      code: 'capability_expired',
      reason: 'capability has expired',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
    })
  }

  const proposalTtlSeconds = Number(capability.limits?.ttl_seconds ?? 0)
  if (proposalTtlSeconds > 0 && hasExpired(new Date(Date.parse(proposal.created_at) + proposalTtlSeconds * 1_000).toISOString(), context.now_ms)) {
    return deny({
      code: 'proposal_expired',
      reason: 'proposal ttl has expired',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
    })
  }

  if (toSafeLower(capability.actor_type) !== toSafeLower(context.actor_type) || toTrimmed(capability.actor_id) !== toTrimmed(context.actor_id)) {
    return deny({
      code: 'actor_mismatch',
      reason: 'capability actor binding mismatch',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: {
        capability_actor_type: capability.actor_type,
        capability_actor_id: capability.actor_id,
        context_actor_type: context.actor_type,
        context_actor_id: context.actor_id,
      },
    })
  }

  if (
    toSafeLower(capability.subsystem) !== toSafeLower(context.subsystem) ||
    toSafeLower(proposal.subsystem) !== toSafeLower(context.subsystem)
  ) {
    return deny({
      code: 'subsystem_mismatch',
      reason: 'subsystem is out of scope',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: {
        capability_subsystem: capability.subsystem,
        proposal_subsystem: proposal.subsystem,
        context_subsystem: context.subsystem,
      },
    })
  }

  if (
    toSafeLower(capability.action) !== toSafeLower(context.action) ||
    toSafeLower(proposal.action) !== toSafeLower(context.action)
  ) {
    return deny({
      code: 'action_mismatch',
      reason: 'action is out of scope',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: {
        capability_action: capability.action,
        proposal_action: proposal.action,
        context_action: context.action,
      },
    })
  }

  if (!includesIgnoreCase(input.allowlist?.subsystems, context.subsystem)) {
    return deny({
      code: 'target_not_allowed',
      reason: 'subsystem is not allowlisted',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: { subsystem: context.subsystem },
    })
  }

  if (!includesIgnoreCase(input.allowlist?.actions, context.action)) {
    return deny({
      code: 'target_not_allowed',
      reason: 'action is not allowlisted',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: { action: context.action },
    })
  }

  const target = toTrimmed(context.target)
  if (target && !includesIgnoreCase(input.allowlist?.targets, target)) {
    return deny({
      code: 'target_not_allowed',
      reason: 'target is not allowlisted',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: { target },
    })
  }

  if (target && Array.isArray(capability.limits.allowed_targets) && capability.limits.allowed_targets.length > 0) {
    if (!includesIgnoreCase(capability.limits.allowed_targets, target)) {
      return deny({
        code: 'target_not_allowed',
        reason: 'target is outside capability limits',
        capability_id: capability.capability_id,
        proposal_id: proposal.proposal_id,
        confirmation_class: confirmationClass,
        details: { target },
      })
    }
  }

  const scopeMismatch = checkScopeMismatch(capability, context)
  if (scopeMismatch) {
    return deny({
      code: 'scope_mismatch',
      reason: `scope mismatch for ${scopeMismatch.key}`,
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: scopeMismatch,
    })
  }

  const amountLimit = capability.limits?.amount_ceiling
  if (amountLimit && context.amount) {
    const inputUnit = toSafeLower(context.amount.unit)
    const limitUnit = toSafeLower(amountLimit.unit)
    if (inputUnit !== limitUnit || context.amount.value > amountLimit.value) {
      return deny({
        code: 'amount_exceeded',
        reason: 'amount exceeds capability ceiling',
        capability_id: capability.capability_id,
        proposal_id: proposal.proposal_id,
        confirmation_class: confirmationClass,
        details: {
          limit: amountLimit,
          requested: context.amount,
        },
      })
    }
  }

  const confirmationIssue = checkConfirmation(
    confirmationClass,
    context.confirmation,
    context.actor_id,
  )
  if (confirmationIssue) {
    return deny({
      code: confirmationIssue.code,
      reason: confirmationIssue.reason,
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: confirmationIssue.details,
    })
  }

  const replayCandidates = normalizeReplayKeys([
    toTrimmed(context.replay_key),
    toTrimmed(context.confirmation.token_id),
    toTrimmed(context.confirmation.token_consumed_at),
  ])

  if (input.replayGuard && replayCandidates.some((candidate) => input.replayGuard?.isReplay(candidate))) {
    return deny({
      code: 'replay_detected',
      reason: 'replay guard blocked repeated request',
      capability_id: capability.capability_id,
      proposal_id: proposal.proposal_id,
      confirmation_class: confirmationClass,
      details: {
        replay_candidates: replayCandidates,
      },
    })
  }

  return allow({
    capability_id: capability.capability_id,
    proposal_id: proposal.proposal_id,
    confirmation_class: confirmationClass,
  })
}

export function assertPolicy(input: EvaluatePolicyInput): Extract<PolicyCheckResult, { allowed: true }> {
  const result = evaluatePolicy(input)
  if (!result.allowed) {
    throw new ControlPolicyError(result.deny_code, result.reason, result.details)
  }
  return result
}
