import fs from 'node:fs'
import path from 'node:path'

export type RegistrationService = {
  name: string
  endpoint: string
  version?: string
  [key: string]: unknown
}

export type RegistrationFile = {
  type?: string
  name?: string
  description?: string
  image?: string
  services?: RegistrationService[]
  x402Support?: boolean
  active?: boolean
  registrations?: Array<{ agentId: number; agentRegistry: string }>
  reputationRegistry?: string
  supportedTrust?: string[]
  [key: string]: unknown
}

const REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1'
const SUPPORTED_ENDPOINT_PREFIXES = ['https://', 'http://', 'ipfs://', 'ar://', 'data:'] as const

const fallbackRegistration: RegistrationFile = {
  type: REGISTRATION_TYPE,
  name: '4626 Agent',
  description: 'Agent API for 4626 on Base. Reachable via XMTP messaging, REST API, and MCP tools. Provides vault management, wallet intelligence, ERC-8004 reputation queries, and keeper automation.',
  image: 'https://4626.fun/app-icon.png',
  services: [
    { name: 'web', endpoint: 'https://4626.fun' },
    {
      name: 'XMTP',
      endpoint: 'https://xmtp.chat/dm/0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
      version: 'production',
      address: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
      description: 'XMTP messaging endpoint — DM or group chat with the agent. Identity is a Coinbase Smart Wallet on Base (chain 8453).',
    },
    {
      name: 'agentWallet',
      endpoint: 'eip155:8453:0xab6d5c10b03300326cd7fab7267ae192842967b5',
      account: 'eip155:8453:0xab6d5c10b03300326cd7fab7267ae192842967b5',
    },
    { name: 'api', endpoint: 'https://4626.fun/api/v1/spec.json', version: '1.0.0' },
    { name: 'feedback', endpoint: 'https://4626.fun/api/v1/agents/feedback', version: '2.0' },
    { name: 'reputation-graph', endpoint: 'https://4626.fun/api/lens/reputation-graph', version: '1.0' },
    { name: 'feedback-payload', endpoint: 'https://4626.fun/api/lens/feedback-payload', version: '2.0' },
    { name: 'wallet-intelligence', endpoint: 'https://4626.fun/api/v1/agents/wallet-intelligence', version: '1.0' },
  ],
  x402Support: false,
  active: true,
  registrations: [
    {
      agentId: 2205,
      agentRegistry: 'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    },
  ],
  supportedTrust: ['reputation', 'crypto-economic', 'tee-attestation'],
}

const registrationPaths = [
  path.join(process.cwd(), 'public', '.well-known', 'agent-registration.json'),
  path.join(process.cwd(), '..', 'public', '.well-known', 'agent-registration.json'),
  path.join(process.cwd(), 'frontend', 'public', '.well-known', 'agent-registration.json'),
]

function parseRegistration(raw: string): RegistrationFile | null {
  try {
    const parsed = JSON.parse(raw) as RegistrationFile
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function readRegistrationFromEnv(): RegistrationFile | null {
  const raw = (process.env.ERC8004_AGENT_REGISTRATION_JSON || '').trim()
  if (!raw) return null
  return parseRegistration(raw)
}

function readRegistrationFromDisk(): RegistrationFile | null {
  for (const candidate of registrationPaths) {
    try {
      const body = fs.readFileSync(candidate, 'utf8')
      if (!body || !body.trim()) continue
      const parsed = parseRegistration(body)
      if (parsed) return parsed
    } catch {
      // Ignore missing path and try the next candidate.
    }
  }
  return null
}

function normalizeUrl(value: string, origin: string): string {
  const v = value.trim()
  if (!v) return origin
  if (SUPPORTED_ENDPOINT_PREFIXES.some((prefix) => v.startsWith(prefix))) return v
  if (v.startsWith('/')) return `${origin}${v}`
  return v
}

function isSupportedEndpointUri(value: string): boolean {
  return SUPPORTED_ENDPOINT_PREFIXES.some((prefix) => value.startsWith(prefix))
}

function parseServicesFromEnv(raw: string): RegistrationService[] | null {
  if (!raw.trim()) return null
  try {
    const parsed = JSON.parse(raw) as RegistrationService[]
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function parseSupportedTrust(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseBooleanFlag(raw: string | undefined): boolean | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return null
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parseAgentRegistryRef(value: string): { chainId: number; registryAddress: string } | null {
  const raw = value.trim()
  if (!raw) return null
  const match = raw.match(/^eip155:(\d+):(0x[a-fA-F0-9]{40})$/)
  if (!match) return null
  const chainId = Number(match[1])
  if (!Number.isFinite(chainId) || chainId <= 0) return null
  return { chainId, registryAddress: match[2].toLowerCase() }
}

function parseCaip10Account(value: string): { chainId: number; address: string } | null {
  const raw = value.trim()
  if (!raw) return null
  const match = raw.match(/^eip155:(\d+):(0x[a-fA-F0-9]{40})$/)
  if (!match) return null
  const chainId = Number(match[1])
  if (!Number.isFinite(chainId) || chainId <= 0) return null
  return { chainId, address: match[2] }
}

function addressExplorerUrl(chainId: number, address: string): string {
  const normalizedAddress = address.toLowerCase()
  if (chainId === 8453) return `https://basescan.org/address/${normalizedAddress}`
  if (chainId === 1) return `https://etherscan.io/address/${normalizedAddress}`
  return `https://etherscan.io/address/${normalizedAddress}`
}

function normalizeService(service: RegistrationService, origin: string): RegistrationService {
  const name = String(service.name ?? '').trim()
  const endpointRaw = String(service.endpoint ?? '').trim()
  const endpointNormalized = normalizeUrl(endpointRaw, origin)
  const normalized: RegistrationService = { ...service, name }

  if (isSupportedEndpointUri(endpointNormalized)) {
    normalized.endpoint = endpointNormalized
    return normalized
  }

  const xmtpMatch = endpointRaw.match(/^xmtp:\/\/(0x[a-fA-F0-9]{40})$/)
  if (xmtpMatch) {
    const address = xmtpMatch[1]
    normalized.endpoint = `https://xmtp.chat/dm/${address}`
    normalized.address = address
    return normalized
  }

  const accountRef = parseCaip10Account(endpointRaw)
  if (accountRef) {
    const caip10 = `eip155:${accountRef.chainId}:${accountRef.address.toLowerCase()}`
    normalized.endpoint = caip10
    normalized.account = caip10
    normalized.explorer = addressExplorerUrl(accountRef.chainId, accountRef.address)
    return normalized
  }

  // Keep the registration parser-safe when a custom URI scheme is provided.
  normalized.endpoint = `${origin}/`
  return normalized
}

function readRegistryConfig(base: RegistrationFile): {
  agentRegistry: string
  agentId: number
  chainId: number
  registryAddress: string
} | { error: string; missing: string[] } {
  const baseRegistrations = Array.isArray(base.registrations) ? base.registrations : []
  const fallbackRegistration = baseRegistrations.find((entry) => {
    if (!entry || typeof entry !== 'object') return false
    if (!Number.isInteger(entry.agentId) || entry.agentId < 0) return false
    return Boolean(parseAgentRegistryRef(String(entry.agentRegistry || '')))
  })
  const fallbackAgentRegistryRef = fallbackRegistration
    ? parseAgentRegistryRef(String(fallbackRegistration.agentRegistry || ''))
    : null

  const registryAddressRaw = (process.env.ERC8004_AGENT_REGISTRY || '').trim()
  const chainIdRaw = (process.env.ERC8004_AGENT_CHAIN_ID || '').trim()
  const agentIdRaw = (process.env.ERC8004_AGENT_ID || '').trim()
  const missing: string[] = []

  let registryAddress = registryAddressRaw
  if (!registryAddress) registryAddress = fallbackAgentRegistryRef?.registryAddress || ''
  if (!registryAddress) missing.push('ERC8004_AGENT_REGISTRY')

  let chainId = Number(chainIdRaw)
  if (!chainIdRaw) chainId = fallbackAgentRegistryRef?.chainId ?? NaN
  if (!Number.isFinite(chainId) || chainId <= 0) {
    if (!chainIdRaw) missing.push('ERC8004_AGENT_CHAIN_ID')
    else return { error: 'ERC8004_AGENT_CHAIN_ID must be a positive number.', missing: [] }
  }

  if (!isAddressLike(registryAddress)) {
    return { error: 'ERC8004_AGENT_REGISTRY must be a valid address.', missing: [] }
  }

  let agentId = agentIdRaw ? Number(agentIdRaw) : Number.NaN
  if (!agentIdRaw && fallbackRegistration) {
    agentId = Number(fallbackRegistration.agentId)
  }
  if (!Number.isFinite(agentId) || agentId < 0 || Math.floor(agentId) !== agentId) {
    if (!agentIdRaw) missing.push('ERC8004_AGENT_ID')
    else return { error: 'ERC8004_AGENT_ID must be a non-negative integer.', missing: [] }
  }

  if (missing.length > 0) {
    return { error: 'Missing ERC-8004 registry configuration.', missing }
  }

  const agentRegistry = `eip155:${chainId}:${registryAddress.toLowerCase()}`
  return { agentRegistry, agentId, chainId, registryAddress }
}

export function buildAgentRegistration(origin: string): {
  payload?: RegistrationFile
  error?: string
  missing?: string[]
} {
  const base = readRegistrationFromEnv() ?? readRegistrationFromDisk() ?? fallbackRegistration
  const registryConfig = readRegistryConfig(base)
  if ('error' in registryConfig) {
    return { error: registryConfig.error, missing: registryConfig.missing }
  }

  const name = (process.env.ERC8004_AGENT_NAME || '').trim() || base.name || '4626 Agent'
  const description =
    (process.env.ERC8004_AGENT_DESCRIPTION || '').trim() || base.description || 'Agent API for 4626 on Base.'
  const imageRaw = (process.env.ERC8004_AGENT_IMAGE_URL || '').trim() || base.image || `${origin}/app-icon.png`

  const servicesOverride = parseServicesFromEnv(process.env.ERC8004_AGENT_SERVICES_JSON || '')
  const servicesBase = Array.isArray(base.services) && base.services.length > 0 ? base.services : null
  const services = (servicesOverride ?? servicesBase ?? [
    { name: 'web', endpoint: `${origin}/` },
    { name: 'api', endpoint: `${origin}/api/v1/spec.json`, version: '1.0.0' },
  ])
    .filter((service) => service && typeof service === 'object')
    .map((service) => normalizeService(service, origin))
    .filter((service) => service.name && service.endpoint)

  const supportedTrustRaw = process.env.ERC8004_AGENT_SUPPORTED_TRUST
  const supportedTrust =
    supportedTrustRaw && supportedTrustRaw.trim()
      ? parseSupportedTrust(supportedTrustRaw)
      : Array.isArray(base.supportedTrust)
        ? base.supportedTrust.filter((entry) => typeof entry === 'string')
        : []

  // Reputation Registry reference (CAIP-10 format, same chain as identity registry)
  const reputationRegistryRaw = (process.env.ERC8004_REPUTATION_REGISTRY ?? '').trim()
  const reputationRegistryAddr = reputationRegistryRaw && isAddressLike(reputationRegistryRaw)
    ? reputationRegistryRaw.toLowerCase()
    : '0x8004baa17c55a88189ae136b182e5fda19de9b63'
  const reputationRegistry = `eip155:${registryConfig.chainId}:${reputationRegistryAddr}`

  // ---------------------------------------------------------------------------
  // Dynamic XMTP / agentWallet injection
  // ---------------------------------------------------------------------------
  // If XMTP_AGENT_CSW_ADDRESS is set, ensure the XMTP and agentWallet services
  // reflect the actual CSW address rather than a hardcoded value.
  const cswAddress = (process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim()
  const xmtpEnv = (process.env.XMTP_ENV ?? 'production').trim()

  if (cswAddress && isAddressLike(cswAddress)) {
    const xmtpEndpoint = `https://xmtp.chat/dm/${cswAddress}`
    const walletAccount = `eip155:${registryConfig.chainId}:${cswAddress.toLowerCase()}`
    const walletExplorer = addressExplorerUrl(registryConfig.chainId, cswAddress)

    // Upsert XMTP service
    const xmtpIdx = services.findIndex((s) => s.name === 'XMTP')
    const xmtpService: RegistrationService = {
      name: 'XMTP',
      endpoint: xmtpEndpoint,
      address: cswAddress,
      version: xmtpEnv,
      description: `XMTP messaging endpoint — DM or group chat with the agent. Identity is a Coinbase Smart Wallet on chain ${registryConfig.chainId}.`,
    }
    if (xmtpIdx >= 0) services[xmtpIdx] = xmtpService
    else services.splice(1, 0, xmtpService) // Insert after 'web'

    // Upsert agentWallet service
    const walletIdx = services.findIndex((s) => s.name === 'agentWallet')
    const walletService: RegistrationService = {
      name: 'agentWallet',
      endpoint: walletAccount,
      account: walletAccount,
      explorer: walletExplorer,
    }
    if (walletIdx >= 0) services[walletIdx] = walletService
    else services.splice(services.findIndex((s) => s.name === 'XMTP') + 1, 0, walletService)
  }


  const envX402Support = parseBooleanFlag(process.env.ERC8004_X402_SUPPORT)
  const x402Support =
    envX402Support ??
    (typeof base.x402Support === 'boolean' ? base.x402Support : false)

  const payload: RegistrationFile = {
    ...base,
    type: REGISTRATION_TYPE,
    name,
    description,
    image: normalizeUrl(imageRaw, origin),
    services,
    x402Support,
    active: typeof base.active === 'boolean' ? base.active : true,
    registrations: [
      {
        agentId: registryConfig.agentId,
        agentRegistry: registryConfig.agentRegistry,
      },
    ],
    reputationRegistry,
    supportedTrust,
  }

  return { payload }
}
