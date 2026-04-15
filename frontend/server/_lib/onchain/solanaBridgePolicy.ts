type EnvLike = Record<string, string | undefined>

declare const process: { env: EnvLike }

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export type CanonicalBridgeTokenPolicyDecision = {
  allowlistConfigured: boolean
  allowlistSize: number
  allowlistRequired: boolean
  allowed: boolean
  code: 'ok' | 'allowlist_missing' | 'token_not_allowlisted'
  message: string | null
}

export type RemoteProvisionerHealthProbe = {
  reachable: boolean
  statusCode: number | null
  healthOk: boolean | null
  payerConfigured: boolean | null
  payerHealthy: boolean | null
  payerError: string | null
  payerPubkey: string | null
  payerBalanceSol: string | null
  payerMinSol: string | null
  reportedAtIso: string | null
  reportedAtMs: number | null
}

export type RemoteProvisionerLivenessDecision = {
  healthy: boolean
  blockers: string[]
  healthAgeSeconds: number | null
}

function normalizeAddress(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!ADDRESS_RE.test(raw)) return null
  return raw.toLowerCase()
}

function parseAddressSet(raw: string): Set<string> {
  const out = new Set<string>()
  for (const piece of raw.split(/[\s,]+/g)) {
    const normalized = normalizeAddress(piece)
    if (normalized) out.add(normalized)
  }
  return out
}

function envBool(value: string | undefined): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parsePositiveInt(value: string | undefined): number | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw || !/^[0-9]+$/.test(raw)) return null
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseIsoTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || ms <= 0) return null
  return ms
}

function safeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function readCanonicalBridgeTokenAllowlist(env: EnvLike = process.env): Set<string> {
  const explicit = String(env.SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST ?? '').trim()
  if (explicit) return parseAddressSet(explicit)
  const legacy = String(env.SOLANA_BRIDGE_TOKEN_ALLOWLIST ?? '').trim()
  if (legacy) return parseAddressSet(legacy)
  return new Set<string>()
}

export function readCanonicalBridgeTokenAllowlistRequired(env: EnvLike = process.env): boolean {
  return envBool(env.SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST_REQUIRED)
}

export function evaluateCanonicalBridgeTokenPolicy(params: {
  bridgeToken: string
  env?: EnvLike
}): CanonicalBridgeTokenPolicyDecision {
  const env = params.env ?? process.env
  const allowlist = readCanonicalBridgeTokenAllowlist(env)
  const allowlistRequired = readCanonicalBridgeTokenAllowlistRequired(env)
  const normalizedToken = normalizeAddress(params.bridgeToken)

  if (!normalizedToken) {
    return {
      allowlistConfigured: allowlist.size > 0,
      allowlistSize: allowlist.size,
      allowlistRequired,
      allowed: false,
      code: 'token_not_allowlisted',
      message: 'Invalid bridge token address for canonical allowlist policy.',
    }
  }

  if (allowlistRequired && allowlist.size === 0) {
    return {
      allowlistConfigured: false,
      allowlistSize: 0,
      allowlistRequired: true,
      allowed: false,
      code: 'allowlist_missing',
      message:
        'Canonical bridge token allowlist is required but empty. Configure SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST.',
    }
  }

  if (allowlist.size > 0 && !allowlist.has(normalizedToken)) {
    return {
      allowlistConfigured: true,
      allowlistSize: allowlist.size,
      allowlistRequired,
      allowed: false,
      code: 'token_not_allowlisted',
      message:
        `Bridge token ${params.bridgeToken} is not in SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST. ` +
        'Registration is blocked by canonical wrapped-asset policy.',
    }
  }

  return {
    allowlistConfigured: allowlist.size > 0,
    allowlistSize: allowlist.size,
    allowlistRequired,
    allowed: true,
    code: 'ok',
    message: null,
  }
}

export function readSolanaBridgeLivenessPolicy(env: EnvLike = process.env): {
  enforced: boolean
  maxHealthAgeSeconds: number | null
} {
  const enforced = envBool(env.SOLANA_BRIDGE_LIVENESS_ENFORCED)
  const maxHealthAgeSeconds = parsePositiveInt(env.SOLANA_BRIDGE_LIVENESS_MAX_HEALTH_AGE_SECONDS) ?? 180
  return {
    enforced,
    maxHealthAgeSeconds,
  }
}

