import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLogin, usePrivy } from '@privy-io/react-auth'

import { PageMeta } from '@/components/seo/PageMeta'
import { Alert } from '@/components/ui/Alert'
import { apiFetch } from '@/lib/apiBase'
import {
  clearStoredTelegramMiniAppLinkContext,
  resolveTelegramMiniAppLinkContext,
  stripTelegramMiniAppLinkParams,
} from '@/lib/telegramMiniAppLink'
import {
  ensureTelegramMiniAppSession,
  isTelegramMiniAppContext,
  loadTelegramWebApp,
  setupTelegramMiniAppUi,
} from '@/lib/telegramWebApp'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type TelegramLinkCompleteResponse = {
  linked: boolean
  linkStatus: string
  canonicalCswAddress: string | null
  ownerVerified: boolean
}

export type TelegramLinkSessionState = 'verifying' | 'ready' | 'error'
export type TelegramLinkFlowState = 'idle' | 'authenticating' | 'linking' | 'linked' | 'error'
type TelegramLinkAlertVariant = 'info' | 'warning' | 'error' | 'success'
const OPEN_FROM_TELEGRAM_SESSION_ERROR = 'Open this link from Telegram so 4626 can verify your Mini App session.'
const PRIVY_ACCESS_TOKEN_TIMEOUT_MS = 15_000
const TELEGRAM_LINK_REQUEST_TIMEOUT_MS = 25_000
type PrivyEmailState = {
  hasAnyEmailAccount: boolean
  hasVerifiedEmail: boolean
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        clearTimeout(timeoutId)
      })
  })
}

function normalizeLowerString(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function accountHasVerifiedFlag(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const account = value as Record<string, unknown>
  if (account.verified === true || account.isVerified === true || account.is_verified === true) return true
  const verifiedAt = normalizeLowerString(account.verifiedAt)
  const verifiedAtSnake = normalizeLowerString(account.verified_at)
  return verifiedAt.length > 0 || verifiedAtSnake.length > 0
}

export function getPrivyEmailState(user: unknown): PrivyEmailState {
  const u = (user ?? {}) as Record<string, unknown>
  let hasAnyEmailAccount = false
  let hasVerifiedEmail = false

  const directEmail = u.email
  if (directEmail && typeof directEmail === 'object') {
    hasAnyEmailAccount = true
    if (accountHasVerifiedFlag(directEmail)) hasVerifiedEmail = true
  }

  const linked = [
    ...(Array.isArray(u.linkedAccounts) ? (u.linkedAccounts as unknown[]) : []),
    ...(Array.isArray(u.linked_accounts) ? (u.linked_accounts as unknown[]) : []),
  ]
  for (const account of linked) {
    const record = (account ?? {}) as Record<string, unknown>
    const type = normalizeLowerString(record.type)
    if (!type.includes('email')) continue
    hasAnyEmailAccount = true
    if (accountHasVerifiedFlag(record)) hasVerifiedEmail = true
  }

  return { hasAnyEmailAccount, hasVerifiedEmail }
}

export function isPrivyEmailAlreadyLinkedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.trim().toLowerCase()
  return (
    normalized.includes('already has an account of type email linked') ||
    normalized.includes('already has an account of type "email" linked') ||
    normalized.includes('account of type email linked') ||
    normalized.includes('email already linked')
  )
}

export function normalizeTelegramLinkUiMessage(message: string | null): string | null {
  if (!message) return null
  if (isPrivyEmailAlreadyLinkedError(message)) {
    return 'This email is already linked in Privy. Tap Retry link to continue Telegram linking.'
  }
  return message
}

export function formatTelegramSessionError(error: string, statusCode: number): string {
  const normalized = String(error ?? '').trim().toLowerCase()
  if (normalized.includes('invalid_hash')) {
    return 'Telegram could not verify this Mini App launch signature. Run /link in Telegram for a fresh Open Mini App button, then retry from that button.'
  }
  if (normalized.includes('missing_hash') || normalized.includes('invalid_hash_format')) {
    return 'Mini App launch signature was missing or malformed. Re-open this flow from Telegram using the Open Mini App button.'
  }
  if (normalized.includes('missing_user') || normalized.includes('invalid_user')) {
    return 'Telegram did not provide a valid Mini App user payload. Update Telegram, then re-open the Mini App from your /link message.'
  }
  if (
    normalized.includes('missing_auth_date') ||
    normalized.includes('invalid_auth_date') ||
    normalized.includes('future_auth_date')
  ) {
    return 'Telegram Mini App launch timing data was invalid. Re-open the Mini App from Telegram and retry.'
  }
  if (statusCode === 409 || normalized.includes('replay')) {
    return 'This Telegram Mini App session was already used. Re-open the Mini App from Telegram, then tap Link again.'
  }
  if (statusCode === 410 || normalized.includes('expired')) {
    return 'This Telegram Mini App session expired. Re-open the Mini App from Telegram and retry.'
  }
  if (normalized.includes('disabled')) {
    return 'Telegram Mini App linking is not enabled for this chat yet.'
  }
  if (normalized.includes('unavailable')) {
    return 'Telegram Mini App session unavailable. Open this flow from Telegram.'
  }
  if (statusCode >= 500) {
    return 'Telegram session verification is temporarily unavailable. Re-open the Mini App from Telegram in a moment.'
  }
  return 'Could not verify your Telegram Mini App session. Re-open the Mini App from Telegram and retry.'
}

