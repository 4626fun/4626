import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { isAdminAddress } from '../../../server/_lib/session.js'
import { probeBankrCanonicalWalletMatch } from '../../../server/bankr/probe.js'

type BankrStatusResponse = {
  actorAddress: string
  actorSource: 'session' | 'siwa'
  canonicalWallet: string | null
  probe: {
    configured: boolean
    walletMatch: boolean
    reason: string
    expectedCanonical: string
    signerWallet: string | null
    bankrEvmWallet: string | null
    bankrEvmWallets: string[]
    bankrError: string | null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = readRequestPrincipal(req)
  if (!principal) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = principal.address.toLowerCase()
  if (!isAdminAddress(principalAddress as `0x${string}`)) {
    return res.status(403).json({ success: false, error: 'Admin authorization required' } satisfies ApiEnvelope<never>)
  }

  const canonicalWallet = await resolveCanonicalSmartWalletAddress(principalAddress)
  const probe = await probeBankrCanonicalWalletMatch({
    canonicalWallet,
    signerWallet: principalAddress,
  })

  return res.status(200).json({
    success: true,
    data: {
      actorAddress: principalAddress,
      actorSource: principal.source,
      canonicalWallet: canonicalWallet ?? null,
      probe,
    } satisfies BankrStatusResponse,
  } satisfies ApiEnvelope<BankrStatusResponse>)
}
