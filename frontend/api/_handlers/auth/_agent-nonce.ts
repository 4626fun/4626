import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createSIWANonce } from '@buildersgarden/siwa'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { ensureSiwaNonceSchema, isAddressLike, parseAgentRegistryRef, storeSiwaNonce } from '../../../server/auth/_siwa.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { getIdentityRegistryAddress } from '../../../server/_lib/erc8004.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'

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

function parseAgentId(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || Math.floor(n) !== n || n < 0) return null
  return n
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').split(',')[0]?.trim() ?? ''
}

function getRequestOrigin(req: VercelRequest): string {
  const protoRaw = firstHeaderValue(req.headers?.['x-forwarded-proto'])
  const hostRaw =
    firstHeaderValue(req.headers?.['x-forwarded-host']) || firstHeaderValue(req.headers?.host)
  const proto = protoRaw.toLowerCase().startsWith('https') ? 'https' : 'http'
  const host = hostRaw || 'localhost'
  return `${proto}://${host}`
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

  const body = (await readJsonBody<AgentNonceBody>(req)) ?? {}
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

  const canonicalOwner = await resolveCanonicalSmartWalletAddress(ownerAddress)
  if (!canonicalOwner || canonicalOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
    return res.status(403).json({
      success: false,
      error: 'ownerAddress must be a verified canonical smart wallet',
    } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureSiwaNonceSchema(db as any)
  } catch {
    return res.status(503).json({ success: false, error: 'SIWA nonce service unavailable' } satisfies ApiEnvelope<never>)
  }

  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl(), { timeout: 12_000 }),
  })

  const nonceResult = await createSIWANonce(
    { address: canonicalOwner, agentId, agentRegistry: registryRaw.toLowerCase() },
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
      ownerAddress: canonicalOwner,
      expiresAt: new Date(nonceResult.expirationTime),
      createdByAddress: principal?.address ?? null,
    })
  } catch {
    return res.status(503).json({ success: false, error: 'SIWA nonce service unavailable' } satisfies ApiEnvelope<never>)
  }

  const uri = getRequestOrigin(req)
  const domain = new URL(uri).host

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
      ownerAddress: canonicalOwner,
    } satisfies AgentNonceResponse,
  } satisfies ApiEnvelope<AgentNonceResponse>)
}
