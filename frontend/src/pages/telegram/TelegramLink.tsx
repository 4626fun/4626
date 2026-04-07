import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, ShieldX, Unplug, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth'

import { PageMeta } from '@/components/seo/PageMeta'
import { apiFetch } from '@/lib/apiBase'
import type { ApiEnvelope } from '@/lib/apiEnvelope'
import { writeStoredSessionToken } from '@/hooks/useSiweAuth'
import {
  clearStoredTelegramMiniAppLinkContext,
  resolveTelegramMiniAppLinkContext,
  stripTelegramMiniAppLinkParams,
  type TelegramMiniAppLinkContext,
} from '@/lib/telegramMiniAppLink'
import { createTelegramLinkFlowId, trackTelegramLinkTelemetryEvent } from '@/lib/telegramLinkTelemetry'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import {
  ensureTelegramMiniAppSession,
  loadTelegramWebApp,
  openTelegramExternalLink,
  readTelegramWebApp,
  setupTelegramMiniAppUi,
} from '@/lib/telegramWebApp'

import {
  createFlowError,
  createInitialTelegramLinkState,
  hasMatchingPrivyTelegramAccount,
  isTelegramLaunchParamError,
  normalizeEmailCandidate,
  telegramLinkReducer,
  type FlowError,
  type TelegramLinkResult,
  type TelegramLinkReadyAccount,
  type TelegramLinkState,
  type TelegramSessionProof,
} from '@/features/telegram-link/telegramLinkFlow'

type TelegramApiEnvelope<T> = ApiEnvelope<T> & { code?: string }

type TelegramLinkReadyData = {
  ready: boolean
  account: TelegramLinkReadyAccount | null
}

type TelegramLinkCompleteData = {
  link: TelegramLinkResult
  account: unknown
}

type PrivyAuthBridgeResponse = {
  address: string
  sessionToken: string
  privyUserId?: string
}

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

type LinkTelegramParams = {
  launchParams?: {
    initDataRaw?: string
  }
}

type PrivyWithTelegramLink = ReturnType<typeof usePrivy> & {
  linkTelegram?: (params?: LinkTelegramParams) => Promise<unknown> | unknown
}

const OTP_RESEND_DELAY_MS = 30_000
const OTP_SEND_TIMEOUT_MS = 12_000
const PRIVY_SYNC_TIMEOUT_MS = 45_000
const PRIVY_ACCESS_TOKEN_TIMEOUT_MS = 4_000
const EMBEDDED_WALLET_PROVISION_TIMEOUT_MS = 20_000
const TELEGRAM_LINK_READY_REQUEST_TIMEOUT_MS = 4_000
const PRIVY_LINK_TELEGRAM_TIMEOUT_MS = 10_000
const TELEGRAM_LINK_COMPLETE_REQUEST_TIMEOUT_MS = 10_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const TG_VIEWPORT_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  height: 'var(--cv-tg-viewport-stable-height, 100dvh)',
  maxHeight: 'var(--cv-tg-viewport-stable-height, 100dvh)',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  paddingTop: 'max(10px, var(--cv-tg-safe-top, 0px))',
  paddingBottom: 'max(10px, var(--cv-tg-content-safe-bottom, 0px))',
  paddingLeft: 'max(12px, var(--cv-tg-content-safe-left, 0px))',
  paddingRight: 'max(12px, var(--cv-tg-content-safe-right, 0px))',
}

const PRIMARY_ACTION_BUTTON_CLASS =
  'inline-flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-[16px] bg-[#0052FF] px-4 text-sm font-semibold text-white transition hover:bg-[#004AD9] disabled:cursor-not-allowed disabled:bg-[#1E3A8A] disabled:text-white/70'
const SECONDARY_ACTION_BUTTON_CLASS =
  'inline-flex h-11 w-full touch-manipulation items-center justify-center rounded-[16px] border border-white/[0.06] bg-transparent px-4 text-sm font-medium text-[#EDEDED] transition hover:border-white/15 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-55'
const TELEGRAM_LINK_PROGRESS_STEPS = [
  { key: 'telegram', label: 'Telegram' },
  { key: 'email', label: 'Email' },
  { key: 'code', label: 'Code' },
  { key: 'link', label: 'Link' },
] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const lc = value.trim().toLowerCase()
    return lc === '1' || lc === 'true' || lc === 'yes'
  }
  return false
}

