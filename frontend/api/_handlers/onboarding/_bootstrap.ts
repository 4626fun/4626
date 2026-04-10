import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
} from '../../../packages/server-core/src/index.js'


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

type BootstrapErrorEnvelope = ApiEnvelope<never> & {
  code?: string
  retryable?: boolean
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
}

function resolveStatusCode(error: unknown): number {
  const flags = extractDelegationFlags(error)
  // Actionable setup states are not hard transport failures.
  // Return 200 + flags so clients can branch without noisy 4xx console errors.
  if (flags.needsBaseAppSetup || flags.needsEmbeddedWallet) return 200
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
  const limiter = checkRateLimit(rateLimitKey('onboarding:bootstrap', getClientIp(req)), RATE_LIMITS.creatorQuickstart)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable',
      code: 'ONBOARDING_BOOTSTRAP_UNAVAILABLE',
      retryable: true,
    } satisfies BootstrapErrorEnvelope)
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
    const statusCode = resolveStatusCode(error)
    const message =
      statusCode >= 500
        ? 'Onboarding bootstrap failed'
        : error instanceof Error
          ? error.message
          : 'Onboarding bootstrap failed'
    return res
      .status(statusCode)
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies BootstrapErrorEnvelope)
  }
}
