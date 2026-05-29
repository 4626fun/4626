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
  ensureTelegramTradingSchema,
  readTelegramMiniAppSession,
} from '@4626/server-core'


import {
  ensureAccountsIdentitySchema,
  syncEmailIdentity,
  verifyPrivyForAccounts,
} from '../../../server/_lib/identity/accountsIdentity.js'

type LinkReadyBody = {
  email?: string
  sessionToken?: string
}
const LINK_READY_MAX_BODY_BYTES = 16_384

type TelegramLinkReadyAccount = {
  privyUserId: string
  email: string
  emailVerified: true
  canonicalCswAddress: string | null
}

type LinkReadyResponse = {
  ready: boolean
  account: TelegramLinkReadyAccount | null
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function withCode<T>(payload: ApiEnvelope<T>, code: string) {
  return { ...payload, code }
}

function isUnauthorizedMessage(message: string): boolean {
  return /token|unauthorized|forbidden|privy/i.test(message)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('telegram-link-ready', getClientIp(req)),
    RATE_LIMITS.telegramLinkRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: LinkReadyBody
  try {
    body = (await readBoundedJsonObjectBody<LinkReadyBody>(req, { maxBytes: LINK_READY_MAX_BODY_BYTES })) ?? {}
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' } satisfies ApiEnvelope<never>)
  }
  const expectedEmail = normalizeEmail(body.email)
  const sessionToken = asTrimmed(body.sessionToken)
  if (!expectedEmail) {
    return res.status(400).json({ success: false, error: 'email is required' } satisfies ApiEnvelope<never>)
  }
  if (!sessionToken) {
    return res
      .status(400)
      .json(withCode({ success: false, error: 'sessionToken is required' } satisfies ApiEnvelope<never>, 'INVALID_TELEGRAM_CONTEXT'))
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureTelegramTradingSchema(db as any)
    await ensureAccountsIdentitySchema(db as any)
    const sessionResult = await readTelegramMiniAppSession({
      db: db as any,
      sessionToken,
    })
    if (!sessionResult.ok) {
      const code = sessionResult.reason === 'expired' || sessionResult.reason === 'revoked' ? 'EXPIRED_TELEGRAM_SESSION' : 'INVALID_TELEGRAM_CONTEXT'
      const status = sessionResult.reason === 'invalid' ? 400 : 409
      return res.status(status).json(
        withCode(
          {
            success: false,
            error:
              sessionResult.reason === 'expired'
                ? 'Telegram session expired. Reopen the Mini App from Telegram and verify again.'
                : sessionResult.reason === 'revoked'
                  ? 'Telegram session was revoked. Reopen the Mini App from Telegram and verify again.'
                  : 'Telegram session proof is invalid.',
          } satisfies ApiEnvelope<never>,
          code,
        ),
      )
    }

    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const result = await db.sql`
      SELECT
        a.email,
        a.email_verified,
        azs.canonical_csw_address
      FROM accounts a
      LEFT JOIN account_zora_signals azs
        ON azs.privy_user_id = a.privy_user_id
      WHERE a.privy_user_id = ${context.privyUserId}
      LIMIT 1;
    `

    const row = result.rows?.[0] ?? null
    const resolvedEmail = normalizeEmail(row?.email)
    const emailVerified = row?.email_verified === true
    const canonicalCswAddress = asTrimmed(row?.canonical_csw_address) || null
    const ready = Boolean(resolvedEmail && resolvedEmail === expectedEmail && emailVerified)

    return res.status(200).json({
      success: true,
      data: {
        ready,
        account: ready
          ? {
              privyUserId: context.privyUserId,
              email: resolvedEmail,
              emailVerified: true,
              canonicalCswAddress,
            }
          : null,
      } satisfies LinkReadyResponse,
    } satisfies ApiEnvelope<LinkReadyResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to resolve Telegram link readiness'
    const status = isUnauthorizedMessage(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
