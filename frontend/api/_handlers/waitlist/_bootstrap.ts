import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  syncEmailIdentity,
  upsertAccount,
  verifyPrivyForAccounts,
} from '../../../server/_lib/accountsIdentity.js'

type BootstrapBody = { email?: string }
type WaitlistBootstrapResponse =
  | {
      requiresPrivyAuth: true
      email: string | null
      waitlistEntryId: number | null
    }
  | ({
      requiresPrivyAuth: false
    } & Awaited<ReturnType<typeof buildAccountsMePayload>>)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

function readPrivyToken(req: VercelRequest): string | null {
  const fromHeader = typeof req.headers?.['x-privy-token'] === 'string' ? req.headers['x-privy-token'].trim() : ''
  if (fromHeader) return fromHeader
  const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice('bearer '.length).trim()
    return token || null
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<BootstrapBody>(req).catch(() => null)) ?? (req.body as BootstrapBody | null) ?? {}
  const email = normalizeEmail(body?.email)
  const token = readPrivyToken(req)

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  if (!token) {
    let waitlistEntryId: number | null = null
    if (email) {
      const existing = await db.sql`
        SELECT id
        FROM profiles
        WHERE email = ${email}
        LIMIT 1;
      `
      const idRaw = existing.rows?.[0]?.id
      const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
      waitlistEntryId = Number.isFinite(id) && id > 0 ? id : null
    }

    return res.status(200).json({
      success: true,
      data: {
        requiresPrivyAuth: true,
        email: email ?? null,
        waitlistEntryId,
      } satisfies WaitlistBootstrapResponse,
    } satisfies ApiEnvelope<WaitlistBootstrapResponse>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)

    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const emailToPersist = email ?? normalizeEmail((context.privyUser as any)?.email?.address)
    if (emailToPersist) {
      await upsertAccount({
        db: db as any,
        privyUserId: context.privyUserId,
        email: emailToPersist,
        emailVerified: true,
      })
      await db.sql`
        INSERT INTO profiles (email, privy_user_id, created_at, updated_at)
        VALUES (${emailToPersist}, ${context.privyUserId}, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE
          SET privy_user_id = COALESCE(EXCLUDED.privy_user_id, profiles.privy_user_id),
              updated_at = NOW();
      `
    }

    const me = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    return res.status(200).json({
      success: true,
      data: {
        requiresPrivyAuth: false,
        ...me,
      } satisfies WaitlistBootstrapResponse,
    } satisfies ApiEnvelope<WaitlistBootstrapResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to bootstrap waitlist account'
    const lower = message.toLowerCase()
    const status = lower.includes('token') || lower.includes('unauthorized') || lower.includes('privy') ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

