import crypto from 'node:crypto'

export type DegradationMode =
  | 'fail_closed'
  | 'allow_stale_read'
  | 'queue_for_retry'
  | 'block_until_operator'
  | 'manual_repair_only'

export type ControlPlaneVerb =
  | 'provisionVaultEconomy'
  | 'getVaultLifecycleStatus'
  | 'runMaintenanceCycle'
  | 'queueOperatorAction'
  | 'settleVault'

export type ExceptionPolicy = {
  id: string
  owner: string
  reason: string
  removalCondition: string
  expiresAt: string
  scopeType?: string
  scopeId?: string
}

export type ControlPlanePolicy = {
  lifecycle: {
    operationStatus: {
      nonTerminal: string[]
      terminal: string[]
    }
  }
  degradation: Record<ControlPlaneVerb, DegradationMode>
  exceptions: ExceptionPolicy[]
}

export type LoadedControlPlanePolicy = {
  policy: ControlPlanePolicy
  policyVersion: string
  criticalWarnings: string[]
}

const DEFAULT_POLICY: ControlPlanePolicy = {
  lifecycle: {
    operationStatus: {
      nonTerminal: ['requested', 'queued', 'running', 'blocked', 'retrying', 'manual_review'],
      terminal: ['succeeded', 'failed', 'cancelled', 'expired'],
    },
  },
  degradation: {
    provisionVaultEconomy: 'fail_closed',
    getVaultLifecycleStatus: 'allow_stale_read',
    runMaintenanceCycle: 'queue_for_retry',
    queueOperatorAction: 'fail_closed',
    settleVault: 'fail_closed',
  },
  exceptions: [],
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const child = value[key]
        if (child !== undefined) acc[key] = canonicalize(child)
        return acc
      }, {})
  }
  return value
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function validateExceptionPolicy(raw: unknown): ExceptionPolicy | null {
  if (!isObject(raw)) return null
  const id = asString(raw.id)
  const owner = asString(raw.owner)
  const reason = asString(raw.reason)
  const removalCondition = asString(raw.removalCondition)
  const expiresAt = asString(raw.expiresAt)
  if (!id || !owner || !reason || !removalCondition || !expiresAt) return null
  const expiresAtMs = Date.parse(expiresAt)
  if (!Number.isFinite(expiresAtMs)) return null
  return {
    id,
    owner,
    reason,
    removalCondition,
    expiresAt: new Date(expiresAtMs).toISOString(),
    scopeType: asString(raw.scopeType) || undefined,
    scopeId: asString(raw.scopeId) || undefined,
  }
}

function parseOverrides(): Partial<ControlPlanePolicy> {
  const raw = process.env.CONTROL_PLANE_POLICY_JSON
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return isObject(parsed) ? (parsed as Partial<ControlPlanePolicy>) : {}
  } catch {
    return {}
  }
}

export function loadControlPlanePolicy(): LoadedControlPlanePolicy {
  const warnings: string[] = []
  const overrides = parseOverrides()
  const policy: ControlPlanePolicy = {
    lifecycle: DEFAULT_POLICY.lifecycle,
    degradation: {
      ...DEFAULT_POLICY.degradation,
      ...(isObject(overrides.degradation) ? (overrides.degradation as Record<ControlPlaneVerb, DegradationMode>) : {}),
    },
    exceptions: Array.isArray(overrides.exceptions)
      ? overrides.exceptions
          .map(validateExceptionPolicy)
          .filter((value): value is ExceptionPolicy => Boolean(value))
      : [],
  }

  const nowMs = Date.now()
  const activeExceptions: ExceptionPolicy[] = []
  for (const exception of policy.exceptions) {
    const expiresMs = Date.parse(exception.expiresAt)
    if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
      warnings.push(`expired_exception_ignored:${exception.id}`)
      continue
    }
    activeExceptions.push(exception)
  }
  policy.exceptions = activeExceptions

  const policyVersion = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(policy)))
    .digest('hex')
    .slice(0, 16)

  return {
    policy,
    policyVersion: `cpol_${policyVersion}`,
    criticalWarnings: warnings,
  }
}

