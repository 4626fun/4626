import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base, mainnet } from 'viem/chains'

import type { RegistrationFile } from './agentRegistration.js'
import {
  IDENTITY_REGISTRY_ABI,
  getIdentityRegistryAddress,
} from './erc8004.js'
import { buildReputationGraph } from '../lens/reputationGraph.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const FETCH_TIMEOUT_MS = 8_000
const MAX_RESPONSE_BYTES = 256_000
const MAX_REDIRECTS = 3
const DEFAULT_DATA_GATEWAY_HOSTS = ['ipfs.io', 'arweave.net'] as const

export type RegistrationProbe = {
  source: 'provided' | 'onchain-token-uri' | 'none'
  rawUrl: string | null
  finalUrl: string | null
  fetched: boolean
  valid: boolean
  name: string | null
  serviceCount: number
  active: boolean | null
  x402Support: boolean | null
  payload: RegistrationFile | null
  error: string | null
}

export type EndpointProbe = {
  source: 'provided' | 'registration' | 'none'
  url: string | null
  finalUrl: string | null
  checked: boolean
  ok: boolean
  status: number | null
  responseTimeMs: number | null
  contentType: string | null
  error: string | null
}

export type IdentitySnapshot = {
  ownerAddress: string | null
  agentWallet: string | null
  tokenUri: string | null
  rpcErrorCount: number
  agentRegistered: boolean
  registryAddress: Address
  chainId: number
}

export type Erc8004TechnicalReview = {
  agentId: number
  scanUrl: string
  identity: IdentitySnapshot & {
    links: {
      registry: string
      token: string
      ownerAddress: string | null
      agentWallet: string | null
    }
  }
  registration: RegistrationProbe
  endpoint: EndpointProbe
  reputation: {
    totalFeedback: number
    totalReviewers: number
    averageValue: string
    averageValueDecimals: number
    label: string
  }
  checks: Array<{
    id: string
    passed: boolean
    detail: string
  }>
  score: {
    value: string
    valueDecimals: number
    numericValue: number
    label: string
  }
  reasoning: string
  generatedAt: string
  source: 'erc8004.paid.review.v1'
}

function normalizeRpcUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (!value.startsWith('http://') && !value.startsWith('https://')) return `https://${value}`
  return value
}

function parseAccountAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^eip155:\d+:(0x[a-fA-F0-9]{40})$/)
  if (!match || !isAddress(match[1])) return null
  return getAddress(match[1])
}

function readAddressLike(value: unknown): string | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value)
}

function parseAddressFromText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.match(/0x[a-fA-F0-9]{40}/)
  if (!match || !isAddress(match[0])) return null
  return getAddress(match[0])
}

function readServiceAddress(service: Record<string, unknown>): string | null {
  const fromAccount = parseAccountAddress(service.account)
  if (fromAccount) return fromAccount
  const fromAddress = readAddressLike(service.address)
  if (fromAddress) return fromAddress
  return parseAddressFromText(service.endpoint)
}

export function extractCanonicalCsw(payload: RegistrationFile): string | null {
  const services = Array.isArray(payload.services) ? payload.services : []
  const byName = (name: string) =>
    services.find((service) => String(service?.name ?? '').trim().toLowerCase() === name)

  const walletService = byName('agentwallet')
  if (walletService && typeof walletService === 'object') {
    const fromWalletService = readServiceAddress(walletService as Record<string, unknown>)
    if (fromWalletService) return fromWalletService
  }

  const xmtpService = byName('xmtp')
  if (xmtpService && typeof xmtpService === 'object') {
    const fromXmtpService = readServiceAddress(xmtpService as Record<string, unknown>)
    if (fromXmtpService) return fromXmtpService
  }

  const fromEnv = readAddressLike((process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim())
  return fromEnv
}

function getRpcUrls(): string[] {
  const raw = String(process.env.BASE_RPC_URL ?? '').trim()
  const fromEnv = raw
    .split(/[\s,]+/g)
    .map(normalizeRpcUrl)
    .filter((value): value is string => Boolean(value))
  return Array.from(new Set(fromEnv.length > 0 ? [...fromEnv, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]))
}

function resolveChain(chainId: number) {
  return chainId === mainnet.id ? mainnet : base
}

function getExplorerBaseUrl(chainId: number): string {
  return chainId === 1 ? 'https://etherscan.io' : 'https://basescan.org'
}

function parseIpv4(octets: string[]): number[] | null {
  if (octets.length !== 4) return null
  const out: number[] = []
  for (const part of octets) {
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (!Number.isFinite(value) || value < 0 || value > 255) return null
    out.push(value)
  }
  return out
}

function isPrivateIpv4(host: string): boolean {
  const octets = parseIpv4(host.split('.'))
  if (!octets) return false
  const [a, b] = octets
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(host: string): boolean {
  const value = host.toLowerCase()
  if (value.startsWith('::ffff:')) return isPrivateIpv4(value.slice('::ffff:'.length))
  if (value === '::' || value === '::1') return true
  if (value.startsWith('fc') || value.startsWith('fd')) return true
  if (value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')) return true
  return false
}

function isForbiddenIpAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  return false
}

function isForbiddenHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '0.0.0.0') return true
  return isForbiddenIpAddress(host)
}

