import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import { buildAgentRegistration, type RegistrationFile } from '../../../../../server/_lib/agent/agentRegistration.js'
import {
  extractCanonicalCsw,
  fetchRegistrationPayload,
  findEndpointFromRegistration,
  probeEndpoint,
  readOnchainSnapshot,
  type RegistrationProbe,
} from '../../../../../server/_lib/agent/erc8004Review.js'
import { getErc8004PublicOrigin } from '../../../../../server/_lib/infra/origin.js'
import { getTeeAttestationStatus } from '../../../../../server/_lib/agent/teeAttestationGate.js'
import {
  buildAgentUriPolicy,
  type AgentUriPolicy,
  buildPublicAgentRegistrationUrl,
  buildPublicDomainVerificationUrl,
  ERC8004_DOMAIN_VERIFICATION_PATH,
  STRICT_IMMUTABLE_AGENT_URI_KIND,
  STRICT_IMMUTABLE_AGENT_URI_SCHEMES,
} from '../../../../../src/lib/agent/erc8004AgentUriPolicy.js'

declare const process: { env: Record<string, string | undefined> }

type RegistrationRef = {
  chainId: number
  registryAddress: string
}

export type VerificationCheck = {
  id: string
  passed: boolean
  detail: string
}

export type TeeAttestationStatus = Awaited<ReturnType<typeof getTeeAttestationStatus>>

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`)
}

function setRetryAfterHeader(res: VercelResponse, resetAt: number) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
}

function parseRegistrationRef(value: string): RegistrationRef | null {
  const raw = value.trim()
  const match = raw.match(/^eip155:(\d+):(0x[a-fA-F0-9]{40})$/)
  if (!match) return null
  const chainId = Number(match[1])
  if (!Number.isFinite(chainId) || chainId <= 0) return null
  return {
    chainId,
    registryAddress: match[2],
  }
}

function getExplorerBaseUrl(chainId: number): string {
  if (chainId === 1) return 'https://etherscan.io'
  return 'https://basescan.org'
}

export type MirrorProbe = {
  url: string
  reachable: boolean
  finalUrl: string | null
  matchesCanonical: boolean
  agentIdMatches: boolean
  error: string | null
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stableClone(entry))
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = stableClone((value as Record<string, unknown>)[key])
  }
  return out
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(stableClone(value))
}

/** Volatile fields that differ between mirror sync time and live API builds. */
const REGISTRATION_VOLATILE_KEYS = new Set(['updatedAt'])

function registrationPayloadForComparison(payload: RegistrationFile | null | undefined): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (REGISTRATION_VOLATILE_KEYS.has(key)) continue
    out[key] = stableClone(value)
  }
  return out
}

function registrationPayloadsMatch(
  left: RegistrationFile | null | undefined,
  right: RegistrationFile | null | undefined,
): boolean {
  return (
    stableJsonStringify(registrationPayloadForComparison(left)) ===
    stableJsonStringify(registrationPayloadForComparison(right))
  )
}

function buildRegistrationProbe(agentId: number, source: RegistrationProbe['source'], rawUrl: string | null, payload: RegistrationFile | null, finalUrl: string | null, error: string | null): RegistrationProbe {
  const services = Array.isArray(payload?.services) ? payload.services : []
  const registrations = Array.isArray(payload?.registrations) ? payload.registrations : []
  const valid = Boolean(
    payload &&
      typeof payload.type === 'string' &&
      payload.type.includes('eip-8004') &&
      typeof payload.name === 'string' &&
      typeof payload.description === 'string' &&
      services.length > 0 &&
      registrations.some((entry) => Number(entry?.agentId) === agentId),
  )

  return {
    source,
    rawUrl,
    finalUrl,
    fetched: Boolean(finalUrl || rawUrl?.startsWith('data:')),
    valid,
    name: typeof payload?.name === 'string' ? payload.name : null,
    serviceCount: services.length,
    active: typeof payload?.active === 'boolean' ? payload.active : null,
    x402Support: typeof payload?.x402Support === 'boolean' ? payload.x402Support : null,
    payload,
    error,
  }
}

async function fetchMirrorProbe(params: {
  url: string
  canonicalPayload: RegistrationFile
  expectedAgentId: number
  expectedRegistry: string
}): Promise<MirrorProbe> {
  const fetched = await fetchRegistrationPayload(params.url)
  const payload = fetched.payload
  const registrations = Array.isArray(payload?.registrations) ? payload.registrations : []
  const agentIdMatches = registrations.some(
    (entry) =>
      Number(entry?.agentId) === params.expectedAgentId &&
      String(entry?.agentRegistry ?? '').trim().toLowerCase() === params.expectedRegistry,
  )

  return {
    url: params.url,
    reachable: Boolean(fetched.payload && !fetched.error),
    finalUrl: fetched.finalUrl,
    matchesCanonical: Boolean(payload && registrationPayloadsMatch(payload, params.canonicalPayload)),
    agentIdMatches,
    error: fetched.error,
  }
}

export type DomainVerificationProbe = {
  url: string
  reachable: boolean
  finalUrl: string | null
  matchesCanonical: boolean
  error: string | null
}

export type AgentVerificationData = {
  chainId: number
  registryAddress: string
  agentId: number
  canonicalCsw: string | null
  ownerAddress: string | null
  agentWallet: string | null
  tokenUri: string | null
  agentRegistered: boolean
  walletBoundToCanonical: boolean
  discoverabilityReady: boolean
  tokenUriIsStrictImmutable: boolean
  tokenUriMatchesCanonical: boolean
  uriPolicy: AgentUriPolicy
  onchainRegistration: RegistrationProbe
  endpoint: Awaited<ReturnType<typeof probeEndpoint>>
  mirrors: {
    registration: MirrorProbe
    domainVerification: DomainVerificationProbe
  }
  checks: VerificationCheck[]
  teeAttestation: TeeAttestationStatus
  links: {
    registry: string
    token: string
    canonicalCsw: string | null
    ownerAddress: string | null
    agentWallet: string | null
  }
  rpcHealthy: boolean
  rpcErrorCount: number
}

function toCanonicalDomain(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function buildExpectedVerifiedEndpoints(origin: string): string[] {
  const canonicalOrigin = origin.replace(/\/+$/, '')
  return [
    canonicalOrigin,
    `${canonicalOrigin}/api/v1/spec.json`,
    `${canonicalOrigin}/api/v1/agents/feedback`,
    `${canonicalOrigin}/api/v1/agents/feedback/review`,
    `${canonicalOrigin}/api/lens/reputation-graph`,
    `${canonicalOrigin}/api/lens/feedback-payload`,
    `${canonicalOrigin}/api/v1/agents/wallet-intelligence`,
    `${canonicalOrigin}/.well-known/agent-card.json`,
  ]
}

async function fetchDomainVerificationProbe(params: {
  url: string
  expectedDomain: string | null
  expectedAgentId: number
  expectedRegistry: string
  expectedRegistrationUrl: string
  expectedVerifiedEndpoints: string[]
}): Promise<DomainVerificationProbe> {
  const fetched = await fetchRegistrationPayload(params.url)
  const payload = fetched.payload as Record<string, unknown> | null
  const payloadVerifiedEndpoints = Array.isArray(payload?.verifiedEndpoints)
    ? payload.verifiedEndpoints.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    : []
  const verifiedEndpointsMatch = stableJsonStringify(payloadVerifiedEndpoints) === stableJsonStringify(params.expectedVerifiedEndpoints)
  const domainMatches = String(payload?.domain ?? '').trim().toLowerCase() === String(params.expectedDomain ?? '').trim().toLowerCase()
  const matchesCanonical = Boolean(
    payload &&
      domainMatches &&
      Number(payload.agentId) === params.expectedAgentId &&
      String(payload.agentRegistry ?? '').trim().toLowerCase() === params.expectedRegistry &&
      String(payload.registrationUrl ?? '').trim() === params.expectedRegistrationUrl &&
      verifiedEndpointsMatch,
  )
  let error = fetched.error
  if (!error && payload && !domainMatches) {
    error = `Domain proof domain does not match canonical host (${params.expectedDomain ?? 'unknown'}).`
  } else if (!error && payload && !verifiedEndpointsMatch) {
    error = 'Domain proof verifiedEndpoints do not match the canonical public endpoints.'
  }

  return {
    url: params.url,
    reachable: Boolean(payload && !fetched.error),
    finalUrl: fetched.finalUrl,
    matchesCanonical,
    error,
  }
}

function isStrictImmutableUri(value: string | null): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  return STRICT_IMMUTABLE_AGENT_URI_SCHEMES.some((prefix) => raw.startsWith(prefix))
}

function buildChecks(params: {
  agentRegistered: boolean
  tokenUri: string | null
  tokenUriIsStrictImmutable: boolean
  tokenUriMatchesCanonical: boolean
  walletBoundToCanonical: boolean
  registrationMirror: MirrorProbe
  domainVerification: DomainVerificationProbe
  endpoint: Awaited<ReturnType<typeof probeEndpoint>>
}): VerificationCheck[] {
  return [
    {
      id: 'onchain-registration',
      passed: params.agentRegistered,
      detail: params.agentRegistered
        ? 'Agent is present in the ERC-8004 identity registry.'
        : 'Agent could not be confirmed onchain from ownerOf/tokenURI lookups.',
    },
    {
      id: 'token-uri-reachable',
      passed: Boolean(params.tokenUri),
      detail: params.tokenUri ? 'Onchain tokenURI is set.' : 'No onchain tokenURI is currently set for this agent.',
    },
    {
      id: 'token-uri-immutable',
      passed: params.tokenUriIsStrictImmutable,
      detail: params.tokenUriIsStrictImmutable
        ? 'Onchain tokenURI uses a strict immutable scheme.'
        : `Onchain tokenURI must use ${STRICT_IMMUTABLE_AGENT_URI_KIND}, ipfs://, or ar://.`,
    },
    {
      id: 'token-uri-matches-canonical',
      passed: params.tokenUriMatchesCanonical,
      detail: params.tokenUriMatchesCanonical
        ? 'Onchain tokenURI matches the canonical registration payload.'
        : 'Onchain tokenURI does not match the canonical registration payload generated by this deployment.',
    },
    {
      id: 'canonical-agent-wallet',
      passed: params.walletBoundToCanonical,
      detail: params.walletBoundToCanonical
        ? 'Onchain agentWallet matches the canonical CSW.'
        : 'Onchain agentWallet is missing or does not match the canonical CSW.',
    },
    {
      id: 'registration-mirror',
      passed: params.registrationMirror.reachable && params.registrationMirror.matchesCanonical,
      detail: params.registrationMirror.reachable && params.registrationMirror.matchesCanonical
        ? 'Public registration mirror matches the canonical payload.'
        : params.registrationMirror.error || 'Public registration mirror is missing or diverges from the canonical payload.',
    },
    {
      id: 'domain-proof',
      passed: params.domainVerification.reachable && params.domainVerification.matchesCanonical,
      detail: params.domainVerification.reachable && params.domainVerification.matchesCanonical
        ? 'Domain verification file matches the canonical agent identity.'
        : params.domainVerification.error || 'Domain verification file is missing or inconsistent.',
    },
    {
      id: 'service-availability',
      passed: params.endpoint.ok,
      detail: params.endpoint.ok
        ? `Primary public endpoint responded successfully${params.endpoint.status ? ` with HTTP ${params.endpoint.status}` : ''}.`
        : params.endpoint.error || 'Primary public endpoint is unhealthy.',
    },
  ]
}