export function getTelegramLinkSuccessMessage(linkStatus: string): string {
  return linkStatus === 'active'
    ? 'Telegram linked successfully. You can return to Telegram or continue into 4626.'
    : 'Telegram linked. Finish Coinbase Smart Wallet setup in 4626 before trading from Telegram.'
}

export function shouldShowRetryTelegramSession(params: {
  sessionState: TelegramLinkSessionState
  telegramMiniAppContext: boolean
}): boolean {
  return params.sessionState === 'error' && params.telegramMiniAppContext
}

export function shouldAutoStartTelegramLink(params: {
  hasLinkContext: boolean
  sessionState: TelegramLinkSessionState
  sessionToken: string
  privyReady: boolean
  privyAuthenticated: boolean
  linkState: TelegramLinkFlowState
  alreadyAttemptedForToken: boolean
}): boolean {
  if (!params.hasLinkContext) return false
  if (params.sessionState !== 'ready') return false
  if (!params.sessionToken) return false
  if (!params.privyReady || !params.privyAuthenticated) return false
  // Auto-submit only from the initial idle state. After any error,
  // require explicit user intent via "Retry link" to avoid request storms.
  if (params.linkState !== 'idle') return false
  if (params.alreadyAttemptedForToken) return false
  return true
}

export function getTelegramLinkViewState(params: {
  sessionState: TelegramLinkSessionState
  linkState: TelegramLinkFlowState
  sessionError: string | null
  linkMessage: string | null
  privyAuthenticated: boolean
  hasLinkContext: boolean
}) {
  const { sessionState, linkState, sessionError, linkMessage, privyAuthenticated, hasLinkContext } = params
  const normalizedLinkMessage = normalizeTelegramLinkUiMessage(linkMessage)
  const isPrivyEmailLinkedIssue = Boolean(linkMessage) && normalizedLinkMessage !== linkMessage
  const statusVariant: TelegramLinkAlertVariant =
    sessionState === 'error' || linkState === 'error' ? 'warning' : linkState === 'linked' ? 'success' : 'info'
  const statusTitle =
    sessionState === 'verifying'
      ? 'Verifying Telegram session'
      : sessionState === 'error' || linkState === 'error'
        ? 'Telegram linking needs attention'
        : linkState === 'linked'
          ? 'Telegram account linked'
          : linkState === 'linking'
            ? 'Linking Telegram account'
            : linkState === 'authenticating'
              ? 'Sign in to 4626'
              : 'Ready to link'

  const statusMessage =
    sessionError ??
    normalizedLinkMessage ??
    (sessionState === 'verifying'
      ? 'Checking your Telegram Mini App session...'
      : privyAuthenticated
        ? 'Your 4626 session is ready. Verify email if prompted, then we will finish the Telegram link.'
        : 'Verify your email with 4626 to finish linking.')

  const canSignIn =
    sessionState === 'ready' &&
    hasLinkContext &&
    linkState !== 'authenticating' &&
    linkState !== 'linking' &&
    linkState !== 'linked' &&
    !isPrivyEmailLinkedIssue
  const canRetryLink = sessionState === 'ready' && hasLinkContext && linkState === 'error'

  return {
    statusVariant,
    statusTitle,
    statusMessage,
    canSignIn,
    canRetryLink,
  }
}