async function isHostnameResolutionSafe(hostname: string): Promise<boolean> {
  if (isForbiddenHostname(hostname)) return false
  if (isIP(hostname) !== 0) return true
  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true })
    if (!Array.isArray(resolved) || resolved.length === 0) return false
    return resolved.every((entry) => !isForbiddenIpAddress(String(entry.address ?? '').trim()))
  } catch {
    return false
  }
}

function readRedirectUrl(currentUrl: URL, locationHeader: string | null): URL | null {
  const location = String(locationHeader ?? '').trim()
  if (!location) return null
  try {
    const next = new URL(location, currentUrl)
    if (next.protocol !== 'http:' && next.protocol !== 'https:') return null
    if (isForbiddenHostname(next.hostname)) return null
    return next
  } catch {
    return null
  }
}

async function fetchPublicResource(startUrl: URL, accept: string): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!(await isHostnameResolutionSafe(currentUrl.hostname))) {
      throw new Error('Resolved hostname is not publicly routable')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(currentUrl.toString(), {
        method: 'GET',
        headers: { Accept: accept },
        signal: controller.signal,
        redirect: 'manual',
      })

      if (response.status >= 300 && response.status < 400) {
        if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects')
        const next = readRedirectUrl(currentUrl, response.headers.get('location'))
        if (!next) throw new Error('Invalid redirect location')
        currentUrl = next
        continue
      }

      return { response, finalUrl: currentUrl }
    } catch (error) {
      if (controller.signal.aborted) throw new Error('External request timed out')
      throw error instanceof Error ? error : new Error('External request failed')
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Too many redirects')
}

async function readTextWithLimit(response: Response): Promise<string> {
  const lengthHeader = response.headers.get('content-length')
  const declaredLength = lengthHeader ? Number(lengthHeader) : NaN
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('External response exceeds size limit')
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('External response exceeds size limit')
  }
  return text
}

function decodeDataUriJson(raw: string): unknown {
  const match = raw.match(/^data:([^,]*?),(.*)$/i)
  if (!match) throw new Error('Unsupported data URI')
  const metadata = match[1] ?? ''
  const payload = match[2] ?? ''
  const isBase64 = /;base64/i.test(metadata)
  const decoded = isBase64 ? Buffer.from(payload, 'base64').toString('utf8') : decodeURIComponent(payload)
  return decoded ? JSON.parse(decoded) : null
}

