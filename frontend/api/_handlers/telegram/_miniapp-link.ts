import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { loadCanonicalDelegationState } from '../../../server/_lib/canonicalCswDelegation.js'
import { assertNoEmailPrivyCollision, isIdentityRecoveryRequiredError } from '../../../server/_lib/identityRecovery.js'
import { ensureAccountsIdentitySchema, upsertAccount, verifyPrivyForAccounts } from '../../../server/_lib/accountsIdentity.js'
import { getDb } from '../../../server/_lib/postgres.js'
import {
  readTelegramMiniAppSession,
  ensureTelegramTradingSchema,
  isTelegramFunnelEventsEnabledForChat,
  logTelegramFunnelEvent,
  readTelegramLinkStartTokenStatus,
  runTelegramMergePreflight,
  upsertTelegramUserLink,
} from '../../../server/_lib/telegramTrading.js'
import { extractPrivyVerifiedEmail } from '../../../server/_lib/trust.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

import { readTelegramMiniAppSessionToken } from './webhook/miniAppAuth.js'
import { isTelegramMiniAppSessionEnabled, verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { asTrimmed, resolveTelegramLinkErrorStatusCode } from './webhook/utils.js'

type MiniAppLinkBody = {
  token?: string
  telegramUsername?: string | null
  miniAppSessionToken?: string
  sessionToken?: string
}

function isPrivyUserIdUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('profiles_privy_user_id_unique') ||
    (lower.includes('duplicate key value') && lower.includes('privy_user_id'))
  )
}

