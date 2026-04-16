// Pure helpers + view-model types extracted from TelegramLink.tsx.
// No React, no window, no DOM. Safe for unit testing in isolation.

import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { TelegramMiniAppLinkContext } from '@/lib/telegram/telegramMiniAppLink'
import {
  createFlowError,
  normalizeEmailCandidate,
  type FlowError,
  type TelegramLinkReadyAccount,
  type TelegramLinkResult,
  type TelegramLinkState,
  type TelegramSessionProof,
} from '@/features/telegram-link/telegramLinkFlow'

export type TelegramApiEnvelope<T> = ApiEnvelope<T> & { code?: string }

export type TelegramLinkReadyData = {
  ready: boolean
  account: TelegramLinkReadyAccount | null
}

export type TelegramLinkCompleteData = {
  link: TelegramLinkResult
  account: unknown
}

export type PrivyAuthBridgeResponse = {
  address: string
  sessionToken: string
  privyUserId?: string
}

export type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

export type LinkTelegramParams = {
  launchParams?: {
    initDataRaw?: string
  }
}

export const OTP_RESEND_DELAY_MS = 30_000
export const OTP_SEND_TIMEOUT_MS = 12_000
export const PRIVY_SYNC_TIMEOUT_MS = 45_000
export const PRIVY_ACCESS_TOKEN_TIMEOUT_MS = 4_000
export const EMBEDDED_WALLET_PROVISION_TIMEOUT_MS = 20_000
export const TELEGRAM_LINK_READY_REQUEST_TIMEOUT_MS = 4_000
export const PRIVY_LINK_TELEGRAM_TIMEOUT_MS = 10_000
export const TELEGRAM_LINK_COMPLETE_REQUEST_TIMEOUT_MS = 10_000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const lc = value.trim().toLowerCase()
    return lc === '1' || lc === 'true' || lc === 'yes'
  }
  return false
}

export function accountHasVerifiedFlag(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const account = value as Record<string, unknown>
  if (isTruthy(account.verified)) return true
  if (isTruthy(account.isVerified)) return true
  if (isTruthy(account.is_verified)) return true
  const hasTimestamp = (candidate: unknown): boolean => {
    if (typeof candidate === 'number') return Number.isFinite(candidate) && candidate > 0
    if (typeof candidate === 'string') return candidate.trim().length > 0
    return false
  }
  return (
    hasTimestamp(account.verifiedAt) ||
    hasTimestamp(account.verified_at) ||
    hasTimestamp(account.firstVerifiedAt) ||
    hasTimestamp(account.first_verified_at) ||
    hasTimestamp(account.latestVerifiedAt) ||
    hasTimestamp(account.latest_verified_at)
  )
}

export function candidateEmailFromAccount(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const account = value as Record<string, unknown>
  const candidates = [account.address, account.emailAddress, account.email_address, account.email]
  for (const candidate of candidates) {
    const normalized = normalizeEmailCandidate(typeof candidate === 'string' ? candidate : '')
    if (normalized && EMAIL_RE.test(normalized)) return normalized
  }
  return null
}

export function extractPrivyVerifiedEmailFromUser(user: unknown): string | null {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return null

  const directEmail = record.email && typeof record.email === 'object' ? (record.email as Record<string, unknown>) : null
  if (directEmail && accountHasVerifiedFlag(directEmail)) {
    const direct = candidateEmailFromAccount(directEmail)
    if (direct) return direct
  }

  const linked = [
    ...(Array.isArray(record.linkedAccounts) ? (record.linkedAccounts as unknown[]) : []),
    ...(Array.isArray(record.linked_accounts) ? (record.linked_accounts as unknown[]) : []),
  ]
  for (const account of linked) {
    const linkedRecord = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!linkedRecord) continue
    const type = normalizeLower(linkedRecord.type)
    if (!type.includes('email')) continue
    if (!accountHasVerifiedFlag(linkedRecord)) continue
    const candidate = candidateEmailFromAccount(linkedRecord)
    if (candidate) return candidate
  }

  return null
}

export function extractPrivyUserIdFromUser(user: unknown): string {
  if (!user || typeof user !== 'object') return ''
  const record = user as Record<string, unknown>
  const candidates = [record.id, record.userId, record.user_id, record.sub]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        globalThis.clearTimeout(timeoutId)
      })
  })
}

export async function readPrivyAccessToken(read: (() => Promise<unknown>) | null | undefined): Promise<string> {
  if (typeof read !== 'function') return ''
  try {
    const value = await withTimeout(
      Promise.resolve().then(() => read()),
      PRIVY_ACCESS_TOKEN_TIMEOUT_MS,
      'Privy access token read timed out.',
    )
    return String(value ?? '').trim()
  } catch {
    return ''
  }
}

