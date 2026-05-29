import type { VercelRequest, VercelResponse } from '@vercel/node'

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
} from '@4626/server-core'


import { isIdentityRecoveryRequiredError } from '../../../server/_lib/identity/identityRecovery.js'
import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  recordProviderLink,
  syncEmailIdentity,
  type AccountLinkProvider,
  verifyPrivyForAccounts,
} from '../../../server/_lib/identity/accountsIdentity.js'

type LinkBody = {
  provider?: AccountLinkProvider
  value?: string | null
}

type AccountsLinkResponse = Awaited<ReturnType<typeof buildAccountsMePayload>>

const ALLOWED_PROVIDERS = new Set<AccountLinkProvider>([
  'google',
  'apple',
  'twitter',
  'telegram',
  'tiktok',
  'external_eoa',
  'email',
  'zora_cross_app',
])
const LINK_VALUE_MAX_LENGTH = 256
const LINK_BODY_MAX_BYTES = 16_384

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function normalizeLinkValue(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value == null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > LINK_VALUE_MAX_LENGTH) return { ok: false }
  return { ok: true, value: trimmed }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('accounts-link', getClientIp(req)),
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

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: LINK_BODY_MAX_BYTES })) as LinkBody
  const provider = body.provider
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, error: 'Invalid provider' } satisfies ApiEnvelope<never>)
  }
  const normalizedValue = normalizeLinkValue(body.value)
  if (!normalizedValue.ok) {
    return res.status(400).json({ success: false, error: 'Invalid link value' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    await recordProviderLink({
      db: db as any,
      privyUserId: context.privyUserId,
      provider,
      // Never trust caller-supplied identity values; only use verified Privy-linked identities.
      value: null,
      privyUser: context.privyUser,
    })

    const data = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AccountsLinkResponse>)
  } catch (error: any) {
    if (isIdentityRecoveryRequiredError(error)) {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this email is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }
    const message = typeof error?.message === 'string' ? error.message : 'Failed to link provider'
    const status =
      /no linked value|not linked|not verified/i.test(message)
        ? 409
        : /token|unauthorized|forbidden|privy/i.test(message)
          ? 401
          : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
