import type { VercelRequest, VercelResponse } from '@vercel/node'

import { SIWAErrorCode, verifySIWA } from '@buildersgarden/siwa'
import { createPublicClient, http, recoverMessageAddress } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  hostMatchesDomain,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import {
  consumeSiwaNonce,
  createSiwaReceiptToken,
  ensureSiwaNonceSchema,
  getSiwaReceiptSecret,
  parseAgentRegistryRef,
  parseSiwaMessageSafe,
} from '../../../server/auth/_siwa.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { getIdentityRegistryAddress } from '../../../server/_lib/erc8004.js'
import { getDb } from '../../../server/_lib/postgres.js'

declare const process: { env: Record<string, string | undefined> }

type VerifyBody = {
  message?: string
  signature?: string
}

type AgentVerifyResponse = {
  address: string
  ownerAddress: string
  agentId: number
  agentRegistry: string
  chainId: number
  verified: 'offline' | 'onchain'
  receipt: string
  receiptExpiresAt: string
}

const OWNER_OF_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function getConfiguredChainId(): number {
  const raw = Number(process.env.ERC8004_AGENT_CHAIN_ID ?? 8453)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 8453
}

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return 'https://mainnet.base.org'
  const first = raw.split(/[\s,]+/g).map((part) => part.trim()).filter(Boolean)[0]
  return first || 'https://mainnet.base.org'
}

function statusForSiwaCode(code: SIWAErrorCode | undefined): number {
  if (!code) return 401
  if (
    code === SIWAErrorCode.INVALID_NONCE ||
    code === SIWAErrorCode.INVALID_REGISTRY_FORMAT ||
    code === SIWAErrorCode.DOMAIN_MISMATCH ||
    code === SIWAErrorCode.MESSAGE_EXPIRED ||
    code === SIWAErrorCode.MESSAGE_NOT_YET_VALID
  ) {
    return 400
  }
  if (code === SIWAErrorCode.NOT_OWNER || code === SIWAErrorCode.NOT_REGISTERED) return 403
  return 401
}

type ParsedSiwaMessage = NonNullable<ReturnType<typeof parseSiwaMessageSafe>>

type FallbackVerifyResult =
  | {
      valid: true
      address: string
      agentId: number
      agentRegistry: string
      chainId: number
      verified: 'onchain'
    }
  | { valid: false; code: SIWAErrorCode; error: string }