export function coerceErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  const maybeMessage = typeof (error as { message?: unknown } | null)?.message === 'string' ? String((error as { message: unknown }).message) : ''
  if (maybeMessage.trim()) return maybeMessage.trim()
  return fallback
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmailCandidate(email))
}

export type EmailSubmitDisabledReason = 'not_collect_email' | 'empty' | 'invalid_email'

export function getEmailSubmitAssessment(
  state: TelegramLinkState,
  emailOverride?: string,
): {
  disabledReason: EmailSubmitDisabledReason | null
  normalizedEmail: string
  emailValid: boolean
} {
  if (state.tag !== 'collect_email') {
    return {
      disabledReason: 'not_collect_email',
      normalizedEmail: '',
      emailValid: false,
    }
  }
  const normalized = normalizeEmailCandidate(emailOverride ?? state.email)
  if (!normalized) {
    return {
      disabledReason: 'empty',
      normalizedEmail: normalized,
      emailValid: false,
    }
  }
  if (!isValidEmail(normalized)) {
    return {
      disabledReason: 'invalid_email',
      normalizedEmail: normalized,
      emailValid: false,
    }
  }
  return {
    disabledReason: null,
    normalizedEmail: normalized,
    emailValid: true,
  }
}

export function buildOtpSendError(error: unknown): FlowError {
  const message = coerceErrorMessage(error, 'Unable to send verification code.')
  const lower = message.toLowerCase()
  if (lower.includes('telegram') || lower.includes('mini app') || lower.includes('session')) {
    return createFlowError({
      code: 'EXPIRED_TELEGRAM_SESSION',
      message,
      recoverable: false,
    })
  }
  return createFlowError({
    code: 'OTP_SEND_FAILED',
    message,
    recoverable: true,
  })
}

export function buildOtpVerifyError(error: unknown): FlowError {
  const message = coerceErrorMessage(error, 'Verification code rejected.')
  const lower = message.toLowerCase()
  if (lower.includes('telegram') || lower.includes('mini app') || lower.includes('session')) {
    return createFlowError({
      code: 'EXPIRED_TELEGRAM_SESSION',
      message,
      recoverable: false,
    })
  }
  return createFlowError({
    code: 'OTP_VERIFY_FAILED',
    message,
    recoverable: true,
  })
}

export function buildTelegramSessionError(error: string, statusCode: number): FlowError {
  if (statusCode === 410 || /expired|revoked/i.test(error)) {
    return createFlowError({
      code: 'EXPIRED_TELEGRAM_SESSION',
      message: 'Telegram session expired. Reopen the Mini App from Telegram and verify again.',
    })
  }
  return createFlowError({
    code: 'INVALID_TELEGRAM_CONTEXT',
    message: statusCode === 400 ? 'Telegram launch context is missing or invalid.' : error || 'Telegram session verification failed.',
  })
}

export function buildPrivySyncFailure(message?: string, recoverable = true): FlowError {
  return createFlowError({
    code: 'PRIVY_SYNC_FAILED',
    message: message || '4626 account sync did not complete after email verification. Retry to continue.',
    recoverable,
  })
}

export function buildBindFailure(message?: string, recoverable = true): FlowError {
  return createFlowError({
    code: 'BIND_TELEGRAM_FAILED',
    message: message || 'Unable to bind the Telegram identity.',
    recoverable,
  })
}

export function buildLaunchParamFailure(): FlowError {
  return createFlowError({
    code: 'STALE_TELEGRAM_LAUNCH_PARAMS',
    message: 'Telegram launch parameters expired. Reopen the Mini App from Telegram and restart linking.',
  })
}

export function parseTelegramLinkReadyAccount(data: unknown, expectedEmail: string): TelegramLinkReadyAccount | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const email = normalizeEmailCandidate(typeof record.email === 'string' ? record.email : '')
  if (!email || email !== normalizeEmailCandidate(expectedEmail)) return null
  if (record.emailVerified !== true) return null
  const canonicalCswAddress =
    typeof record.canonicalCswAddress === 'string' && record.canonicalCswAddress.trim()
      ? record.canonicalCswAddress.trim()
      : null
  const privyUserId = typeof record.privyUserId === 'string' ? record.privyUserId.trim() : ''
  if (!privyUserId) return null
  return {
    privyUserId,
    email,
    emailVerified: true,
    canonicalCswAddress,
  }
}

export function getFlowHeadline(tag: string): string {
  switch (tag) {
    case 'verify_telegram_session':
      return 'Verify Telegram'
    case 'collect_email':
    case 'sending_email_code':
      return 'Enter Email Address'
    case 'enter_email_code':
    case 'verifying_email_code':
      return 'Enter Verification Code'
    case 'wait_for_privy_sync':
      return 'Resolving Account'
    case 'bind_telegram':
      return 'Linking Telegram'
    case 'success':
      return 'Telegram Linked'
    case 'expired_or_error':
      return 'Reconnect Telegram'
    default:
      return 'Telegram Link'
  }
}

