import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'

import { runWaitlistPrivyLogout } from '@/components/waitlist/waitlistAuthState'
import { buildWaitlistEmailLoginOptions } from '@/components/waitlist/waitlistLoginOptions'
import { apiFetch } from '@/lib/apiBase'
import {
  clearStoredTelegramMiniAppLinkContext,
  resolveTelegramMiniAppLinkContext,
  stripTelegramMiniAppLinkParams,
} from '@/lib/telegramMiniAppLink'
import {
  clearTelegramMiniAppSession,
  ensureTelegramMiniAppSession,
  isTelegramMiniAppContext,
  loadTelegramWebApp,
  readPrivyTelegramLaunchParams,
  setupTelegramMiniAppUi,
} from '@/lib/telegramWebApp'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type TelegramLinkCompleteResponse = {
  linked: boolean
  linkStatus: string
  canonicalCswAddress: string | null
  ownerVerified: boolean
}

type AccountsMeResponse = {
  emailVerified: boolean
}

export type TelegramLinkSessionState = 'verifying' | 'ready' | 'error'
export type TelegramLinkFlowState = 'idle' | 'authenticating' | 'linking' | 'linked' | 'error'
export type TelegramLinkEmailState = 'unknown' | 'checking' | 'needs_verification' | 'verifying' | 'pending' | 'verified' | 'error'
type TelegramLinkAlertVariant = 'info' | 'warning' | 'error' | 'success'

export const OPEN_FROM_TELEGRAM_SESSION_ERROR = 'Open this link from Telegram so 4626 can verify your Mini App session.'
const PRIVY_ACCESS_TOKEN_TIMEOUT_MS = 15_000
const TELEGRAM_LINK_REQUEST_TIMEOUT_MS = 25_000
const TELEGRAM_EMAIL_CHECK_TIMEOUT_MS = 15_000
const TELEGRAM_EMAIL_POLL_ATTEMPTS = 5
const TELEGRAM_EMAIL_POLL_INTERVAL_MS = 1200
const TELEGRAM_EMAIL_PENDING_RETRY_MS = 3_000

type PrivyEmailState = {
  hasAnyEmailAccount: boolean
  hasVerifiedEmail: boolean
}

type TelegramLinkPrivyAuthSnapshot = {
  ready: boolean
  authenticated: boolean
  accessToken: string | null
  hasVerifiedEmail: boolean
  serverEmailVerified: boolean
}

type TelegramLinkEmailVerificationResult =
  | { status: 'verified' }
  | { status: 'needs_verification' }
  | { status: 'error'; message: string }

export type TelegramLinkEmailAuthAction = 'verified' | 'login' | 'link_email'

export type TelegramLinkViewState = {
  statusVariant: TelegramLinkAlertVariant
  statusTitle: string
  statusMessage: string
  canSignIn: boolean
  canRetryLink: boolean
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

export function isPrivyTelegramAlreadyLinkedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.trim().toLowerCase()
  const referencesTelegram = normalized.includes('telegram')
  return (
    (referencesTelegram && normalized.includes('already has an account of type telegram linked')) ||
    (referencesTelegram && normalized.includes('already has an account of type "telegram" linked')) ||
    (referencesTelegram && normalized.includes('account of type telegram linked')) ||
    normalized.includes('telegram already linked')
  )
}

export async function linkPrivyTelegramInMiniApp(params: {
  linkTelegram: ((params: { launchParams: { initDataRaw: string } }) => Promise<unknown>) | null | undefined
  launchParams: { initDataRaw?: string } | null | undefined
}): Promise<'linked' | 'already_linked' | 'skipped' | 'failed'> {
  const initDataRaw = typeof params.launchParams?.initDataRaw === 'string' ? params.launchParams.initDataRaw.trim() : ''
  if (!initDataRaw || typeof params.linkTelegram !== 'function') return 'skipped'
  try {
    await params.linkTelegram({
      launchParams: { initDataRaw },
    })
    return 'linked'
  } catch (error) {
    if (isPrivyTelegramAlreadyLinkedError(error)) return 'already_linked'
    return 'failed'
  }
}

export function normalizeTelegramLinkUiMessage(message: string | null): string | null {
  if (!message) return null
  if (isPrivyEmailAlreadyLinkedError(message)) {
    return 'This email is already linked in Privy. Tap Retry link to continue Telegram linking.'
  }
  return message
}

