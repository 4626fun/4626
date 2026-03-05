import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import {
  bootstrapCanonicalDelegationState,
  extractDelegationFlags,
} from '../../../server/_lib/canonicalCswDelegation.js'

type BootstrapResponse = {
  chainId: 8453
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  privyIsOwner: boolean
}

function resolveStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    lower.includes('missing privy auth token') ||
    lower.includes('invalid privy auth token') ||
    lower.includes('privy verification failed') ||
    lower.includes('jwt') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return 401
  }
  if (
    lower.includes('unable to resolve canonical zora smart wallet') ||
    lower.includes('no privy embedded eoa found')
  ) {
    return 409
  }
  if (lower.includes('not configured')) return 503
  return 500
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const bootstrap = await bootstrapCanonicalDelegationState({ db: db as any, req })
    const data: BootstrapResponse = {
      chainId: 8453,
      canonicalCswAddress: bootstrap.canonicalCswAddress,
      privyEmbeddedEoaAddress: bootstrap.privyEmbeddedEoaAddress,
      privyIsOwner: bootstrap.privyIsOwner,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<BootstrapResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Onboarding bootstrap failed'
    return res
      .status(resolveStatusCode(error))
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies ApiEnvelope<never>)
  }
}