export function getFlowDescription(tag: string): string {
  switch (tag) {
    case 'verify_telegram_session':
      return 'Validating the Telegram Mini App proof.'
    case 'collect_email':
    case 'sending_email_code':
      return 'Use the email for your 4626 account. We’ll verify it, then attach this Telegram account.'
    case 'enter_email_code':
    case 'verifying_email_code':
      return 'Enter the 6-digit code we emailed you to keep setup moving inside Telegram.'
    case 'wait_for_privy_sync':
      return 'We’re confirming your verified 4626 account before attaching Telegram.'
    case 'bind_telegram':
      return 'Telegram is being attached to your verified 4626 account now.'
    case 'success':
      return 'Your 4626 account is verified and this Telegram account is connected.'
    case 'expired_or_error':
      return 'Telegram launch or account sync could not complete.'
    default:
      return ''
  }
}

export function getFlowProgressIndex(tag: TelegramLinkState['tag']): number {
  switch (tag) {
    case 'verify_telegram_session':
      return 1
    case 'collect_email':
    case 'sending_email_code':
      return 2
    case 'enter_email_code':
    case 'verifying_email_code':
      return 3
    case 'wait_for_privy_sync':
    case 'bind_telegram':
    case 'success':
    case 'expired_or_error':
      return 4
    default:
      return 1
  }
}

export function getErrorTitle(error: FlowError): string {
  switch (error.code) {
    case 'INVALID_TELEGRAM_CONTEXT':
      return 'Invalid Telegram Context'
    case 'EXPIRED_TELEGRAM_SESSION':
      return 'Telegram Session Expired'
    case 'STALE_TELEGRAM_LAUNCH_PARAMS':
      return 'Launch Parameters Expired'
    case 'PRIVY_SYNC_FAILED':
      return 'Account Sync Failed'
    case 'RECOVERY_REQUIRED':
      return 'Recovery Required'
    case 'BIND_TELEGRAM_FAILED':
      return 'Telegram Bind Failed'
    default:
      return 'Flow Error'
  }
}

export type ExpiredOrErrorState = Extract<TelegramLinkState, { tag: 'expired_or_error' }>
export type OwnerSetupHandoffState = ExpiredOrErrorState & {
  error: FlowError & { recoverable: true }
}

export function isOwnerSetupHandoffState(state: TelegramLinkState): state is OwnerSetupHandoffState {
  if (state.tag !== 'expired_or_error' || !state.error.recoverable) return false
  const retryTag = state.retryTarget?.tag
  return retryTag === 'wait_for_privy_sync' || retryTag === 'bind_telegram' || state.error.code === 'PRIVY_SYNC_FAILED'
}

export function prefersLinkedHandoffCopy(state: OwnerSetupHandoffState): boolean {
  return state.error.code === 'PRIVY_SYNC_FAILED' || state.retryTarget?.tag === 'wait_for_privy_sync'
}

export function formatTelegramHandle(username: string | null, userId: string): string {
  return username ? `@${username}` : `user:${userId}`
}

export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export function getTelemetryProof(state: TelegramLinkState): TelegramSessionProof | null {
  switch (state.tag) {
    case 'collect_email':
    case 'sending_email_code':
    case 'enter_email_code':
    case 'verifying_email_code':
    case 'wait_for_privy_sync':
    case 'bind_telegram':
    case 'success':
      return state.proof
    case 'expired_or_error':
      return state.proof ?? null
    default:
      return null
  }
}

export function getTelemetryLinkContext(state: TelegramLinkState): TelegramMiniAppLinkContext | null {
  if (state.tag === 'verify_telegram_session') return state.linkContext
  const proof = getTelemetryProof(state)
  if (proof?.linkContext) return proof.linkContext
  if (state.tag === 'expired_or_error' && state.retryTarget?.tag === 'verify_telegram_session') {
    return state.retryTarget.linkContext
  }
  return null
}

export function getTelemetryPhase(state: TelegramLinkState): string {
  if (state.tag === 'bind_telegram') {
    return state.step === 'ensure_privy_link'
      ? 'bind_telegram.ensure_privy_link'
      : 'bind_telegram.complete_backend'
  }
  return state.tag
}

export type FlowStateDescriptor = {
  tag: TelegramLinkState['tag']
  step: string | null
  errorCode: string | null
}

export function describeFlowState(state: TelegramLinkState): FlowStateDescriptor {
  if (state.tag === 'bind_telegram') {
    return {
      tag: state.tag,
      step: state.step,
      errorCode: null,
    }
  }
  if (state.tag === 'expired_or_error') {
    return {
      tag: state.tag,
      step: null,
      errorCode: state.error.code,
    }
  }
  return {
    tag: state.tag,
    step: null,
    errorCode: null,
  }
}

export function formatFlowStateDescriptor(value: FlowStateDescriptor): string {
  return value.step ? `${value.tag}:${value.step}` : value.tag
}
