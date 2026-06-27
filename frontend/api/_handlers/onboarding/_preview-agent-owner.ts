/**
 * POST /api/onboarding/preview-agent-owner
 *
 * UNAUTHENTICATED companion to `/api/onboarding/provision-agent-owner`.
 *
 * Designed to be called from a Zora content-coin iframe (sandboxed,
 * `allow-same-origin` disabled), which cannot carry a Privy auth token.
 * Instead of session auth we gate access by ownership proof:
 * - EOA-owner path: caller supplies `(cswAddress, connectedEoa)` where
 *   `connectedEoa` is a current owner of `cswAddress`.
 * - CSW-self path: caller supplies `connectedEoa == cswAddress` plus an
 *   ERC-1271 signature proof over a short-lived deterministic message.
 *
 * If neither proof path validates, we refuse to provision a Privy agent wallet.
 *
 * Because the Zora iframe's Origin header is literally the string "null",
 * we serve permissive CORS (`Access-Control-Allow-Origin: *`) without
 * credentials. This endpoint carries no cookies or auth tokens, so there
 * is nothing to leak cross-origin. It is a read-through to on-chain state
 * plus a deterministic Privy wallet lookup (idempotency key = CSW address).
 *
 * Response shape mirrors the authenticated variant so the client-side
 * install flow can be shared:
 *   { alreadyOwner: true, agentWalletAddress }
 *   OR
 *   { alreadyOwner: false, agentWalletAddress, txRequest }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, hashMessage, http, getAddress, type Address, type Hex, type PublicClient } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  setNoStore,
  readJsonBody,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import {
  prepareAddOwnerTx,
  isOwner as isOwnerOnChain,
} from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'
import { createAgentWallet } from '../../../server/_lib/wallet/privyWalletApi.js'
import { resolveServerBaseRpcUrl } from '../../../server/_lib/onchain/baseRpcUrl.js'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const HEX_RE = /^0x[0-9a-fA-F]+$/
// Body holds two addresses plus an optional ownership proof (a short message
// + ERC-1271 signature). 8 KiB is comfortably above the worst-case payload
// (proof message capped at 1024 chars + a signature of a few hundred bytes)
// while still rejecting obviously hostile bodies.
const PREVIEW_AGENT_OWNER_BODY_MAX_BYTES = 8 * 1024
const MAX_PROOF_MESSAGE_LENGTH = 1_024
const OWNERSHIP_PROOF_TTL_MS = 10 * 60_000
const OWNERSHIP_PROOF_MAX_FUTURE_SKEW_MS = 2 * 60_000
const EIP1271_MAGIC_VALUE = '0x1626ba7e'
const EIP1271_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

type OwnershipProof = {
  issuedAtMs: number
  message: string
  signature: Hex
}

type PreviewResponse =
  | { alreadyOwner: true; agentWalletAddress: string }
  | {
      alreadyOwner: false
      agentWalletAddress: string
      txRequest: ReturnType<typeof prepareAddOwnerTx>
    }

/**
 * Permissive CORS for a public, no-credentials endpoint that must be
 * reachable from sandboxed iframes whose Origin is "null".
 */
function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function normalizeAddressOrThrow(raw: unknown, field: string): Address {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!ADDRESS_RE.test(value)) {
    throw Object.assign(new Error(`Invalid ${field} address`), { statusCode: 400 })
  }
  return getAddress(value) as Address
}

function normalizeHexSignatureOrThrow(raw: unknown): Hex {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!HEX_RE.test(value) || value.length < 4 || value.length % 2 !== 0) {
    throw Object.assign(new Error('Invalid ownership proof signature'), { statusCode: 400 })
  }
  return value as Hex
}

function readOwnershipProofOrThrow(raw: unknown): OwnershipProof {
  if (!raw || typeof raw !== 'object') {
    throw Object.assign(new Error('Missing ownership proof'), { statusCode: 400 })
  }
  const proof = raw as Record<string, unknown>
  const issuedAtMs = Number(proof.issuedAtMs)
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) {
    throw Object.assign(new Error('Invalid ownership proof issuedAtMs'), { statusCode: 400 })
  }
  const message = typeof proof.message === 'string' ? proof.message.trim() : ''
  if (!message || message.length > MAX_PROOF_MESSAGE_LENGTH) {
    throw Object.assign(new Error('Invalid ownership proof message'), { statusCode: 400 })
  }
  const signature = normalizeHexSignatureOrThrow(proof.signature)
  return { issuedAtMs: Math.floor(issuedAtMs), message, signature }
}

function buildOwnershipProofMessage(params: {
  cswAddress: Address
  connectedAddress: Address
  issuedAtMs: number
}): string {
  return [
    '4626 onboarding owner preview',
    `chainId:8453`,
    `csw:${params.cswAddress.toLowerCase()}`,
    `connected:${params.connectedAddress.toLowerCase()}`,
    `issuedAtMs:${params.issuedAtMs}`,
  ].join('\n')
}

function validateOwnershipProofFreshnessOrThrow(issuedAtMs: number) {
  const now = Date.now()
  if (issuedAtMs > now + OWNERSHIP_PROOF_MAX_FUTURE_SKEW_MS) {
    throw Object.assign(new Error('Ownership proof issuedAtMs is in the future'), { statusCode: 400 })
  }
  if (now - issuedAtMs > OWNERSHIP_PROOF_TTL_MS) {
    throw Object.assign(new Error('Ownership proof expired. Sign a fresh proof and retry.'), { statusCode: 400 })
  }
}