async function ensureProfileIdForPrivyUser(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  privyUserId: string
  email: string | null
}): Promise<number> {
  const { db, privyUserId, email } = params
  if (email) {
    await assertNoEmailPrivyCollision({ db, email, privyUserId })
  }

  const existing = await db.sql`
    SELECT id
    FROM profiles
    WHERE privy_user_id = ${privyUserId}
    LIMIT 1;
  `
  const existingIdRaw = existing.rows?.[0]?.id
  const existingId = typeof existingIdRaw === 'number' ? existingIdRaw : Number(existingIdRaw)
  if (Number.isFinite(existingId) && existingId > 0) return existingId

  try {
    const inserted = await db.sql`
      INSERT INTO profiles (email, privy_user_id, created_at, updated_at)
      VALUES (${email}, ${privyUserId}, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
        SET privy_user_id = COALESCE(profiles.privy_user_id, EXCLUDED.privy_user_id),
            updated_at = NOW()
      RETURNING id;
    `
    const insertedIdRaw = inserted.rows?.[0]?.id
    const insertedId = typeof insertedIdRaw === 'number' ? insertedIdRaw : Number(insertedIdRaw)
    if (Number.isFinite(insertedId) && insertedId > 0) return insertedId
  } catch (error) {
    if (!isPrivyUserIdUniqueViolation(error)) throw error
  }

  const recovered = await db.sql`
    SELECT id
    FROM profiles
    WHERE privy_user_id = ${privyUserId}
    LIMIT 1;
  `
  const recoveredIdRaw = recovered.rows?.[0]?.id
  const recoveredId = typeof recoveredIdRaw === 'number' ? recoveredIdRaw : Number(recoveredIdRaw)
  if (Number.isFinite(recoveredId) && recoveredId > 0) return recoveredId

  throw new Error('telegram_link_profile_upsert_failed')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<MiniAppLinkBody>(req).catch(() => null)) ?? (req.body as MiniAppLinkBody | null) ?? {}
  const token = asTrimmed(body.token ?? '')
  const tokenStatus = readTelegramLinkStartTokenStatus(token)
  if (!tokenStatus.ok) {
    const statusCode = tokenStatus.reason === 'expired' ? 410 : 400
    return res.status(statusCode).json({
      success: false,
      error:
        tokenStatus.reason === 'expired'
          ? 'Telegram link expired. Run /link in Telegram and open the new Mini App button.'
          : 'Invalid link token',
    } satisfies ApiEnvelope<never>)
  }
  const parsed = tokenStatus.payload
  const shouldEmitFunnelEvent = isTelegramFunnelEventsEnabledForChat(parsed.chatId)
  const miniAppSessionRequired = isTelegramMiniAppSessionEnabled({
    chatId: parsed.chatId,
    userId: parsed.telegramUserId,
  })
  const hasLinkApiSecret = verifyTelegramLinkApiSecret(req)
  if (!miniAppSessionRequired && !hasLinkApiSecret) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureWaitlistSchema(db as any)
    await ensureTelegramTradingSchema(db as any)

    if (miniAppSessionRequired) {
      const miniAppSessionToken = readTelegramMiniAppSessionToken({
        req,
        bodyToken: asTrimmed(body.miniAppSessionToken ?? body.sessionToken ?? ''),
      })
      if (!miniAppSessionToken) {
        return res.status(401).json({
          success: false,
          error: 'Telegram Mini App session token is required. Re-open the Mini App from Telegram and retry.',
        } satisfies ApiEnvelope<never>)
      }
      const miniAppSession = await readTelegramMiniAppSession({
        db: db as any,
        sessionToken: miniAppSessionToken,
      })
      if (!miniAppSession.ok) {
        const isExpired = miniAppSession.reason === 'expired'
        return res.status(isExpired ? 410 : 401).json({
          success: false,
          error: isExpired
            ? 'Telegram Mini App session expired. Re-open the Mini App from Telegram and retry.'
            : 'Invalid Telegram Mini App session. Re-open the Mini App from Telegram and retry.',
        } satisfies ApiEnvelope<never>)
      }
      if (miniAppSession.session.telegramUserId !== parsed.telegramUserId) {
        return res.status(401).json({
          success: false,
          error: 'Telegram Mini App session user mismatch. Start /link again from Telegram.',
        } satisfies ApiEnvelope<never>)
      }
      if (miniAppSession.session.chatId && miniAppSession.session.chatId !== parsed.chatId) {
        return res.status(401).json({
          success: false,
          error: 'Telegram Mini App session chat mismatch. Start /link again from Telegram.',
        } satisfies ApiEnvelope<never>)
      }
    }

    const context = await verifyPrivyForAccounts(req)
    const verifiedEmail = extractPrivyVerifiedEmail(context.privyUser)
    if (!verifiedEmail) {
      return res.status(409).json({
        success: false,
        error: 'Verify your email with 4626 before linking Telegram.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
        emailVerificationRequired: true,
      } as ApiEnvelope<never> & { code: string; emailVerificationRequired: true })
    }
    await ensureAccountsIdentitySchema(db as any)
    await upsertAccount({
      db: db as any,
      privyUserId: context.privyUserId,
      email: verifiedEmail,
      emailVerified: true,
    })
    const profileId = await ensureProfileIdForPrivyUser({
      db: db as any,
      privyUserId: context.privyUserId,
      email: verifiedEmail,
    })
    const delegation = await loadCanonicalDelegationState({
      db: db as any,
      privyUserId: context.privyUserId,
    })
    const mergePreflight = await runTelegramMergePreflight({
      db: db as any,
      telegramUserId: parsed.telegramUserId,
      privyUserId: context.privyUserId,
    })
    if (!mergePreflight.ok) {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this Telegram account is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_TELEGRAM_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }

    const link = await upsertTelegramUserLink({
      db: db as any,
      telegramUserId: parsed.telegramUserId,
      telegramUsername: asTrimmed(body.telegramUsername ?? '') || null,
      profileId,
      privyUserId: context.privyUserId,
      canonicalCswAddress: delegation?.canonicalCswAddress ?? null,
      ownerVerified: delegation?.privyIsOwner === true,
    })
    if (!link) {
      return res.status(500).json({ success: false, error: 'Failed to persist telegram link' } satisfies ApiEnvelope<never>)
    }

    if (shouldEmitFunnelEvent) {
      await logTelegramFunnelEvent({
        db: db as any,
        telegramUserId: parsed.telegramUserId,
        chatId: parsed.chatId,
        eventName: 'link_complete_success',
        actionType: 'link',
        context: { profileId: link.profileId, ownerVerified: link.ownerVerified, linkStatus: link.linkStatus },
      }).catch(() => {})
    }

    return res.status(200).json({
      success: true,
      data: {
        linked: link.linkStatus === 'active',
        telegramUserId: link.telegramUserId,
        chatId: parsed.chatId,
        profileId: link.profileId,
        privyUserId: link.privyUserId,
        canonicalCswAddress: link.canonicalCswAddress,
        ownerVerified: link.ownerVerified,
        linkStatus: link.linkStatus,
        linkedAt: link.linkedAt,
      },
    } satisfies ApiEnvelope<{
      linked: boolean
      telegramUserId: string
      chatId: string
      profileId: number
      privyUserId: string
      canonicalCswAddress: string | null
      ownerVerified: boolean
      linkStatus: string
      linkedAt: string | null
    }>)
  } catch (error) {
    if (isIdentityRecoveryRequiredError(error)) {
      return res.status(409).json({
        success: false,
        error: `Recovery required: email "${error.email}" is already linked to another account. Recover that account to continue.`,
        code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }
    if ((error as any)?.code === 'IDENTITY_RECOVERY_REQUIRED') {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this Telegram account is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_TELEGRAM_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }
    const message = error instanceof Error ? error.message : 'Failed to complete Telegram link'
    if (shouldEmitFunnelEvent) {
      await logTelegramFunnelEvent({
        db: db as any,
        telegramUserId: parsed.telegramUserId,
        chatId: parsed.chatId,
        eventName: 'link_complete_failed',
        actionType: 'link',
        context: { message },
      }).catch(() => {})
    }
    return res.status(resolveTelegramLinkErrorStatusCode(error)).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