export function resolveTelegramLinkEmailAuthAction(params: {
  hasAnyEmailAccount: boolean
  hasVerifiedEmail: boolean
  canLinkEmail: boolean
}): TelegramLinkEmailAuthAction {
  if (params.hasVerifiedEmail) return 'verified'
  if (params.hasAnyEmailAccount) return 'login'
  return params.canLinkEmail ? 'link_email' : 'login'
}

export function isTelegramLinkEmailVerificationRequiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.trim().toLowerCase()
  return normalized.includes('verify your email with 4626 before linking telegram')
}

export function shouldResetTelegramMiniAppSessionForLinkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.trim().toLowerCase()
  return (
    normalized.includes('telegram mini app session expired') ||
    normalized.includes('invalid telegram mini app session') ||
    normalized.includes('telegram mini app session user mismatch') ||
    normalized.includes('telegram mini app session chat mismatch') ||
    normalized.includes('telegram mini app session token is required') ||
    normalized.includes('telegram mini app session is required')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms))
  })
}

export async function fetchTelegramLinkEmailVerificationState(params: {
  getAccessToken: () => Promise<string | null>
  fetchImpl?: typeof apiFetch
}): Promise<TelegramLinkEmailVerificationResult> {
  const fetchImpl = params.fetchImpl ?? apiFetch
  const accessToken = (
    await withTimeout(
      params.getAccessToken().catch(() => null),
      TELEGRAM_EMAIL_CHECK_TIMEOUT_MS,
      'Reading your 4626 session',
    ).catch(() => null)
  )?.trim() ?? ''

  if (!accessToken) {
    return {
      status: 'error',
      message: 'Could not read your 4626 session. Sign in again and retry linking.',
    }
  }

  const response = await fetchImpl('/api/accounts/me', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-privy-token': accessToken,
    },
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountsMeResponse> | null
  if (!response.ok || !payload?.success || !payload.data) {
    const message =
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'Could not confirm your 4626 email verification state.'
    return { status: 'error', message }
  }

  return payload.data.emailVerified === true
    ? { status: 'verified' }
    : { status: 'needs_verification' }
}

export async function pollTelegramLinkEmailVerification(params: {
  readState: () => Promise<TelegramLinkEmailVerificationResult>
  maxAttempts?: number
  intervalMs?: number
  sleepImpl?: (ms: number) => Promise<void>
}): Promise<TelegramLinkEmailVerificationResult> {
  const maxAttempts = Math.max(1, Math.floor(params.maxAttempts ?? TELEGRAM_EMAIL_POLL_ATTEMPTS))
  const intervalMs = Math.max(0, Math.floor(params.intervalMs ?? TELEGRAM_EMAIL_POLL_INTERVAL_MS))
  const sleepImpl = params.sleepImpl ?? sleep

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await params.readState()
    if (result.status === 'verified' || result.status === 'error') return result
    if (attempt < maxAttempts - 1) {
      await sleepImpl(intervalMs)
    }
  }

  return { status: 'needs_verification' }
}

