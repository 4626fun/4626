import type { TelegramMiniAppLinkContext } from '@/lib/telegramMiniAppLink'

export type FlowErrorCode =
  | 'INVALID_TELEGRAM_CONTEXT'
  | 'EXPIRED_TELEGRAM_SESSION'
  | 'OTP_SEND_FAILED'
  | 'OTP_VERIFY_FAILED'
  | 'PRIVY_SYNC_FAILED'
  | 'BIND_TELEGRAM_FAILED'
  | 'STALE_TELEGRAM_LAUNCH_PARAMS'
  | 'RECOVERY_REQUIRED'
  | 'UNKNOWN'

export type FlowError = {
  code: FlowErrorCode
  message: string
  recoverable: boolean
}

export type TelegramSessionProof = {
  sessionToken: string
  initDataRaw: string
  telegramUserId: string
  telegramUsername: string | null
  chatId: string | null
  chatType: string | null
  chatInstance: string | null
  expiresAt: string
  verifiedAt: number
  linkContext: TelegramMiniAppLinkContext | null
}

export type CanonicalAccountReady = {
  privyUserId: string
  email: string
  emailVerified: true
  appAccessStatus: string | null
  linkedMethods: Record<string, string[]>
  accountSignals: {
    linked: boolean
    canonicalCswAddress: string | null
    creatorCoin: { address: string } | null
    zoraHandle: string | null
    lastResolvedAt: string | null
  }
  score: {
    points: number
    tier: number
    multipliers?: Record<string, number>
  }
}

export type TelegramLinkResult = {
  telegramUserId: string
  telegramUsername: string | null
  privyUserId: string
  profileId: number
  linkStatus: string
  canonicalCswAddress: string | null
  ownerVerified: boolean
}

type RetryTarget =
  | { tag: 'verify_telegram_session'; linkContext: TelegramMiniAppLinkContext | null }
  | {
      tag: 'wait_for_privy_sync'
      proof: TelegramSessionProof
      email: string
      code: string
      startedAt: number
    }
  | {
      tag: 'bind_telegram'
      proof: TelegramSessionProof
      account: CanonicalAccountReady
      step: 'ensure_privy_link' | 'complete_backend'
    }

export type TelegramLinkState =
  | {
      tag: 'verify_telegram_session'
      linkContext: TelegramMiniAppLinkContext | null
    }
  | {
      tag: 'collect_email'
      proof: TelegramSessionProof
      email: string
      emailError: string | null
    }
  | {
      tag: 'sending_email_code'
      proof: TelegramSessionProof
      email: string
    }
  | {
      tag: 'enter_email_code'
      proof: TelegramSessionProof
      email: string
      code: string
      codeError: string | null
      resendAvailableAt: number | null
    }
  | {
      tag: 'verifying_email_code'
      proof: TelegramSessionProof
      email: string
      code: string
    }
  | {
      tag: 'wait_for_privy_sync'
      proof: TelegramSessionProof
      email: string
      code: string
      startedAt: number
    }
  | {
      tag: 'bind_telegram'
      proof: TelegramSessionProof
      account: CanonicalAccountReady
      step: 'ensure_privy_link' | 'complete_backend'
    }
  | {
      tag: 'success'
      proof: TelegramSessionProof
      account: CanonicalAccountReady
      link: TelegramLinkResult
    }
  | {
      tag: 'expired_or_error'
      proof: TelegramSessionProof | null
      error: FlowError
      email?: string
      code?: string
      retryTarget?: RetryTarget
    }

