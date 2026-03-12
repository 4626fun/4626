import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base, mainnet } from 'viem/chains'

import { handleOptions } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import { buildAgentRegistration, type RegistrationFile } from '../../../../../server/_lib/agentRegistration.js'
import { IDENTITY_REGISTRY_ABI } from '../../../../../server/_lib/erc8004.js'
import { getCanonicalOrigin } from '../../../../../server/_lib/origin.js'
import { getTeeAttestationStatus } from '../../../../../server/_lib/teeAttestationGate.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type RegistrationRef = {
  chainId: number
  registryAddress: Address
}

type OnchainSnapshot = {
  ownerAddress: string | null
  agentWallet: string | null
  tokenUri: string | null
  diagnostics: string[]
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`)
}

function parseRegistrationRef(value: string): RegistrationRef | null {
  const raw = value.trim()
  const match = raw.match(/^eip155:(\d+):(0x[a-fA-F0-9]{40})$/)
  if (!match) return null
  const chainId = Number(match[1])
  if (!Number.isFinite(chainId) || chainId <= 0) return null
  return {
    chainId,
    registryAddress: getAddress(match[2]),
  }
}

function getExplorerBaseUrl(chainId: number): string {
  if (chainId === 1) return 'https://etherscan.io'
  return 'https://basescan.org'
}

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

function getRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  const fromEnv = raw
    .split(/[\s,]+/g)
    .map(normalizeRpcUrl)
    .filter((value): value is string => Boolean(value))
  const urls = fromEnv.length > 0 ? [...fromEnv, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
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

function parseAccountAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^eip155:\d+:(0x[a-fA-F0-9]{40})$/)
  if (!match || !isAddress(match[1])) return null
  return getAddress(match[1])
}

function readServiceAddress(service: Record<string, unknown>): string | null {
  const fromAccount = parseAccountAddress(service.account)
  if (fromAccount) return fromAccount
  const fromAddress = readAddressLike(service.address)
  if (fromAddress) return fromAddress
  return parseAddressFromText(service.endpoint)
}

function extractCanonicalCsw(payload: RegistrationFile): string | null {
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

function resolveChain(chainId: number) {
  return chainId === mainnet.id ? mainnet : base
}

async function readOnchainSnapshot(params: {
  chainId: number
  registryAddress: Address
  agentId: bigint
}): Promise<OnchainSnapshot> {
  const diagnostics: string[] = []
  const chain = resolveChain(params.chainId)

  for (const rpcUrl of getRpcUrls()) {
    try {
      const client = createPublicClient({
        chain,
        transport: http(rpcUrl, { timeout: 12_000 }),
      })

      await client.readContract({
        address: params.registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getVersion',
      })

      let ownerAddress: string | null = null
      let tokenUri: string | null = null
      let agentWallet: string | null = null

      try {
        const owner = await client.readContract({
          address: params.registryAddress,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'ownerOf',
          args: [params.agentId],
        })
        ownerAddress = readAddressLike(owner)
      } catch {
        // Not registered or unavailable on this chain state.
      }

      try {
        const wallet = await client.readContract({
          address: params.registryAddress,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'getAgentWallet',
          args: [params.agentId],
        })
        const normalized = readAddressLike(wallet)
        if (normalized && normalized.toLowerCase() !== ZERO_ADDRESS) {
          agentWallet = normalized
        }
      } catch {
        // Best effort only.
      }

      try {
        const rawTokenUri = await client.readContract({
          address: params.registryAddress,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'tokenURI',
          args: [params.agentId],
        })
        tokenUri = typeof rawTokenUri === 'string' ? rawTokenUri : null
      } catch {
        // Best effort only.
      }

      return { ownerAddress, agentWallet, tokenUri, diagnostics }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'rpc_unavailable'
      diagnostics.push(`rpc_failed:${msg}`)
      continue
    }
  }

  return {
    ownerAddress: null,
    agentWallet: null,
    tokenUri: null,
    diagnostics,
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

  const origin = (() => {
    try {
      return getCanonicalOrigin(req)
    } catch {
      return 'https://4626.fun'
    }
  })()

  const registration = buildAgentRegistration(origin)
  if (!registration.payload) {
    return res.status(503).json({
      success: false,
      error: registration.error || 'Missing ERC-8004 registry configuration.',
      missing: registration.missing ?? [],
    })
  }

  const primaryRegistration = Array.isArray(registration.payload.registrations)
    ? registration.payload.registrations[0]
    : null
  if (!primaryRegistration || typeof primaryRegistration.agentRegistry !== 'string') {
    return res.status(503).json({ success: false, error: 'Agent registration metadata is missing registrations[0].' })
  }

  const ref = parseRegistrationRef(primaryRegistration.agentRegistry)
  if (!ref) {
    return res.status(503).json({ success: false, error: 'Invalid agentRegistry reference in registration metadata.' })
  }

  const agentId = Number(primaryRegistration.agentId)
  if (!Number.isFinite(agentId) || agentId < 0 || Math.floor(agentId) !== agentId) {
    return res.status(503).json({ success: false, error: 'Invalid agentId in registration metadata.' })
  }

  const canonicalCsw = extractCanonicalCsw(registration.payload)
  const onchain = await readOnchainSnapshot({
    chainId: ref.chainId,
    registryAddress: ref.registryAddress,
    agentId: BigInt(agentId),
  })

  const explorer = getExplorerBaseUrl(ref.chainId)
  const walletBoundToCanonical = Boolean(
    canonicalCsw && onchain.agentWallet && canonicalCsw.toLowerCase() === onchain.agentWallet.toLowerCase(),
  )
  const agentRegistered = Boolean(onchain.ownerAddress || onchain.tokenUri)
  const teeAttestation = await getTeeAttestationStatus().catch(() => ({
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

  setCache(res, 30)
  return res.status(200).json({
    success: true,
    data: {
      chainId: ref.chainId,
      registryAddress: ref.registryAddress,
      agentId,
      canonicalCsw,
      ownerAddress: onchain.ownerAddress,
      agentWallet: onchain.agentWallet,
      tokenUri: onchain.tokenUri,
      agentRegistered,
      walletBoundToCanonical,
      teeAttestation,
      links: {
        registry: `${explorer}/address/${ref.registryAddress}`,
        token: `${explorer}/token/${ref.registryAddress}?a=${agentId}`,
        canonicalCsw: canonicalCsw ? `${explorer}/address/${canonicalCsw}` : null,
        ownerAddress: onchain.ownerAddress ? `${explorer}/address/${onchain.ownerAddress}` : null,
        agentWallet: onchain.agentWallet ? `${explorer}/address/${onchain.agentWallet}` : null,
      },
      diagnostics: onchain.diagnostics,
    },
  })
}
