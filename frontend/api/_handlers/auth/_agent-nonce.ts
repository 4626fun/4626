import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  createSIWANonce } from '@buildersgarden/siwa'
import { createPublicClient,
  http } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipal,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'

import { ensureSiwaNonceSchema, isAddressLike, parseAgentRegistryRef, storeSiwaNonce } from '../../../server/auth/_siwa.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { getIdentityRegistryAddress } from '../../../server/_lib/erc8004.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'



declare const process: { env: Record<string, string | undefined> }

type AgentNonceBody = {
  agentId?: number | string
  agentRegistry?: string
  ownerAddress?: string
}

type AgentNonceResponse = {
  nonce: string
  issuedAt: string
  expirationTime: string
  domain: string
  uri: string
  chainId: number
  agentId: number
  agentRegistry: string
  ownerAddress: string
}

const AGENT_NONCE_BODY_MAX_BYTES = 16_384

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function parseAgentId(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || Math.floor(n) !== n || n < 0) return null
  return n
}

function getDefaultAgentRegistry(): string {
  const chainId = Number(process.env.ERC8004_AGENT_CHAIN_ID ?? 8453)
  const safeChainId = Number.isFinite(chainId) && chainId > 0 ? Math.floor(chainId) : 8453
  return `eip155:${safeChainId}:${getIdentityRegistryAddress().toLowerCase()}`
}

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return 'https://mainnet.base.org'
  const first = raw.split(/[\s,]+/g).map((part) => part.trim()).filter(Boolean)[0]
  return first || 'https://mainnet.base.org'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('auth-agent-nonce', getClientIp(req)),
    RATE_LIMITS.authAgentWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: AGENT_NONCE_BODY_MAX_BYTES })) as AgentNonceBody
  const agentId = parseAgentId(body.agentId)
  if (agentId === null) {
    return res.status(400).json({ success: false, error: 'agentId is required (non-negative integer)' } satisfies ApiEnvelope<never>)
  }

  const registryRaw = typeof body.agentRegistry === 'string' && body.agentRegistry.trim()
    ? body.agentRegistry.trim()
    : getDefaultAgentRegistry()
  const registryRef = parseAgentRegistryRef(registryRaw)
  if (!registryRef) {
    return res.status(400).json({ success: false, error: 'agentRegistry must use eip155:<chainId>:<address>' } satisfies ApiEnvelope<never>)
  }

  const ownerInput = typeof body.ownerAddress === 'string' ? body.ownerAddress.trim().toLowerCase() : ''
  if (ownerInput && !isAddressLike(ownerInput)) {
    return res.status(400).json({ success: false, error: 'ownerAddress must be a valid address' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'SIWA nonce service unavailable' } satisfies ApiEnvelope<never>)
  }

  let ownerAddress = ownerInput
  const principal = readRequestPrincipal(req, { lowercase: false })
  const principalAddress = principal?.address ?? ''
  if (!ownerAddress && principalAddress) {
    const canonicalForPrincipal = await resolveCanonicalSmartWalletAddress(principalAddress)
    ownerAddress = canonicalForPrincipal ?? ''
  }
  if (!ownerAddress) {
    return res.status(400).json({
      success: false,
      error: 'ownerAddress is required (or authenticate with a canonical wallet principal first)',
    } satisfies ApiEnvelope<never>)
  }

  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl(), { timeout: 12_000 }),
  })

  const canonicalOwner = await resolveCanonicalSmartWalletAddress(ownerAddress)
  let validatedOwnerAddress = ''
  if (canonicalOwner && canonicalOwner.toLowerCase() === ownerAddress.toLowerCase()) {
    validatedOwnerAddress = canonicalOwner.toLowerCase()
  } else {
    const principalLower = String(principalAddress || '').trim().toLowerCase()
    const ownerLower = ownerAddress.toLowerCase()
    const principalCanControlOwner =
      isAddressLike(principalLower) &&
      (principalLower === ownerLower ||
        (await client
          .readContract({
            address: ownerLower as `0x${string}`,
            abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
            functionName: 'isOwnerAddress',
            args: [principalLower as `0x${string}`],
          })
          .then((v) => v === true)
          .catch(() => false)))
    if (principalCanControlOwner) {
      validatedOwnerAddress = ownerLower
    }
  }
  if (!validatedOwnerAddress) {
    return res.status(403).json({
      success: false,
      error: 'ownerAddress must be a verified canonical smart wallet (or controlled by the authenticated owner)',
    } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureSiwaNonceSchema(db as any)
  } catch {
    return res.status(503).json({ success: false, error: 'SIWA nonce service unavailable' } satisfies ApiEnvelope<never>)
  }

  const nonceResult = await createSIWANonce(
    { address: validatedOwnerAddress, agentId, agentRegistry: registryRaw.toLowerCase() },
    client as any,
  )

  if (nonceResult.status !== 'nonce_issued') {
    return res.status(403).json({
      success: false,
      error: nonceResult.error || 'Agent nonce rejected',
      data: nonceResult,
    } satisfies ApiEnvelope<unknown>)
  }

  try {
    await storeSiwaNonce(db as any, {
      nonce: nonceResult.nonce,
      agentId,
      agentRegistry: registryRaw,
      ownerAddress: validatedOwnerAddress,
      expiresAt: new Date(nonceResult.expirationTime),
      createdByAddress: principal?.address ?? null,
    })
  } catch {
    return res.status(503).json({ success: false, error: 'SIWA nonce service unavailable' } satisfies ApiEnvelope<never>)
  }

  let uri = ''
  try {
    uri = getCanonicalOrigin(req)
  } catch {
    return res.status(503).json({ success: false, error: 'Canonical origin is not configured' } satisfies ApiEnvelope<never>)
  }
  const domain = new URL(uri).host.toLowerCase()

  return res.status(200).json({
    success: true,
    data: {
      nonce: nonceResult.nonce,
      issuedAt: nonceResult.issuedAt,
      expirationTime: nonceResult.expirationTime,
      domain,
      uri,
      chainId: registryRef.chainId,
      agentId,
      agentRegistry: registryRaw.toLowerCase(),
      ownerAddress: validatedOwnerAddress,
    } satisfies AgentNonceResponse,
  } satisfies ApiEnvelope<AgentNonceResponse>)
}
