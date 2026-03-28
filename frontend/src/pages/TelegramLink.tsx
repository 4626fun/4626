import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, ShieldX, Unplug } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLinkAccount, useLoginWithEmail, usePrivy } from '@privy-io/react-auth'

import { PageMeta } from '@/components/seo/PageMeta'
import { apiFetch } from '@/lib/apiBase'
import {
  clearStoredTelegramMiniAppLinkContext,
  resolveTelegramMiniAppLinkContext,
  stripTelegramMiniAppLinkParams,
  type TelegramMiniAppLinkContext,
} from '@/lib/telegramMiniAppLink'
import { createTelegramLinkFlowId, trackTelegramLinkTelemetryEvent } from '@/lib/telegramLinkTelemetry'
import { ensureTelegramMiniAppSession, loadTelegramWebApp, readTelegramWebApp, setupTelegramMiniAppUi } from '@/lib/telegramWebApp'

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
} from './telegramLinkFlow'

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
  code?: string
}

type TelegramLinkReadyData = {
  ready: boolean
  account: TelegramLinkReadyAccount | null
}

type TelegramLinkCompleteData = {
  link: TelegramLinkResult
  account: unknown
}

const OTP_RESEND_DELAY_MS = 30_000
const OTP_SEND_TIMEOUT_MS = 12_000
const PRIVY_SYNC_TIMEOUT_MS = 20_000
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
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
    message: message || '4626 account sync did not complete after email verification.',
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
      return 'Verify Telegram Session'
    case 'collect_email':
    case 'sending_email_code':
      return 'Verify Email'
    case 'enter_email_code':
    case 'verifying_email_code':
      return 'Enter Verification Code'
    case 'wait_for_privy_sync':
      return 'Awaiting Account Sync'
    case 'bind_telegram':
      return 'Binding Telegram Identity'
    case 'success':
      return 'Telegram Linked'
    case 'expired_or_error':
      return 'Session Expired'
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
      return 'Verified email is the canonical 4626 identity.'
    case 'enter_email_code':
    case 'verifying_email_code':
      return 'Enter the code inline. Telegram remains linked only.'
    case 'wait_for_privy_sync':
      return 'Email verified. Waiting for Privy and the canonical 4626 account.'
    case 'bind_telegram':
      return 'Canonical account ready. Binding Telegram now.'
    case 'success':
      return 'Canonical account resolved. Telegram is attached.'
    case 'expired_or_error':
      return 'Telegram launch or account sync could not complete.'
    default:
      return ''
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

  const privy = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()
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
  const privySnapshotRef = useRef({
    ready: Boolean(privy.ready),
    authenticated: Boolean(privy.authenticated),
    user: privy.user ?? null,
    getAccessToken,
  })
  const {
    disabledReason: emailSubmitDisabledReason,
    normalizedEmail: normalizedCollectEmail,
    emailValid: emailIsValid,
  } = getEmailSubmitAssessment(state)
  const emailSubmitDisabled = emailSubmitDisabledReason !== null
  const hasTelegramMainButton = telegramUiReady && Boolean(readTelegramWebApp()?.MainButton)

  useEffect(() => {
    stateRef.current = state
  }, [state])

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
    }
  }, [getAccessToken, privy.authenticated, privy.ready, privy.user])

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

  const { linkTelegram } = useLinkAccount({
    onSuccess: ({ linkMethod, user }) => {
      if (linkMethod !== 'telegram') return
      if (stateRef.current.tag !== 'bind_telegram' || stateRef.current.step !== 'ensure_privy_link') return
      emitTelemetry('telegram_link_privy_link_succeeded', {
        status: 'succeeded',
        privyUserId: typeof (user as { id?: unknown } | null)?.id === 'string' ? String((user as any).id) : null,
      })
      dispatch({ type: 'PRIVY_TELEGRAM_LINK_SUCCEEDED' })
    },
    onError: (errorCode, details) => {
      if (details?.linkMethod !== 'telegram') return
      if (stateRef.current.tag !== 'bind_telegram' || stateRef.current.step !== 'ensure_privy_link') return
      const error = isTelegramLaunchParamError(String(errorCode))
        ? buildLaunchParamFailure()
        : buildBindFailure(coerceErrorMessage(errorCode, 'Telegram link failed.'), true)
      emitTelemetry('telegram_link_privy_link_failed', {
        status: 'failed',
        errorCode: error.code,
        recoverable: error.recoverable,
      })
      dispatch({
        type: 'PRIVY_TELEGRAM_LINK_FAILED',
        error,
      })
    },
  })
  const linkTelegramRef = useRef(linkTelegram)

  useEffect(() => {
    linkTelegramRef.current = linkTelegram
  }, [linkTelegram])

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
  }, [emitTelemetry, state])

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
  }, [emitTelemetry, state])

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
  }, [emitTelemetry, state])

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
        if (!snapshot.ready || !snapshot.authenticated || !snapshot.user || typeof snapshot.getAccessToken !== 'function') {
          await sleep(250)
          continue
        }

        let accessToken = ''
        try {
          accessToken = String((await snapshot.getAccessToken()) ?? '').trim()
        } catch {
          accessToken = ''
        }
        if (!accessToken) {
          accessTokenRetries += 1
          await sleep(300)
          continue
        }

        try {
          readinessChecks += 1
          const response = await apiFetch('/api/telegram/link/ready', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              email: expectedEmail,
            }),
          })
          const json = (await response.json().catch(() => null)) as ApiEnvelope<TelegramLinkReadyData> | null
          const account =
            response.ok && json?.data?.ready === true ? parseTelegramLinkReadyAccount(json.data.account, expectedEmail) : null
          if (account) {
            emitTelemetry('telegram_link_privy_sync_ready', {
              status: 'ready',
              durationMs: Date.now() - startedAt,
              pollCount,
              accessTokenRetries,
              readinessChecks,
              privyUserId: account.privyUserId,
            })
            dispatch({ type: 'PRIVY_SYNC_READY', account })
            return
          }
        } catch {
          // Stay inside the explicit wait state until timeout.
        }

        await sleep(500)
      }

      if (!cancelled) {
        emitTelemetry('telegram_link_privy_sync_failed', {
          status: 'failed',
          durationMs: Date.now() - startedAt,
          pollCount,
          accessTokenRetries,
          readinessChecks,
          privyReady: lastSnapshot.ready,
          privyAuthenticated: lastSnapshot.authenticated,
          errorCode: 'PRIVY_SYNC_FAILED',
        })
        dispatch({
          type: 'PRIVY_SYNC_FAILED',
          error: buildPrivySyncFailure(),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [emitTelemetry, state])

  useEffect(() => {
    if (state.tag !== 'bind_telegram' || state.step !== 'ensure_privy_link') return

    const executionKey = `${state.proof.sessionToken}:${state.account.privyUserId}:${state.step}`
    if (bindExecutionKeyRef.current === executionKey) return
    bindExecutionKeyRef.current = executionKey

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

    emitTelemetry('telegram_link_privy_link_started', {
      status: 'started',
      privyUserId: state.account.privyUserId,
    })
    linkTelegramRef.current({
      launchParams: {
        initDataRaw: state.proof.initDataRaw,
      },
    })
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

      let accessToken = ''
      try {
        accessToken = String((await snapshot.getAccessToken()) ?? '').trim()
      } catch {
        accessToken = ''
      }
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
        const response = await apiFetch('/api/telegram/link/complete', {
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
        })
        const json = (await response.json().catch(() => null)) as ApiEnvelope<TelegramLinkCompleteData> | null
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
          : 'Email resolves the canonical 4626 account. Telegram attaches after sync.'
      : null
  const isMinimalVerifyEmailStep = state.tag === 'collect_email' || state.tag === 'sending_email_code'

  const renderContent = () => {
    switch (state.tag) {
      case 'verify_telegram_session':
        return <StatusBlock icon={ShieldCheck} tone="info" body="Checking Telegram Mini App session proof." />

      case 'collect_email':
        return (
          <form className="space-y-3" onSubmit={handleEmailFormSubmit}>
            <label htmlFor="telegram-link-email" className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[#666666]">
              Verified Email
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
              className="block h-11 w-full rounded-md border border-white/10 bg-[#111111] px-3 text-[15px] text-[#EDEDED] outline-none focus:border-[#0052FF] focus:ring-0"
            />
            {state.emailError ? <InlineError message={state.emailError} /> : null}
            {emailSubmitHelperText ? <p className="text-[12px] leading-[1.4] text-[#666666]">{emailSubmitHelperText}</p> : null}
            {!hasTelegramMainButton ? (
              <button
                type="submit"
                onPointerDown={handleEmailSubmitActivation('pointerdown')}
                onTouchStart={handleEmailSubmitActivation('touchstart')}
                onMouseDown={handleEmailSubmitActivation('mousedown')}
                data-testid="telegram-link-submit"
                data-disabled-reason={emailSubmitDisabledReason ?? 'ready'}
                data-email-normalized={normalizedCollectEmail}
                data-email-valid={emailIsValid ? 'true' : 'false'}
                data-flow-tag={state.tag}
                className="block h-11 w-full touch-manipulation rounded-md bg-[#0052FF] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#1E3A8A] disabled:text-white/70"
                disabled={emailSubmitDisabled}
              >
                Send Code
              </button>
            ) : null}
          </form>
        )

      case 'sending_email_code':
        return <StatusBlock icon={LoaderCircle} tone="info" spinning body={`Sending verification code to ${state.email}.`} />

      case 'enter_email_code':
        return (
          <form className="space-y-3" onSubmit={handleCodeSubmit}>
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
            <div className="flex gap-2.5">
              <button
                type="submit"
                className="relative z-10 inline-flex h-11 flex-1 touch-manipulation items-center justify-center rounded-[16px] bg-[#0052FF] px-5 text-sm font-semibold text-white transition hover:bg-[#004AD9] disabled:cursor-not-allowed disabled:bg-[#1E3A8A] disabled:text-white/70"
                disabled={state.code.trim().length < 6}
              >
                Verify Code
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESEND_CODE' })}
                className="inline-flex h-11 touch-manipulation items-center justify-center rounded-[16px] border border-white/[0.06] bg-transparent px-4 text-sm font-medium text-[#EDEDED] transition hover:border-white/15 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!canResend}
              >
                {canResend ? 'Resend' : `${resendSeconds}s`}
              </button>
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
        return (
          <div className="space-y-4">
            <StatusBlock
              icon={CheckCircle2}
              tone="success"
              body={`Canonical account ${state.account.email} is ready. Telegram ${formatTelegramHandle(state.link.telegramUsername, state.link.telegramUserId)} is linked.`}
            />
            <div className="grid gap-x-4 gap-y-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
              <MetaField label="Telegram" value={formatTelegramHandle(state.link.telegramUsername, state.link.telegramUserId)} />
              <MetaField label="Profile" value={String(state.link.profileId)} />
              <MetaField label="Link Status" value={state.link.linkStatus} />
              <MetaField label="Canonical Email" value={state.account.email} />
              <MetaField
                label="Canonical CSW"
                value={canonicalCswAddress ? shortAddress(canonicalCswAddress) : 'Pending wallet setup'}
                title={canonicalCswAddress ?? 'Canonical Coinbase Smart Wallet not set yet.'}
              />
            </div>
            <div className="text-sm leading-6 text-[#666666]">
              Telegram is attached to the verified-email 4626 account. Telegram does not replace email recovery.
            </div>
          </div>
        )

      case 'expired_or_error':
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
            <div className="flex flex-wrap gap-3">
              {state.retryTarget ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RETRY' })}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-[#0052FF] px-5 text-sm font-semibold text-white transition hover:bg-[#004AD9]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              ) : null}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border border-white/[0.08] bg-transparent px-5 text-sm font-medium text-[#EDEDED] transition hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <Unplug className="h-4 w-4" />
                  Reset Flow
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <div
      data-testid="telegram-link-shell"
      className="relative flex overflow-hidden bg-[#020202] text-[#EDEDED]"
      style={TG_VIEWPORT_STYLE}
    >
      <PageMeta title="Telegram Link" description="Verify email inside Telegram and bind Telegram to the canonical 4626 account." canonicalPath="/telegram/link" />
      {!isMinimalVerifyEmailStep ? (
        <div data-testid="telegram-link-decorative-overlay" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-[#0052FF]/18 blur-3xl" />
          <div className="absolute right-[-10%] top-[8%] h-80 w-80 rounded-full bg-[#3B82F6]/12 blur-3xl" />
          <div className="absolute bottom-[-14%] left-[18%] h-72 w-72 rounded-full bg-white/[0.035] blur-3xl" />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[27rem] items-start">
        {isMinimalVerifyEmailStep ? (
          <section
            data-flow-state={state.tag}
            data-testid="telegram-link-panel"
            className="relative isolate flex w-full flex-col rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-4 touch-manipulation"
          >
            <h1 className="text-[20px] font-semibold text-[#EDEDED]">Verify Email</h1>
            <p className="mt-1 text-[13px] leading-[1.4] text-[#666666]">
              Verified email is the canonical 4626 identity. Telegram links after verification.
            </p>

            {proof ? (
              <div className="mt-3 space-y-1.5 text-[13px] leading-[1.4] text-[#EDEDED]">
                <div>Telegram: <span className="font-mono">{formatTelegramHandle(proof.telegramUsername, proof.telegramUserId)}</span></div>
                <div>Chat: <span className="font-mono">{proof.chatId ?? 'direct'}</span></div>
                <div>Session: <span className="font-mono">{new Date(proof.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
              </div>
            ) : null}

            <div className="mt-4">{renderContent()}</div>
          </section>
        ) : (
          <div
            data-flow-state={state.tag}
            data-testid="telegram-link-panel"
            className="flex w-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(10,10,10,0.94),rgba(10,10,10,0.84))] px-4 py-3 shadow-[0_24px_96px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.75 text-[9px] font-medium uppercase tracking-[0.2em] text-[#666666]">
                  Telegram Mini App
                </div>
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#EDEDED]">{getFlowHeadline(state.tag)}</h1>
                <p className="max-w-xl text-[12px] leading-[1.35] text-[#666666]">{getFlowDescription(state.tag)}</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] leading-[1.35]">
              <span className="font-mono text-[#EDEDED]">email -&gt; account</span>
              <span className="font-mono text-[#666666]">telegram -&gt; linked</span>
            </div>

            {proof ? (
              <div className="mt-2 grid gap-x-3 gap-y-2 border-t border-white/[0.05] pt-2.5 text-sm sm:grid-cols-3">
                <MetaField label="Telegram" value={formatTelegramHandle(proof.telegramUsername, proof.telegramUserId)} />
                <MetaField label="Chat" value={proof.chatId ?? 'direct'} />
                <MetaField label="Session" value={new Date(proof.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
              </div>
            ) : null}

            <div className="mt-3 min-h-0 overflow-y-auto pr-0.5 scrollbar-hide">{renderContent()}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBlock(props: {
  icon: typeof LoaderCircle
  body: string
  spinning?: boolean
  tone: 'info' | 'success' | 'error'
}) {
  const toneClasses =
    props.tone === 'success'
      ? 'border-[#22c55e]/25 bg-[#22c55e]/10 text-[#EDEDED]'
      : props.tone === 'error'
        ? 'border-[#ef4444]/25 bg-[#ef4444]/10 text-[#EDEDED]'
        : 'border-[#0052FF]/25 bg-[#0052FF]/10 text-[#EDEDED]'
  const Icon = props.icon

  return (
    <div className={`rounded-[18px] border px-3.5 py-2.5 ${toneClasses}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-white/10 bg-white/[0.05] p-1.5">
          <Icon className={`h-4 w-4 ${props.spinning ? 'animate-spin' : ''}`} />
        </div>
        <div className="text-[13px] leading-5">{props.body}</div>
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
