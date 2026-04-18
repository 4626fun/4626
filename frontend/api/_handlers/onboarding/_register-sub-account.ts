import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress } from 'viem'

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
  resolveCanonicalCsw,
  verifyPrivyRequest,
} from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import {
  WAITLIST_POINTS,
  awardWaitlistPoints,
} from '../../../server/_lib/onboarding/waitlistPoints.js'

declare const process: { env: Record<string, string | undefined> }

type RegisterSubAccountResponse = {
  subAccountAddress: string
  parentAddress: string
  registered: boolean
}

function normalizeAddress(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || !isAddress(trimmed)) return null
  try {
    return getAddress(trimmed)
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('onboarding:register-sub-account', getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    // Parse and validate request body
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const subAccountAddress = normalizeAddress(body.subAccountAddress)
    const parentAddress = normalizeAddress(body.parentAddress)

    if (!subAccountAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid subAccountAddress',
      } satisfies ApiEnvelope<never>)
    }
    if (!parentAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid parentAddress',
      } satisfies ApiEnvelope<never>)
    }

    // Verify auth and resolve canonical CSW
    const privyContext = await verifyPrivyRequest(req)
    await ensureWaitlistSchema(db as any)
    const canonical = await resolveCanonicalCsw({
      db: db as any,
      privyUserId: privyContext.privyUserId,
      privyUser: privyContext.privyUser,
    })

    // Verify the parent address matches the user's canonical CSW
    if (parentAddress.toLowerCase() !== canonical.canonicalCswAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `Parent address ${parentAddress} does not match canonical CSW ${canonical.canonicalCswAddress}`,
      } satisfies ApiEnvelope<never>)
    }

    // Update the profile's base_sub_account to the actual sub-account address
    await (db as any).sql`
      UPDATE profiles
      SET
        base_sub_account = ${subAccountAddress},
        updated_at = NOW()
      WHERE id = ${canonical.profileId};
    `

    // Award waitlist points for enabling 4626 signing (sub-account registration).
    // `awardWaitlistPoints` is idempotent on (source, signup_id) — the
    // `csw_link` source has a hard one-per-signup cap inside the helper,
    // so repeated calls are safe and never double-credit. Failures here
    // must not block sub-account registration, so we wrap best-effort.
    try {
      await awardWaitlistPoints({
        db: db as any,
        signupId: canonical.profileId,
        source: 'csw_link',
        sourceId: `csw:${canonical.canonicalCswAddress.toLowerCase()}`,
        amount: WAITLIST_POINTS.linkCsw,
      })
    } catch {
      // Swallow — points are additive; sub-account registration already
      // succeeded and must remain the source of truth for this endpoint.
    }

    const data: RegisterSubAccountResponse = {
      subAccountAddress,
      parentAddress,
      registered: true,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<RegisterSubAccountResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to register sub-account'
    const lower = message.toLowerCase()
    if (
      lower.includes('missing privy auth token') ||
      lower.includes('invalid privy auth token') ||
      lower.includes('privy verification failed') ||
      lower.includes('unauthorized')
    ) {
      return res.status(401).json({ success: false, error: message } satisfies ApiEnvelope<never>)
    }
    return res.status(500).json({ success: false, error: 'Failed to register sub-account' } satisfies ApiEnvelope<never>)
  }
}
