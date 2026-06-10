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
} from '@4626/server-core'


import {
  bootstrapCanonicalDelegationState,
  extractDelegationFlags,
} from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import type {
  BaseSubAccountSummary,
  ExecutionTrack,
} from '../../../server/_lib/wallet/executionTrack.js'

type BootstrapResponse = {
  chainId: 8453
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  /**
   * Legacy-track indicator: whether the Privy embedded EOA is installed as a
   * direct owner of the parent CSW. Under the sub-account-first architecture
   * this is expected to be `false` for new accounts; a `true` value means the
   * account is on the legacy owner-install path. Kept for backward
   * compatibility with existing clients; prefer `executionTrack` for
   * new gating logic.
   */
  privyIsOwner: boolean
  /**
   * Explicit alias for `privyIsOwner` whose name states its legacy-track
   * semantics clearly. Same value; clients may use either.
   */
  privyEmbeddedEoaIsOwnerOfCanonicalCsw: boolean
  /**
   * Sub-account status (user-initiated frontend execution track). See
   * `docs/4626-connection-methods.md` Section 2.
   */
  baseSubAccount: BaseSubAccountSummary
  /**
   * Derived execution track. Clients should prefer this single field over
   * combining `privyIsOwner` + sub-account inference on their own.
   */
  executionTrack: ExecutionTrack
}

type BootstrapErrorEnvelope = ApiEnvelope<never> & {
  code?: string
  retryable?: boolean
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
}

function isProductionEnv(): boolean {
  const raw = String((globalThis as any)?.process?.env?.NODE_ENV ?? '')
    .trim()
    .toLowerCase()
  return raw === 'production'
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
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: bootstrap.privyIsOwner,
      baseSubAccount: bootstrap.baseSubAccount,
      executionTrack: bootstrap.executionTrack,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<BootstrapResponse>)
  } catch (error: unknown) {
    const statusCode = resolveStatusCode(error)
    const rawMessage = error instanceof Error ? error.message : String(error ?? 'Onboarding bootstrap failed')
    if (statusCode >= 500) {
      console.error('[onboarding/bootstrap] failed', {
        statusCode,
        message: rawMessage,
        stack: error instanceof Error ? error.stack : null,
      })
    }
    const message =
      statusCode >= 500 && isProductionEnv()
        ? 'Onboarding bootstrap failed'
        : rawMessage
    return res
      .status(statusCode)
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies BootstrapErrorEnvelope)
  }
}
