import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  checkDurableRateLimit,
  getClientIp,
  RATE_LIMITS,
  enforceDualRateLimit,
} from '@4626/server-core'


import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  syncEmailIdentity,
  verifyPrivyForAccounts,
} from '../../../server/_lib/identity/accountsIdentity.js'
import { bootstrapCanonicalDelegationState } from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import { isDeployDryRunDbDisabled } from '../../../server/_lib/dev/localDevEnv.js'

type AccountsMeResponse = Awaited<ReturnType<typeof buildAccountsMePayload>>

function shouldHydrateExecutionSignals(data: AccountsMeResponse): boolean {
  const signals = data.accountSignals
  const hasCanonicalAddress =
    typeof signals.canonicalCswAddress === 'string' && signals.canonicalCswAddress.trim().length > 0
  const hasExecutionTrack =
    typeof signals.executionTrack === 'string' &&
    signals.executionTrack.trim().length > 0 &&
    signals.executionTrack !== 'none-yet'
  const hasOwnerFlag =
    signals.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true ||
    signals.privyEmbeddedEoaIsOwnerOfCanonicalCsw === false
  const hasBaseSubAccount = signals.baseSubAccount != null
  return !(hasCanonicalAddress && hasExecutionTrack && hasOwnerFlag && hasBaseSubAccount)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // APIAUTH-001: /api/accounts/me performs DB writes (syncEmailIdentity) and
  // external Privy API calls on every authenticated GET. Rate-limit before any
  // DB or Privy work to prevent amplification attacks.
  const clientIp = getClientIp(req)
  const limiter = await enforceDualRateLimit({
    scope: 'accounts-me',
    req,
    ip: clientIp,
    sessionConfig: RATE_LIMITS.accountsMeSession,
    ipConfig: RATE_LIMITS.accountsMe,
    check: (key, config) => checkDurableRateLimit(key, config, { failClosed: true }),
  })
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    const error = isDeployDryRunDbDisabled()
      ? 'Database unavailable for deploy dry-run. Set DEPLOY_DRY_RUN_KEEP_DB_ENV=1 in frontend/.env.deploy-dry-run.local and restart dev-deploy-dry-run.'
      : 'Database unavailable'
    return res.status(503).json({ success: false, error } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const baseData = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })
    let data: AccountsMeResponse = baseData

    // Fold bootstrap execution signals into /accounts/me only when they're
    // missing. This keeps /accounts/me as the frontend's single source while
    // avoiding the heavier bootstrap path for already-hydrated accounts.
    if (shouldHydrateExecutionSignals(baseData)) {
      try {
        const bootstrap = await bootstrapCanonicalDelegationState({ db: db as any, req })
        const existingSignals = baseData.accountSignals
        data = {
          ...baseData,
          accountSignals: {
            ...existingSignals,
            canonicalCswAddress: existingSignals.canonicalCswAddress ?? bootstrap.canonicalCswAddress,
            canonicalSource: existingSignals.canonicalSource ?? bootstrap.canonicalSource ?? null,
            baseSubAccount: existingSignals.baseSubAccount ?? bootstrap.baseSubAccount,
            executionTrack:
              existingSignals.executionTrack && existingSignals.executionTrack !== 'none-yet'
                ? existingSignals.executionTrack
                : bootstrap.executionTrack,
            privyEmbeddedEoaIsOwnerOfCanonicalCsw:
              existingSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
                ? true
                : bootstrap.privyIsOwner
                  ? true
                  : (existingSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw ?? null),
            embeddedEoaAddress: existingSignals.embeddedEoaAddress ?? bootstrap.privyEmbeddedEoaAddress,
            walletHydrationError: null,
          },
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Wallet profile sync is still catching up. Retry in a moment.'
        data = {
          ...baseData,
          accountSignals: {
            ...baseData.accountSignals,
            walletHydrationError: message,
          },
        }
      }
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AccountsMeResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to load account'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

