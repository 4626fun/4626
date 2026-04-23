import { createPublicClient, http, isAddress, type Address } from 'viem'

import { getValidationRegistryAddress, VALIDATION_REGISTRY_ABI } from './erc8004.js'
import { logger } from '../infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

export type TeeAttestationStatus = {
  enabled: boolean
  passed: boolean
  reason: string
  source: 'disabled' | 'validation-registry'
  tag: string
  registryAddress: Address | null
  validatorAddresses: Address[]
  validationCount: number
  averageResponse: number
  checkedAtMs: number
}

type TeeCheckContext = {
  action?: string
  actorAddress?: string
  metadata?: Record<string, unknown>
}

type CacheEntry = {
  expiresAtMs: number
  value: TeeAttestationStatus
}

let cachedStatus: CacheEntry | null = null

function parseEnvBool(value: string | undefined, fallback: boolean): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return fallback
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function teeEnforcementEnabled(): boolean {
  return parseEnvBool(process.env.TEE_ENFORCEMENT_ENABLED, false)
}

// M-30 (4626-339): the default for TEE_ENFORCEMENT_FAIL_OPEN is already
// `false` (fail-closed). Harden this further by refusing to honour a
// `true` value in production: any deployment that tries to enable
// fail-open behind the TEE gate in production logs a warning and gets
// the safe (fail-closed) behaviour anyway. Dev/staging can still opt
// into fail-open for local iteration.
let loggedFailOpenOverride = false
function teeFailOpenOnVerifierFailure(): boolean {
  const raw = parseEnvBool(process.env.TEE_ENFORCEMENT_FAIL_OPEN, false)
  if (!raw) return false
  const isProduction = String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production'
  if (isProduction) {
    if (!loggedFailOpenOverride) {
      loggedFailOpenOverride = true
      console.warn(
        '[tee] TEE_ENFORCEMENT_FAIL_OPEN=true ignored in production; '
          + 'fail-open attestation would defeat the gate. Unset the variable or '
          + 'explicitly accept the risk by disabling NODE_ENV=production.',
      )
    }
    return false
  }
  return true
}

function parseAgentId(): bigint | null {
  const raw = String(process.env.ERC8004_AGENT_ID ?? '').trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) return null
  return BigInt(n)
}

function parseValidatorAddresses(): Address[] {
  const raw = String(process.env.TEE_VALIDATOR_ADDRESSES ?? '').trim()
  if (!raw) return []
  const out: Address[] = []
  for (const entry of raw.split(/[\s,]+/g)) {
    const candidate = entry.trim()
    if (!candidate) continue
    if (!isAddress(candidate)) continue
    out.push(candidate.toLowerCase() as Address)
  }
  return Array.from(new Set(out))
}

function getValidationTag(): string {
  const raw = String(process.env.TEE_VALIDATION_TAG ?? '').trim()
  return raw || 'tee-attestation'
}

