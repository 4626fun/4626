import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipalAddress,
  resolveAuthorizedRequestPrincipal,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import { disconnectExternalWalletFromProfile } from '../../../server/_lib/wallet/disconnectExternalWallet.js'

type DisconnectExternalResponse = {
  clearedPrimaryWallet: boolean
  clearedProfileWalletRows: number
  nextPrimaryWallet: string | null
}

function readExternalAddress(req: VercelRequest): string | null {
  const body = (req.body ?? {}) as { address?: unknown; externalAddress?: unknown }
  const candidate =
    (typeof body.address === 'string' ? body.address : null) ??
    (typeof body.externalAddress === 'string' ? body.externalAddress : null)
  if (!candidate || !isAddress(candidate)) return null
  return candidate
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('wallet-disconnect-external', getClientIp(req)),
    RATE_LIMITS.cswLink,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const externalAddress = readExternalAddress(req)
  if (!externalAddress) {
    return res.status(400).json({ success: false, error: 'Missing or invalid external wallet address' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
    if (!authorizedPrincipal) {
      return res.status(403).json({
        success: false,
        error: 'Current session is not authorized for an active wallet profile',
      } satisfies ApiEnvelope<never>)
    }

    const result = await disconnectExternalWalletFromProfile({
      db: db as any,
      profileId: authorizedPrincipal.profileId,
      externalAddress,
    })

    return res.status(200).json({
      success: true,
      data: {
        clearedPrimaryWallet: result.clearedPrimaryWallet,
        clearedProfileWalletRows: result.clearedProfileWalletRows,
        nextPrimaryWallet: result.nextPrimaryWallet,
      },
    } satisfies ApiEnvelope<DisconnectExternalResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'cannot_disconnect_embedded_signer' || message === 'cannot_disconnect_canonical_csw') {
      return res.status(400).json({ success: false, error: message } satisfies ApiEnvelope<never>)
    }
    return res.status(500).json({ success: false, error: 'Failed to disconnect external wallet' } satisfies ApiEnvelope<never>)
  }
}