function buildVerificationError(message: string, statusCode: number, missing?: string[]) {
  return Object.assign(new Error(message), {
    statusCode,
    ...(missing && missing.length > 0 ? { missing } : {}),
  })
}

export async function buildAgentVerificationData(req?: VercelRequest): Promise<AgentVerificationData> {
  const origin = getErc8004PublicOrigin(req)

  const registration = buildAgentRegistration(origin)
  if (!registration.payload) {
    throw buildVerificationError(
      registration.error || 'Missing ERC-8004 registry configuration.',
      503,
      registration.missing ?? [],
    )
  }

  const primaryRegistration = Array.isArray(registration.payload.registrations)
    ? registration.payload.registrations[0]
    : null
  if (!primaryRegistration || typeof primaryRegistration.agentRegistry !== 'string') {
    throw buildVerificationError('Agent registration metadata is missing registrations[0].', 503)
  }

  const ref = parseRegistrationRef(primaryRegistration.agentRegistry)
  if (!ref) {
    throw buildVerificationError('Invalid agentRegistry reference in registration metadata.', 503)
  }

  const agentId = Number(primaryRegistration.agentId)
  if (!Number.isFinite(agentId) || agentId < 0 || Math.floor(agentId) !== agentId) {
    throw buildVerificationError('Invalid agentId in registration metadata.', 503)
  }

  const canonicalCsw = extractCanonicalCsw(registration.payload)
  const onchain = await readOnchainSnapshot(agentId)
  const uriPolicy = buildAgentUriPolicy({
    origin,
    registration: registration.payload,
    compatibilityFallbackUrl: null,
  })
  const tokenUriFetch = onchain.tokenUri
    ? await fetchRegistrationPayload(onchain.tokenUri)
    : { payload: null, finalUrl: null, fetched: false, error: 'No registration URL available' }
  const onchainRegistration = buildRegistrationProbe(
    agentId,
    onchain.tokenUri ? 'onchain-token-uri' : 'none',
    onchain.tokenUri,
    tokenUriFetch.payload,
    tokenUriFetch.finalUrl,
    tokenUriFetch.error,
  )
  const expectedRegistry = primaryRegistration.agentRegistry.trim().toLowerCase()
  const registrationMirrorUrl = buildPublicAgentRegistrationUrl(origin)
  const domainVerificationUrl = buildPublicDomainVerificationUrl(origin)
  const expectedVerifiedEndpoints = buildExpectedVerifiedEndpoints(origin)
  const registrationMirror = await fetchMirrorProbe({
    url: registrationMirrorUrl,
    canonicalPayload: registration.payload,
    expectedAgentId: agentId,
    expectedRegistry,
  })
  const domainVerification = await fetchDomainVerificationProbe({
    url: domainVerificationUrl,
    expectedDomain: toCanonicalDomain(origin),
    expectedAgentId: agentId,
    expectedRegistry,
    expectedRegistrationUrl: registrationMirrorUrl,
    expectedVerifiedEndpoints,
  })
  const endpointUrl = findEndpointFromRegistration(onchainRegistration.payload ?? registration.payload)
  const endpoint = await probeEndpoint(endpointUrl ?? '')

  const explorer = getExplorerBaseUrl(ref.chainId)
  const walletBoundToCanonical = Boolean(
    canonicalCsw && onchain.agentWallet && canonicalCsw.toLowerCase() === onchain.agentWallet.toLowerCase(),
  )
  const tokenUriIsStrictImmutable = isStrictImmutableUri(onchain.tokenUri)
  const tokenUriMatchesCanonical = Boolean(
    onchainRegistration.payload &&
      registrationPayloadsMatch(onchainRegistration.payload, registration.payload),
  )
  const checks = buildChecks({
    agentRegistered: onchain.agentRegistered,
    tokenUri: onchain.tokenUri,
    tokenUriIsStrictImmutable,
    tokenUriMatchesCanonical,
    walletBoundToCanonical,
    registrationMirror,
    domainVerification,
    endpoint,
  })
  const discoverabilityReady = checks.every((check) => check.passed)
  const teeAttestation: TeeAttestationStatus = await getTeeAttestationStatus().catch(() => ({
    enabled: false,
    passed: false,
    reason: 'tee_attestation_lookup_failed',
    source: 'validation-registry' as const,
    tag: 'tee-attestation',
    registryAddress: null,
    validatorAddresses: [],
    validationCount: 0,
    averageResponse: 0,
    checkedAtMs: Date.now(),
  }))

  return {
    chainId: ref.chainId,
    registryAddress: ref.registryAddress,
    agentId,
    canonicalCsw,
    ownerAddress: onchain.ownerAddress,
    agentWallet: onchain.agentWallet,
    tokenUri: onchain.tokenUri,
    agentRegistered: onchain.agentRegistered,
    walletBoundToCanonical,
    discoverabilityReady,
    tokenUriIsStrictImmutable,
    tokenUriMatchesCanonical,
    uriPolicy,
    onchainRegistration,
    endpoint,
    mirrors: {
      registration: registrationMirror,
      domainVerification,
    },
    checks,
    teeAttestation,
    links: {
      registry: `${explorer}/address/${ref.registryAddress}`,
      token: `${explorer}/token/${ref.registryAddress}?a=${agentId}`,
      canonicalCsw: canonicalCsw ? `${explorer}/address/${canonicalCsw}` : null,
      ownerAddress: onchain.ownerAddress ? `${explorer}/address/${onchain.ownerAddress}` : null,
      agentWallet: onchain.agentWallet ? `${explorer}/address/${onchain.agentWallet}` : null,
    },
    rpcHealthy: onchain.rpcErrorCount === 0,
    rpcErrorCount: onchain.rpcErrorCount,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/identity/verification', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-agents-identity-verification', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentsRead,
  )
  if (!limiter.allowed) {
    setRetryAfterHeader(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  try {
    const data = await buildAgentVerificationData(req)

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? Number((error as { statusCode?: number }).statusCode)
      : 500
    const missing = Array.isArray((error as { missing?: unknown })?.missing)
      ? ((error as { missing?: string[] }).missing ?? [])
      : undefined
    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build agent verification snapshot.',
      ...(missing && missing.length > 0 ? { missing } : {}),
    })
  }
}