export async function waitForTelegramLinkPrivyAuth(params: {
  readSnapshot: () => TelegramLinkPrivyAuthSnapshot | Promise<TelegramLinkPrivyAuthSnapshot>
  requireFreshAccessToken?: string | null
  timeoutMs?: number
  intervalMs?: number
  sleepImpl?: (ms: number) => Promise<void>
}): Promise<boolean> {
  const timeoutMs = Math.max(0, Math.floor(params.timeoutMs ?? PRIVY_ACCESS_TOKEN_TIMEOUT_MS))
  const intervalMs = Math.max(1, Math.floor(params.intervalMs ?? 150))
  const sleepImpl = params.sleepImpl ?? sleep
  const startedAt = Date.now()
  const requiredFreshAccessToken = typeof params.requireFreshAccessToken === 'string' ? params.requireFreshAccessToken.trim() : ''

  const isSettled = (snapshot: TelegramLinkPrivyAuthSnapshot): boolean => {
    const accessToken = typeof snapshot.accessToken === 'string' ? snapshot.accessToken.trim() : ''
    const hasFreshAccessToken = accessToken.length > 0 && (!requiredFreshAccessToken || accessToken !== requiredFreshAccessToken)
    return (
      snapshot.ready &&
      snapshot.authenticated &&
      hasFreshAccessToken &&
      (snapshot.hasVerifiedEmail || snapshot.serverEmailVerified)
    )
  }

  while (Date.now() - startedAt <= timeoutMs) {
    const snapshot = await params.readSnapshot()
    if (isSettled(snapshot)) return true
    await sleepImpl(intervalMs)
  }

  const snapshot = await params.readSnapshot()
  return isSettled(snapshot)
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
  if (statusCode === 504 || normalized.includes('timeout')) {
    return 'Telegram session verification timed out. Keep this flow open in Telegram and retry.'
  }
  if (statusCode === 503 || normalized.includes('unreachable') || normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Could not reach Telegram session verification. Keep this flow open in Telegram and retry.'
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

export function shouldShowResetTelegramLinkAccount(params: {
  sessionState: TelegramLinkSessionState
  hasLinkContext: boolean
  privyAuthenticated: boolean
  linkState: TelegramLinkFlowState
}): boolean {
  return (
    params.sessionState === 'ready' &&
    params.hasLinkContext &&
    params.privyAuthenticated &&
    params.linkState !== 'linking' &&
    params.linkState !== 'linked'
  )
}

export function shouldAutoStartTelegramLink(params: {
  hasLinkContext: boolean
  sessionState: TelegramLinkSessionState
  sessionToken: string
  privyReady: boolean
  privyAuthenticated: boolean
  emailState: TelegramLinkEmailState
  linkState: TelegramLinkFlowState
  alreadyAttemptedForToken: boolean
}): boolean {
  if (!params.hasLinkContext) return false
  if (params.sessionState !== 'ready') return false
  if (!params.sessionToken) return false
  if (!params.privyReady || !params.privyAuthenticated) return false
  if (params.emailState !== 'verified') return false
  if (params.linkState !== 'idle') return false
  if (params.alreadyAttemptedForToken) return false
  return true
}

export function shouldAutoRefreshTelegramLinkEmail(params: {
  hasLinkContext: boolean
  sessionState: TelegramLinkSessionState
  privyReady: boolean
  linkState: TelegramLinkFlowState
  emailState: TelegramLinkEmailState
}): boolean {
  if (!params.hasLinkContext) return false
  if (params.sessionState !== 'ready') return false
  if (!params.privyReady) return false
  if (params.linkState === 'linked') return false
  return params.emailState === 'unknown'
}

export function getTelegramLinkViewState(params: {
  sessionState: TelegramLinkSessionState
  emailState: TelegramLinkEmailState
  linkState: TelegramLinkFlowState
  sessionError: string | null
  emailMessage: string | null
  linkMessage: string | null
  privyAuthenticated: boolean
  hasLinkContext: boolean
}): TelegramLinkViewState {
  const { sessionState, emailState, linkState, sessionError, emailMessage, linkMessage, privyAuthenticated, hasLinkContext } = params
  const normalizedEmailMessage = normalizeTelegramLinkUiMessage(emailMessage)
  const normalizedLinkMessage = normalizeTelegramLinkUiMessage(linkMessage)
  const hasPrivyEmailLinkedIssue = isPrivyEmailAlreadyLinkedError(emailMessage) || isPrivyEmailAlreadyLinkedError(linkMessage)

  const statusVariant: TelegramLinkAlertVariant =
    hasPrivyEmailLinkedIssue ||
    sessionState === 'error' ||
    linkState === 'error' ||
    emailState === 'error' ||
    emailState === 'needs_verification' ||
    emailState === 'pending'
      ? 'warning'
      : linkState === 'linked'
        ? 'success'
        : 'info'

  const statusTitle =
    hasPrivyEmailLinkedIssue
      ? 'Telegram linking needs attention'
      : sessionState === 'verifying'
        ? 'Verifying Telegram session'
        : sessionState === 'error'
          ? 'Telegram linking needs attention'
          : linkState === 'error'
            ? 'Telegram linking needs attention'
            : emailState === 'checking'
              ? 'Checking 4626 email'
              : emailState === 'verifying'
                ? 'Verify your 4626 email'
                : emailState === 'pending'
                  ? 'Waiting for email verification'
                  : emailState === 'needs_verification'
                    ? privyAuthenticated
                      ? 'Verify your 4626 email'
                      : 'Sign in to 4626'
                    : emailState === 'error'
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
    normalizedEmailMessage ??
    normalizedLinkMessage ??
    (sessionState === 'verifying'
      ? 'Checking your Telegram Mini App session...'
      : emailState === 'checking'
        ? 'Telegram session is verified. Checking whether your 4626 email is ready for linking.'
        : emailState === 'verifying'
          ? 'Telegram session is verified. Complete the 4626 email OTP and we will resume the Telegram link automatically.'
          : emailState === 'pending'
            ? 'Telegram session is verified. Your 4626 email verification is still syncing. Keep this flow inside Telegram, then retry email verification if needed.'
            : emailState === 'verified'
              ? 'Telegram session is verified and your 4626 email is confirmed. Finishing the Telegram link now.'
              : privyAuthenticated
                ? 'Telegram session is verified. Your 4626 email verification is the remaining step before we can link Telegram.'
                : 'Sign in to 4626 and verify your email to finish linking.')

  const canSignIn =
    sessionState === 'ready' &&
    hasLinkContext &&
    linkState !== 'authenticating' &&
    linkState !== 'linking' &&
    linkState !== 'linked' &&
    emailState !== 'checking' &&
    emailState !== 'verifying' &&
    emailState !== 'verified' &&
    !hasPrivyEmailLinkedIssue

  const canRetryLink =
    sessionState === 'ready' &&
    hasLinkContext &&
    ((emailState === 'verified' && linkState === 'error') || hasPrivyEmailLinkedIssue)

  return {
    statusVariant,
    statusTitle,
    statusMessage,
    canSignIn,
    canRetryLink,
  }
}

type UseTelegramLinkFlowResult = {
  linkState: TelegramLinkFlowState
  emailState: TelegramLinkEmailState
  sessionState: TelegramLinkSessionState
  sessionError: string | null
  linkMessage: string | null
  emailMessage: string | null
  privyAuthenticated: boolean
  telegramLinkContext: ReturnType<typeof resolveTelegramMiniAppLinkContext>
  statusView: TelegramLinkViewState
  showRetrySessionButton: boolean
  showResetAccountButton: boolean
  working: boolean
  onRetrySession: () => void
  onRetryLink: () => void
  onResetAccount: () => Promise<void>
  onSignIn: () => Promise<void>
}

export function useTelegramLinkFlow(): UseTelegramLinkFlowResult {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const privy = usePrivy()
  const { login } = useLogin()

  const privyReady = Boolean(privy.ready)
  const privyAuthenticated = Boolean(privy.authenticated)
  const logout = useMemo(
    () =>
      typeof (privy as any)?.logout === 'function'
        ? ((privy as any).logout as () => Promise<void>)
        : null,
    [privy],
  )
  const getAccessToken = useMemo(
    () =>
      typeof privy.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy.getAccessToken],
  )
  const linkTelegram = useMemo(
    () =>
      typeof (privy as any)?.linkTelegram === 'function'
        ? ((privy as any).linkTelegram as (params: { launchParams: { initDataRaw: string } }) => Promise<unknown>)
        : null,
    [privy],
  )

  const telegramLinkContext = useMemo(() => resolveTelegramMiniAppLinkContext(searchParams), [searchParams])

  const [sessionState, setSessionState] = useState<TelegramLinkSessionState>('verifying')
  const [sessionToken, setSessionToken] = useState('')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [linkState, setLinkState] = useState<TelegramLinkFlowState>('idle')
  const [emailState, setEmailState] = useState<TelegramLinkEmailState>('unknown')
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const linkAttemptRef = useRef('')
  const emailCheckRunRef = useRef(0)
  const privyStatusRef = useRef({ ready: privyReady, authenticated: privyAuthenticated })

  useEffect(() => {
    privyStatusRef.current = { ready: privyReady, authenticated: privyAuthenticated }
  }, [privyAuthenticated, privyReady])

  const verifySession = useCallback(async () => {
    setSessionState('verifying')
    setSessionError(null)
    setSessionToken('')

    let session
    try {
      session = await ensureTelegramMiniAppSession()
    } catch {
      setSessionState('error')
      setSessionError('Could not reach Telegram session verification. Keep this flow open in Telegram and retry.')
      return null
    }
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

  const readEmailVerificationState = useCallback(
    async () =>
      fetchTelegramLinkEmailVerificationState({
        getAccessToken,
      }),
    [getAccessToken],
  )

  const refreshEmailVerificationState = useCallback(
    async (params?: { poll?: boolean }) => {
      const poll = params?.poll === true
      const runId = ++emailCheckRunRef.current

      if (!telegramLinkContext || sessionState !== 'ready') {
        if (runId === emailCheckRunRef.current) {
          setEmailState('unknown')
          setEmailMessage(null)
        }
        return { status: 'needs_verification' } satisfies TelegramLinkEmailVerificationResult
      }

      if (!privyReady) {
        return { status: 'needs_verification' } satisfies TelegramLinkEmailVerificationResult
      }

      if (!privyAuthenticated) {
        if (runId === emailCheckRunRef.current) {
          setEmailState('needs_verification')
          setEmailMessage(null)
        }
        return { status: 'needs_verification' } satisfies TelegramLinkEmailVerificationResult
      }

      if (runId === emailCheckRunRef.current) {
        setEmailState(poll ? 'verifying' : 'checking')
        setEmailMessage(null)
      }

      const result = poll
        ? await pollTelegramLinkEmailVerification({
            readState: readEmailVerificationState,
          })
        : await readEmailVerificationState()

      if (runId !== emailCheckRunRef.current) return result

      if (result.status === 'verified') {
        setEmailState('verified')
        setEmailMessage(null)
        return result
      }

      if (result.status === 'needs_verification') {
        setEmailState(poll ? 'pending' : 'needs_verification')
        setEmailMessage(
          poll
            ? 'Your 4626 email verification is still pending. Keep this flow open in Telegram, then retry email verification if needed.'
            : null,
        )
        return result
      }

      setEmailState('error')
      setEmailMessage(result.message)
      return result
    },
    [privyAuthenticated, privyReady, readEmailVerificationState, sessionState, telegramLinkContext],
  )

  useEffect(() => {
    const shouldAutoRefresh = shouldAutoRefreshTelegramLinkEmail({
      hasLinkContext: Boolean(telegramLinkContext),
      sessionState,
      privyReady,
      linkState,
      emailState,
    })
    if (!shouldAutoRefresh) return
    void refreshEmailVerificationState()
  }, [emailState, linkState, privyReady, refreshEmailVerificationState, sessionState, telegramLinkContext])

  useEffect(() => {
    if (!telegramLinkContext || sessionState !== 'ready' || !privyReady || !privyAuthenticated) return
    if (linkState === 'linked' || emailState !== 'pending') return
    const retryId = window.setTimeout(() => {
      void refreshEmailVerificationState()
    }, TELEGRAM_EMAIL_PENDING_RETRY_MS)
    return () => window.clearTimeout(retryId)
  }, [emailState, linkState, privyAuthenticated, privyReady, refreshEmailVerificationState, sessionState, telegramLinkContext])

  useEffect(() => {
    const shouldAutoStart = shouldAutoStartTelegramLink({
      hasLinkContext: Boolean(telegramLinkContext),
      sessionState,
      sessionToken,
      privyReady,
      privyAuthenticated,
      emailState,
      linkState,
      alreadyAttemptedForToken: Boolean(telegramLinkContext && linkAttemptRef.current === telegramLinkContext.linkToken),
    })
    if (!telegramLinkContext || !shouldAutoStart) return

    linkAttemptRef.current = telegramLinkContext.linkToken
    void (async () => {
      setLinkState('linking')
      setLinkMessage('Linking your Telegram identity to your 4626 account...')

      const privyTelegramLinkResult = await linkPrivyTelegramInMiniApp({
        linkTelegram,
        launchParams: readPrivyTelegramLaunchParams(),
      })
      if (privyTelegramLinkResult === 'failed') {
        console.warn('[telegram/link] Privy linkTelegram failed; continuing with backend link flow')
      }

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
        if (isTelegramLinkEmailVerificationRequiredError(message)) {
          setLinkState('idle')
          setLinkMessage(null)
          setEmailState('needs_verification')
          setEmailMessage('Verify your email with 4626 before linking Telegram.')
          return
        }
        if (shouldResetTelegramMiniAppSessionForLinkError(message)) {
          clearTelegramMiniAppSession()
          linkAttemptRef.current = ''
          setSessionToken('')
          setSessionState('error')
          setSessionError(formatTelegramSessionError(message, res.status || 500))
          setLinkState('idle')
          setLinkMessage(null)
          return
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
    emailState,
    getAccessToken,
    linkState,
    linkTelegram,
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
    if (privyAuthenticated) {
      void refreshEmailVerificationState()
    }
  }, [privyAuthenticated, refreshEmailVerificationState])

  const onResetAccount = useCallback(async () => {
    linkAttemptRef.current = ''
    setLinkState('idle')
    setLinkMessage(null)
    setEmailState('unknown')
    setEmailMessage(null)
    await runWaitlistPrivyLogout({ logout })
  }, [logout])

  const onSignIn = useCallback(async () => {
    const startedAuthenticated = privyAuthenticated

    setLinkState('authenticating')
    setLinkMessage(null)
    setEmailState(startedAuthenticated ? 'verifying' : 'checking')
    setEmailMessage('Verify your email to continue.')

    try {
      if (startedAuthenticated) {
        const initialVerification = await refreshEmailVerificationState({ poll: true })
        if (initialVerification.status === 'verified') {
          setLinkState('idle')
          setLinkMessage(null)
          linkAttemptRef.current = ''
          return
        }

        const currentEmailState = getPrivyEmailState((privy as any)?.user)
        const linkEmail = (privy as any)?.linkEmail ?? (privy as any)?.linkEmailAccount
        const authAction = resolveTelegramLinkEmailAuthAction({
          hasAnyEmailAccount: currentEmailState.hasAnyEmailAccount,
          hasVerifiedEmail: currentEmailState.hasVerifiedEmail,
          canLinkEmail: typeof linkEmail === 'function',
        })

        if (authAction === 'link_email' && typeof linkEmail === 'function') {
          try {
            await linkEmail()
          } catch (error) {
            if (isPrivyEmailAlreadyLinkedError(error)) {
              await login(buildWaitlistEmailLoginOptions() as any)
            } else {
              throw error
            }
          }
        } else {
          await login(buildWaitlistEmailLoginOptions() as any)
        }
      } else {
        await login(buildWaitlistEmailLoginOptions() as any)
      }

      if (!startedAuthenticated) {
        const authSettled = await waitForTelegramLinkPrivyAuth({
          requireFreshAccessToken: null,
          readSnapshot: async () => {
            const accessToken = ((await getAccessToken().catch(() => null))?.trim() ?? '') || null
            const nextEmailState = getPrivyEmailState((privy as any)?.user)
            let serverEmailVerified = false
            if (accessToken) {
              const serverState = await fetchTelegramLinkEmailVerificationState({
                getAccessToken: async () => accessToken,
              }).catch<TelegramLinkEmailVerificationResult>(() => ({
                status: 'needs_verification',
              }))
              serverEmailVerified = serverState.status === 'verified'
            }
            return {
              ready: privyStatusRef.current.ready,
              authenticated: privyStatusRef.current.authenticated,
              accessToken,
              hasVerifiedEmail: nextEmailState.hasVerifiedEmail,
              serverEmailVerified,
            }
          },
        })
        if (!authSettled) {
          linkAttemptRef.current = ''
          setLinkState('idle')
          setLinkMessage(null)
          const verification = await refreshEmailVerificationState({ poll: true })
          if (verification.status === 'verified') {
            linkAttemptRef.current = ''
          }
          return
        }
      }

      const verification = await refreshEmailVerificationState({ poll: true })
      setLinkState('idle')
      setLinkMessage(null)
      if (verification.status === 'verified') {
        linkAttemptRef.current = ''
      }
    } catch (error: unknown) {
      if (isPrivyEmailAlreadyLinkedError(error)) {
        setLinkState('idle')
        setLinkMessage(null)
        const verification = await refreshEmailVerificationState({ poll: true })
        if (verification.status === 'verified') {
          linkAttemptRef.current = ''
        }
        return
      }
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Failed to start 4626 sign-in.'
      setLinkState('error')
      setLinkMessage(message)
    }
  }, [getAccessToken, login, privy, privyAuthenticated, refreshEmailVerificationState])

  const statusView = getTelegramLinkViewState({
    sessionState,
    emailState,
    linkState,
    sessionError,
    emailMessage,
    linkMessage,
    privyAuthenticated,
    hasLinkContext: Boolean(telegramLinkContext),
  })

  return {
    linkState,
    emailState,
    sessionState,
    sessionError,
    linkMessage,
    emailMessage,
    privyAuthenticated,
    telegramLinkContext,
    statusView,
    showRetrySessionButton: shouldShowRetryTelegramSession({
      sessionState,
      telegramMiniAppContext: isTelegramMiniAppContext(),
    }),
    showResetAccountButton: shouldShowResetTelegramLinkAccount({
      sessionState,
      hasLinkContext: Boolean(telegramLinkContext),
      privyAuthenticated,
      linkState,
    }),
    working:
      sessionState === 'verifying' ||
      linkState === 'authenticating' ||
      linkState === 'linking' ||
      emailState === 'checking' ||
      emailState === 'verifying',
    onRetrySession,
    onRetryLink,
    onResetAccount,
    onSignIn,
  }
}