export type TelegramLinkEvent =
  | { type: 'TELEGRAM_VERIFIED'; proof: TelegramSessionProof }
  | { type: 'TELEGRAM_VERIFY_FAILED'; error: FlowError }
  | { type: 'EMAIL_CHANGED'; email: string }
  | { type: 'SUBMIT_EMAIL'; email: string }
  | { type: 'EMAIL_CODE_SENT'; resendAvailableAt?: number | null }
  | { type: 'EMAIL_CODE_SEND_FAILED'; error: FlowError }
  | { type: 'CODE_CHANGED'; code: string }
  | { type: 'SUBMIT_CODE' }
  | { type: 'EMAIL_CODE_VERIFIED' }
  | { type: 'EMAIL_CODE_VERIFY_FAILED'; error: FlowError }
  | { type: 'PRIVY_SYNC_READY'; account: CanonicalAccountReady }
  | { type: 'PRIVY_SYNC_FAILED'; error: FlowError }
  | { type: 'PRIVY_TELEGRAM_LINK_SKIPPED' }
  | { type: 'PRIVY_TELEGRAM_LINK_SUCCEEDED' }
  | { type: 'PRIVY_TELEGRAM_LINK_FAILED'; error: FlowError }
  | { type: 'BIND_TELEGRAM_SUCCEEDED'; link: TelegramLinkResult }
  | { type: 'BIND_TELEGRAM_FAILED'; error: FlowError }
  | { type: 'RESEND_CODE' }
  | { type: 'RETRY' }
  | { type: 'RESET' }

export function createFlowError(params: {
  code: FlowErrorCode
  message: string
  recoverable?: boolean
}): FlowError {
  return {
    code: params.code,
    message: params.message,
    recoverable: params.recoverable === true,
  }
}

export function normalizeEmailCandidate(value: string): string {
  return value.trim().toLowerCase()
}

export function createInitialTelegramLinkState(linkContext: TelegramMiniAppLinkContext | null): TelegramLinkState {
  return {
    tag: 'verify_telegram_session',
    linkContext,
  }
}

function withRecoverableOtpSendFailure(
  state: Extract<TelegramLinkState, { tag: 'sending_email_code' }>,
  error: FlowError,
): TelegramLinkState {
  if (error.recoverable) {
    return {
      tag: 'collect_email',
      proof: state.proof,
      email: state.email,
      emailError: error.message,
    }
  }
  return {
    tag: 'expired_or_error',
    proof: state.proof,
    error,
    email: state.email,
    retryTarget: {
      tag: 'verify_telegram_session',
      linkContext: state.proof.linkContext,
    },
  }
}

function withRecoverableOtpVerifyFailure(
  state: Extract<TelegramLinkState, { tag: 'verifying_email_code' }>,
  error: FlowError,
): TelegramLinkState {
  if (error.recoverable) {
    return {
      tag: 'enter_email_code',
      proof: state.proof,
      email: state.email,
      code: state.code,
      codeError: error.message,
      resendAvailableAt: null,
    }
  }
  return {
    tag: 'expired_or_error',
    proof: state.proof,
    error,
    email: state.email,
    code: state.code,
    retryTarget: {
      tag: 'verify_telegram_session',
      linkContext: state.proof.linkContext,
    },
  }
}