function accountHasVerifiedFlag(value: unknown): boolean {
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

function candidateEmailFromAccount(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const account = value as Record<string, unknown>
  const candidates = [account.address, account.emailAddress, account.email_address, account.email]
  for (const candidate of candidates) {
    const normalized = normalizeEmailCandidate(typeof candidate === 'string' ? candidate : '')
    if (normalized && EMAIL_RE.test(normalized)) return normalized
  }
  return null
}

function extractPrivyVerifiedEmailFromUser(user: unknown): string | null {
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

function extractPrivyUserIdFromUser(user: unknown): string {
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
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

async function readPrivyAccessToken(read: (() => Promise<unknown>) | null | undefined): Promise<string> {
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

function coerceErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  const maybeMessage = typeof (error as { message?: unknown } | null)?.message === 'string' ? String((error as any).message) : ''
  if (maybeMessage.trim()) return maybeMessage.trim()
  return fallback
}

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmailCandidate(email))
}

type EmailSubmitDisabledReason = 'not_collect_email' | 'empty' | 'invalid_email'

function getEmailSubmitAssessment(
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

function buildOtpSendError(error: unknown): FlowError {
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

function buildOtpVerifyError(error: unknown): FlowError {
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

function buildTelegramSessionError(error: string, statusCode: number): FlowError {
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

function buildPrivySyncFailure(message?: string, recoverable = true): FlowError {
  return createFlowError({
    code: 'PRIVY_SYNC_FAILED',
    message: message || '4626 account sync did not complete after email verification. Retry to continue.',
    recoverable,
  })
}

function buildBindFailure(message?: string, recoverable = true): FlowError {
  return createFlowError({
    code: 'BIND_TELEGRAM_FAILED',
    message: message || 'Unable to bind the Telegram identity.',
    recoverable,
  })
}

function buildLaunchParamFailure(): FlowError {
  return createFlowError({
    code: 'STALE_TELEGRAM_LAUNCH_PARAMS',
    message: 'Telegram launch parameters expired. Reopen the Mini App from Telegram and restart linking.',
  })
}

function parseTelegramLinkReadyAccount(data: unknown, expectedEmail: string): TelegramLinkReadyAccount | null {
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

function getFlowHeadline(tag: string): string {
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

function getFlowDescription(tag: string): string {
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

function getFlowProgressIndex(tag: TelegramLinkState['tag']): number {
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

function getErrorTitle(error: FlowError): string {
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

type ExpiredOrErrorState = Extract<TelegramLinkState, { tag: 'expired_or_error' }>
type OwnerSetupHandoffState = ExpiredOrErrorState & {
  error: FlowError & { recoverable: true }
}

function isOwnerSetupHandoffState(state: TelegramLinkState): state is OwnerSetupHandoffState {
  if (state.tag !== 'expired_or_error' || !state.error.recoverable) return false
  const retryTag = state.retryTarget?.tag
  return retryTag === 'wait_for_privy_sync' || retryTag === 'bind_telegram' || state.error.code === 'PRIVY_SYNC_FAILED'
}

function prefersLinkedHandoffCopy(state: OwnerSetupHandoffState): boolean {
  return state.error.code === 'PRIVY_SYNC_FAILED' || state.retryTarget?.tag === 'wait_for_privy_sync'
}

function formatTelegramHandle(username: string | null, userId: string): string {
  return username ? `@${username}` : `user:${userId}`
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function getTelemetryProof(state: TelegramLinkState): TelegramSessionProof | null {
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

function getTelemetryLinkContext(state: TelegramLinkState): TelegramMiniAppLinkContext | null {
  if (state.tag === 'verify_telegram_session') return state.linkContext
  const proof = getTelemetryProof(state)
  if (proof?.linkContext) return proof.linkContext
  if (state.tag === 'expired_or_error' && state.retryTarget?.tag === 'verify_telegram_session') {
    return state.retryTarget.linkContext
  }
  return null
}

function getTelemetryPhase(state: TelegramLinkState): string {
  if (state.tag === 'bind_telegram') {
    return state.step === 'ensure_privy_link'
      ? 'bind_telegram.ensure_privy_link'
      : 'bind_telegram.complete_backend'
  }
  return state.tag
}

type FlowStateDescriptor = {
  tag: TelegramLinkState['tag']
  step: string | null
  errorCode: string | null
}

function describeFlowState(state: TelegramLinkState): FlowStateDescriptor {
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

function formatFlowStateDescriptor(value: FlowStateDescriptor): string {
  return value.step ? `${value.tag}:${value.step}` : value.tag
}

export function TelegramLink() {
  const location = useLocation()
  const navigate = useNavigate()

  const [state, dispatch] = useReducer(
    telegramLinkReducer,
    location.search,
    (initialSearch) => createInitialTelegramLinkState(resolveTelegramMiniAppLinkContext(new URLSearchParams(initialSearch))),
  )
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [ownerSetupHandoffBusy, setOwnerSetupHandoffBusy] = useState(false)
  const [ownerSetupHandoffError, setOwnerSetupHandoffError] = useState<string | null>(null)

  const privy = usePrivy() as PrivyWithTelegramLink
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const { embeddedEoaAddress, ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const getAccessToken = typeof privy.getAccessToken === 'function' ? privy.getAccessToken.bind(privy) : null
  const stateRef = useRef(state)
  const sendCodeRef = useRef(sendCode)
  const loginWithCodeRef = useRef(loginWithCode)
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const flowIdRef = useRef(createTelegramLinkFlowId())
  const flowStartedAtRef = useRef(Date.now())
  const lastStateDescriptorRef = useRef<FlowStateDescriptor | null>(null)
  const lastEmailSubmitDisabledReasonRef = useRef<string | null>(null)
  const emailSubmitGestureLockRef = useRef(false)
  const emailSubmitGestureResetTimerRef = useRef<number | null>(null)
  const telegramMainButtonHandlerRef = useRef<(() => void) | null>(null)
  const emailSendExecutionKeyRef = useRef<string | null>(null)
  const codeVerifyExecutionKeyRef = useRef<string | null>(null)
  const bindExecutionKeyRef = useRef<string | null>(null)
  const [telegramUiReady, setTelegramUiReady] = useState(false)
  const telegramWebApp = telegramUiReady ? readTelegramWebApp() : null
  const privySnapshotRef = useRef({
    ready: Boolean(privy.ready),
    authenticated: Boolean(privy.authenticated),
    user: privy.user ?? null,
    getAccessToken,
    linkTelegram: typeof privy.linkTelegram === 'function' ? privy.linkTelegram.bind(privy) : null,
  })
  const {
    disabledReason: emailSubmitDisabledReason,
    normalizedEmail: normalizedCollectEmail,
    emailValid: emailIsValid,
  } = getEmailSubmitAssessment(state)
  const emailSubmitDisabled = emailSubmitDisabledReason !== null
  const hasTelegramMainButton = Boolean(telegramWebApp?.MainButton)
  const canCloseTelegramMiniApp = typeof telegramWebApp?.close === 'function'

  const openOwnerInstallHandoff = useCallback(async () => {
    const snapshot = privySnapshotRef.current
    setOwnerSetupHandoffBusy(true)
    setOwnerSetupHandoffError(null)
    try {
      if (typeof snapshot.getAccessToken !== 'function') {
        throw new Error('Privy access token reader is unavailable. Reopen Telegram linking and retry.')
      }

      const accessToken = await readPrivyAccessToken(snapshot.getAccessToken)
      if (!accessToken) {
        throw new Error('Privy access token is unavailable. Reopen Telegram linking and retry.')
      }

      const authRes = await apiFetch('/api/auth/privy', {
        method: 'POST',
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })
      const authJson = (await authRes.json().catch(() => null)) as TelegramApiEnvelope<PrivyAuthBridgeResponse> | null
      if (!authRes.ok || !authJson?.success || !authJson.data?.sessionToken) {
        throw new Error(authJson?.error || 'Could not establish a 4626 session for setup continuation.')
      }
      writeStoredSessionToken(authJson.data.sessionToken)

      const handoffRes = await apiFetch('/api/auth/handoff/create', {
        method: 'POST',
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ privyToken: accessToken }),
      })
      const handoffJson = (await handoffRes.json().catch(() => null)) as TelegramApiEnvelope<HandoffCreateResponse> | null
      const handoffCode =
        handoffRes.ok && handoffJson?.success && typeof handoffJson.data?.code === 'string'
          ? handoffJson.data.code.trim()
          : ''
      if (!handoffCode) {
        throw new Error(handoffJson?.error || 'Could not prepare the setup handoff.')
      }

      const targetUrl = new URL('/accounts', window.location.origin)
      targetUrl.searchParams.set('cv_handoff', handoffCode)
      targetUrl.searchParams.set('setup', 'owner-install')
      targetUrl.searchParams.set('source', 'telegram')

      if (!openTelegramExternalLink(targetUrl.toString())) {
        throw new Error('Could not open the Accounts setup surface from Telegram.')
      }
    } catch (error) {
      setOwnerSetupHandoffError(coerceErrorMessage(error, 'Could not open the Accounts setup surface from Telegram.'))
    } finally {
      setOwnerSetupHandoffBusy(false)
    }
  }, [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    setOwnerSetupHandoffBusy(false)
    setOwnerSetupHandoffError(null)
  }, [state.tag])

  useEffect(() => {
    sendCodeRef.current = sendCode
  }, [sendCode])

  useEffect(() => {
    loginWithCodeRef.current = loginWithCode
  }, [loginWithCode])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    const body = document.body
    html.classList.add('telegram-link-html-lock')
    body.classList.add('telegram-link-body-lock')

    return () => {
      html.classList.remove('telegram-link-html-lock')
      body.classList.remove('telegram-link-body-lock')
      if (emailSubmitGestureResetTimerRef.current !== null) {
        window.clearTimeout(emailSubmitGestureResetTimerRef.current)
        emailSubmitGestureResetTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (state.tag !== 'collect_email') {
      emailSubmitGestureLockRef.current = false
      if (emailSubmitGestureResetTimerRef.current !== null) {
        window.clearTimeout(emailSubmitGestureResetTimerRef.current)
        emailSubmitGestureResetTimerRef.current = null
      }
    }
  }, [state.tag])

  useEffect(() => {
    if (state.tag !== 'sending_email_code') {
      emailSendExecutionKeyRef.current = null
    }
    if (state.tag !== 'verifying_email_code') {
      codeVerifyExecutionKeyRef.current = null
    }
    if (state.tag !== 'bind_telegram') {
      bindExecutionKeyRef.current = null
    }
  }, [state.tag])

  useEffect(() => {
    privySnapshotRef.current = {
      ready: Boolean(privy.ready),
      authenticated: Boolean(privy.authenticated),
      user: privy.user ?? null,
      getAccessToken,
      linkTelegram: typeof privy.linkTelegram === 'function' ? privy.linkTelegram.bind(privy) : null,
    }
  }, [getAccessToken, privy, privy.authenticated, privy.linkTelegram, privy.ready, privy.user])

  const emitTelemetry = useCallback((
    event: string,
    payload: Record<string, unknown> = {},
    snapshot: TelegramLinkState = stateRef.current,
  ) => {
    const proof = getTelemetryProof(snapshot)
    const linkContext = getTelemetryLinkContext(snapshot)
    trackTelegramLinkTelemetryEvent({
      event,
      flowId: flowIdRef.current,
      phase: getTelemetryPhase(snapshot),
      telegramUserId: proof?.telegramUserId ?? null,
      chatId: proof?.chatId ?? null,
      linkTokenPresent: Boolean(linkContext?.linkToken),
      ...payload,
    })
  }, [])

  useEffect(() => {
    let active = true
    let teardown = () => {}

    void (async () => {
      await loadTelegramWebApp().catch(() => null)
      if (!active) return
      teardown = setupTelegramMiniAppUi({ requestExpand: true })
      setTelegramUiReady(Boolean(readTelegramWebApp()))
    })()

    return () => {
      active = false
      teardown()
    }
  }, [])

  useEffect(() => {
    const next = describeFlowState(state)
    const previous = lastStateDescriptorRef.current
    if (!previous) {
      emitTelemetry(
        'telegram_link_flow_started',
        {
          status: 'started',
          hasLinkToken: Boolean(getTelemetryLinkContext(state)?.linkToken),
          state: formatFlowStateDescriptor(next),
          elapsedMs: 0,
        },
        state,
      )
    } else if (
      previous.tag !== next.tag ||
      previous.step !== next.step ||
      previous.errorCode !== next.errorCode
    ) {
      emitTelemetry(
        'telegram_link_state_transition',
        {
          status: 'transition',
          fromState: formatFlowStateDescriptor(previous),
          toState: formatFlowStateDescriptor(next),
          fromTag: previous.tag,
          toTag: next.tag,
          fromStep: previous.step,
          toStep: next.step,
          errorCode: next.errorCode,
          elapsedMs: Date.now() - flowStartedAtRef.current,
        },
        state,
      )
    }
    lastStateDescriptorRef.current = next
  }, [embeddedEoaAddress, emitTelemetry, ensureEmbeddedWallet, state])

  useEffect(() => {
    if (state.tag !== 'collect_email') {
      lastEmailSubmitDisabledReasonRef.current = null
      return
    }

    const reason = emailSubmitDisabledReason ?? 'ready'
    if (lastEmailSubmitDisabledReasonRef.current === reason) return
    lastEmailSubmitDisabledReasonRef.current = reason

    emitTelemetry(
      'telegram_link_email_submit_state',
      {
        status: reason === 'ready' ? 'ready' : 'disabled',
        disabled: reason !== 'ready',
        disabledReason: reason,
        normalizedEmail: normalizedCollectEmail,
        emailValid: emailIsValid,
        flowTag: state.tag,
      },
      state,
    )
  }, [emailIsValid, emailSubmitDisabledReason, emitTelemetry, normalizedCollectEmail, state])

  useEffect(() => {
    if (state.tag !== 'verify_telegram_session') return

    let cancelled = false
    void (async () => {
      const startedAt = Date.now()
      emitTelemetry('telegram_link_miniapp_session_verification_started', { status: 'started' }, state)

      const verified = await ensureTelegramMiniAppSession({
        flowId: flowIdRef.current,
      })
      if (cancelled) return

      if (!verified.ok) {
        const error = buildTelegramSessionError(verified.error, verified.statusCode)
        emitTelemetry(
          'telegram_link_miniapp_session_verification_failed',
          {
            status: 'failed',
            durationMs: Date.now() - startedAt,
            statusCode: verified.statusCode,
            errorCode: error.code,
          },
          state,
        )
        dispatch({
          type: 'TELEGRAM_VERIFY_FAILED',
          error,
        })
        return
      }

      emitTelemetry(
        'telegram_link_miniapp_session_verification_succeeded',
        {
          status: 'succeeded',
          durationMs: Date.now() - startedAt,
          telegramUserId: verified.session.telegramUserId,
          chatId: verified.session.chatId,
        },
        state,
      )

      const proof = {
        sessionToken: verified.session.sessionToken,
        initDataRaw: verified.session.initData,
        telegramUserId: verified.session.telegramUserId,
        telegramUsername: verified.session.telegramUsername,
        chatId: verified.session.chatId,
        chatType: verified.session.chatType,
        chatInstance: verified.session.chatInstance,
        expiresAt: verified.session.expiresAt,
        verifiedAt: Date.now(),
        linkContext: state.linkContext,
      }

      dispatch({ type: 'TELEGRAM_VERIFIED', proof })

      const currentParams = new URLSearchParams(location.search)
      const stripped = stripTelegramMiniAppLinkParams(currentParams)
      if (currentParams.toString() !== stripped.toString()) {
        const nextSearch = stripped.toString()
        navigate(
          {
            pathname: location.pathname,
            search: nextSearch ? `?${nextSearch}` : '',
            hash: location.hash,
          },
          { replace: true },
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dispatch, emitTelemetry, location.hash, location.pathname, location.search, navigate, state])

  useEffect(() => {
    if (state.tag !== 'sending_email_code') return

    const executionKey = `${state.proof.sessionToken}:${normalizeEmailCandidate(state.email)}`
    if (emailSendExecutionKeyRef.current === executionKey) return
    emailSendExecutionKeyRef.current = executionKey

    let cancelled = false
    void (async () => {
      const startedAt = Date.now()
      const normalized = normalizeEmailCandidate(state.email)
      emitTelemetry('telegram_link_email_code_send_started', {
        status: 'started',
        hasEmail: normalized.length > 0,
      })
      if (!isValidEmail(normalized)) {
        const error = createFlowError({
          code: 'OTP_SEND_FAILED',
          message: 'Enter a valid email address.',
          recoverable: true,
        })
        emitTelemetry('telegram_link_email_code_send_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          errorCode: error.code,
          recoverable: error.recoverable,
        })
        dispatch({
          type: 'EMAIL_CODE_SEND_FAILED',
          error,
        })
        return
      }

      try {
        let timeoutId: number | null = null
        try {
          await Promise.race([
            sendCodeRef.current({ email: normalized }),
            new Promise<never>((_, reject) => {
              timeoutId = window.setTimeout(() => {
                reject(new Error('telegram_link_send_code_timeout'))
              }, OTP_SEND_TIMEOUT_MS)
            }),
          ])
        } finally {
          if (timeoutId !== null) window.clearTimeout(timeoutId)
        }
        if (cancelled) return
        emitTelemetry('telegram_link_email_code_send_succeeded', {
          status: 'succeeded',
          durationMs: Date.now() - startedAt,
        })
        dispatch({
          type: 'EMAIL_CODE_SENT',
          resendAvailableAt: Date.now() + OTP_RESEND_DELAY_MS,
        })
      } catch (error) {
        if (cancelled) return
        const flowError =
          coerceErrorMessage(error, '') === 'telegram_link_send_code_timeout'
            ? createFlowError({
                code: 'OTP_SEND_FAILED',
                message: 'Verification email took too long to start. Try again.',
                recoverable: true,
              })
            : buildOtpSendError(error)
        emitTelemetry('telegram_link_email_code_send_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          errorCode: flowError.code,
          recoverable: flowError.recoverable,
        })
        dispatch({
          type: 'EMAIL_CODE_SEND_FAILED',
          error: flowError,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [embeddedEoaAddress, emitTelemetry, ensureEmbeddedWallet, state])

  useEffect(() => {
    if (state.tag !== 'verifying_email_code') return

    const executionKey = `${state.proof.sessionToken}:${state.code.trim()}`
    if (codeVerifyExecutionKeyRef.current === executionKey) return
    codeVerifyExecutionKeyRef.current = executionKey

    let cancelled = false
    void (async () => {
      const startedAt = Date.now()
      const normalizedCode = state.code.trim()
      emitTelemetry('telegram_link_email_code_verify_started', {
        status: 'started',
        codeLength: normalizedCode.length,
      })
      if (normalizedCode.length < 6) {
        const error = createFlowError({
          code: 'OTP_VERIFY_FAILED',
          message: 'Enter the 6-digit code from your email.',
          recoverable: true,
        })
        emitTelemetry('telegram_link_email_code_verify_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          errorCode: error.code,
          recoverable: error.recoverable,
        })
        dispatch({
          type: 'EMAIL_CODE_VERIFY_FAILED',
          error,
        })
        return
      }

      try {
        await loginWithCodeRef.current({ code: normalizedCode })
        if (cancelled) return
        emitTelemetry('telegram_link_email_code_verify_succeeded', {
          status: 'succeeded',
          durationMs: Date.now() - startedAt,
        })
        dispatch({ type: 'EMAIL_CODE_VERIFIED' })
      } catch (error) {
        if (cancelled) return
        const flowError = buildOtpVerifyError(error)
        emitTelemetry('telegram_link_email_code_verify_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          errorCode: flowError.code,
          recoverable: flowError.recoverable,
        })
        dispatch({
          type: 'EMAIL_CODE_VERIFY_FAILED',
          error: flowError,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [embeddedEoaAddress, emitTelemetry, ensureEmbeddedWallet, state])

  useEffect(() => {
    if (state.tag !== 'wait_for_privy_sync') return

    let cancelled = false
    void (async () => {
      const expectedEmail = normalizeEmailCandidate(state.email)
      const deadline = state.startedAt + PRIVY_SYNC_TIMEOUT_MS
      const startedAt = Date.now()
      let pollCount = 0
      let accessTokenRetries = 0
      let readinessChecks = 0
      let readinessTimeouts = 0
      let lastSnapshot = privySnapshotRef.current

      emitTelemetry('telegram_link_privy_sync_started', {
        status: 'started',
        privyReady: lastSnapshot.ready,
        privyAuthenticated: lastSnapshot.authenticated,
      })

      while (!cancelled && Date.now() < deadline) {
        const snapshot = privySnapshotRef.current
        lastSnapshot = snapshot
        pollCount += 1
        if (typeof snapshot.getAccessToken !== 'function') {
          await sleep(250)
          continue
        }

        const accessToken = await readPrivyAccessToken(snapshot.getAccessToken)
        if (!accessToken) {
          accessTokenRetries += 1
          await sleep(300)
          continue
        }

        try {
          readinessChecks += 1
          const response = await withTimeout(
            apiFetch('/api/telegram/link/ready', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                email: expectedEmail,
              }),
            }),
            TELEGRAM_LINK_READY_REQUEST_TIMEOUT_MS,
            'Telegram link readiness request timed out.',
          )
          const json = (await response.json().catch(() => null)) as TelegramApiEnvelope<TelegramLinkReadyData> | null
          const account =
            response.ok && json?.data?.ready === true ? parseTelegramLinkReadyAccount(json.data.account, expectedEmail) : null
          if (account) {
            if (!embeddedEoaAddress) {
              emitTelemetry('telegram_link_embedded_wallet_provision_started', {
                status: 'started',
                privyUserId: account.privyUserId,
              })
              try {
                const provisionedWallet = await withTimeout(
                  Promise.resolve().then(() => ensureEmbeddedWallet()),
                  EMBEDDED_WALLET_PROVISION_TIMEOUT_MS,
                  'Privy embedded wallet provisioning timed out.',
                )
                emitTelemetry('telegram_link_embedded_wallet_provision_succeeded', {
                  status: provisionedWallet.created ? 'created' : 'existing',
                  durationMs: Date.now() - startedAt,
                  pollCount,
                  accessTokenRetries,
                  readinessChecks,
                  privyUserId: account.privyUserId,
                  embeddedEoaAddress: provisionedWallet.address,
                })
              } catch (error) {
                const flowError = buildPrivySyncFailure(
                  coerceErrorMessage(error, 'Privy embedded wallet provisioning did not complete. Retry to continue.'),
                )
                emitTelemetry('telegram_link_embedded_wallet_provision_failed', {
                  status: 'failed',
                  durationMs: Date.now() - startedAt,
                  pollCount,
                  accessTokenRetries,
                  readinessChecks,
                  privyUserId: account.privyUserId,
                  errorCode: flowError.code,
                  recoverable: flowError.recoverable,
                })
                dispatch({
                  type: 'PRIVY_SYNC_FAILED',
                  error: flowError,
                })
                return
              }
            }
            emitTelemetry('telegram_link_privy_sync_ready', {
              status: 'ready',
              durationMs: Date.now() - startedAt,
              pollCount,
              accessTokenRetries,
              readinessChecks,
              readinessTimeouts,
              privyUserId: account.privyUserId,
            })
            dispatch({ type: 'PRIVY_SYNC_READY', account })
            return
          }
        } catch (error) {
          if (coerceErrorMessage(error, '').toLowerCase().includes('timed out')) {
            readinessTimeouts += 1
          }
          // Stay inside the explicit wait state until timeout.
        }

        await sleep(500)
      }

      if (!cancelled) {
        const fallbackAccessToken = await readPrivyAccessToken(lastSnapshot.getAccessToken)
        const fallbackPrivyUserId = extractPrivyUserIdFromUser(lastSnapshot.user)
        const fallbackVerifiedEmail = extractPrivyVerifiedEmailFromUser(lastSnapshot.user)
        const fallbackEmailMatchesExpected =
          !fallbackVerifiedEmail || normalizeEmailCandidate(fallbackVerifiedEmail) === expectedEmail
        if (
          lastSnapshot.authenticated &&
          Boolean(fallbackAccessToken) &&
          Boolean(fallbackPrivyUserId) &&
          fallbackEmailMatchesExpected
        ) {
          emitTelemetry('telegram_link_privy_sync_fallback_to_bind', {
            status: 'fallback',
            durationMs: Date.now() - startedAt,
            pollCount,
            accessTokenRetries,
            readinessChecks,
            readinessTimeouts,
            privyReady: lastSnapshot.ready,
            privyAuthenticated: lastSnapshot.authenticated,
            privyUserId: fallbackPrivyUserId,
          })
          dispatch({
            type: 'PRIVY_SYNC_READY',
            account: {
              privyUserId: fallbackPrivyUserId,
              email: fallbackVerifiedEmail ?? expectedEmail,
              emailVerified: true,
              canonicalCswAddress: null,
            },
          })
          return
        }

        const mismatchMessage =
          fallbackVerifiedEmail && normalizeEmailCandidate(fallbackVerifiedEmail) !== expectedEmail
            ? 'Signed-in account email changed before Telegram link could complete. Retry from Telegram to continue.'
            : undefined
        emitTelemetry('telegram_link_privy_sync_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          pollCount,
          accessTokenRetries,
          readinessChecks,
          readinessTimeouts,
          privyReady: lastSnapshot.ready,
          privyAuthenticated: lastSnapshot.authenticated,
          errorCode: 'PRIVY_SYNC_FAILED',
        })
        dispatch({
          type: 'PRIVY_SYNC_FAILED',
          error: buildPrivySyncFailure(mismatchMessage),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [embeddedEoaAddress, emitTelemetry, ensureEmbeddedWallet, state])

  useEffect(() => {
    if (state.tag !== 'bind_telegram' || state.step !== 'ensure_privy_link') return

    const executionKey = `${state.proof.sessionToken}:${state.account.privyUserId}:${state.step}`
    if (bindExecutionKeyRef.current === executionKey) return
    bindExecutionKeyRef.current = executionKey

    let cancelled = false
    void (async () => {
      const snapshot = privySnapshotRef.current
      if (hasMatchingPrivyTelegramAccount(snapshot.user, state.proof)) {
        emitTelemetry('telegram_link_privy_link_skipped', {
          status: 'skipped',
          privyUserId: state.account.privyUserId,
          reason: 'already_linked_to_privy_user',
        })
        dispatch({ type: 'PRIVY_TELEGRAM_LINK_SKIPPED' })
        return
      }

      if (!snapshot.ready || !snapshot.authenticated) {
        emitTelemetry('telegram_link_privy_link_failed', {
          status: 'failed',
          errorCode: 'BIND_TELEGRAM_FAILED',
          privyUserId: state.account.privyUserId,
          reason: 'privy_session_not_ready',
        })
        dispatch({
          type: 'PRIVY_TELEGRAM_LINK_FAILED',
          error: buildBindFailure('Privy session was not ready for Telegram linking.', true),
        })
        return
      }

      if (typeof snapshot.linkTelegram !== 'function') {
        emitTelemetry('telegram_link_privy_link_failed', {
          status: 'failed',
          errorCode: 'BIND_TELEGRAM_FAILED',
          privyUserId: state.account.privyUserId,
          reason: 'link_telegram_unavailable',
        })
        dispatch({
          type: 'PRIVY_TELEGRAM_LINK_FAILED',
          error: buildBindFailure('Privy Telegram linking is unavailable in this session.', true),
        })
        return
      }

      emitTelemetry('telegram_link_privy_link_started', {
        status: 'started',
        privyUserId: state.account.privyUserId,
        reason: 'link_telegram_requested',
      })

      try {
        await withTimeout(
          Promise.resolve().then(() =>
            snapshot.linkTelegram?.({
              launchParams: {
                initDataRaw: state.proof.initDataRaw,
              },
            }),
          ),
          PRIVY_LINK_TELEGRAM_TIMEOUT_MS,
          'Privy Telegram link timed out.',
        )
        if (cancelled) return
        emitTelemetry('telegram_link_privy_link_succeeded', {
          status: 'succeeded',
          privyUserId: state.account.privyUserId,
        })
        dispatch({ type: 'PRIVY_TELEGRAM_LINK_SUCCEEDED' })
      } catch (error) {
        if (cancelled) return
        const flowError = isTelegramLaunchParamError(coerceErrorMessage(error, ''))
          ? buildLaunchParamFailure()
          : buildBindFailure(coerceErrorMessage(error, 'Telegram link failed.'), true)
        emitTelemetry('telegram_link_privy_link_failed', {
          status: 'failed',
          errorCode: flowError.code,
          recoverable: flowError.recoverable,
          privyUserId: state.account.privyUserId,
        })
        dispatch({
          type: 'PRIVY_TELEGRAM_LINK_FAILED',
          error: flowError,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [emitTelemetry, state])

  useEffect(() => {
    if (state.tag !== 'bind_telegram' || state.step !== 'complete_backend') return

    let cancelled = false
    void (async () => {
      const startedAt = Date.now()
      const snapshot = privySnapshotRef.current
      emitTelemetry('telegram_link_backend_completion_started', {
        status: 'started',
        privyUserId: state.account.privyUserId,
      })
      if (typeof snapshot.getAccessToken !== 'function') {
        emitTelemetry('telegram_link_backend_completion_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          privyUserId: state.account.privyUserId,
          errorCode: 'BIND_TELEGRAM_FAILED',
          reason: 'missing_access_token_reader',
        })
        dispatch({
          type: 'BIND_TELEGRAM_FAILED',
          error: buildBindFailure('Privy access token reader is unavailable.', true),
        })
        return
      }

      const accessToken = await readPrivyAccessToken(snapshot.getAccessToken)
      if (!accessToken) {
        emitTelemetry('telegram_link_backend_completion_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          privyUserId: state.account.privyUserId,
          errorCode: 'BIND_TELEGRAM_FAILED',
          reason: 'missing_access_token',
        })
        dispatch({
          type: 'BIND_TELEGRAM_FAILED',
          error: buildBindFailure('Privy access token was unavailable.', true),
        })
        return
      }

      try {
        const response = await withTimeout(
          apiFetch('/api/telegram/link/complete', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              sessionToken: state.proof.sessionToken,
              linkToken: state.proof.linkContext?.linkToken ?? null,
              flowId: flowIdRef.current,
            }),
          }),
          TELEGRAM_LINK_COMPLETE_REQUEST_TIMEOUT_MS,
          'Telegram link completion request timed out.',
        )
        const json = (await response.json().catch(() => null)) as TelegramApiEnvelope<TelegramLinkCompleteData> | null
        if (cancelled) return

        if (!response.ok || !json?.success || !json.data?.link) {
          const message = json?.error || 'Unable to complete Telegram binding.'
          const code = String(json?.code ?? '').trim().toUpperCase()
          const lower = message.toLowerCase()
          let errorCode = 'BIND_TELEGRAM_FAILED'
          let recoverable = response.status >= 500 || response.status === 0
          if (code.includes('RECOVERY_REQUIRED') || lower.includes('recovery required')) {
            errorCode = 'RECOVERY_REQUIRED'
            recoverable = false
            emitTelemetry('telegram_link_backend_completion_failed', {
              status: 'failed',
              durationMs: Date.now() - startedAt,
              responseStatus: response.status,
              privyUserId: state.account.privyUserId,
              errorCode,
              recoverable,
            })
            dispatch({
              type: 'BIND_TELEGRAM_FAILED',
              error: createFlowError({
                code: 'RECOVERY_REQUIRED',
                message,
                recoverable: false,
              }),
            })
            return
          }
          if (code.includes('EXPIRED_TELEGRAM_SESSION') || lower.includes('expired telegram') || lower.includes('telegram session')) {
            errorCode = 'EXPIRED_TELEGRAM_SESSION'
            recoverable = false
            emitTelemetry('telegram_link_backend_completion_failed', {
              status: 'failed',
              durationMs: Date.now() - startedAt,
              responseStatus: response.status,
              privyUserId: state.account.privyUserId,
              errorCode,
              recoverable,
            })
            dispatch({
              type: 'BIND_TELEGRAM_FAILED',
              error: createFlowError({
                code: 'EXPIRED_TELEGRAM_SESSION',
                message,
                recoverable: false,
              }),
            })
            return
          }
          emitTelemetry('telegram_link_backend_completion_failed', {
            status: 'failed',
            durationMs: Date.now() - startedAt,
            responseStatus: response.status,
            privyUserId: state.account.privyUserId,
            errorCode,
            recoverable,
          })
          dispatch({
            type: 'BIND_TELEGRAM_FAILED',
            error: buildBindFailure(message, response.status >= 500 || response.status === 0),
          })
          return
        }

        emitTelemetry('telegram_link_backend_completion_succeeded', {
          status: 'succeeded',
          durationMs: Date.now() - startedAt,
          responseStatus: response.status,
          privyUserId: json.data.link.privyUserId ?? state.account.privyUserId,
          linkStatus: json.data.link.linkStatus,
        })
        dispatch({
          type: 'BIND_TELEGRAM_SUCCEEDED',
          link: json.data.link,
        })
      } catch (error) {
        if (cancelled) return
        emitTelemetry('telegram_link_backend_completion_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          privyUserId: state.account.privyUserId,
          errorCode: 'BIND_TELEGRAM_FAILED',
        })
        dispatch({
          type: 'BIND_TELEGRAM_FAILED',
          error: buildBindFailure(coerceErrorMessage(error, 'Unable to complete Telegram binding.'), true),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [emitTelemetry, state])

  useEffect(() => {
    if (state.tag !== 'enter_email_code' || !state.resendAvailableAt || state.resendAvailableAt <= Date.now()) return

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [emitTelemetry, state])

  useEffect(() => {
    if (state.tag === 'success') {
      emitTelemetry('telegram_link_flow_completed', {
        status: 'succeeded',
        elapsedMs: Date.now() - flowStartedAtRef.current,
        privyUserId: state.account.privyUserId,
        linkStatus: state.link.linkStatus,
      }, state)
      clearStoredTelegramMiniAppLinkContext()
    }
  }, [emitTelemetry, state])

  const submitEmail = useCallback((source: 'submit' | 'click' | 'pointerdown' | 'touchstart' | 'mousedown' | 'telegram_main_button' | 'enter') => {
    const snapshot = stateRef.current
    const assessment = getEmailSubmitAssessment(snapshot, emailInputRef.current?.value)
    emitTelemetry(
      'telegram_link_email_submit_attempted',
      {
        status: assessment.disabledReason ? 'blocked' : 'submitted',
        disabled: assessment.disabledReason !== null,
        disabledReason: assessment.disabledReason ?? 'ready',
        normalizedEmail: assessment.normalizedEmail,
        emailValid: assessment.emailValid,
        source,
      },
      snapshot,
    )
    if (assessment.disabledReason) return
    if (emailSubmitGestureLockRef.current) return
    emailSubmitGestureLockRef.current = true
    if (typeof window !== 'undefined') {
      if (emailSubmitGestureResetTimerRef.current !== null) window.clearTimeout(emailSubmitGestureResetTimerRef.current)
      emailSubmitGestureResetTimerRef.current = window.setTimeout(() => {
        emailSubmitGestureLockRef.current = false
        emailSubmitGestureResetTimerRef.current = null
      }, 1000)
    }
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    if (activeElement instanceof HTMLElement) activeElement.blur()
    dispatch({ type: 'SUBMIT_EMAIL', email: assessment.normalizedEmail })
  }, [dispatch, emitTelemetry])

  const handleEmailSubmitActivation = (source: 'click' | 'pointerdown' | 'touchstart' | 'mousedown') => () => {
    submitEmail(source)
  }

  const handleEmailFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitEmail('submit')
  }

  const handleTelegramMainButtonClick = useCallback(() => {
    submitEmail('telegram_main_button')
  }, [submitEmail])

  const handleCloseTelegramMiniApp = useCallback(() => {
    try {
      telegramWebApp?.close?.()
    } catch {
      // Ignore Telegram SDK close errors and leave the success state visible.
    }
  }, [telegramWebApp])

  useEffect(() => {
    if (!telegramUiReady) return
    const mainButton = readTelegramWebApp()?.MainButton
    if (!mainButton) return

    const hideButton = () => {
      try {
        mainButton.hideProgress?.()
      } catch {
        // Ignore SDK errors.
      }
      try {
        mainButton.hide?.()
      } catch {
        // Ignore SDK errors.
      }
    }

    if (state.tag === 'collect_email') {
      try {
        mainButton.setText?.('Send Code')
        mainButton.setParams?.({
          text: 'Send Code',
          color: '#0052FF',
          text_color: '#FFFFFF',
          is_active: !emailSubmitDisabled,
          is_visible: true,
        })
        if (emailSubmitDisabled) {
          mainButton.disable?.()
        } else {
          mainButton.enable?.()
        }
        mainButton.show?.()
      } catch {
        // Ignore SDK errors so the inline button remains the fallback.
      }

      return () => hideButton()
    }

    if (state.tag === 'sending_email_code') {
      try {
        mainButton.setText?.('Sending Code…')
        mainButton.setParams?.({
          text: 'Sending Code…',
          color: '#1E3A8A',
          text_color: '#FFFFFF',
          is_active: false,
          is_visible: true,
        })
        mainButton.disable?.()
        mainButton.show?.()
        mainButton.showProgress?.(false)
      } catch {
        // Ignore SDK errors.
      }

      return () => {
        hideButton()
      }
    }

    hideButton()
    return () => {
      hideButton()
    }
  }, [emailSubmitDisabled, state.tag, telegramUiReady])

  useEffect(() => {
    if (!telegramUiReady) return
    const mainButton = readTelegramWebApp()?.MainButton
    if (!mainButton) return

    if (telegramMainButtonHandlerRef.current) {
      try {
        mainButton.offClick?.(telegramMainButtonHandlerRef.current)
      } catch {
        // Ignore SDK errors.
      }
      telegramMainButtonHandlerRef.current = null
    }

    if (state.tag !== 'collect_email' && state.tag !== 'sending_email_code') return

    telegramMainButtonHandlerRef.current = handleTelegramMainButtonClick
    try {
      mainButton.onClick?.(handleTelegramMainButtonClick)
    } catch {
      telegramMainButtonHandlerRef.current = null
    }

    return () => {
      if (!telegramMainButtonHandlerRef.current) return
      try {
        mainButton.offClick?.(telegramMainButtonHandlerRef.current)
      } catch {
        // Ignore SDK errors.
      }
      telegramMainButtonHandlerRef.current = null
    }
  }, [handleTelegramMainButtonClick, state.tag, telegramUiReady])

  const handleCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    dispatch({ type: 'SUBMIT_CODE' })
  }

  const canResend =
    state.tag === 'enter_email_code' &&
    (!state.resendAvailableAt || state.resendAvailableAt <= nowMs)
  const resendSeconds =
    state.tag === 'enter_email_code' && state.resendAvailableAt && state.resendAvailableAt > nowMs
      ? Math.ceil((state.resendAvailableAt - nowMs) / 1_000)
      : 0

  const proof =
    state.tag === 'collect_email' ||
    state.tag === 'sending_email_code' ||
    state.tag === 'enter_email_code' ||
    state.tag === 'verifying_email_code' ||
    state.tag === 'wait_for_privy_sync' ||
    state.tag === 'bind_telegram' ||
    state.tag === 'success'
      ? state.proof
      : state.tag === 'expired_or_error'
        ? state.proof
        : null

  const emailSubmitHelperText =
    state.tag === 'collect_email'
      ? state.emailError
        ? null
        : emailSubmitDisabledReason === 'invalid_email'
          ? 'Enter a complete email address to continue.'
          : 'We’ll send a 6-digit code to this email.'
      : null

  const renderContent = () => {
    switch (state.tag) {
      case 'verify_telegram_session':
        return <StatusBlock icon={ShieldCheck} tone="info" body="Checking Telegram Mini App session proof." />

      case 'collect_email':
        return (
          <form id="telegram-link-email-form" className="space-y-3" onSubmit={handleEmailFormSubmit}>
            <label htmlFor="telegram-link-email" className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[#666666]">
              Email Address
            </label>
            <input
              ref={emailInputRef}
              id="telegram-link-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              value={state.email}
              onChange={(event) => dispatch({ type: 'EMAIL_CHANGED', email: event.target.value })}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                submitEmail('enter')
              }}
              placeholder="name@example.com"
              className="block h-11 w-full rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-4 text-[15px] text-[#EDEDED] outline-none transition focus:border-[#0052FF]/75 focus:bg-white/[0.04] focus:ring-0"
            />
            {state.emailError ? <InlineError message={state.emailError} /> : null}
            {emailSubmitHelperText ? <p className="text-[12px] leading-[1.4] text-[#666666]">{emailSubmitHelperText}</p> : null}
          </form>
        )

      case 'sending_email_code':
        return <StatusBlock icon={LoaderCircle} tone="info" spinning body={`Sending verification code to ${state.email}.`} />

      case 'enter_email_code':
        return (
          <form id="telegram-link-code-form" className="space-y-3" onSubmit={handleCodeSubmit}>
            <div className="text-[13px] text-[#EDEDED]">
              Code sent to <span className="font-mono text-[13px]">{state.email}</span>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="telegram-link-code" className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#666666]">
                Email Verification Code
              </label>
              <input
                id="telegram-link-code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                value={state.code}
                onChange={(event) => dispatch({ type: 'CODE_CHANGED', code: event.target.value.replace(/\s+/g, '').slice(0, 6) })}
                placeholder="000000"
                className="h-11 w-full rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-4 text-center font-mono text-[18px] tracking-[0.34em] text-[#EDEDED] outline-none transition focus:border-[#0052FF]/75 focus:bg-white/[0.04] focus:ring-0"
              />
              {state.codeError ? <InlineError message={state.codeError} /> : null}
            </div>
          </form>
        )

      case 'verifying_email_code':
        return <StatusBlock icon={LoaderCircle} tone="info" spinning body={`Verifying email code for ${state.email}.`} />

      case 'wait_for_privy_sync':
        return (
          <StatusBlock
            icon={LoaderCircle}
            tone="info"
            spinning
            body={`Email verified for ${state.email}. Waiting for the canonical 4626 account and session to resolve.`}
          />
        )

      case 'bind_telegram':
        return (
          <StatusBlock
            icon={LoaderCircle}
            tone="info"
            spinning
            body={
              state.step === 'ensure_privy_link'
                ? 'Linking Telegram inside Privy using the active Mini App launch proof.'
                : 'Finalizing the Telegram bind against the canonical verified-email account.'
            }
          />
        )

      case 'success':
        const canonicalCswAddress = state.link.canonicalCswAddress ?? state.account.canonicalCswAddress
        const walletSetupPending = state.link.linkStatus !== 'active' || !state.link.ownerVerified
        return (
          <div className="space-y-3">
            <StatusBlock
              icon={CheckCircle2}
              tone="success"
              compact
              body={`Telegram linked to ${state.account.email}. Your Telegram account is attached to your 4626 account.`}
            />
            {walletSetupPending ? (
              <div className="rounded-[18px] border border-[#0052FF]/20 bg-[#0052FF]/8 px-3.5 py-3 text-[13px] leading-5 text-[#EDEDED] space-y-1.5">
                <div>
                  Wallet setup pending. Telegram is linked, but wallet and trading actions unlock after your Privy embedded signer is added as an owner on your Zora Coinbase Smart Wallet.
                </div>
                <div className="text-[11px] leading-5 text-[#A9B9FF]">
                  Next step: continue into Accounts on phone or desktop, connect a current owner of your detected Zora Coinbase Smart Wallet, and run <span className="font-medium text-[#D7E0FF]">Enable 4626 signing</span>.
                </div>
                <div className="text-[11px] text-[#8FB0FF]">Use Continue setup below to open Accounts outside Telegram.</div>
              </div>
            ) : null}
            <SuccessAccountSummary
              email={state.account.email}
              canonicalCswAddress={canonicalCswAddress}
            />
            <div className="text-[13px] leading-5 text-[#666666]">
              {walletSetupPending
                ? 'You can close this Mini App now. Finish wallet setup to unlock trading and wallet actions in Telegram.'
                : 'You can close this Mini App and return to the bot. Wallet, trade, and creator actions are ready there.'}
            </div>
          </div>
        )

      case 'expired_or_error':
        if (isOwnerSetupHandoffState(state)) {
          const handoffEmail = normalizeEmailCandidate(state.email ?? '') || 'your verified email'
          const linkedHandoffCopy = prefersLinkedHandoffCopy(state)
          return (
            <div className="space-y-4">
              <StatusBlock
                icon={CheckCircle2}
                tone="success"
                body={
                  linkedHandoffCopy
                    ? `Telegram linked to ${handoffEmail}. Continue on your phone or desktop to enable 4626 signing on your Zora Coinbase Smart Wallet.`
                    : `Email verified for ${handoffEmail}. Continue on your phone or desktop to finish 4626 signing setup on your Zora Coinbase Smart Wallet.`
                }
              />
              <div className="rounded-[18px] border border-[#0052FF]/20 bg-[#0052FF]/8 px-4 py-3 text-sm leading-6 text-[#EDEDED] space-y-2">
                <div>
                  {linkedHandoffCopy
                    ? 'Mini App account sync timed out after verification, but you can finish owner setup from Accounts on a phone or desktop browser.'
                    : 'Mini App finalization was interrupted after verification, but you can still finish owner setup from Accounts on a phone or desktop browser.'}
                </div>
                <div className="text-xs text-[#A9B9FF]">
                  Next step: continue into Accounts, connect a current owner of your Zora Coinbase Smart Wallet, and run <span className="font-medium text-[#D7E0FF]">Enable 4626 signing</span>.
                </div>
                <div className="text-xs text-[#8FB0FF]">Use the Continue setup button below to open the real Accounts flow outside Telegram.</div>
              </div>
            </div>
          )
        }

        return (
          <div className="space-y-4">
            <StatusBlock icon={state.error.recoverable ? AlertTriangle : ShieldX} tone="error" body={state.error.message} />
            <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#666666]">{getErrorTitle(state.error)}</div>
              <div className="mt-2 text-sm leading-6 text-[#EDEDED]">
                {state.error.recoverable
                  ? 'This failure is recoverable. Retry resumes from the last explicit machine checkpoint.'
                  : 'This flow must be re-opened from Telegram to obtain a fresh session proof.'}
              </div>
            </div>
          </div>
        )
    }
  }

  const renderFooterActions = () => {
    switch (state.tag) {
      case 'collect_email':
        if (hasTelegramMainButton) return null
        return (
          <button
            type="submit"
            form="telegram-link-email-form"
            onPointerDown={handleEmailSubmitActivation('pointerdown')}
            onTouchStart={handleEmailSubmitActivation('touchstart')}
            onMouseDown={handleEmailSubmitActivation('mousedown')}
            data-testid="telegram-link-submit"
            data-disabled-reason={emailSubmitDisabledReason ?? 'ready'}
            data-email-normalized={normalizedCollectEmail}
            data-email-valid={emailIsValid ? 'true' : 'false'}
            data-flow-tag={state.tag}
            className={PRIMARY_ACTION_BUTTON_CLASS}
            disabled={emailSubmitDisabled}
          >
            Send Code
          </button>
        )

      case 'enter_email_code':
        return (
          <div className="space-y-2.5">
            <button
              type="submit"
              form="telegram-link-code-form"
              className={PRIMARY_ACTION_BUTTON_CLASS}
              disabled={state.code.trim().length < 6}
            >
              Verify Code
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESEND_CODE' })}
              className={SECONDARY_ACTION_BUTTON_CLASS}
              disabled={!canResend}
            >
              {canResend ? 'Resend' : `${resendSeconds}s`}
            </button>
          </div>
        )

      case 'success':
        if (state.link.linkStatus !== 'active' || !state.link.ownerVerified) {
          return (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void openOwnerInstallHandoff()}
                className={PRIMARY_ACTION_BUTTON_CLASS}
                disabled={ownerSetupHandoffBusy}
              >
                {ownerSetupHandoffBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {ownerSetupHandoffBusy ? 'Opening setup…' : 'Continue setup'}
              </button>
              {ownerSetupHandoffError ? (
                <div className="rounded-[16px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-100">
                  {ownerSetupHandoffError}
                </div>
              ) : null}
            </div>
          )
        }
        if (!canCloseTelegramMiniApp) return null
        return (
          <button
            type="button"
            onClick={handleCloseTelegramMiniApp}
            className={PRIMARY_ACTION_BUTTON_CLASS}
          >
            <X className="h-4 w-4" />
            Close
          </button>
        )

      case 'expired_or_error':
        if (isOwnerSetupHandoffState(state)) {
          return (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void openOwnerInstallHandoff()}
                className={PRIMARY_ACTION_BUTTON_CLASS}
                disabled={ownerSetupHandoffBusy}
              >
                {ownerSetupHandoffBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {ownerSetupHandoffBusy ? 'Opening setup…' : 'Continue setup'}
              </button>
              {ownerSetupHandoffError ? (
                <div className="rounded-[16px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-100">
                  {ownerSetupHandoffError}
                </div>
              ) : null}
              {state.retryTarget ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RETRY' })}
                  className={SECONDARY_ACTION_BUTTON_CLASS}
                >
                  <RefreshCw className="h-4 w-4" />
                Retry in Mini App
              </button>
            ) : null}
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET' })}
                className={SECONDARY_ACTION_BUTTON_CLASS}
              >
                <Unplug className="h-4 w-4" />
                Reset Flow
              </button>
            </div>
          )
        }

        return (
          <div className="space-y-2.5">
            {state.retryTarget ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'RETRY' })}
                className={PRIMARY_ACTION_BUTTON_CLASS}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESET' })}
              className={SECONDARY_ACTION_BUTTON_CLASS}
            >
              <Unplug className="h-4 w-4" />
              Reset Flow
            </button>
          </div>
        )

      default:
        return null
    }
  }

  const footerActions = renderFooterActions()
  const ownerSetupHandoffState = isOwnerSetupHandoffState(state) ? state : null
  const ownerSetupHandoffLinkedCopy = ownerSetupHandoffState ? prefersLinkedHandoffCopy(ownerSetupHandoffState) : false
  const compactMiniAppLayout = state.tag === 'success' || ownerSetupHandoffState !== null
  const panelHeadline = ownerSetupHandoffState
    ? ownerSetupHandoffLinkedCopy
      ? 'Telegram Linked'
      : 'Continue Setup'
    : getFlowHeadline(state.tag)
  const panelDescription = ownerSetupHandoffState
    ? ownerSetupHandoffLinkedCopy
      ? 'Linked. Finish owner setup in Accounts.'
      : 'Verified. Continue in Accounts to finish setup.'
    : getFlowDescription(state.tag)

  return (
    <div
      data-testid="telegram-link-shell"
      className="relative flex overflow-hidden bg-[#020202] text-[#EDEDED]"
      style={TG_VIEWPORT_STYLE}
    >
      <PageMeta title="Telegram Link" description="Verify email inside Telegram and bind Telegram to the canonical 4626 account." canonicalPath="/telegram/link" />
      <div data-testid="telegram-link-decorative-overlay" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-[#0052FF]/18 blur-3xl" />
        <div className="absolute right-[-10%] top-[8%] h-80 w-80 rounded-full bg-[#3B82F6]/12 blur-3xl" />
        <div className="absolute bottom-[-14%] left-[18%] h-72 w-72 rounded-full bg-white/[0.035] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[27rem] flex-col">
        <div
          data-flow-state={state.tag}
          data-testid="telegram-link-panel"
          className={`flex w-full flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(10,10,10,0.94),rgba(10,10,10,0.84))] shadow-[0_24px_96px_rgba(0,0,0,0.5)] backdrop-blur-xl ${
            compactMiniAppLayout ? 'px-4 py-3' : 'px-4 py-3.5'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.75 text-[9px] font-medium uppercase tracking-[0.2em] text-[#666666]">
                Telegram Mini App
              </div>
              <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#EDEDED]">{panelHeadline}</h1>
              <p className="max-w-xl text-[12px] leading-[1.35] text-[#666666]">{panelDescription}</p>
            </div>
          </div>

          <FlowProgress currentTag={state.tag} compact={compactMiniAppLayout} />

          {proof ? (
            <div className={`grid grid-cols-3 gap-x-2 gap-y-2 border-t border-white/[0.05] text-sm ${compactMiniAppLayout ? 'mt-2 pt-2' : 'mt-3 pt-2.5'}`}>
              <MetaField label="Telegram" value={formatTelegramHandle(proof.telegramUsername, proof.telegramUserId)} />
              <MetaField label="Chat" value={proof.chatId ?? 'direct'} />
              <MetaField label="Session" value={new Date(proof.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
            </div>
          ) : null}

          <div className={compactMiniAppLayout ? 'mt-2.5' : 'mt-3'}>{renderContent()}</div>
        </div>

        {footerActions ? (
          <div data-testid="telegram-link-footer-actions" className={`mt-auto ${compactMiniAppLayout ? 'pt-3' : 'pt-4'}`}>
            {footerActions}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FlowProgress(props: { currentTag: TelegramLinkState['tag']; compact?: boolean }) {
  const currentStep = getFlowProgressIndex(props.currentTag)
  const isComplete = props.currentTag === 'success'

  return (
    <ol data-testid="telegram-link-progress" className={`${props.compact ? 'mt-2.5 gap-1.5' : 'mt-3 gap-2'} flex items-start justify-between`}>
      {TELEGRAM_LINK_PROGRESS_STEPS.map((step, index) => {
        const stepNumber = index + 1
        const status = isComplete
          ? 'complete'
          : stepNumber < currentStep
            ? 'complete'
            : stepNumber === currentStep
              ? 'active'
              : 'upcoming'
        const statusClasses =
          status === 'complete'
            ? 'border-[#0052FF] bg-[#0052FF] text-white'
            : status === 'active'
              ? 'border-[#0052FF] bg-[#0052FF]/15 text-[#EDEDED]'
              : 'border-white/[0.08] bg-white/[0.03] text-[#666666]'

        return (
          <li
            key={step.key}
            data-testid={`telegram-link-progress-step-${step.key}`}
            data-status={status}
            className="min-w-0 flex-1"
          >
            <div className="flex items-center gap-2">
              <div className={`flex shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${props.compact ? 'h-6.5 w-6.5' : 'h-7 w-7'} ${statusClasses}`}>
                {stepNumber}
              </div>
              <div className={`min-w-0 font-medium text-[#CFCFCF] ${props.compact ? 'text-[10px]' : 'text-[11px]'}`}>{step.label}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StatusBlock(props: {
  icon: typeof LoaderCircle
  body: string
  spinning?: boolean
  tone: 'info' | 'success' | 'error'
  compact?: boolean
}) {
  const toneClasses =
    props.tone === 'success'
      ? 'border-[#22c55e]/25 bg-[#22c55e]/10 text-[#EDEDED]'
      : props.tone === 'error'
        ? 'border-[#ef4444]/25 bg-[#ef4444]/10 text-[#EDEDED]'
        : 'border-[#0052FF]/25 bg-[#0052FF]/10 text-[#EDEDED]'
  const Icon = props.icon

  return (
    <div className={`rounded-[18px] border ${props.compact ? 'px-3 py-2.5' : 'px-3.5 py-2.5'} ${toneClasses}`}>
      <div className={`flex items-start ${props.compact ? 'gap-2.5' : 'gap-3'}`}>
        <div className={`rounded-full border border-white/10 bg-white/[0.05] ${props.compact ? 'mt-0.5 p-1.25' : 'mt-0.5 p-1.5'}`}>
          <Icon className={`${props.compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${props.spinning ? 'animate-spin' : ''}`} />
        </div>
        <div className={`${props.compact ? 'text-[12.5px] leading-5' : 'text-[13px] leading-5'}`}>{props.body}</div>
      </div>
    </div>
  )
}

function InlineError(props: { message: string }) {
  return (
    <div className="rounded-[12px] bg-[#ef4444]/10 px-3 py-2 text-[12px] leading-[1.35] text-[#EDEDED]">
      {props.message}
    </div>
  )
}

function MetaField(props: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0" title={props.title}>
      <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#666666]">{props.label}</div>
      <div className="mt-0.5 truncate font-mono text-[12px] text-[#EDEDED]">{props.value}</div>
    </div>
  )
}

function SuccessSummaryCard(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.03] px-3 py-3" title={props.title}>
      <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#666666]">{props.label}</div>
      <div className={`mt-1 min-w-0 truncate text-[13px] text-[#EDEDED] ${props.mono ? 'font-mono' : 'font-medium'}`}>
        {props.value}
      </div>
    </div>
  )
}

function SuccessAccountSummary(props: { email: string; canonicalCswAddress: string | null }) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#666666]">Connected Account</div>
      <div className="mt-2.5 space-y-2">
        <CompactSummaryRow label="Canonical Email" value={props.email} />
        <CompactSummaryRow
          label="Canonical CSW"
          value={props.canonicalCswAddress ? shortAddress(props.canonicalCswAddress) : 'Pending wallet setup'}
          title={props.canonicalCswAddress ?? 'Canonical Coinbase Smart Wallet not set yet.'}
          mono
        />
      </div>
    </div>
  )
}

function CompactSummaryRow(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="rounded-[15px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5" title={props.title}>
      <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#666666]">{props.label}</div>
      <div className={`mt-1 min-w-0 truncate text-[13px] text-[#EDEDED] ${props.mono ? 'font-mono' : 'font-medium'}`}>
        {props.value}
      </div>
    </div>
  )
}
