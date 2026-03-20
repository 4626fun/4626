import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { assertNoEmailPrivyCollision, isIdentityRecoveryRequiredError } from '../../../server/_lib/identityRecovery.js'
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

function isPrivyUserIdUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('profiles_privy_user_id_unique') ||
    (lower.includes('duplicate key value') && lower.includes('privy_user_id'))
  )
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

async function upsertBootstrapProfile(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  email: string
  privyUserId: string
}): Promise<void> {
  const { db, email, privyUserId } = params

  const updateByPrivyUserId = async () =>
    db.sql`
      UPDATE profiles
      SET
        email = COALESCE(profiles.email, ${email}),
        updated_at = NOW()
      WHERE privy_user_id = ${privyUserId}
      RETURNING id;
    `

  const existingByPrivy = await updateByPrivyUserId()
  if (Array.isArray(existingByPrivy.rows) && existingByPrivy.rows.length > 0) return

  try {
    await db.sql`
      INSERT INTO profiles (email, privy_user_id, created_at, updated_at)
      VALUES (${email}, ${privyUserId}, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
        SET privy_user_id = COALESCE(profiles.privy_user_id, EXCLUDED.privy_user_id),
            updated_at = NOW();
    `
    return
  } catch (error) {
    if (!isPrivyUserIdUniqueViolation(error)) throw error
  }

  const recoveredByPrivy = await updateByPrivyUserId()
  if (Array.isArray(recoveredByPrivy.rows) && recoveredByPrivy.rows.length > 0) return
  throw new Error('waitlist_bootstrap_profile_upsert_failed')
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

    const privyEmail = normalizeEmail((context.privyUser as any)?.email?.address)
    // Only Privy's verified email is allowed to become the canonical account email.
    // Pre-auth form input is intent, not proof.
    if (privyEmail) {
      await assertNoEmailPrivyCollision({
        db: db as any,
        email: privyEmail,
        privyUserId: context.privyUserId,
      })
      await upsertAccount({
        db: db as any,
        privyUserId: context.privyUserId,
        email: privyEmail,
        emailVerified: true,
      })
      await upsertBootstrapProfile({
        db: db as any,
        email: privyEmail,
        privyUserId: context.privyUserId,
      })
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
    if (isIdentityRecoveryRequiredError(error)) {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this email is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & {
        code: string
        recoveryRequired: true
      })
    }
    const message = typeof error?.message === 'string' ? error.message : 'Failed to bootstrap waitlist account'
    const lower = message.toLowerCase()
    const isEmailMismatch =
      lower.includes('email does not match authenticated user') || lower.includes('does not match authenticated user')
    if (isEmailMismatch) {
      return res.status(401).json({
        success: false,
        error: 'Session email mismatch. Please sign in again.',
      } satisfies ApiEnvelope<never>)
    }
    const status = lower.includes('token') || lower.includes('unauthorized') || lower.includes('privy') ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