async function verifyCanonicalOwnerSiwaFallback(params: {
  parsed: ParsedSiwaMessage
  message: string
  signature: string
  client: any
  consumeNonce: () => Promise<boolean>
}): Promise<FallbackVerifyResult> {
  const address = String(params.parsed.address ?? '').trim().toLowerCase()
  if (!address) {
    return {
      valid: false,
      code: SIWAErrorCode.INVALID_SIGNATURE,
      error: 'Invalid signature',
    }
  }

  const contractVerified =
    typeof params.client?.verifyMessage === 'function'
      ? await params.client
          .verifyMessage({
            address: address as `0x${string}`,
            message: params.message,
            signature: params.signature as `0x${string}`,
          })
          .then((value: unknown) => value === true)
          .catch(() => false)
      : false

  if (!contractVerified) {
    let recoveredAddress = ''
    try {
      recoveredAddress = String(
        await recoverMessageAddress({
          message: params.message,
          signature: params.signature as `0x${string}`,
        }),
      ).toLowerCase()
    } catch {
      recoveredAddress = ''
    }

    if (!recoveredAddress) {
      return {
        valid: false,
        code: SIWAErrorCode.INVALID_SIGNATURE,
        error: 'Invalid signature',
      }
    }

    if (recoveredAddress !== address) {
      const delegatedOwnerValid = await params.client
        .readContract({
          address: address as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [recoveredAddress as `0x${string}`],
        })
        .then((value: unknown) => value === true)
        .catch(() => false)

      if (!delegatedOwnerValid) {
        return {
          valid: false,
          code: SIWAErrorCode.INVALID_SIGNATURE,
          error: 'Invalid signature',
        }
      }
    }
  }

  const nonceValid = await params.consumeNonce()
  if (!nonceValid) {
    return {
      valid: false,
      code: SIWAErrorCode.INVALID_NONCE,
      error: 'Invalid or consumed nonce',
    }
  }

  const now = new Date()
  if (params.parsed.expirationTime && now > new Date(params.parsed.expirationTime)) {
    return {
      valid: false,
      code: SIWAErrorCode.MESSAGE_EXPIRED,
      error: 'Message expired',
    }
  }
  if (params.parsed.notBefore && now < new Date(params.parsed.notBefore)) {
    return {
      valid: false,
      code: SIWAErrorCode.MESSAGE_NOT_YET_VALID,
      error: 'Message not yet valid (notBefore)',
    }
  }

  return {
    valid: true,
    address,
    agentId: params.parsed.agentId,
    agentRegistry: String(params.parsed.agentRegistry ?? '').toLowerCase(),
    chainId: params.parsed.chainId,
    verified: 'onchain',
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<VerifyBody>(req)) ?? {}
  const message = typeof body.message === 'string' ? body.message : ''
  const signature = typeof body.signature === 'string' ? body.signature : ''
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' } satisfies ApiEnvelope<never>)
  }

  const parsed = parseSiwaMessageSafe(message)
  if (!parsed) {
    return res.status(400).json({ success: false, error: 'Invalid SIWA message' } satisfies ApiEnvelope<never>)
  }

  const host = typeof req.headers?.host === 'string' ? req.headers.host : ''
  if (!hostMatchesDomain(host, parsed.domain)) {
    return res.status(400).json({ success: false, error: 'Domain mismatch' } satisfies ApiEnvelope<never>)
  }

  const registryRef = parseAgentRegistryRef(parsed.agentRegistry)
  if (!registryRef) {
    return res.status(400).json({ success: false, error: 'Invalid agentRegistry' } satisfies ApiEnvelope<never>)
  }

  const expectedChainId = getConfiguredChainId()
  if (parsed.chainId !== expectedChainId || registryRef.chainId !== expectedChainId) {
    return res.status(400).json({ success: false, error: 'Invalid chain for SIWA' } satisfies ApiEnvelope<never>)
  }

  const expectedRegistry = getIdentityRegistryAddress().toLowerCase()
  if (registryRef.registryAddress.toLowerCase() !== expectedRegistry) {
    return res.status(400).json({ success: false, error: 'Unsupported agent registry' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'SIWA verify service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureSiwaNonceSchema(db as any)
  } catch {
    return res.status(503).json({ success: false, error: 'SIWA verify service unavailable' } satisfies ApiEnvelope<never>)
  }

  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl(), { timeout: 12_000 }),
  })

  let nonceOwnerAddress: string | null = null
  let nonceConsumed = false
  let nonceValid = false
  const consumeNonceOnce = async (nonce: string): Promise<boolean> => {
    if (nonceConsumed) return nonceValid
    nonceConsumed = true
    const consumed = await consumeSiwaNonce(db as any, {
      nonce,
      agentId: parsed.agentId,
      agentRegistry: parsed.agentRegistry,
    })
    if (!consumed) {
      nonceValid = false
      return false
    }
    nonceOwnerAddress = consumed.ownerAddress
    nonceValid = true
    return true
  }

  let result = await verifySIWA(
    message,
    signature,
    parsed.domain,
    async (nonce: string) => {
      return consumeNonceOnce(nonce)
    },
    client as any,
  )

  if (!result.valid && result.code === SIWAErrorCode.INVALID_SIGNATURE) {
    result = await verifyCanonicalOwnerSiwaFallback({
      parsed,
      message,
      signature,
      client,
      consumeNonce: async () => consumeNonceOnce(parsed.nonce),
    })
  }

  if (!result.valid) {
    const reason = result.code ? `${result.code}: ${result.error || 'SIWA verification failed'}` : (result.error || 'SIWA verification failed')
    return res.status(statusForSiwaCode(result.code)).json({
      success: false,
      error: reason,
    } satisfies ApiEnvelope<never>)
  }

  let ownerAddress = ''
  try {
    ownerAddress = String(
      await client.readContract({
        address: registryRef.registryAddress as `0x${string}`,
        abi: OWNER_OF_ABI,
        functionName: 'ownerOf',
        args: [BigInt(parsed.agentId)],
      }),
    ).toLowerCase()
  } catch {
    return res.status(503).json({ success: false, error: 'Unable to resolve agent owner' } satisfies ApiEnvelope<never>)
  }

  const nonceOwnerLower = nonceOwnerAddress ? String(nonceOwnerAddress).toLowerCase() : ''
  if (nonceOwnerLower && String(result.address).toLowerCase() !== nonceOwnerLower) {
    return res.status(401).json({
      success: false,
      error: 'SIWA message address does not match nonce owner',
    } satisfies ApiEnvelope<never>)
  }
  if (nonceOwnerLower && nonceOwnerLower !== String(ownerAddress).toLowerCase()) {
    return res.status(401).json({
      success: false,
      error: 'Agent owner changed since nonce issuance',
    } satisfies ApiEnvelope<never>)
  }

  const canonicalOwner = await resolveCanonicalSmartWalletAddress(ownerAddress)
  const canonicalOwnerMatches =
    !!canonicalOwner && canonicalOwner.toLowerCase() === ownerAddress.toLowerCase()
  const nonceOwnerMatches = !!nonceOwnerLower && nonceOwnerLower === ownerAddress.toLowerCase()
  if (!canonicalOwnerMatches && !nonceOwnerMatches) {
    return res.status(403).json({
      success: false,
      error: 'Agent owner must be a verified canonical smart wallet',
    } satisfies ApiEnvelope<never>)
  }

  if (!getSiwaReceiptSecret()) {
    return res.status(503).json({
      success: false,
      error: 'SIWA receipt secret is not configured',
    } satisfies ApiEnvelope<never>)
  }

  const receiptResult = createSiwaReceiptToken({
    address: result.address.toLowerCase(),
    agentId: result.agentId,
    agentRegistry: result.agentRegistry.toLowerCase(),
    chainId: result.chainId,
    verified: result.verified,
  })
  if (!receiptResult) {
    return res.status(503).json({
      success: false,
      error: 'SIWA receipt issue failed',
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      address: result.address.toLowerCase(),
      ownerAddress,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry.toLowerCase(),
      chainId: result.chainId,
      verified: result.verified,
      receipt: receiptResult.receipt,
      receiptExpiresAt: receiptResult.expiresAt,
    } satisfies AgentVerifyResponse,
  } satisfies ApiEnvelope<AgentVerifyResponse>)
}
