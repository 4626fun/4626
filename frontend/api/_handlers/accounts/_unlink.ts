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
} from '../../../packages/server-core/src/index.js'


import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  recordProviderUnlink,
  syncEmailIdentity,
  type AccountLinkProvider,
  verifyPrivyForAccounts,
} from '../../../server/_lib/identity/accountsIdentity.js'

type UnlinkBody = {
  provider?: AccountLinkProvider
  value?: string | null
}

type AccountsUnlinkResponse = Awaited<ReturnType<typeof buildAccountsMePayload>>

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
const UNLINK_VALUE_MAX_LENGTH = 256
const UNLINK_BODY_MAX_BYTES = 16_384

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function normalizeUnlinkValue(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value == null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > UNLINK_VALUE_MAX_LENGTH) return { ok: false }
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
    rateLimitKey('accounts-unlink', getClientIp(req)),
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

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: UNLINK_BODY_MAX_BYTES })) as UnlinkBody
  const provider = body.provider
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, error: 'Invalid provider' } satisfies ApiEnvelope<never>)
  }
  const normalizedValue = normalizeUnlinkValue(body.value)
  if (!normalizedValue.ok) {
    return res.status(400).json({ success: false, error: 'Invalid unlink value' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    await recordProviderUnlink({
      db: db as any,
      privyUserId: context.privyUserId,
      provider,
      value: normalizedValue.value,
    })

    const data = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AccountsUnlinkResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to unlink provider'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
