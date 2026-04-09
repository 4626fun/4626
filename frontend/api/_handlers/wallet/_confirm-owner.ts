import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import { confirmOwnerState, extractDelegationFlags } from '../../../server/_lib/canonicalCswDelegation.js'

type ConfirmBody = {
  cswAddress?: string
  ownerAddress?: string
  txHash?: string
}

type ConfirmResponse = {
  isOwner: boolean
  canonicalCswAddress: string
  ownerAddress: string
  txHash: string | null
}

function resolveStatusCode(error: unknown): number {
  const flags = extractDelegationFlags(error)
  if (flags.needsBaseAppSetup || flags.needsEmbeddedWallet) return 409
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    lower.includes('does not match the canonical wallet') ||
    lower.includes('invalid csw address') ||
    lower.includes('invalid owner address')
  ) {
    return 400
  }
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

  const body = await readJsonBody<ConfirmBody>(req, { maxBytes: 8_192 })
  const ownerAddress = typeof body?.ownerAddress === 'string' ? body.ownerAddress : null
  const cswAddress = typeof body?.cswAddress === 'string' ? body.cswAddress : null
  const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : ''

  try {
    const confirmed = await confirmOwnerState({
      db: db as any,
      req,
      ownerAddress,
      cswAddress,
    })
    const data: ConfirmResponse = {
      isOwner: confirmed.isOwner,
      canonicalCswAddress: confirmed.canonicalCswAddress,
      ownerAddress: confirmed.ownerAddress,
      txHash: txHash || null,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ConfirmResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to confirm owner install'
    return res
      .status(resolveStatusCode(error))
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies ApiEnvelope<never>)
  }
}