export async function probeRemoteProvisionerHealth(params: {
  url: string
  secret: string
  timeoutMs?: number
}): Promise<RemoteProvisionerHealthProbe> {
  const url = String(params.url ?? '').trim()
  if (!url) {
    return {
      reachable: false,
      statusCode: null,
      healthOk: null,
      payerConfigured: null,
      payerHealthy: null,
      payerError: null,
      payerPubkey: null,
      payerBalanceSol: null,
      payerMinSol: null,
      reportedAtIso: null,
      reportedAtMs: null,
    }
  }

  const timeoutMs = Math.max(1000, Number(params.timeoutMs ?? 4_000))
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: params.secret ? { Authorization: `Bearer ${params.secret}` } : {},
      signal: ac.signal,
    })
    const raw = await response.text().catch(() => '')
    let payload: Record<string, unknown> | null = null
    try {
      payload = safeRecord(raw ? JSON.parse(raw) : null)
    } catch {
      payload = null
    }
    const reportedAtIso =
      typeof payload?.now === 'string' && payload.now.trim() ? String(payload.now).trim() : null
    return {
      reachable: true,
      statusCode: response.status,
      healthOk: typeof payload?.ok === 'boolean' ? payload.ok : null,
      payerConfigured:
        typeof payload?.payerConfigured === 'boolean' ? payload.payerConfigured : null,
      payerHealthy: typeof payload?.payerHealthy === 'boolean' ? payload.payerHealthy : null,
      payerError: typeof payload?.payerError === 'string' ? payload.payerError : null,
      payerPubkey: typeof payload?.payerPubkey === 'string' ? payload.payerPubkey : null,
      payerBalanceSol:
        typeof payload?.payerBalanceSol === 'string' ? payload.payerBalanceSol : null,
      payerMinSol: typeof payload?.payerMinSol === 'string' ? payload.payerMinSol : null,
      reportedAtIso,
      reportedAtMs: parseIsoTimestampMs(reportedAtIso),
    }
  } catch {
    return {
      reachable: false,
      statusCode: null,
      healthOk: null,
      payerConfigured: null,
      payerHealthy: null,
      payerError: null,
      payerPubkey: null,
      payerBalanceSol: null,
      payerMinSol: null,
      reportedAtIso: null,
      reportedAtMs: null,
    }
  } finally {
    clearTimeout(timer)
  }
}

export function evaluateRemoteProvisionerLiveness(params: {
  enforced: boolean
  maxHealthAgeSeconds: number | null
  probe: RemoteProvisionerHealthProbe | null
  nowMs?: number
}): RemoteProvisionerLivenessDecision {
  if (!params.enforced) {
    return { healthy: true, blockers: [], healthAgeSeconds: null }
  }

  const blockers: string[] = []
  const probe = params.probe
  const nowMs = Number.isFinite(params.nowMs) ? Number(params.nowMs) : Date.now()
  let healthAgeSeconds: number | null = null

  if (!probe || !probe.reachable) {
    blockers.push('Remote Solana provisioner health endpoint is unreachable.')
    return { healthy: false, blockers, healthAgeSeconds: null }
  }

  if (probe.statusCode !== null && probe.statusCode >= 400) {
    blockers.push(`Remote Solana provisioner health endpoint returned HTTP ${probe.statusCode}.`)
  }
  if (probe.healthOk === false) {
    blockers.push('Remote Solana provisioner reported ok=false.')
  }
  if (probe.payerHealthy === false) {
    blockers.push('Remote Solana provisioner payer balance is below required minimum.')
  }

  if (params.maxHealthAgeSeconds !== null) {
    if (probe.reportedAtMs === null) {
      blockers.push('Remote Solana provisioner health payload is missing now timestamp.')
    } else {
      const ageSeconds = Math.max(0, Math.floor((nowMs - probe.reportedAtMs) / 1000))
      healthAgeSeconds = ageSeconds
      if (ageSeconds > params.maxHealthAgeSeconds) {
        blockers.push(
          `Remote Solana provisioner health payload is stale (${ageSeconds}s > ${params.maxHealthAgeSeconds}s).`,
        )
      }
    }
  }

  return {
    healthy: blockers.length === 0,
    blockers,
    healthAgeSeconds,
  }
}
