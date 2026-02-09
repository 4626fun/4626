import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'
import path from 'node:path'

import { getCanonicalOrigin } from '../server/_lib/origin.js'

declare const process: { env: Record<string, string | undefined>; cwd: () => string }

type RegistrationService = {
  name: string
  endpoint: string
  version?: string
  [key: string]: unknown
}

type RegistrationFile = {
  type?: string
  name?: string
  description?: string
  image?: string
  services?: RegistrationService[]
  x402Support?: boolean
  active?: boolean
  registrations?: Array<{ agentId: number; agentRegistry: string }>
  supportedTrust?: string[]
  [key: string]: unknown
}

const REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1'

const fallbackRegistration: RegistrationFile = {
  type: REGISTRATION_TYPE,
  name: 'CreatorVault Agent',
  description: 'Agent API for CreatorVault on Base.',
  image: 'https://4626.fun/miniapp-icon.png',
  services: [
    { name: 'web', endpoint: 'https://4626.fun' },
    { name: 'api', endpoint: 'https://4626.fun/api/v1/spec.json', version: '1.0.0' },
  ],
  x402Support: false,
  active: true,
  registrations: [
    {
      agentId: 0,
      agentRegistry: 'eip155:8453:0x0000000000000000000000000000000000000000',
    },
  ],
  supportedTrust: ['reputation', 'crypto-economic', 'tee-attestation'],
}

const registrationPaths = [
  path.join(process.cwd(), 'public', '.well-known', 'agent-registration.json'),
  path.join(process.cwd(), '..', 'public', '.well-known', 'agent-registration.json'),
  path.join(process.cwd(), 'frontend', 'public', '.well-known', 'agent-registration.json'),
]

function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

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

function normalizeOrigin(req: VercelRequest): string {
  try {
    return getCanonicalOrigin(req)
  } catch {
    return 'https://4626.fun'
  }
}

function normalizeUrl(value: string, origin: string): string {
  const v = value.trim()
  if (!v) return origin
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('ipfs://') || v.startsWith('data:')) return v
  if (v.startsWith('/')) return `${origin}${v}`
  return v
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

  let agentId = Number(agentIdRaw)
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

function sendRegistration(res: VercelResponse, payload: RegistrationFile) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = 200
  res.end(JSON.stringify(payload, null, 2))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  setPublicCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const origin = normalizeOrigin(req)
  const base = readRegistrationFromEnv() ?? readRegistrationFromDisk() ?? fallbackRegistration
  const registryConfig = readRegistryConfig(base)
  if ('error' in registryConfig) {
    return res.status(503).json({
      success: false,
      error: registryConfig.error,
      missing: registryConfig.missing,
    })
  }

  const name = (process.env.ERC8004_AGENT_NAME || '').trim() || base.name || 'CreatorVault Agent'
  const description =
    (process.env.ERC8004_AGENT_DESCRIPTION || '').trim() || base.description || 'Agent API for CreatorVault on Base.'
  const imageRaw = (process.env.ERC8004_AGENT_IMAGE_URL || '').trim() || base.image || `${origin}/miniapp-icon.png`

  const servicesOverride = parseServicesFromEnv(process.env.ERC8004_AGENT_SERVICES_JSON || '')
  const servicesBase = Array.isArray(base.services) && base.services.length > 0 ? base.services : null
  const services = (servicesOverride ?? servicesBase ?? [
    { name: 'web', endpoint: `${origin}/` },
    { name: 'api', endpoint: `${origin}/api/v1/spec.json`, version: '1.0.0' },
  ])
    .filter((service) => service && typeof service === 'object')
    .map((service) => ({
      ...service,
      name: String(service.name ?? '').trim(),
      endpoint: normalizeUrl(String(service.endpoint ?? ''), origin),
    }))
    .filter((service) => service.name && service.endpoint)

  const supportedTrustRaw = process.env.ERC8004_AGENT_SUPPORTED_TRUST
  const supportedTrust =
    supportedTrustRaw && supportedTrustRaw.trim()
      ? parseSupportedTrust(supportedTrustRaw)
      : Array.isArray(base.supportedTrust)
        ? base.supportedTrust.filter((entry) => typeof entry === 'string')
        : []

  const payload: RegistrationFile = {
    ...base,
    type: REGISTRATION_TYPE,
    name,
    description,
    image: normalizeUrl(imageRaw, origin),
    services,
    x402Support: typeof base.x402Support === 'boolean' ? base.x402Support : false,
    active: typeof base.active === 'boolean' ? base.active : true,
    registrations: [
      {
        agentId: registryConfig.agentId,
        agentRegistry: registryConfig.agentRegistry,
      },
    ],
    supportedTrust,
  }

  sendRegistration(res, payload)
}