export function TelegramLink() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const privy = usePrivy()
  const { login } = useLogin()

  const privyReady = Boolean(privy.ready)
  const privyAuthenticated = Boolean(privy.authenticated)
  const getAccessToken = useMemo(
    () =>
      typeof privy.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy.getAccessToken],
  )

  const telegramLinkContext = useMemo(() => resolveTelegramMiniAppLinkContext(searchParams), [searchParams])

  const [sessionState, setSessionState] = useState<'verifying' | 'ready' | 'error'>('verifying')
  const [sessionToken, setSessionToken] = useState('')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [linkState, setLinkState] = useState<'idle' | 'authenticating' | 'linking' | 'linked' | 'error'>('idle')
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const linkAttemptRef = useRef('')

  const verifySession = useCallback(async () => {
    setSessionState('verifying')
    setSessionError(null)
    setSessionToken('')

    const session = await ensureTelegramMiniAppSession()
    if (!session.ok) {
      setSessionState('error')
      setSessionError(formatTelegramSessionError(session.error, session.statusCode))
      return null
    }

    setSessionState('ready')
    setSessionToken(session.session.sessionToken)
    return session.session
  }, [])

  useEffect(() => {
    let cancelled = false
    let teardown: (() => void) | null = null

    void (async () => {
      const webApp = await loadTelegramWebApp().catch(() => null)
      if (cancelled) return
      if (!webApp) {
        setSessionState('error')
        setSessionError(OPEN_FROM_TELEGRAM_SESSION_ERROR)
        return
      }
      teardown = setupTelegramMiniAppUi({ requestExpand: true })
      if (!isTelegramMiniAppContext()) {
        setSessionState('error')
        setSessionError(OPEN_FROM_TELEGRAM_SESSION_ERROR)
        return
      }
      await verifySession()
    })()

    return () => {
      cancelled = true
      teardown?.()
    }
  }, [verifySession])

  useEffect(() => {
    const shouldAutoStart = shouldAutoStartTelegramLink({
      hasLinkContext: Boolean(telegramLinkContext),
      sessionState,
      sessionToken,
      privyReady,
      privyAuthenticated,
      linkState,
      alreadyAttemptedForToken: Boolean(telegramLinkContext && linkAttemptRef.current === telegramLinkContext.linkToken),
    })
    if (!telegramLinkContext || !shouldAutoStart) return

    linkAttemptRef.current = telegramLinkContext.linkToken
    void (async () => {
      setLinkState('linking')
      setLinkMessage('Linking your Telegram identity to your 4626 account...')

      const accessToken = (
        await withTimeout(
          getAccessToken().catch(() => null),
          PRIVY_ACCESS_TOKEN_TIMEOUT_MS,
          'Reading your 4626 session',
        ).catch(() => null)
      )?.trim() ?? ''
      if (!accessToken) {
        throw new Error('Could not read your 4626 session. Sign in again and retry linking.')
      }

      const abortController = new AbortController()
      const requestTimeoutId = setTimeout(() => abortController.abort(), TELEGRAM_LINK_REQUEST_TIMEOUT_MS)
      let res: Response
      try {
        res = await apiFetch('/api/telegram/miniapp/link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-privy-token': accessToken,
          },
          body: JSON.stringify({
            token: telegramLinkContext.linkToken,
            telegramUsername: telegramLinkContext.telegramUsername,
            miniAppSessionToken: sessionToken,
          }),
          signal: abortController.signal,
        })
      } catch (error) {
        if (abortController.signal.aborted) {
          throw new Error('Telegram linking timed out. Tap Retry link to try again.')
        }
        throw error
      } finally {
        clearTimeout(requestTimeoutId)
      }
      const json = (await res.json().catch(() => null)) as ApiEnvelope<TelegramLinkCompleteResponse> | null
      if (!res.ok || !json?.success || !json.data) {
        const message =
          typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : 'Telegram linking failed.'
        if (res.status === 410 || /expired/i.test(message)) {
          clearStoredTelegramMiniAppLinkContext()
        }
        throw new Error(message)
      }

      clearStoredTelegramMiniAppLinkContext()
      const cleaned = stripTelegramMiniAppLinkParams(searchParams)
      const next = cleaned.toString()
      navigate(
        {
          pathname: '/telegram/link',
          search: next ? `?${next}` : '',
        },
        { replace: true },
      )
      setLinkState('linked')
      setLinkMessage(getTelegramLinkSuccessMessage(json.data.linkStatus))
    })().catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Could not complete Telegram linking. Retry in a moment.'
      setLinkState('error')
      setLinkMessage(message)
    })
  }, [
    getAccessToken,
    linkState,
    navigate,
    privyAuthenticated,
    privyReady,
    searchParams,
    sessionState,
    sessionToken,
    telegramLinkContext,
  ])

  const onRetrySession = useCallback(() => {
    if (!isTelegramMiniAppContext()) {
      setSessionState('error')
      setSessionError(OPEN_FROM_TELEGRAM_SESSION_ERROR)
      return
    }
    void verifySession()
  }, [verifySession])

  const onRetryLink = useCallback(() => {
    linkAttemptRef.current = ''
    setLinkState('idle')
    setLinkMessage(null)
  }, [])

  const onSignIn = useCallback(async () => {
    setLinkState('authenticating')
    setLinkMessage('Verify your email to continue.')
    try {
      if (privyAuthenticated) {
        const emailState = getPrivyEmailState((privy as any)?.user)
        if (emailState.hasVerifiedEmail) {
          linkAttemptRef.current = ''
          setLinkState('idle')
          setLinkMessage(null)
          return
        }
        const launchEmailLogin = async () => {
          await login({ loginMethods: ['email'] } as any)
        }
        if (emailState.hasAnyEmailAccount) {
          await launchEmailLogin()
        } else {
          const linkEmail = (privy as any)?.linkEmail ?? (privy as any)?.linkEmailAccount
          if (typeof linkEmail === 'function') {
            try {
              await linkEmail()
            } catch (error) {
              if (isPrivyEmailAlreadyLinkedError(error)) {
                await launchEmailLogin()
              } else {
                throw error
              }
            }
          } else {
            await launchEmailLogin()
          }
        }
      } else {
        await login({ loginMethods: ['email'] } as any)
      }
      linkAttemptRef.current = ''
      setLinkState('idle')
      setLinkMessage(null)
    } catch (error: unknown) {
      if (isPrivyEmailAlreadyLinkedError(error)) {
        // Privy can throw this when the email method already exists on the
        // current user. Treat as recoverable and continue the link flow.
        linkAttemptRef.current = ''
        setLinkState('idle')
        setLinkMessage(null)
        return
      }
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Failed to start 4626 sign-in.'
      setLinkState('error')
      setLinkMessage(message)
    }
  }, [login, privy, privyAuthenticated])

  const { statusVariant, statusTitle, statusMessage, canSignIn, canRetryLink } = getTelegramLinkViewState({
    sessionState,
    linkState,
    sessionError,
    linkMessage,
    privyAuthenticated,
    hasLinkContext: Boolean(telegramLinkContext),
  })
  const showRetrySessionButton = shouldShowRetryTelegramSession({
    sessionState,
    telegramMiniAppContext: isTelegramMiniAppContext(),
  })

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <PageMeta title="Telegram Link" description="Link your Telegram identity to 4626." canonicalPath="/telegram/link" />
      <div className="w-full rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">Telegram Mini App</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Link Telegram to your 4626 account</h1>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            This page is only for the Telegram account-link handshake. It verifies the Mini App session first, then binds your
            Telegram identity after you verify your email with 4626.
          </p>
        </div>

        <Alert variant={statusVariant} title={statusTitle} className="mt-6">
          {statusMessage}
        </Alert>

        {!telegramLinkContext && linkState !== 'linked' ? (
          <div className="mt-4 text-sm text-zinc-400">
            The one-time Telegram link token is missing. Open Telegram and run <span className="font-mono text-zinc-200">/link</span>{' '}
            again to get a fresh Mini App launch.
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Telegram session</div>
            <div className="mt-2 text-sm font-medium text-zinc-100">
              {sessionState === 'ready' ? 'Verified' : sessionState === 'error' ? 'Needs retry' : 'Checking'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">4626 account</div>
            <div className="mt-2 text-sm font-medium text-zinc-100">
              {privyAuthenticated ? 'Signed in' : linkState === 'authenticating' ? 'Waiting for sign-in' : 'Sign-in required'}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {canSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-300"
            >
              {privyAuthenticated ? 'Verify email' : 'Continue with 4626'}
            </button>
          ) : null}

          {showRetrySessionButton ? (
            <button
              type="button"
              onClick={onRetrySession}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Retry Telegram session
            </button>
          ) : null}

          {canRetryLink ? (
            <button
              type="button"
              onClick={onRetryLink}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Retry link
            </button>
          ) : null}

          {linkState === 'linked' ? (
            <>
              <Link
                to="/swap"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-emerald-300"
              >
                Open 4626
              </Link>
              <Link
                to="/accounts"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                Manage accounts
              </Link>
            </>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-400">
          <div className="font-medium uppercase tracking-[0.18em] text-zinc-500">Notes</div>
          <div className="mt-2">
            Keep this flow inside Telegram while linking. If the Mini App session expires or gets consumed, reopen the Mini App
            from Telegram to mint a fresh session before retrying.
          </div>
        </div>

        {(sessionState === 'verifying' || linkState === 'authenticating' || linkState === 'linking') ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Working...</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
