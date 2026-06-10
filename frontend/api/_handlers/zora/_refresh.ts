import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'


import {
  ensureAccountsIdentitySchema,
  resolveAndPersistZoraSignals,
  syncEmailIdentity,
  verifyPrivyForAccounts,
} from '../../../server/_lib/identity/accountsIdentity.js'

type ZoraRefreshResponse = {
  canonicalCswAddress: string | null
  creatorCoin: { address: string; name: string | null; symbol: string | null } | null
  zoraHandle: string | null
  lastResolvedAt: string | null
}

const REFRESH_WINDOW_MS = 10 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('zora-refresh', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  let context: Awaited<ReturnType<typeof verifyPrivyForAccounts>> | null = null
  try {
    context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const summary = await resolveAndPersistZoraSignals({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
      forceRefresh: true,
      refreshWindowMs: REFRESH_WINDOW_MS,
    })

    const data: ZoraRefreshResponse = {
      canonicalCswAddress: summary.canonicalCswAddress,
      creatorCoin: summary.creatorCoin,
      zoraHandle: summary.zoraHandle,
      lastResolvedAt: summary.lastResolvedAt,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ZoraRefreshResponse>)
  } catch (error: any) {
    const code = typeof error?.code === 'string' ? error.code : ''
    if (code === 'ZORA_REFRESH_RATE_LIMITED') {
      const retryAfterSec = Number(error?.retryAfterSec ?? 60)
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterSec))))

      // If forced refresh is temporarily limited, fall back to the latest persisted signals
      // so waitlist/account setup can keep moving with known-good state.
      if (context) {
        try {
          const summary = await resolveAndPersistZoraSignals({
            db: db as any,
            privyUserId: context.privyUserId,
            privyUser: context.privyUser,
            forceRefresh: false,
          })
          const data: ZoraRefreshResponse = {
            canonicalCswAddress: summary.canonicalCswAddress,
            creatorCoin: summary.creatorCoin,
            zoraHandle: summary.zoraHandle,
            lastResolvedAt: summary.lastResolvedAt,
          }
          res.setHeader('X-Zora-Refresh-Limited', '1')
          return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ZoraRefreshResponse>)
        } catch {
          // If fallback also fails, return the original rate-limit error.
        }
      }

      return res.status(429).json({
        success: false,
        error: `Refresh is rate-limited. Try again in ${Math.max(1, Math.ceil(retryAfterSec))}s.`,
      } satisfies ApiEnvelope<never>)
    }

    const message = typeof error?.message === 'string' ? error.message : 'Failed to refresh Zora signals'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
