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

import { isIdentityRecoveryRequiredError } from '../../../server/_lib/identityRecovery.js'

import { trackTelegramLinkEvent } from '../../../server/_lib/telegramLinkTelemetry.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { syncUserWallets } from '../../../server/_lib/walletSync.js'
import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  recordProviderLink,
  syncEmailIdentity,
  verifyPrivyForAccounts,
} from '../../../server/_lib/accountsIdentity.js'
import {
  claimAndConsumeTelegramLinkStartToken,
  ensureTelegramTradingSchema,
  getTelegramLinkByUserId,
  readTelegramLinkStartTokenStatus,
  readTelegramMiniAppSession,
  runTelegramMergePreflight,
  upsertTelegramUserLink,
} from '../../../server/_lib/telegramTrading.js'

type LinkCompleteBody = {
  sessionToken?: string
  linkToken?: string | null
  flowId?: string | null
}
const LINK_COMPLETE_MAX_BODY_BYTES = 16_384

type LinkCompleteResponse = {
  link: NonNullable<Awaited<ReturnType<typeof upsertTelegramUserLink>>>
  account: Awaited<ReturnType<typeof buildAccountsMePayload>>
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
    rateLimitKey('telegram-link-complete', getClientIp(req)),
    RATE_LIMITS.telegramLinkWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  let body: LinkCompleteBody
  try {
    body = (await readBoundedJsonObjectBody<LinkCompleteBody>(req, { maxBytes: LINK_COMPLETE_MAX_BODY_BYTES })) ?? {}
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' } satisfies ApiEnvelope<never>)
  }
  const sessionToken = asTrimmed(body.sessionToken)
  const linkToken = asTrimmed(body.linkToken ?? '')
  const flowId = asTrimmed(body.flowId ?? '')
  if (!sessionToken) {
    await trackTelegramLinkEvent({
      event: 'telegram_link_backend_completion_result',
      source: 'telegram-link-complete',
      flowId,
      phase: 'bind_telegram.complete_backend',
      status: 'failed',
      payload: {
        reason: 'missing_session_token',
      },
    })
    return res
      .status(400)
      .json(withCode({ success: false, error: 'sessionToken is required' } satisfies ApiEnvelope<never>, 'INVALID_TELEGRAM_CONTEXT'))
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureWaitlistSchema(db as any)
    await ensureAccountsIdentitySchema(db as any)
    await ensureTelegramTradingSchema(db as any)

    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const syncResult = await syncUserWallets(db as any, context.privyUser)
    const profileId = Number(syncResult.profileId)
    if (!Number.isFinite(profileId) || profileId <= 0) {
      throw new Error('profile_sync_failed')
    }
    const canonicalCswAddress = syncResult.canonicalSmartWallet?.address ?? null
    const ownerVerified =
      Boolean(canonicalCswAddress) &&
      Boolean(syncResult.embeddedEoa?.address) &&
      Boolean(syncResult.activeOwnerWallet?.address) &&
      String(syncResult.activeOwnerWallet?.address).toLowerCase() === String(syncResult.embeddedEoa?.address).toLowerCase()

    const sessionResult = await readTelegramMiniAppSession({
      db: db as any,
      sessionToken,
    })
    if (!sessionResult.ok) {
      const code = sessionResult.reason === 'expired' || sessionResult.reason === 'revoked' ? 'EXPIRED_TELEGRAM_SESSION' : 'INVALID_TELEGRAM_CONTEXT'
      const status = sessionResult.reason === 'invalid' ? 400 : 409
      await trackTelegramLinkEvent({
        event: 'telegram_link_miniapp_session_result',
        source: 'telegram-link-complete',
        flowId,
        phase: 'bind_telegram.complete_backend',
        status: 'failed',
        privyUserId: context.privyUserId,
        payload: {
          reason: sessionResult.reason,
        },
      })
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

    const session = sessionResult.session
    await trackTelegramLinkEvent({
      event: 'telegram_link_miniapp_session_result',
      source: 'telegram-link-complete',
      flowId,
      phase: 'bind_telegram.complete_backend',
      status: 'succeeded',
      telegramUserId: session.telegramUserId,
      privyUserId: context.privyUserId,
      chatId: session.chatId,
    })
    const existingLink = await getTelegramLinkByUserId({
      db: db as any,
      telegramUserId: session.telegramUserId,
    })
    const sameUserExistingLink =
      existingLink?.privyUserId?.toLowerCase() === context.privyUserId.toLowerCase()

    if (linkToken) {
      const tokenStatus = readTelegramLinkStartTokenStatus(linkToken)
      if (!tokenStatus.ok) {
        await trackTelegramLinkEvent({
          event: 'telegram_link_token_claim_result',
          source: 'telegram-link-complete',
          flowId,
          phase: 'bind_telegram.complete_backend',
          status: 'failed',
          telegramUserId: session.telegramUserId,
          privyUserId: context.privyUserId,
          chatId: session.chatId,
          payload: {
            reason: tokenStatus.reason,
            stage: 'status_check',
          },
        })
        return res.status(tokenStatus.reason === 'expired' ? 409 : 400).json(
          withCode(
            {
              success: false,
              error:
                tokenStatus.reason === 'expired'
                  ? 'Telegram link token expired. Restart the link flow from Telegram.'
                  : 'Telegram link token is invalid.',
            } satisfies ApiEnvelope<never>,
            tokenStatus.reason === 'expired' ? 'EXPIRED_TELEGRAM_SESSION' : 'INVALID_TELEGRAM_CONTEXT',
          ),
        )
      }

      if (tokenStatus.payload.telegramUserId !== session.telegramUserId) {
        await trackTelegramLinkEvent({
          event: 'telegram_link_token_claim_result',
          source: 'telegram-link-complete',
          flowId,
          phase: 'bind_telegram.complete_backend',
          status: 'failed',
          telegramUserId: session.telegramUserId,
          privyUserId: context.privyUserId,
          chatId: session.chatId,
          payload: {
            reason: 'telegram_user_mismatch',
          },
        })
        return res
          .status(409)
          .json(withCode({ success: false, error: 'Telegram launch token does not match the active Telegram user.' } satisfies ApiEnvelope<never>, 'INVALID_TELEGRAM_CONTEXT'))
      }
      if (session.chatId && tokenStatus.payload.chatId !== session.chatId) {
        await trackTelegramLinkEvent({
          event: 'telegram_link_token_claim_result',
          source: 'telegram-link-complete',
          flowId,
          phase: 'bind_telegram.complete_backend',
          status: 'failed',
          telegramUserId: session.telegramUserId,
          privyUserId: context.privyUserId,
          chatId: session.chatId,
          payload: {
            reason: 'telegram_chat_mismatch',
          },
        })
        return res
          .status(409)
          .json(withCode({ success: false, error: 'Telegram launch token does not match the active Telegram chat.' } satisfies ApiEnvelope<never>, 'INVALID_TELEGRAM_CONTEXT'))
      }

      const claim = await claimAndConsumeTelegramLinkStartToken({
        db: db as any,
        token: linkToken,
        privyUserId: context.privyUserId,
      })
      if (claim.ok) {
        await trackTelegramLinkEvent({
          event: 'telegram_link_token_claim_result',
          source: 'telegram-link-complete',
          flowId,
          phase: 'bind_telegram.complete_backend',
          status: 'consumed',
          telegramUserId: session.telegramUserId,
          privyUserId: context.privyUserId,
          chatId: session.chatId,
          payload: {
            claimState: claim.state ?? null,
          },
        })
      } else if (claim.reason === 'consumed') {
        if (
          !sameUserExistingLink ||
          claim.existingPrivyUserId?.toLowerCase() !== context.privyUserId.toLowerCase() ||
          !claim.consumedAt
        ) {
          await trackTelegramLinkEvent({
            event: 'telegram_link_token_claim_result',
            source: 'telegram-link-complete',
            flowId,
            phase: 'bind_telegram.complete_backend',
            status: 'failed',
            telegramUserId: session.telegramUserId,
            privyUserId: context.privyUserId,
            chatId: session.chatId,
            payload: {
              reason: 'already_consumed_by_other_user',
            },
          })
          return res
            .status(409)
            .json(withCode({ success: false, error: 'Telegram link token has already been used.' } satisfies ApiEnvelope<never>, 'INVALID_TELEGRAM_CONTEXT'))
        }
        await trackTelegramLinkEvent({
          event: 'telegram_link_token_claim_result',
          source: 'telegram-link-complete',
          flowId,
          phase: 'bind_telegram.complete_backend',
          status: 'already_consumed',
          telegramUserId: session.telegramUserId,
          privyUserId: context.privyUserId,
          chatId: session.chatId,
          payload: {
            idempotent: true,
          },
        })
      } else if (claim.reason === 'claimed_by_other_user') {
        await trackTelegramLinkEvent({
          event: 'telegram_link_token_claim_result',
          source: 'telegram-link-complete',
          flowId,
          phase: 'bind_telegram.complete_backend',
          status: 'failed',
          telegramUserId: session.telegramUserId,
          privyUserId: context.privyUserId,
          chatId: session.chatId,
          payload: {
            reason: 'claimed_by_other_user',
          },
        })
        return res.status(409).json(
          withCode(
            {
              success: false,
              error: 'Recovery required: this Telegram identity is already claimed by another account.',
            } satisfies ApiEnvelope<never>,
            'RECOVERY_REQUIRED',
          ),
        )
      } else {
        await trackTelegramLinkEvent({
          event: 'telegram_link_token_claim_result',
          source: 'telegram-link-complete',
          flowId,
          phase: 'bind_telegram.complete_backend',
          status: 'failed',
          telegramUserId: session.telegramUserId,
          privyUserId: context.privyUserId,
          chatId: session.chatId,
          payload: {
            reason: claim.reason,
          },
        })
        return res.status(claim.reason === 'expired' ? 409 : 400).json(
          withCode(
            {
              success: false,
              error:
                claim.reason === 'expired'
                  ? 'Telegram link token expired. Restart the link flow from Telegram.'
                  : 'Telegram link token is invalid.',
            } satisfies ApiEnvelope<never>,
            claim.reason === 'expired' ? 'EXPIRED_TELEGRAM_SESSION' : 'INVALID_TELEGRAM_CONTEXT',
          ),
        )
      }
    }

    const mergePreflight = await runTelegramMergePreflight({
      db: db as any,
      telegramUserId: session.telegramUserId,
      privyUserId: context.privyUserId,
    })
    if (!mergePreflight.ok) {
      await trackTelegramLinkEvent({
        event: 'telegram_link_backend_completion_result',
        source: 'telegram-link-complete',
        flowId,
        phase: 'bind_telegram.complete_backend',
        status: 'failed',
        telegramUserId: session.telegramUserId,
        privyUserId: context.privyUserId,
        chatId: session.chatId,
        payload: {
          reason: 'merge_preflight_recovery_required',
          mergeReason: mergePreflight.reason ?? null,
        },
      })
      return res.status(409).json(
        withCode(
          {
            success: false,
            error: 'Recovery required: this Telegram account is already linked to another 4626 account.',
          } satisfies ApiEnvelope<never>,
          'RECOVERY_REQUIRED',
        ),
      )
    }

    await recordProviderLink({
      db: db as any,
      privyUserId: context.privyUserId,
      provider: 'telegram',
      value: session.telegramUserId,
      privyUser: context.privyUser,
    })

    const link = await upsertTelegramUserLink({
      db: db as any,
      telegramUserId: session.telegramUserId,
      telegramUsername: session.telegramUsername,
      profileId,
      privyUserId: context.privyUserId,
      canonicalCswAddress,
      ownerVerified,
    })
    if (!link) {
      throw new Error('telegram_link_upsert_failed')
    }

    const account = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    await trackTelegramLinkEvent({
      event: 'telegram_link_backend_completion_result',
      source: 'telegram-link-complete',
      flowId,
      phase: 'bind_telegram.complete_backend',
      status: 'succeeded',
      telegramUserId: session.telegramUserId,
      privyUserId: context.privyUserId,
      chatId: session.chatId,
      payload: {
        linkStatus: link.linkStatus,
        ownerVerified,
      },
    })

    return res.status(200).json({
      success: true,
      data: {
        link,
        account,
      } satisfies LinkCompleteResponse,
    } satisfies ApiEnvelope<LinkCompleteResponse>)
  } catch (error: unknown) {
    if (isIdentityRecoveryRequiredError(error)) {
      await trackTelegramLinkEvent({
        event: 'telegram_link_backend_completion_result',
        source: 'telegram-link-complete',
        flowId,
        phase: 'bind_telegram.complete_backend',
        status: 'failed',
        payload: {
          reason: 'identity_recovery_required',
        },
      })
      return res.status(409).json(
        withCode(
          {
            success: false,
            error: 'Recovery required: this Telegram account is already linked to another 4626 account.',
          } satisfies ApiEnvelope<never>,
          'RECOVERY_REQUIRED',
        ),
      )
    }

    const message = asTrimmed((error as { message?: unknown } | null)?.message) || 'Failed to complete Telegram link'
    const status = isUnauthorizedMessage(message) ? 401 : message === 'profile_sync_failed' ? 409 : 500
    await trackTelegramLinkEvent({
      event: 'telegram_link_backend_completion_result',
      source: 'telegram-link-complete',
      flowId,
      phase: 'bind_telegram.complete_backend',
      status: 'failed',
      payload: {
        reason: message,
        httpStatus: status,
      },
    })
    return res.status(status).json(
      withCode(
        {
          success: false,
          error: message,
        } satisfies ApiEnvelope<never>,
        'UNKNOWN',
      ),
    )
  }
}
