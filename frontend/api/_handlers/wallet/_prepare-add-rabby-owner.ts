import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getAddress } from 'viem'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'


import {
  bootstrapCanonicalDelegationState,
  confirmOwnerState,
  extractDelegationFlags,
} from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import { prepareAddOwnerTx } from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'

type PrepareRabbyBody = {
  rabbyAddress?: string
  confirmedAdvanced?: boolean
}

type PrepareRabbyResponse =
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

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function parseChecksummedAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!ADDRESS_RE.test(raw)) return null
  try {
    return getAddress(raw) as `0x${string}`
  } catch {
    return null
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

  const limiter = checkRateLimit(
    rateLimitKey('wallet-prepare-add-rabby-owner', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as PrepareRabbyBody | null
  if (body?.confirmedAdvanced !== true) {
    return res.status(400).json({
      success: false,
      error: 'Advanced owner install requires explicit confirmation.',
    } satisfies ApiEnvelope<never>)
  }

  const rabbyAddress = parseChecksummedAddress(body?.rabbyAddress)
  if (!rabbyAddress) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Rabby address. Provide a valid 0x address.',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const bootstrap = await bootstrapCanonicalDelegationState({ db: db as any, req })
    const ownerState = await confirmOwnerState({
      db: db as any,
      req,
      ownerAddress: rabbyAddress,
      cswAddress: bootstrap.canonicalCswAddress,
    })
    if (ownerState.isOwner) {
      return res.status(200).json({
        success: true,
        data: { alreadyOwner: true } satisfies PrepareRabbyResponse,
      } satisfies ApiEnvelope<PrepareRabbyResponse>)
    }
    const txRequest = prepareAddOwnerTx(bootstrap.canonicalCswAddress, rabbyAddress)
    return res.status(200).json({
      success: true,
      data: { alreadyOwner: false, txRequest } satisfies PrepareRabbyResponse,
    } satisfies ApiEnvelope<PrepareRabbyResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to prepare advanced owner install'
    return res
      .status(resolveStatusCode(error))
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies ApiEnvelope<never>)
  }
}
