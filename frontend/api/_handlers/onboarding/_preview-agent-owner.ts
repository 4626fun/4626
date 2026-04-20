/**
 * POST /api/onboarding/preview-agent-owner
 *
 * UNAUTHENTICATED companion to `/api/onboarding/provision-agent-owner`.
 *
 * Designed to be called from a Zora content-coin iframe (sandboxed,
 * `allow-same-origin` disabled), which cannot carry a Privy auth token.
 * Instead of session auth we gate access by an on-chain ownership check:
 * the caller must supply a `(cswAddress, connectedEoa)` pair where
 * `connectedEoa` is a current owner of `cswAddress`. If that check fails
 * we refuse to provision a Privy agent wallet.
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
import { createPublicClient, http, getAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  setNoStore,
  readJsonBody,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'
import {
  prepareAddOwnerTx,
  isOwner as isOwnerOnChain,
} from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'
import { createAgentWallet } from '../../../server/_lib/wallet/privyWalletApi.js'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

type PreviewResponse =
  | { alreadyOwner: true; agentWalletAddress: string }
  | {
      alreadyOwner: false
      agentWalletAddress: string
      txRequest: {
        chainId: 8453
        to: `0x${string}`
        data: `0x${string}`
        value: '0x0'
      }
    }

function resolveBaseRpcUrl(): string {
  const envUrl = (process.env.BASE_RPC_URL ?? '').trim()
  return envUrl || 'https://mainnet.base.org'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate-limit aggressively: this endpoint can trigger Privy wallet creation
  // and we do not want arbitrary IPs to spam CSW addresses.
  const limiter = checkRateLimit(
    rateLimitKey('onboarding-preview-agent-owner', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let parsedBody: Record<string, unknown>
  try {
    parsedBody = (await readJsonBody(req)) as Record<string, unknown>
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  let cswAddress: Address
  let connectedEoa: Address
  try {
    cswAddress = normalizeAddressOrThrow(parsedBody.cswAddress, 'cswAddress')
    connectedEoa = normalizeAddressOrThrow(parsedBody.connectedEoa, 'connectedEoa')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid input'
    return res.status(400).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }

  // 1. Gate on on-chain ownership: the caller must supply an EOA that is
  //    currently an owner of the CSW they want to extend. Without this
  //    check anyone could trigger Privy wallet provisioning for arbitrary
  //    CSW addresses they don't control.
  const publicClient = createPublicClient({
    chain: base,
    transport: http(resolveBaseRpcUrl()),
  })

  let eoaIsOwner = false
  try {
    eoaIsOwner = await isOwnerOnChain(publicClient, cswAddress, connectedEoa)
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
  if (!eoaIsOwner) {
    return res.status(403).json({
      success: false,
      error: 'Connected wallet is not an owner of this smart wallet. Connect the EOA you used to sign up for Zora.',
    } satisfies ApiEnvelope<never>)
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
