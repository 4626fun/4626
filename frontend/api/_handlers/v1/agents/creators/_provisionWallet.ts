/**
 * POST /api/v1/agents/creators/provision-wallet
 *
 * Provisions (or retrieves) a Privy server wallet that will act as the
 * server-side signer for a creator's CSW-based XMTP agent.
 *
 * The creator must add this wallet as an owner of their Coinbase Smart Wallet
 * so it can sign XMTP messages on behalf of the CSW.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import { resolveCanonicalSmartWalletAddress } from '../../../../../server/_lib/wallet/canonicalWalletResolver.js'
import { getOrCreateCreatorAgentWallet } from '../../../../../server/_lib/wallet/creatorAgentWallets.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SIWA-Receipt')
}

function setRetryAfterHeader(res: VercelResponse, resetAt: number) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
}

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

type RequestBody = {
  creatorAddress?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/creators/provision-wallet', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-agents-creators-provision-wallet', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentsWrite,
  )
  if (!limiter.allowed) {
    setRetryAfterHeader(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const principalAddress = g.auth?.address ? String(g.auth.address).toLowerCase() : ''
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required (session or SIWA receipt)' })
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) as RequestBody
  // The creator address defaults to the signed-in address.
  const requestedAddress = body.creatorAddress?.trim().toLowerCase() || principalAddress
  const canonicalForPrincipal = await resolveCanonicalSmartWalletAddress(principalAddress)
  const allowedTargets = new Set<string>([
    principalAddress,
    ...(canonicalForPrincipal ? [canonicalForPrincipal.toLowerCase()] : []),
  ])

  // Allow provisioning for:
  // - the signed-in address itself
  // - the signed-in address's canonical CSW (owner EOA flow)
  if (!allowedTargets.has(requestedAddress)) {
    return res.status(403).json({
      success: false,
      error: canonicalForPrincipal
        ? `Can only provision wallet for your own address or canonical smart wallet (${canonicalForPrincipal.toLowerCase()})`
        : 'Can only provision wallet for your own address',
    })
  }

  // Canonical CSW should be the stable wallet identity when known.
  const creatorAddress = canonicalForPrincipal?.toLowerCase() || requestedAddress

  try {
    // Use the creator's address as the idempotency key for the wallet
    const wallet = await getOrCreateCreatorAgentWallet({
      creatorToken: creatorAddress as `0x${string}`,
    })

    return res.status(200).json({
      success: true,
      data: {
        walletId: wallet.walletId,
        address: wallet.address,
      },
    })
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : 'Failed to provision wallet'
    const code = msg.includes('db_not_configured') ? 503 : 500
    return res.status(code).json({ success: false, error: msg })
  }
}