export function telegramLinkReducer(state: TelegramLinkState, event: TelegramLinkEvent): TelegramLinkState {
  switch (state.tag) {
    case 'verify_telegram_session':
      switch (event.type) {
        case 'TELEGRAM_VERIFIED':
          return {
            tag: 'collect_email',
            proof: event.proof,
            email: '',
            emailError: null,
          }
        case 'TELEGRAM_VERIFY_FAILED':
          return {
            tag: 'expired_or_error',
            proof: null,
            error: event.error,
            retryTarget: {
              tag: 'verify_telegram_session',
              linkContext: state.linkContext,
            },
          }
        case 'RESET':
          return createInitialTelegramLinkState(state.linkContext)
        default:
          return state
      }

    case 'collect_email':
      switch (event.type) {
        case 'EMAIL_CHANGED':
          return {
            ...state,
            email: event.email,
            emailError: null,
          }
        case 'SUBMIT_EMAIL':
          return {
            tag: 'sending_email_code',
            proof: state.proof,
            email: event.email,
          }
        case 'RESET':
          return {
            ...state,
            email: '',
            emailError: null,
          }
        default:
          return state
      }

    case 'sending_email_code':
      switch (event.type) {
        case 'EMAIL_CODE_SENT':
          return {
            tag: 'enter_email_code',
            proof: state.proof,
            email: state.email,
            code: '',
            codeError: null,
            resendAvailableAt: event.resendAvailableAt ?? null,
          }
        case 'EMAIL_CODE_SEND_FAILED':
          return withRecoverableOtpSendFailure(state, event.error)
        default:
          return state
      }

    case 'enter_email_code':
      switch (event.type) {
        case 'CODE_CHANGED':
          return {
            ...state,
            code: event.code,
            codeError: null,
          }
        case 'SUBMIT_CODE':
          return {
            tag: 'verifying_email_code',
            proof: state.proof,
            email: state.email,
            code: state.code,
          }
        case 'RESEND_CODE':
          return {
            tag: 'sending_email_code',
            proof: state.proof,
            email: state.email,
          }
        case 'RESET':
          return {
            ...state,
            code: '',
            codeError: null,
          }
        default:
          return state
      }

    case 'verifying_email_code':
      switch (event.type) {
        case 'EMAIL_CODE_VERIFIED':
          return {
            tag: 'wait_for_privy_sync',
            proof: state.proof,
            email: state.email,
            code: state.code,
            startedAt: Date.now(),
          }
        case 'EMAIL_CODE_VERIFY_FAILED':
          return withRecoverableOtpVerifyFailure(state, event.error)
        default:
          return state
      }

    case 'wait_for_privy_sync':
      switch (event.type) {
        case 'PRIVY_SYNC_READY':
          return {
            tag: 'bind_telegram',
            proof: state.proof,
            account: event.account,
            step: 'ensure_privy_link',
          }
        case 'PRIVY_SYNC_FAILED':
          return {
            tag: 'expired_or_error',
            proof: state.proof,
            error: event.error,
            email: state.email,
            code: state.code,
            retryTarget: event.error.recoverable
              ? {
                  tag: 'wait_for_privy_sync',
                  proof: state.proof,
                  email: state.email,
                  code: state.code,
                  startedAt: Date.now(),
                }
              : {
                  tag: 'verify_telegram_session',
                  linkContext: state.proof.linkContext,
                },
          }
        default:
          return state
      }

    case 'bind_telegram':
      switch (event.type) {
        case 'PRIVY_TELEGRAM_LINK_SKIPPED':
        case 'PRIVY_TELEGRAM_LINK_SUCCEEDED':
          return {
            ...state,
            step: 'complete_backend',
          }
        case 'PRIVY_TELEGRAM_LINK_FAILED':
        case 'BIND_TELEGRAM_FAILED':
          return {
            tag: 'expired_or_error',
            proof: state.proof,
            error: event.error,
            email: state.account.email,
            retryTarget: event.error.recoverable
              ? {
                  tag: 'bind_telegram',
                  proof: state.proof,
                  account: state.account,
                  step: state.step,
                }
              : {
                  tag: 'verify_telegram_session',
                  linkContext: state.proof.linkContext,
                },
          }
        case 'BIND_TELEGRAM_SUCCEEDED':
          return {
            tag: 'success',
            proof: state.proof,
            account: state.account,
            link: event.link,
          }
        default:
          return state
      }

    case 'expired_or_error':
      switch (event.type) {
        case 'RETRY':
          if (!state.retryTarget) return state
          if (state.retryTarget.tag === 'verify_telegram_session') {
            return createInitialTelegramLinkState(state.retryTarget.linkContext)
          }
          return state.retryTarget
        case 'RESET':
          return createInitialTelegramLinkState(state.proof?.linkContext ?? null)
        default:
          return state
      }

    case 'success':
      switch (event.type) {
        case 'RESET':
          return createInitialTelegramLinkState(state.proof.linkContext)
        default:
          return state
      }
  }
}

type LinkedTelegramAccount = {
  type?: string
  telegramUserId?: string
  username?: string | null
}

export function hasMatchingPrivyTelegramAccount(
  user: { linkedAccounts?: LinkedTelegramAccount[] | null; linked_accounts?: LinkedTelegramAccount[] | null } | null | undefined,
  proof: TelegramSessionProof,
): boolean {
  const linkedAccounts = [
    ...(Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []),
    ...(Array.isArray(user?.linked_accounts) ? user.linked_accounts : []),
  ]
  return linkedAccounts.some((account) => {
    if (account?.type !== 'telegram') return false
    const telegramUserId = typeof account.telegramUserId === 'string' ? account.telegramUserId.trim() : ''
    return telegramUserId === proof.telegramUserId
  })
}

export function isTelegramLaunchParamError(code: string | null | undefined): boolean {
  const normalized = String(code ?? '').trim().toLowerCase()
  return normalized === 'invalid_data' || normalized === 'failed_to_link_account' || normalized === 'missing_or_invalid_token'
}
