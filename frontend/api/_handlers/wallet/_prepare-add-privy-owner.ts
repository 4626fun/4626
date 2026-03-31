import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import {
  bootstrapCanonicalDelegationState,
  extractDelegationFlags,
} from '../../../server/_lib/canonicalCswDelegation.js'
import { prepareAddOwnerTx } from '../../../server/_lib/coinbaseSmartWalletOwner.js'

type PrepareResponse =
  | { alreadyOwner: true }
  | {
      alreadyOwner: false
      txRequest: {
        chainId: 8453
        to: `0x${string}`
        data: `0x${string}`
        value: '0x0'
      }
    }

function resolveStatusCode(error: unknown): number {
  const flags = extractDelegationFlags(error)
  if (flags.needsBaseAppSetup || flags.needsEmbeddedWallet) return 409
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
    if (bootstrap.privyIsOwner) {
      return res.status(200).json({
        success: true,
        data: { alreadyOwner: true } satisfies PrepareResponse,
      } satisfies ApiEnvelope<PrepareResponse>)
    }

    const txRequest = prepareAddOwnerTx(bootstrap.canonicalCswAddress, bootstrap.privyEmbeddedEoaAddress)
    return res.status(200).json({
      success: true,
      data: { alreadyOwner: false, txRequest } satisfies PrepareResponse,
    } satisfies ApiEnvelope<PrepareResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to prepare owner install'
    return res
      .status(resolveStatusCode(error))
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies ApiEnvelope<never>)
  }
}