function toGatewayUrl(raw: string): string | null {
  if (raw.startsWith('ipfs://')) {
    const cid = raw.slice('ipfs://'.length).replace(/^ipfs\//, '')
    return cid ? `https://${DEFAULT_DATA_GATEWAY_HOSTS[0]}/ipfs/${cid}` : null
  }
  if (raw.startsWith('ar://')) {
    const id = raw.slice('ar://'.length)
    return id ? `https://${DEFAULT_DATA_GATEWAY_HOSTS[1]}/${id}` : null
  }
  return null
}

export async function fetchRegistrationPayload(rawUrl: string): Promise<{
  payload: RegistrationFile | null
  finalUrl: string | null
  fetched: boolean
  error: string | null
}> {
  if (!rawUrl.trim()) {
    return { payload: null, finalUrl: null, fetched: false, error: 'No registration URL available' }
  }

  if (rawUrl.startsWith('data:')) {
    try {
      return {
        payload: decodeDataUriJson(rawUrl) as RegistrationFile,
        finalUrl: rawUrl,
        fetched: true,
        error: null,
      }
    } catch (error) {
      return {
        payload: null,
        finalUrl: rawUrl,
        fetched: true,
        error: error instanceof Error ? error.message : 'Failed to parse data URI registration',
      }
    }
  }

  const normalizedUrl = toGatewayUrl(rawUrl) ?? rawUrl
  let parsed: URL
  try {
    parsed = new URL(normalizedUrl)
  } catch {
    return { payload: null, finalUrl: null, fetched: false, error: 'Invalid registration URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { payload: null, finalUrl: null, fetched: false, error: 'Unsupported registration URL protocol' }
  }
  if (isForbiddenHostname(parsed.hostname)) {
    return { payload: null, finalUrl: null, fetched: false, error: 'Registration URL points to a forbidden host' }
  }

  try {
    const { response, finalUrl } = await fetchPublicResource(parsed, 'application/json')
    if (!response.ok) {
      return {
        payload: null,
        finalUrl: finalUrl.toString(),
        fetched: true,
        error: `Registration URL returned ${response.status}`,
      }
    }
    const text = await readTextWithLimit(response)
    return {
      payload: (text ? JSON.parse(text) : null) as RegistrationFile,
      finalUrl: finalUrl.toString(),
      fetched: true,
      error: null,
    }
  } catch (error) {
    return {
      payload: null,
      finalUrl: parsed.toString(),
      fetched: true,
      error: error instanceof Error ? error.message : 'Failed to fetch registration',
    }
  }
}

export async function probeEndpoint(rawUrl: string): Promise<EndpointProbe> {
  if (!rawUrl.trim()) {
    return {
      source: 'none',
      url: null,
      finalUrl: null,
      checked: false,
      ok: false,
      status: null,
      responseTimeMs: null,
      contentType: null,
      error: 'No endpoint available for review',
    }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return {
      source: 'provided',
      url: rawUrl,
      finalUrl: null,
      checked: false,
      ok: false,
      status: null,
      responseTimeMs: null,
      contentType: null,
      error: 'Invalid endpoint URL',
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      source: 'provided',
      url: rawUrl,
      finalUrl: null,
      checked: false,
      ok: false,
      status: null,
      responseTimeMs: null,
      contentType: null,
      error: 'Endpoint must use http or https',
    }
  }
  if (isForbiddenHostname(parsed.hostname)) {
    return {
      source: 'provided',
      url: rawUrl,
      finalUrl: null,
      checked: false,
      ok: false,
      status: null,
      responseTimeMs: null,
      contentType: null,
      error: 'Endpoint points to a forbidden host',
    }
  }

  const startedAt = Date.now()
  try {
    const { response, finalUrl } = await fetchPublicResource(parsed, 'application/json, text/plain;q=0.8, */*;q=0.1')
    void response.body?.cancel?.().catch(() => {})
    return {
      source: 'provided',
      url: rawUrl,
      finalUrl: finalUrl.toString(),
      checked: true,
      ok: response.ok,
      status: response.status,
      responseTimeMs: Date.now() - startedAt,
      contentType: response.headers.get('content-type'),
      error: response.ok ? null : `Endpoint returned ${response.status}`,
    }
  } catch (error) {
    return {
      source: 'provided',
      url: rawUrl,
      finalUrl: null,
      checked: true,
      ok: false,
      status: null,
      responseTimeMs: Date.now() - startedAt,
      contentType: null,
      error: error instanceof Error ? error.message : 'Failed to probe endpoint',
    }
  }
}

function isValidRegistrationPayload(payload: RegistrationFile | null, agentId: number): boolean {
  if (!payload || typeof payload !== 'object') return false
  const services = Array.isArray(payload.services) ? payload.services : []
  const registrations = Array.isArray(payload.registrations) ? payload.registrations : []
  if (!payload.type || !String(payload.type).includes('eip-8004')) return false
  if (!payload.name || !payload.description) return false
  if (services.length === 0) return false
  return registrations.some((entry) => Number(entry?.agentId) === agentId)
}

export function findEndpointFromRegistration(payload: RegistrationFile | null): string | null {
  if (!payload || !Array.isArray(payload.services)) return null
  const ranked = ['api', 'wallet-intelligence', 'feedback', 'reputation-graph', 'web']
  for (const name of ranked) {
    const match = payload.services.find((service) => String(service?.name ?? '').trim().toLowerCase() === name)
    const endpoint = typeof match?.endpoint === 'string' ? match.endpoint.trim() : ''
    if (/^https?:\/\//i.test(endpoint)) return endpoint
  }
  for (const service of payload.services) {
    const endpoint = typeof service?.endpoint === 'string' ? service.endpoint.trim() : ''
    if (/^https?:\/\//i.test(endpoint)) return endpoint
  }
  return null
}

export async function readOnchainSnapshot(agentId: number): Promise<IdentitySnapshot> {
  const chainId = Number(process.env.ERC8004_AGENT_CHAIN_ID ?? '8453')
  const registryAddress = getAddress(getIdentityRegistryAddress())
  const chain = resolveChain(chainId)
  let rpcErrorCount = 0

  for (const rpcUrl of getRpcUrls()) {
    try {
      const client = createPublicClient({
        chain,
        transport: http(rpcUrl, { timeout: 12_000 }),
      })

      await client.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getVersion',
      })

      let ownerAddress: string | null = null
      let agentWallet: string | null = null
      let tokenUri: string | null = null

      try {
        const owner = await client.readContract({
          address: registryAddress,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'ownerOf',
          args: [BigInt(agentId)],
        })
        if (typeof owner === 'string' && isAddress(owner)) ownerAddress = getAddress(owner)
      } catch {
        // Best-effort only.
      }

      try {
        const wallet = await client.readContract({
          address: registryAddress,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'getAgentWallet',
          args: [BigInt(agentId)],
        })
        if (typeof wallet === 'string' && isAddress(wallet) && wallet.toLowerCase() !== ZERO_ADDRESS) {
          agentWallet = getAddress(wallet)
        }
      } catch {
        // Best-effort only.
      }

      try {
        const rawTokenUri = await client.readContract({
          address: registryAddress,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'tokenURI',
          args: [BigInt(agentId)],
        })
        tokenUri = typeof rawTokenUri === 'string' ? rawTokenUri : null
      } catch {
        // Best-effort only.
      }

      return {
        ownerAddress,
        agentWallet,
        tokenUri,
        rpcErrorCount,
        agentRegistered: Boolean(ownerAddress || tokenUri),
        registryAddress,
        chainId,
      }
    } catch {
      rpcErrorCount += 1
    }
  }

  return {
    ownerAddress: null,
    agentWallet: null,
    tokenUri: null,
    rpcErrorCount,
    agentRegistered: false,
    registryAddress,
    chainId,
  }
}

function buildChecks(params: {
  identity: IdentitySnapshot
  registration: RegistrationProbe
  endpoint: EndpointProbe
}): Array<{ id: string; passed: boolean; detail: string }> {
  const { identity, registration, endpoint } = params
  return [
    {
      id: 'onchain-registration',
      passed: identity.agentRegistered,
      detail: identity.agentRegistered
        ? 'Agent is present in the ERC-8004 identity registry.'
        : 'Agent could not be confirmed onchain from ownerOf/tokenURI lookups.',
    },
    {
      id: 'registration-payload',
      passed: registration.valid,
      detail: registration.valid
        ? `Registration payload is reachable and exposes ${registration.serviceCount} service${registration.serviceCount === 1 ? '' : 's'}.`
        : registration.error || 'Registration payload is missing or invalid.',
    },
    {
      id: 'agent-wallet',
      passed: Boolean(identity.agentWallet),
      detail: identity.agentWallet
        ? `Agent wallet is bound onchain at ${identity.agentWallet}.`
        : 'No non-zero agent wallet is currently bound onchain.',
    },
    {
      id: 'service-availability',
      passed: endpoint.ok,
      detail: endpoint.ok
        ? `Endpoint responded successfully${endpoint.status ? ` with ${endpoint.status}` : ''}.`
        : endpoint.error || 'No public endpoint passed the availability probe.',
    },
    {
      id: 'discoverability',
      passed: registration.valid && Boolean(registration.active) && registration.serviceCount >= 2,
      detail: registration.valid && Boolean(registration.active) && registration.serviceCount >= 2
        ? 'Registration is active and exposes multiple public services.'
        : 'Registration is either inactive, too sparse, or not yet fully discoverable.',
    },
  ]
}

function scoreFromChecks(checks: Array<{ passed: boolean }>): {
  value: string
  valueDecimals: number
  numericValue: number
  label: string
} {
  const passedCount = checks.filter((entry) => entry.passed).length
  const numericValue = Math.max(1, Math.min(5, 1 + passedCount))
  let label = 'Needs Work'
  if (numericValue >= 5) label = 'Excellent'
  else if (numericValue >= 4) label = 'Strong'
  else if (numericValue >= 3) label = 'Promising'
  return {
    value: String(numericValue),
    valueDecimals: 0,
    numericValue,
    label,
  }
}

function buildReasoning(params: {
  registration: RegistrationProbe
  endpoint: EndpointProbe
  reputation: Erc8004TechnicalReview['reputation']
  score: Erc8004TechnicalReview['score']
}): string {
  const fragments = [
    `Paid ERC-8004 review generated by 4626. Final technical score: ${params.score.value}/5 (${params.score.label}).`,
    params.registration.valid
      ? `Registration metadata is reachable${params.registration.finalUrl ? ` at ${params.registration.finalUrl}` : ''} and exposes ${params.registration.serviceCount} public service${params.registration.serviceCount === 1 ? '' : 's'}.`
      : `Registration metadata could not be validated${params.registration.error ? `: ${params.registration.error}.` : '.'}`,
    params.endpoint.ok
      ? `Primary endpoint probe succeeded${params.endpoint.status ? ` with HTTP ${params.endpoint.status}` : ''}.`
      : `Primary endpoint probe failed${params.endpoint.error ? `: ${params.endpoint.error}.` : '.'}`,
    params.reputation.totalFeedback > 0
      ? `Existing onchain reputation is ${params.reputation.label} across ${params.reputation.totalFeedback} feedback entr${params.reputation.totalFeedback === 1 ? 'y' : 'ies'}.`
      : 'No prior onchain feedback was detected, so this review is based on live registration and service checks.',
    'Payment purchased evaluation and artifact generation only; it did not guarantee a positive score.',
  ]
  return fragments.join(' ')
}

export async function buildErc8004TechnicalReview(params: {
  agentId: number
  registrationUrl?: string
  endpoint?: string
}): Promise<Erc8004TechnicalReview> {
  const agentId = params.agentId
  const identity = await readOnchainSnapshot(agentId)
  const registrationSource = params.registrationUrl?.trim()
    ? { source: 'provided' as const, rawUrl: params.registrationUrl.trim() }
    : identity.tokenUri?.trim()
      ? { source: 'onchain-token-uri' as const, rawUrl: identity.tokenUri.trim() }
      : { source: 'none' as const, rawUrl: null }

  const registrationFetch = registrationSource.rawUrl
    ? await fetchRegistrationPayload(registrationSource.rawUrl)
    : { payload: null, finalUrl: null, fetched: false, error: 'No registration URL available' }

  const registration: RegistrationProbe = {
    source: registrationSource.source,
    rawUrl: registrationSource.rawUrl,
    finalUrl: registrationFetch.finalUrl,
    fetched: registrationFetch.fetched,
    valid: isValidRegistrationPayload(registrationFetch.payload, agentId),
    name: typeof registrationFetch.payload?.name === 'string' ? registrationFetch.payload.name : null,
    serviceCount: Array.isArray(registrationFetch.payload?.services) ? registrationFetch.payload.services.length : 0,
    active: typeof registrationFetch.payload?.active === 'boolean' ? registrationFetch.payload.active : null,
    x402Support: typeof registrationFetch.payload?.x402Support === 'boolean' ? registrationFetch.payload.x402Support : null,
    payload: registrationFetch.payload,
    error: registrationFetch.error,
  }

  const endpointSource = params.endpoint?.trim()
    ? { source: 'provided' as const, url: params.endpoint.trim() }
    : { source: registration.valid ? 'registration' as const : 'none' as const, url: findEndpointFromRegistration(registration.payload) }

  const endpointProbe = await probeEndpoint(endpointSource.url ?? '')
  const endpoint: EndpointProbe = {
    ...endpointProbe,
    source: endpointSource.source,
  }

  const reputationGraph = await buildReputationGraph({
    agentId,
    includeRevoked: true,
  })

  const checks = buildChecks({ identity, registration, endpoint })
  const score = scoreFromChecks(checks)
  const reasoning = buildReasoning({
    registration,
    endpoint,
    reputation: reputationGraph.summary,
    score,
  })
  const explorer = getExplorerBaseUrl(identity.chainId)

  return {
    agentId,
    scanUrl: `https://www.8004scan.io/agents/base/${agentId}`,
    identity: {
      ...identity,
      links: {
        registry: `${explorer}/address/${identity.registryAddress}`,
        token: `${explorer}/token/${identity.registryAddress}?a=${agentId}`,
        ownerAddress: identity.ownerAddress ? `${explorer}/address/${identity.ownerAddress}` : null,
        agentWallet: identity.agentWallet ? `${explorer}/address/${identity.agentWallet}` : null,
      },
    },
    registration,
    endpoint,
    reputation: {
      totalFeedback: reputationGraph.summary.totalFeedback,
      totalReviewers: reputationGraph.summary.totalReviewers,
      averageValue: reputationGraph.summary.averageValue,
      averageValueDecimals: reputationGraph.summary.averageValueDecimals,
      label: reputationGraph.summary.label,
    },
    checks,
    score,
    reasoning,
    generatedAt: new Date().toISOString(),
    source: 'erc8004.paid.review.v1',
  }
}
