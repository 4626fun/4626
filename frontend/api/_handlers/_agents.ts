import type { VercelRequest, VercelResponse } from '@vercel/node'

import { guardAgentApiRequest } from '../server/_lib/agentApiGuard.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`)
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

function normalizeOrigin(req: VercelRequest): string {
  const explicit = (process.env.CANONICAL_ORIGIN ?? '').trim()
  if (explicit) return explicit

  const vercelUrl = (process.env.VERCEL_URL ?? '').trim()
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, '')}`

  const proto = String(req.headers['x-forwarded-proto'] ?? 'https').toLowerCase()
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').trim()
  if (host) {
    const safeProto = proto.startsWith('https') ? 'https' : 'http'
    return `${safeProto}://${host}`
  }

  return 'https://4626.fun'
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parseSupportedTrust(raw: string | undefined): string[] {
  if (!raw) return ['reputation', 'crypto-economic', 'tee-attestation']
  const entries = raw
    .split(/[\s,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
  return entries.length > 0 ? entries : ['reputation', 'crypto-economic', 'tee-attestation']
}

function getErc8004Meta(req: VercelRequest): {
  agentRegistry: string
  agentId: number
  chainId: number
  registrationUrl: string
  supportedTrust: string[]
} | null {
  const registry = (process.env.ERC8004_AGENT_REGISTRY ?? '').trim()
  const chainIdRaw = (process.env.ERC8004_AGENT_CHAIN_ID ?? '').trim()
  const agentIdRaw = (process.env.ERC8004_AGENT_ID ?? '').trim()
  if (!registry || !chainIdRaw || !agentIdRaw) return null
  if (!isAddressLike(registry)) return null

  const chainId = Number(chainIdRaw)
  const agentId = Number(agentIdRaw)
  if (!Number.isFinite(chainId) || chainId <= 0) return null
  if (!Number.isFinite(agentId) || agentId < 0 || Math.floor(agentId) !== agentId) return null

  const origin = normalizeOrigin(req)
  const agentRegistry = `eip155:${chainId}:${registry.toLowerCase()}`
  const registrationUrl = `${origin}/.well-known/agent-registration.json`
  const supportedTrust = parseSupportedTrust(process.env.ERC8004_AGENT_SUPPORTED_TRUST)

  return { agentRegistry, agentId, chainId, registrationUrl, supportedTrust }
}

/**
 * GET /api/agents
 *
 * Directory-compatible agent listing endpoint (XMTP Agent Directory shape).
 * If XMTP_AGENT_ADDRESS is configured, returns a single CreatorVault agent entry.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'agents', kind: 'read' })
  if (!g.ok) return

  const addr = (process.env.XMTP_AGENT_ADDRESS ?? '').trim()
  const agentAddress = isAddressLike(addr) ? (addr.toLowerCase() as `0x${string}`) : null

  const agents = agentAddress
    ? [
        {
          agentName: 'CreatorVault',
          agentAddress,
          agentWebsite: 'https://4626.fun',
          agentCategories: ['defi', 'analytics', 'governance', 'lottery'],
          status: 'unknown',
          lastChecked: '',
        },
      ]
    : []

  const erc8004 = getErc8004Meta(req)
  const byo = {
    registrationUrlTemplate: 'https://{your-domain}/.well-known/agent-registration.json',
    agentUriHint: 'Use an IPFS or data: URI (content-addressed) for agentURI when registering your agent.',
    requiredFields: ['type', 'name', 'description', 'image', 'services', 'x402Support', 'active', 'registrations'],
    specUrl: 'https://eips.ethereum.org/EIPS/eip-8004',
  }

  setCache(res, 60)
  const payload: Record<string, unknown> = {
    success: true,
    count: agents.length,
    agents,
    byo,
  }
  if (erc8004) payload.erc8004 = erc8004
  return res.status(200).json(payload)
}