async function verifyEip1271OwnershipProof(params: {
  publicClient: Pick<PublicClient, 'readContract'>
  cswAddress: Address
  connectedAddress: Address
  proof: OwnershipProof
}): Promise<boolean> {
  validateOwnershipProofFreshnessOrThrow(params.proof.issuedAtMs)
  const expected = buildOwnershipProofMessage({
    cswAddress: params.cswAddress,
    connectedAddress: params.connectedAddress,
    issuedAtMs: params.proof.issuedAtMs,
  })
  if (params.proof.message !== expected) {
    throw Object.assign(
      new Error('Ownership proof message mismatch. Build the proof using the documented 4626 message template.'),
      { statusCode: 400 },
    )
  }
  const digest = hashMessage(params.proof.message)
  const magic = await params.publicClient.readContract({
    address: params.cswAddress,
    abi: EIP1271_ABI,
    functionName: 'isValidSignature',
    args: [digest, params.proof.signature],
  })
  return String(magic).toLowerCase() === EIP1271_MAGIC_VALUE
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate-limit aggressively: this endpoint can trigger Privy wallet creation
  // and we do not want arbitrary IPs to spam CSW addresses.
  const limiter = await checkDurableRateLimit(
    rateLimitKey('onboarding-preview-agent-owner', getClientIp(req)),
    RATE_LIMITS.cswLink,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let parsedBody: Record<string, unknown>
  try {
    parsedBody = (await readJsonBody(req, { maxBytes: PREVIEW_AGENT_OWNER_BODY_MAX_BYTES })) as Record<string, unknown>
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  let cswAddress: Address
  let connectedAddress: Address
  let ownershipProof: OwnershipProof | null = null
  try {
    cswAddress = normalizeAddressOrThrow(parsedBody.cswAddress, 'cswAddress')
    connectedAddress = normalizeAddressOrThrow(
      parsedBody.connectedEoa ?? parsedBody.connectedAddress,
      'connectedEoa',
    )
    if (parsedBody.ownershipProof !== undefined) {
      ownershipProof = readOwnershipProofOrThrow(parsedBody.ownershipProof)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid input'
    return res.status(400).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }

  // 1. Gate on ownership proof:
  //    - EOA-owner path (on-chain owner scan), or
  //    - CSW-self ERC-1271 proof path when connectedAddress === cswAddress.
  //
  //    The caller must supply an address that is
  //    currently an owner of the CSW they want to extend. Without this
  //    check anyone could trigger Privy wallet provisioning for arbitrary
  //    CSW addresses they don't control.
  const publicClient = createPublicClient({
    chain: base,
    transport: http(resolveServerBaseRpcUrl()),
  })

  let connectedAddressIsOwner = false
  try {
    connectedAddressIsOwner = await isOwnerOnChain(publicClient, cswAddress, connectedAddress)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'On-chain lookup failed'
    // A revert here usually means the address is not a CoinbaseSmartWallet
    // (no isOwnerAddress selector). Surface as 400 so the client can
    // re-prompt for the correct address.
    return res.status(400).json({
      success: false,
      error: `Could not verify ownership on Base: ${message}. Confirm this is a Coinbase Smart Wallet address.`,
    } satisfies ApiEnvelope<never>)
  }
  if (!connectedAddressIsOwner) {
    const connectedIsCswSelf = connectedAddress.toLowerCase() === cswAddress.toLowerCase()
    if (!connectedIsCswSelf) {
      return res.status(403).json({
        success: false,
        error: 'Connected wallet is not an owner of this smart wallet. Connect an owner EOA or provide a CSW ownership proof.',
      } satisfies ApiEnvelope<never>)
    }
    if (!ownershipProof) {
      return res.status(403).json({
        success: false,
        error: 'CSW self-auth requires ownershipProof (ERC-1271 signature). Sign a fresh proof and retry.',
      } satisfies ApiEnvelope<never>)
    }
    try {
      const proofValid = await verifyEip1271OwnershipProof({
        publicClient,
        cswAddress,
        connectedAddress,
        proof: ownershipProof,
      })
      if (!proofValid) {
        return res.status(403).json({
          success: false,
          error: 'Invalid CSW ownership proof signature.',
        } satisfies ApiEnvelope<never>)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid ownership proof'
      const statusCode = typeof (err as { statusCode?: unknown })?.statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 400
      return res.status(statusCode).json({ success: false, error: message } satisfies ApiEnvelope<never>)
    }
  }

  // 2. Idempotent Privy agent-wallet lookup keyed on the CSW. Same CSW
  //    always resolves to the same agent wallet.
  let agentWallet: { walletId: string; address: `0x${string}` }
  try {
    agentWallet = await createAgentWallet({
      idempotencyKey: `agent-owner:${cswAddress.toLowerCase()}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Privy provisioning failed'
    const lower = message.toLowerCase()
    const status = lower.includes('not configured') ? 503 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }

  // 3. Short-circuit if the agent is already installed.
  let alreadyOwner = false
  try {
    alreadyOwner = await isOwnerOnChain(publicClient, cswAddress, agentWallet.address)
  } catch {
    // If the lookup fails transiently, treat as not-yet-owner so the
    // client can attempt the install (which will no-op on chain if it
    // turns out to already be set up).
    alreadyOwner = false
  }

  if (alreadyOwner) {
    return res.status(200).json({
      success: true,
      data: {
        alreadyOwner: true,
        agentWalletAddress: agentWallet.address,
      } satisfies PreviewResponse,
    } satisfies ApiEnvelope<PreviewResponse>)
  }

  const txRequest = prepareAddOwnerTx(cswAddress, agentWallet.address)
  return res.status(200).json({
    success: true,
    data: {
      alreadyOwner: false,
      agentWalletAddress: agentWallet.address,
      txRequest,
    } satisfies PreviewResponse,
  } satisfies ApiEnvelope<PreviewResponse>)
}