function getBaseRpcUrls(): string[] {
  const fromEnv = String(process.env.BASE_RPC_URL ?? '')
    .split(/[\s,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
  const defaults = ['https://mainnet.base.org', 'https://base.llamarpc.com']
  return Array.from(new Set([...fromEnv, ...defaults]))
}

function coerceSummaryNumbers(summary: unknown): { count: number; avgResponse: number } {
  if (Array.isArray(summary)) {
    const count = Number(summary[0] ?? 0)
    const avg = Number(summary[1] ?? 0)
    return {
      count: Number.isFinite(count) ? count : 0,
      avgResponse: Number.isFinite(avg) ? avg : 0,
    }
  }
  const rec = (summary ?? {}) as Record<string, unknown>
  const count = Number(rec.count ?? 0)
  const avg = Number(rec.avgResponse ?? 0)
  return {
    count: Number.isFinite(count) ? count : 0,
    avgResponse: Number.isFinite(avg) ? avg : 0,
  }
}

async function readValidationSummary(params: {
  registryAddress: Address
  agentId: bigint
  validatorAddresses: Address[]
  tag: string
}): Promise<{ count: number; avgResponse: number }> {
  let lastError: unknown = null
  for (const rpcUrl of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        transport: http(rpcUrl, { timeout: 12_000 }),
      })
      const summary = await client.readContract({
        address: params.registryAddress,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'getSummary',
        args: [params.agentId, params.validatorAddresses, params.tag],
      })
      return coerceSummaryNumbers(summary)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('tee_validation_summary_unavailable')
}

function makeStatus(input: Partial<TeeAttestationStatus> & {
  enabled: boolean
  passed: boolean
  reason: string
  source: TeeAttestationStatus['source']
}): TeeAttestationStatus {
  return {
    enabled: input.enabled,
    passed: input.passed,
    reason: input.reason,
    source: input.source,
    tag: input.tag ?? getValidationTag(),
    registryAddress: input.registryAddress ?? null,
    validatorAddresses: input.validatorAddresses ?? [],
    validationCount: input.validationCount ?? 0,
    averageResponse: input.averageResponse ?? 0,
    checkedAtMs: input.checkedAtMs ?? Date.now(),
  }
}

export async function getTeeAttestationStatus(): Promise<TeeAttestationStatus> {
  const enabled = teeEnforcementEnabled()
  if (!enabled) {
    return makeStatus({
      enabled: false,
      passed: true,
      reason: 'tee_enforcement_disabled',
      source: 'disabled',
    })
  }

  const ttlMs = parsePositiveInt(process.env.TEE_VALIDATION_CACHE_TTL_MS, 30_000)
  if (cachedStatus && Date.now() < cachedStatus.expiresAtMs) return cachedStatus.value

  const registryAddress = getValidationRegistryAddress()
  const validatorAddresses = parseValidatorAddresses()
  const agentId = parseAgentId()
  const tag = getValidationTag()
  const failOpen = teeFailOpenOnVerifierFailure()

  if (!registryAddress || validatorAddresses.length === 0 || !agentId) {
    const status = makeStatus({
      enabled: true,
      passed: failOpen,
      reason: 'tee_validation_config_missing',
      source: 'validation-registry',
      tag,
      registryAddress: registryAddress ?? null,
      validatorAddresses,
    })
    cachedStatus = { expiresAtMs: Date.now() + ttlMs, value: status }
    return status
  }

  try {
    const summary = await readValidationSummary({
      registryAddress,
      agentId,
      validatorAddresses,
      tag,
    })
    const minCount = parsePositiveInt(process.env.TEE_MIN_VALIDATION_COUNT, 1)
    const minAvgResponse = parsePositiveInt(process.env.TEE_MIN_AVG_RESPONSE, 1)
    const passed = summary.count >= minCount && summary.avgResponse >= minAvgResponse
    const status = makeStatus({
      enabled: true,
      passed,
      reason: passed ? 'tee_attestation_verified' : 'tee_attestation_below_threshold',
      source: 'validation-registry',
      tag,
      registryAddress,
      validatorAddresses,
      validationCount: summary.count,
      averageResponse: summary.avgResponse,
    })
    cachedStatus = { expiresAtMs: Date.now() + ttlMs, value: status }
    return status
  } catch (error) {
    const status = makeStatus({
      enabled: true,
      passed: failOpen,
      reason: 'tee_validation_unreachable',
      source: 'validation-registry',
      tag,
      registryAddress,
      validatorAddresses,
    })
    logger.warn('[tee] validation registry lookup failed', {
      error: error instanceof Error ? error.message : String(error),
      failOpen,
    })
    cachedStatus = { expiresAtMs: Date.now() + ttlMs, value: status }
    return status
  }
}

export async function assertTeeAttestationOrThrow(context?: TeeCheckContext): Promise<void> {
  const status = await getTeeAttestationStatus()
  if (status.passed) return
  logger.error('[tee] attestation check failed for privileged action', {
    action: context?.action ?? 'unknown',
    actorAddress: context?.actorAddress ?? null,
    reason: status.reason,
    source: status.source,
    registryAddress: status.registryAddress,
    validatorCount: status.validatorAddresses.length,
    validationCount: status.validationCount,
    averageResponse: status.averageResponse,
    metadata: context?.metadata ?? null,
  })
  throw new Error(`TEE_ATTESTATION_REQUIRED:${status.reason}`)
}
