import { useEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, LoaderCircle, Mail, RefreshCw, ShieldCheck, ShieldX, Unplug } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLinkAccount, useLoginWithEmail, usePrivy } from '@privy-io/react-auth'

import { PageMeta } from '@/components/seo/PageMeta'
import { apiFetch } from '@/lib/apiBase'
import {
  clearStoredTelegramMiniAppLinkContext,
  resolveTelegramMiniAppLinkContext,
  stripTelegramMiniAppLinkParams,
} from '@/lib/telegramMiniAppLink'
import { ensureTelegramMiniAppSession, setupTelegramMiniAppUi } from '@/lib/telegramWebApp'

import {
  createFlowError,
  createInitialTelegramLinkState,
  hasMatchingPrivyTelegramAccount,
  isTelegramLaunchParamError,
  normalizeEmailCandidate,
  telegramLinkReducer,
  type CanonicalAccountReady,
  type FlowError,
  type TelegramLinkResult,
} from './telegramLinkFlow'

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
  code?: string
}

type TelegramLinkCompleteData = {
  link: TelegramLinkResult
  account: CanonicalAccountReady
}

const OTP_RESEND_DELAY_MS = 30_000
const PRIVY_SYNC_TIMEOUT_MS = 20_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const TG_VIEWPORT_STYLE: CSSProperties = {
  minHeight: 'max(100vh, var(--cv-tg-viewport-stable-height, 100vh))',
  paddingTop: 'max(16px, var(--cv-tg-safe-top, 0px))',
  paddingBottom: 'max(24px, var(--cv-tg-safe-bottom, 0px))',
  paddingLeft: 'max(16px, var(--cv-tg-content-safe-left, 0px))',
  paddingRight: 'max(16px, var(--cv-tg-content-safe-right, 0px))',
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

function parseCanonicalAccount(data: unknown, expectedEmail: string): CanonicalAccountReady | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const email = normalizeEmailCandidate(typeof record.email === 'string' ? record.email : '')
  if (!email || email !== normalizeEmailCandidate(expectedEmail)) return null
  if (record.emailVerified !== true) return null
  return record as unknown as CanonicalAccountReady
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
      return 'Validating the Telegram Mini App proof before any account work starts.'
    case 'collect_email':
    case 'sending_email_code':
      return 'Verified email is the canonical 4626 identity and recovery key.'
    case 'enter_email_code':
    case 'verifying_email_code':
      return 'Enter the email code inline. Telegram remains a linked identity only.'
    case 'wait_for_privy_sync':
      return 'Email verification succeeded. Waiting for Privy and the canonical 4626 account to finish syncing.'
    case 'bind_telegram':
      return 'Canonical account is ready. Binding the Telegram identity to that verified-email account.'
    case 'success':
      return 'Canonical account resolved from verified email. Telegram is now attached to that account.'
    case 'expired_or_error':
      return 'Telegram launch or account sync could not be completed. No implicit retries were applied.'
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
  const privySnapshotRef = useRef({
    ready: Boolean(privy.ready),
    authenticated: Boolean(privy.authenticated),
    user: privy.user ?? null,
    getAccessToken,
  })

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    privySnapshotRef.current = {
      ready: Boolean(privy.ready),
      authenticated: Boolean(privy.authenticated),
      user: privy.user ?? null,
      getAccessToken,
    }
  }, [getAccessToken, privy.authenticated, privy.ready, privy.user])

  const { linkTelegram } = useLinkAccount({
    onSuccess: ({ linkMethod }) => {
      if (linkMethod !== 'telegram') return
      if (stateRef.current.tag !== 'bind_telegram' || stateRef.current.step !== 'ensure_privy_link') return
      dispatch({ type: 'PRIVY_TELEGRAM_LINK_SUCCEEDED' })
    },
    onError: (errorCode, details) => {
      if (details?.linkMethod !== 'telegram') return
      if (stateRef.current.tag !== 'bind_telegram' || stateRef.current.step !== 'ensure_privy_link') return
      dispatch({
        type: 'PRIVY_TELEGRAM_LINK_FAILED',
        error: isTelegramLaunchParamError(String(errorCode))
          ? buildLaunchParamFailure()
          : buildBindFailure(coerceErrorMessage(errorCode, 'Telegram link failed.'), true),
      })
    },
  })

  useEffect(() => {
    return setupTelegramMiniAppUi({ requestExpand: true })
  }, [])

  useEffect(() => {
    if (state.tag !== 'verify_telegram_session') return

    let cancelled = false
    void (async () => {
      const verified = await ensureTelegramMiniAppSession()
      if (cancelled) return

      if (!verified.ok) {
        dispatch({
          type: 'TELEGRAM_VERIFY_FAILED',
          error: buildTelegramSessionError(verified.error, verified.statusCode),
        })
        return
      }

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
  }, [dispatch, location.hash, location.pathname, location.search, navigate, state])

  useEffect(() => {
    if (state.tag !== 'sending_email_code') return

    let cancelled = false
    void (async () => {
      const normalized = normalizeEmailCandidate(state.email)
      if (!isValidEmail(normalized)) {
        dispatch({
          type: 'EMAIL_CODE_SEND_FAILED',
          error: createFlowError({
            code: 'OTP_SEND_FAILED',
            message: 'Enter a valid email address.',
            recoverable: true,
          }),
        })
        return
      }

      try {
        await sendCode({ email: normalized })
        if (cancelled) return
        dispatch({
          type: 'EMAIL_CODE_SENT',
          resendAvailableAt: Date.now() + OTP_RESEND_DELAY_MS,
        })
      } catch (error) {
        if (cancelled) return
        dispatch({
          type: 'EMAIL_CODE_SEND_FAILED',
          error: buildOtpSendError(error),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sendCode, state])

  useEffect(() => {
    if (state.tag !== 'verifying_email_code') return

    let cancelled = false
    void (async () => {
      const normalizedCode = state.code.trim()
      if (normalizedCode.length < 6) {
        dispatch({
          type: 'EMAIL_CODE_VERIFY_FAILED',
          error: createFlowError({
            code: 'OTP_VERIFY_FAILED',
            message: 'Enter the 6-digit code from your email.',
            recoverable: true,
          }),
        })
        return
      }

      try {
        await loginWithCode({ code: normalizedCode })
        if (cancelled) return
        dispatch({ type: 'EMAIL_CODE_VERIFIED' })
      } catch (error) {
        if (cancelled) return
        dispatch({
          type: 'EMAIL_CODE_VERIFY_FAILED',
          error: buildOtpVerifyError(error),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loginWithCode, state])

  useEffect(() => {
    if (state.tag !== 'wait_for_privy_sync') return

    let cancelled = false
    void (async () => {
      const expectedEmail = normalizeEmailCandidate(state.email)
      const deadline = state.startedAt + PRIVY_SYNC_TIMEOUT_MS

      while (!cancelled && Date.now() < deadline) {
        const snapshot = privySnapshotRef.current
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
          await sleep(300)
          continue
        }

        try {
          const response = await apiFetch('/api/accounts/me', {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          })
          const json = (await response.json().catch(() => null)) as ApiEnvelope<CanonicalAccountReady> | null
          const account = response.ok ? parseCanonicalAccount(json?.data, expectedEmail) : null
          if (account) {
            dispatch({ type: 'PRIVY_SYNC_READY', account })
            return
          }
        } catch {
          // Stay inside the explicit wait state until timeout.
        }

        await sleep(500)
      }

      if (!cancelled) {
        dispatch({
          type: 'PRIVY_SYNC_FAILED',
          error: buildPrivySyncFailure(),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state])

  useEffect(() => {
    if (state.tag !== 'bind_telegram' || state.step !== 'ensure_privy_link') return

    const snapshot = privySnapshotRef.current
    if (hasMatchingPrivyTelegramAccount(snapshot.user, state.proof)) {
      dispatch({ type: 'PRIVY_TELEGRAM_LINK_SKIPPED' })
      return
    }

    if (!snapshot.ready || !snapshot.authenticated) {
      dispatch({
        type: 'PRIVY_TELEGRAM_LINK_FAILED',
        error: buildBindFailure('Privy session was not ready for Telegram linking.', true),
      })
      return
    }

    linkTelegram({
      launchParams: {
        initDataRaw: state.proof.initDataRaw,
      },
    })
  }, [linkTelegram, state])

  useEffect(() => {
    if (state.tag !== 'bind_telegram' || state.step !== 'complete_backend') return

    let cancelled = false
    void (async () => {
      const snapshot = privySnapshotRef.current
      if (typeof snapshot.getAccessToken !== 'function') {
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
          }),
        })
        const json = (await response.json().catch(() => null)) as ApiEnvelope<TelegramLinkCompleteData> | null
        if (cancelled) return

        if (!response.ok || !json?.success || !json.data?.link) {
          const message = json?.error || 'Unable to complete Telegram binding.'
          const code = String(json?.code ?? '').trim().toUpperCase()
          const lower = message.toLowerCase()
          if (code.includes('RECOVERY_REQUIRED') || lower.includes('recovery required')) {
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
          dispatch({
            type: 'BIND_TELEGRAM_FAILED',
            error: buildBindFailure(message, response.status >= 500 || response.status === 0),
          })
          return
        }

        dispatch({
          type: 'BIND_TELEGRAM_SUCCEEDED',
          link: json.data.link,
        })
      } catch (error) {
        if (cancelled) return
        dispatch({
          type: 'BIND_TELEGRAM_FAILED',
          error: buildBindFailure(coerceErrorMessage(error, 'Unable to complete Telegram binding.'), true),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state])

  useEffect(() => {
    if (state.tag !== 'enter_email_code' || !state.resendAvailableAt || state.resendAvailableAt <= Date.now()) return

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [state])

  useEffect(() => {
    if (state.tag === 'success') {
      clearStoredTelegramMiniAppLinkContext()
    }
  }, [state.tag])

  const handleEmailSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    dispatch({ type: 'SUBMIT_EMAIL' })
  }

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

  const renderContent = () => {
    switch (state.tag) {
      case 'verify_telegram_session':
        return <StatusBlock icon={ShieldCheck} tone="info" body="Checking Telegram Mini App session proof." />

      case 'collect_email':
        return (
          <form className="space-y-4" onSubmit={handleEmailSubmit}>
            <div className="space-y-2">
              <label htmlFor="telegram-link-email" className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#666666]">
                Verified Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" />
                <input
                  id="telegram-link-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={state.email}
                  onChange={(event) => dispatch({ type: 'EMAIL_CHANGED', email: event.target.value })}
                  placeholder="name@example.com"
                  className="h-13 w-full rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] pl-11 pr-4 text-[15px] text-[#EDEDED] outline-none transition focus:border-[#0052FF] focus:ring-0"
                />
              </div>
              {state.emailError ? <InlineError message={state.emailError} /> : null}
            </div>
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#0052FF] px-5 text-sm font-semibold text-white transition hover:bg-[#004AD9] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!state.email.trim()}
            >
              Send Code
            </button>
          </form>
        )

      case 'sending_email_code':
        return <StatusBlock icon={LoaderCircle} tone="info" spinning body={`Sending verification code to ${state.email}.`} />

      case 'enter_email_code':
        return (
          <form className="space-y-4" onSubmit={handleCodeSubmit}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#EDEDED]">
              Code sent to <span className="font-mono text-[13px]">{state.email}</span>
            </div>
            <div className="space-y-2">
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
                className="h-13 w-full rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] px-4 text-center font-mono text-[18px] tracking-[0.38em] text-[#EDEDED] outline-none transition focus:border-[#0052FF] focus:ring-0"
              />
              {state.codeError ? <InlineError message={state.codeError} /> : null}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-[#0052FF] px-5 text-sm font-semibold text-white transition hover:bg-[#004AD9] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={state.code.trim().length < 6}
              >
                Verify Code
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESEND_CODE' })}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#1F1F1F] bg-transparent px-4 text-sm font-medium text-[#EDEDED] transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-55"
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
        return (
          <div className="space-y-5">
            <StatusBlock
              icon={CheckCircle2}
              tone="success"
              body={`Canonical account ${state.account.email} is ready. Telegram ${formatTelegramHandle(state.link.telegramUsername, state.link.telegramUserId)} is linked.`}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <MetaCard label="Telegram" value={formatTelegramHandle(state.link.telegramUsername, state.link.telegramUserId)} />
              <MetaCard label="Profile" value={String(state.link.profileId)} />
              <MetaCard label="Link Status" value={state.link.linkStatus} />
              <MetaCard label="Canonical Email" value={state.account.email} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[#EDEDED]">
              Telegram is attached to the verified-email 4626 account. Telegram does not replace email recovery.
            </div>
          </div>
        )

      case 'expired_or_error':
        return (
          <div className="space-y-4">
            <StatusBlock icon={state.error.recoverable ? AlertTriangle : ShieldX} tone="error" body={state.error.message} />
            <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] px-4 py-3">
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
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0052FF] px-5 text-sm font-semibold text-white transition hover:bg-[#004AD9]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET' })}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#1F1F1F] bg-transparent px-5 text-sm font-medium text-[#EDEDED] transition hover:border-white/20 hover:bg-white/[0.04]"
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
    <div className="overflow-hidden bg-[#020202] text-[#EDEDED]" style={TG_VIEWPORT_STYLE}>
      <PageMeta title="Telegram Link" description="Verify email inside Telegram and bind Telegram to the canonical 4626 account." canonicalPath="/telegram/link" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-[#0052FF]/18 blur-3xl" />
        <div className="absolute right-[-10%] top-[8%] h-80 w-80 rounded-full bg-[#3B82F6]/12 blur-3xl" />
        <div className="absolute bottom-[-14%] left-[18%] h-72 w-72 rounded-full bg-white/[0.035] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-xl items-center justify-center py-6">
        <div className="w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,10,0.94),rgba(10,10,10,0.82))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-6">
          <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-[#666666]">
                  Telegram Mini App
                </div>
                <div className="space-y-2">
                  <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#EDEDED]">{getFlowHeadline(state.tag)}</h1>
                  <p className="max-w-lg text-sm leading-6 text-[#666666]">{getFlowDescription(state.tag)}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-2 text-right">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#666666]">Identity Model</div>
                <div className="mt-1 text-[13px] font-mono text-[#EDEDED]">email -&gt; account</div>
                <div className="text-[11px] font-mono text-[#666666]">telegram -&gt; linked</div>
              </div>
            </div>

            {proof ? (
              <div className="mt-5 grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm sm:grid-cols-3">
                <MetaCard label="Telegram" value={formatTelegramHandle(proof.telegramUsername, proof.telegramUserId)} />
                <MetaCard label="Chat" value={proof.chatId ?? 'direct'} />
                <MetaCard label="Session" value={new Date(proof.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
              </div>
            ) : null}

            <div className="mt-5">{renderContent()}</div>
          </div>
        </div>
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
    <div className={`rounded-[22px] border px-4 py-4 ${toneClasses}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-white/10 bg-white/[0.05] p-2">
          <Icon className={`h-4 w-4 ${props.spinning ? 'animate-spin' : ''}`} />
        </div>
        <div className="text-sm leading-6">{props.body}</div>
      </div>
    </div>
  )
}

function InlineError(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#EDEDED]">
      {props.message}
    </div>
  )
}

function MetaCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#666666]">{props.label}</div>
      <div className="mt-2 truncate font-mono text-[13px] text-[#EDEDED]">{props.value}</div>
    </div>
  )
}
