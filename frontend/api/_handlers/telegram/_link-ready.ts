import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import {
  ensureAccountsIdentitySchema,
  syncEmailIdentity,
  verifyPrivyForAccounts,
} from '../../../server/_lib/accountsIdentity.js'

type LinkReadyBody = {
  email?: string
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<LinkReadyBody>(req, { maxBytes: 16_384 }).catch(() => null)) ?? (req.body as LinkReadyBody | null) ?? {}
  const expectedEmail = normalizeEmail(body.email)
  if (!expectedEmail) {
    return res.status(400).json({ success: false, error: 'email is required' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
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
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
