import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { Button } from '@/components/ui/Button'
import { AppLoadingBootstrapGate } from '@/components/layout/AppLoadingOverlay'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { createStaleSessionProbe, withSessionRepairTimeout } from '@/lib/auth/sessionRepair'
import {
  getMarketingWaitlistEntryUrl,
  isOnCanonicalMarketingWaitlistPage,
  isWaitlistStartAuthSearchParam,
  readStoredWaitlistReferralCode,
  storeWaitlistReferralCode,
  WAITLIST_START_AUTH_QUERY_KEY,
} from '@/lib/auth/waitlistEntry'
import { getAppBaseUrl } from '@/lib/env/host'
import { usePrivyClientStatus } from '@/lib/privy/client'
import {
  captureWaitlistVerifiedEmailHint,
  clearStoredWaitlistVerifiedEmailHint,
  resolveWaitlistVerifiedEmailHint,
  resolveWaitlistPrivyDisplayEmail,
} from './waitlistVerifiedEmailHint'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import type { ApiEnvelope } from '@/lib/wallet/onboardingBootstrapTypes'

import {
  type WaitlistStep,
  resolveWaitlistStep,
} from './waitlistFlowState'
import {
  clearStoredWaitlistSessionToken,
  isAlreadyLoggedInAuthError,
  isRecoveryRequiredAuthError,
  runWaitlistPrivyLogout,
} from './waitlistAuthState'
import { buildWaitlistEmailLoginOptions, buildWaitlistRecoveryLoginOptions } from './waitlistLoginOptions'
import { type WaitlistEmailUi, canEnterAppFromAccountState, deriveWaitlistAuthUi } from './waitlistFlowUi'
import { bridgePrivySession, createAuthHandoffCode } from './waitlistHandoff'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { type WaitlistAccountsSummary } from './waitlistAccountTypes'
import {
  FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS,
  FINALIZING_BACKGROUND_RETRY_MS,
  FLOW_TIMEOUT_MS,
  PRIVY_LOGOUT_SETTLE_ATTEMPTS,
  PRIVY_LOGOUT_SETTLE_DELAY_MS,
  RECOVERY_REQUIRED_MESSAGE,
  RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE,
  SESSION_FINALIZING_RETRY_MESSAGE,
  SESSION_MISMATCH_MESSAGE,
  STALE_PRIVY_SESSION_MESSAGE,
  WAITLIST_STALE_SESSION_RESET_MESSAGE,
  getWalletProviderCollisionMessage,
  getWaitlistNetworkUnstableMessage,
  isSessionFinalizingError,
  isStalePrivyTokenError,
  isTimeoutErrorMessage,
  isTransientWaitlistNetworkError,
  isWalletProviderCollisionError,
  withTimeout,
} from './waitlistBootstrapUtils'
import { useWaitlistBootstrap } from './useWaitlistBootstrap'
import { ReferrerGreetingBanner } from './ReferrerGreetingBanner'
import {
  clearWaitlistRecoveryGate,
  writeWaitlistRecoveryGate,
} from './waitlistRecoveryGate'
import {
  clearWaitlistAuthPending,
  writeWaitlistAuthPending,
} from './waitlistAuthPending'
type AccountsSummary = WaitlistAccountsSummary

const LazyWaitlistSetupWorkspace = lazy(async () => {
  const mod = await import('./WaitlistSetupWorkspace')
  return { default: mod.WaitlistSetupWorkspace }
})

type WaitlistStatsData = {
  signedUpCount: number
  capacity: number
  spotsRemaining: number
}

const HANDOFF_QUERY_KEY = 'cv_handoff'
const WAITLIST_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]
const WAITLIST_SPINNER_TIMEOUT_MESSAGE = 'Sign-in is taking longer than expected. Tap Continue to retry.'
const WAITLIST_BUSY_WATCHDOG_MS = 25_000
const PRIVY_OAUTH_QUERY_KEYS = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'] as const

async function runPrivyLoginWithTimeout(
  login: (options?: unknown) => Promise<unknown>,
  options: unknown,
): Promise<void> {
  await withTimeout(Promise.resolve().then(() => login(options)), FLOW_TIMEOUT_MS, 'Sign-in')
}

function isSessionEmailMismatchError(message: unknown): boolean {
  const text = typeof message === 'string' ? message.toLowerCase() : ''
  return text.includes('email does not match authenticated user') || text.includes('session email mismatch')
}

export function isPrivyLoginBootstrapError(error: unknown): boolean {
  return isTransientWaitlistNetworkError(error)
}

function getSignInNetworkUnstableMessage(): string {
  return getWaitlistNetworkUnstableMessage()
}

function isTelegramMiniAppRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const maybeTelegram = (window as any)?.Telegram?.WebApp
  if (maybeTelegram) return true
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('telegram')
}

function useWaitlistAttemptState() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryRequired, setRecoveryRequired] = useState(false)
  const attemptInFlightRef = useRef(false)

  const clearFeedback = useCallback(() => {
    setError(null)
  }, [])

  const beginAttempt = useCallback((): boolean => {
    if (busy || attemptInFlightRef.current) return false
    attemptInFlightRef.current = true
    setBusy(true)
    clearFeedback()
    setRecoveryRequired(false)
    writeWaitlistAuthPending(true)
    return true
  }, [busy, clearFeedback])

  const endAttempt = useCallback(() => {
    attemptInFlightRef.current = false
    setBusy(false)
  }, [])

  return {
    busy,
    setBusy,
    error,
    setError,
    recoveryRequired,
    setRecoveryRequired,
    attemptInFlightRef,
    clearFeedback,
    beginAttempt,
    endAttempt,
  }
}

function WaitlistAuthStep(props: {
  authUi: WaitlistEmailUi
  waitlistStats: WaitlistStatsData | null
  busy: boolean
  privyAuthed: boolean
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  privyEmail: string | null
  error: string | null
  recoveryRequired: boolean
  referralCode: string | null
  onContinueAuth: () => void | Promise<void>
  onRecoverAccount: () => void | Promise<void>
  onTryDifferentEmail: () => void | Promise<void>
  onSignOut?: () => void | Promise<void>
  signOutBusy?: boolean
  disableMotion?: boolean
}) {
  const {
    authUi,
    waitlistStats,
    busy,
    privyAuthed,
    privyClientStatus,
    privyEmail,
    error,
    recoveryRequired,
    referralCode,
    onContinueAuth,
    onRecoverAccount,
    onTryDifferentEmail,
    onSignOut,
    signOutBusy = false,
    disableMotion = false,
  } = props

  const privyReady = privyClientStatus === 'ready'
  const buttonsDisabled = busy || !privyReady
  const motionEnabled = !disableMotion
  const signedUpCount = Math.max(0, Number(waitlistStats?.signedUpCount ?? 0))
  const capacity = Math.max(0, Number(waitlistStats?.capacity ?? 0))
  const spotsRemaining = Math.max(0, Number(waitlistStats?.spotsRemaining ?? 0))
  // Only treat stats as real when the endpoint actually returned a non-zero
  // capacity. When `/api/waitlist/stats` fails (500 / network error), we must
  // NOT render `0 / 0` or the "Current round full" banner — that would lie
  // to the user. Hide both lines until we have real data.
  const hasWaitlistStats = waitlistStats != null && capacity > 0
  const waitlistProgressLine = hasWaitlistStats
    ? spotsRemaining <= 0
      ? `${signedUpCount.toLocaleString()} of ${capacity.toLocaleString()} joined · current round full`
      : `${signedUpCount.toLocaleString()} of ${capacity.toLocaleString()} joined · ${spotsRemaining.toLocaleString()} spots left`
    : null

  const stagger = (i: number) => (
    motionEnabled
      ? {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.22, delay: 0.1 + i * 0.06, ease: WAITLIST_EASE },
        }
      : {
          initial: false,
          animate: false,
          transition: { duration: 0 },
        }
  )

  // Single source of truth for what this step shows. Exactly one status message
  // renders at a time — never the old "Creating account… / Finishing sign-in… /
  // this usually takes a few seconds" triple-stack.
  const finalizingStall = !busy && error === SESSION_FINALIZING_RETRY_MESSAGE
  const working = privyAuthed && !recoveryRequired && (busy || finalizingStall)
  const visibleError =
    error && error !== SESSION_FINALIZING_RETRY_MESSAGE && (!recoveryRequired || privyAuthed)
      ? error
      : null
  return (
    <motion.div
      key="step-auth"
      initial={motionEnabled ? { opacity: 0 } : false}
      animate={motionEnabled ? { opacity: 1 } : false}
      exit={motionEnabled ? { opacity: 0, y: -6 } : undefined}
      transition={motionEnabled ? { duration: 0.22, ease: WAITLIST_EASE } : { duration: 0 }}
      className="relative flex min-h-[calc(100dvh-2rem)] flex-col justify-center py-4 sm:py-6"
    >
      <div className="relative z-10 mx-auto w-full max-w-md text-center">
        <motion.div {...stagger(0)} className="relative px-2 sm:px-0">
          {/* Header */}
          <h2 className="text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.25rem]">
            {authUi.title}
          </h2>

          {hasWaitlistStats ? (
            <div className="mx-auto mt-4 w-full max-w-[20rem] space-y-2">
              <p className="text-xs tabular-nums text-zinc-500">{waitlistProgressLine}</p>
            </div>
          ) : null}

          {/* Referral greeting — only renders when a code is present and resolves. */}
          {referralCode ? (
            <div className="mt-4 text-left">
              <ReferrerGreetingBanner referralCode={referralCode} />
            </div>
          ) : null}

          {working ? (
            /* One quiet working state: loader, one line of status, the email it
               applies to, and an escape hatch. Nothing else competes for attention. */
            <motion.div {...stagger(1)} className="mt-10 flex flex-col items-center gap-5">
              <PixelWaveLoader name="wave-lr" size={20} color="rgb(var(--brand-primary))" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-white" role="status" aria-live="polite">
                  {finalizingStall ? 'Almost there — finishing sign-in' : 'Setting up your account'}
                </p>
                {privyEmail ? <p className="text-xs text-zinc-500">{privyEmail}</p> : null}
              </div>
              {finalizingStall ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void onContinueAuth()}
                  className="w-full"
                >
                  Retry now
                </Button>
              ) : null}
              {onSignOut ? (
                <button
                  type="button"
                  disabled={signOutBusy}
                  onClick={() => void onSignOut()}
                  className="text-xs text-red-400/80 transition hover:text-red-300 disabled:opacity-60"
                >
                  Sign out
                </button>
              ) : null}
            </motion.div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {privyAuthed && !recoveryRequired && privyEmail ? (
                  <>
                    Signed in as <span className="font-medium text-zinc-200">{privyEmail}</span>
                  </>
                ) : (
                  authUi.subtitle
                )}
              </p>

              {privyAuthed && recoveryRequired ? (
                <div className="mt-4 rounded-xl bg-amber-500/[0.07] px-4 py-3 text-left text-sm leading-6 text-amber-100/90">
                  {privyEmail ? (
                    <>
                      Signed in as <span className="font-medium text-white">{privyEmail}</span>, but
                      that session is not linked to your existing 4626 account yet.
                    </>
                  ) : (
                    <>
                      Your wallet session is connected, but it is not linked to your existing 4626
                      account yet. Use existing account and sign in with email OTP.
                    </>
                  )}
                </div>
              ) : null}

              {/* CTA */}
              <motion.div {...stagger(1)} className="mt-6 space-y-3">
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  aria-disabled={buttonsDisabled}
                  onClick={() => {
                    if (buttonsDisabled) return
                    void (recoveryRequired ? onRecoverAccount() : onContinueAuth())
                  }}
                  className="w-full"
                >
                  {busy || !privyReady ? (
                    <span className="inline-flex items-center gap-2 text-[13.5px] font-medium text-white/90">
                      <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.92)" />
                      <span>{busy ? authUi.busyLabel : 'Loading sign-in…'}</span>
                    </span>
                  ) : privyAuthed && !recoveryRequired ? (
                    'Continue'
                  ) : (
                    authUi.ctaLabel
                  )}
                </Button>
                {recoveryRequired ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onTryDifferentEmail()}
                    className="w-full text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-60"
                  >
                    Try a different email instead
                  </button>
                ) : null}
                {privyAuthed && !recoveryRequired && onSignOut ? (
                  <button
                    type="button"
                    disabled={busy || signOutBusy}
                    onClick={() => void onSignOut()}
                    className="w-full text-xs text-red-400/80 transition hover:text-red-300 disabled:opacity-60"
                  >
                    Sign out
                  </button>
                ) : null}
              </motion.div>

              {/* error */}
              {visibleError ? (
                <motion.div
                  {...stagger(2)}
                  role="alert"
                  aria-live="polite"
                  className="mt-4 rounded-xl bg-blue-500/[0.07] px-4 py-3 text-left text-sm leading-6 text-blue-200"
                >
                  {visibleError}
                </motion.div>
              ) : null}
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

export function WaitlistFlow(props: {
  sectionId?: string
}) {
  const sectionId = props.sectionId ?? 'waitlist'
  const prefersReducedMotion = useReducedMotion()
  const baseInAppContext = useMemo(() => isBaseAppInAppContext(), [])
  const disableHeroMotion = Boolean(prefersReducedMotion || baseInAppContext)

  const privy = usePrivy()
  const privyClientStatus = usePrivyClientStatus()
  const { login } = useLogin()

  const privyAuthed = privy.authenticated
  const shouldDestroyPrivySession = privyAuthed && privyClientStatus === 'ready'
  const { getAccessToken } = privy
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()

  const [searchParams, setSearchParams] = useSearchParams()
  const [step, setStep] = useState<WaitlistStep>('auth')

  const {
    busy,
    setBusy,
    error,
    setError,
    recoveryRequired,
    setRecoveryRequired,
    attemptInFlightRef: authAttemptInFlightRef,
    beginAttempt: beginAuthAttempt,
    endAttempt: endAuthAttempt,
  } = useWaitlistAttemptState()

  // NOTE: Guarded setter pattern (setErrorGuarded etc.) is already established in
  // useAccountSetupController and useAddUserOpOwnerInstall. The attempt state here
  // already uses ref-based in-flight guards; additional guarded wrappers can be
  // added when specific long-OTP or bootstrap churn is observed.
  const [completionBusy, setCompletionBusy] = useState(false)
  const [account, setAccount] = useState<AccountsSummary | null>(null)
  const [waitlistStats, setWaitlistStats] = useState<WaitlistStatsData | null>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [sessionRepairBusy, setSessionRepairBusy] = useState(false)

  useEffect(() => {
    if (!account?.emailVerified) return
    setStep(resolveWaitlistStep({ account }))
  }, [account])

  const authBootstrapAutoAttemptedRef = useRef(false)
  const privyAuthedBootstrapAttemptedRef = useRef(false)
  const recoveryHandoffInFlightRef = useRef(false)
  const pendingAuthResumeStartedRef = useRef(false)
  const loginStartedWhileLoggedOutRef = useRef(false)
  const loginAwaitInProgressRef = useRef(false)
  const startAuthAutoAttemptedRef = useRef(false)
  const finalizingAutoRetryCountRef = useRef(0)
  const finalizingBackgroundRetryCountRef = useRef(0)
  // Shared bounded double-probe: a single null token read is never "stale".
  // True-stale requires >= 2 probe misses (see @/lib/auth/sessionRepair).
  const staleSessionProbeRef = useRef<ReturnType<typeof createStaleSessionProbe> | null>(null)
  if (!staleSessionProbeRef.current) {
    staleSessionProbeRef.current = createStaleSessionProbe({
      getToken: () => getAccessToken(),
      hasLiveCookie: () => false,
      withTimeout: withSessionRepairTimeout,
    })
  }
  const privyLogoutRef = useRef<null | (() => Promise<void>)>(null)
  const privyAuthedRef = useRef(privyAuthed)
  const privyClientStatusRef = useRef(privyClientStatus)

  const wrapClass =
    step === 'done'
      ? 'mx-auto w-full max-w-none px-0 py-5 sm:py-8'
      : 'mx-auto w-full max-w-5xl px-4 py-6 sm:py-8'
  const activeReferralCode = useMemo(() => readStoredWaitlistReferralCode(), [])
  const enterAppUrl = useMemo(() => buildAppEntryUrl(getAppBaseUrl()), [])
  const waitlistRecoveryUrl = useMemo(() => getMarketingWaitlistEntryUrl(), [])
  const disableAggressiveSessionReset = useMemo(() => isTelegramMiniAppRuntime(), [])
  const redirectToCanonicalWaitlist = useCallback(() => {
    if (typeof window === 'undefined') return false
    const localHost = window.location.hostname.toLowerCase()
    if (localHost === 'localhost' || localHost === '127.0.0.1' || localHost === '::1' || localHost === '[::1]') {
      return false
    }
    let target = getMarketingWaitlistEntryUrl()
    try {
      const currentUrl = new URL(window.location.href)
      const targetUrl = new URL(target)
      for (const key of PRIVY_OAUTH_QUERY_KEYS) {
        const value = currentUrl.searchParams.get(key)
        if (value) targetUrl.searchParams.set(key, value)
      }
      target = targetUrl.toString()
    } catch {
      // Keep the canonical target as-is if URL parsing fails.
    }
    const current = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
    if (target === current) return false
    window.location.assign(target)
    return true
  }, [])

  useEffect(() => {
    privyLogoutRef.current = async () => {
      if (!shouldDestroyPrivySession) return
      await privy.logout().catch(() => null)
    }
  }, [privy, shouldDestroyPrivySession])

  const prevPrivyAuthedRef = useRef(privyAuthed)

  useEffect(() => {
    // Drop stale sessionStorage recovery flags from prior broken attempts so Continue
    // opens normal Privy email login instead of the legacy handoff loop.
    clearWaitlistRecoveryGate()
  }, [])

  useEffect(() => {
    privyAuthedRef.current = privyAuthed
    if (!privyAuthed) {
      privyAuthedBootstrapAttemptedRef.current = false
    }
  }, [privyAuthed])

  useEffect(() => {
    privyClientStatusRef.current = privyClientStatus
  }, [privyClientStatus])

  useEffect(() => {
    if (!activeReferralCode) return
    storeWaitlistReferralCode(activeReferralCode)
  }, [activeReferralCode])

  const resetResolvedAccountState = useCallback(() => {
    setAccount(null)
  }, [])

  const fetchWaitlistStats = useCallback(async () => {
    try {
      const response = await apiFetch('/api/waitlist/stats', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistStatsData> | null
      if (!response.ok || !payload?.success || !payload.data) return
      setWaitlistStats(payload.data)
    } catch {
      // Keep the last known value if stats refresh fails.
    }
  }, [])

  const {
    requestBootstrap,
    settleBootstrapAfterRecoverableLoginError,
    resetBootstrapCooldowns,
    tokenlessFinalizingBootstrapCooldownUntilRef,
    recoveryRequiredBootstrapCooldownUntilRef,
  } = useWaitlistBootstrap({
    activeReferralCode,
    ensureEmbeddedWallet,
    getAccessToken,
    getVerifiedEmailHint: () => resolveWaitlistVerifiedEmailHint(privy.user),
    privyAuthed,
    setAccount,
    setStep,
    setError,
    setRecoveryRequired,
    finalizingAutoRetryCountRef,
    finalizingBackgroundRetryCountRef,
  })

  useEffect(() => {
    if (!privyAuthed) return
    captureWaitlistVerifiedEmailHint(privy.user)
  }, [privy.user, privyAuthed])

  useEffect(() => {
    if (!prevPrivyAuthedRef.current && privyAuthed) {
      authBootstrapAutoAttemptedRef.current = false
      // User-initiated Continue owns bootstrap until the attempt finishes; do not
      // reset this flag mid-flight or auto-bootstrap duplicates the same request.
      if (!authAttemptInFlightRef.current) {
        privyAuthedBootstrapAttemptedRef.current = false
      }
      clearWaitlistRecoveryGate()
      setRecoveryRequired(false)
      recoveryRequiredBootstrapCooldownUntilRef.current = 0
    }
    prevPrivyAuthedRef.current = privyAuthed
  }, [privyAuthed, authAttemptInFlightRef, recoveryRequiredBootstrapCooldownUntilRef, setRecoveryRequired])

  const beginRecoveryHandoffAttempt = useCallback((): boolean => {
    if (busy || authAttemptInFlightRef.current || recoveryHandoffInFlightRef.current) return false
    recoveryHandoffInFlightRef.current = true
    authAttemptInFlightRef.current = true
    privyAuthedBootstrapAttemptedRef.current = true
    authBootstrapAutoAttemptedRef.current = true
    recoveryRequiredBootstrapCooldownUntilRef.current = 0
    setBusy(true)
    setError(null)
    writeWaitlistAuthPending(true)
    return true
  }, [authAttemptInFlightRef, busy, recoveryRequiredBootstrapCooldownUntilRef, setBusy, setError])

  const endRecoveryHandoffAttempt = useCallback(() => {
    recoveryHandoffInFlightRef.current = false
    authAttemptInFlightRef.current = false
    setBusy(false)
  }, [authAttemptInFlightRef, setBusy])

  const finalizeRecoveryHandoffError = useCallback(
    (recoverError: unknown) => {
      if (isPrivyLoginBootstrapError(recoverError) && redirectToCanonicalWaitlist()) {
        setError('Redirecting back to the waitlist sign-in flow...')
        return
      }
      if (isRecoveryRequiredAuthError(recoverError)) {
        writeWaitlistRecoveryGate(true)
        setRecoveryRequired(true)
        setError(
          privyAuthedRef.current
            ? RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE
            : RECOVERY_REQUIRED_MESSAGE,
        )
        return
      }
      setError(
        typeof (recoverError as { message?: unknown })?.message === 'string'
          ? String((recoverError as { message: string }).message)
          : 'Failed to start account recovery sign-in.',
      )
      setRecoveryRequired(true)
    },
    [redirectToCanonicalWaitlist, setError, setRecoveryRequired],
  )

  const tryResumeExistingPrivySession = useCallback(async (): Promise<boolean> => {
    const existingToken = await getAccessToken().catch(() => null)
    if (!existingToken) return false
    await settleBootstrapAfterRecoverableLoginError({
      bypassRecoveryCooldown: true,
    })
    return true
  }, [getAccessToken, settleBootstrapAfterRecoverableLoginError])

  const waitForPrivyLogoutSettlement = useCallback(async (opts?: { tokenOnly?: boolean }): Promise<void> => {
    for (let attempt = 0; attempt < PRIVY_LOGOUT_SETTLE_ATTEMPTS; attempt += 1) {
      const token = await getAccessToken().catch(() => null)
      const tokenMissing = !token
      const authCleared = privyAuthedRef.current === false
      const clientNotReady = privyClientStatusRef.current !== 'ready'
      if (tokenMissing && (opts?.tokenOnly === true || authCleared || clientNotReady)) return
      await new Promise<void>((resolve) => setTimeout(resolve, PRIVY_LOGOUT_SETTLE_DELAY_MS))
    }
    throw new Error(STALE_PRIVY_SESSION_MESSAGE)
  }, [getAccessToken])

  const resetStalePrivySessionAndRetryEmailLogin = useCallback(async (): Promise<void> => {
    await runWaitlistPrivyLogout({
      logout: async () => {
        await privy.logout().catch(() => null)
      },
      // Force a real logout call here even when token introspection is stale/null.
      // This path exists specifically to clear zombie Privy state.
      shouldLogout: true,
    })
    await waitForPrivyLogoutSettlement()
    try {
      await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, buildWaitlistEmailLoginOptions() as any)
      const next = await requestBootstrap({
        forceNew: true,
        waitForTokenHydration: true,
        bypassRecoveryCooldown: true,
      })
      if (!next) {
        throw new Error(STALE_PRIVY_SESSION_MESSAGE)
      }
    } catch (error: unknown) {
      if (isSessionFinalizingError(error)) {
        throw new Error(STALE_PRIVY_SESSION_MESSAGE)
      }
      throw error
    }
  }, [login, privy, requestBootstrap, waitForPrivyLogoutSettlement])

  const runRecoveryPrivyLogin = useCallback(async (): Promise<void> => {
    const recoveryOptions = buildWaitlistRecoveryLoginOptions()
    try {
      await runPrivyLoginWithTimeout(
        login as (options?: unknown) => Promise<unknown>,
        recoveryOptions as any,
      )
    } catch (loginError: unknown) {
      if (isWalletProviderCollisionError(loginError)) {
        throw new Error(getWalletProviderCollisionMessage())
      }
      if (!isAlreadyLoggedInAuthError(loginError)) throw loginError

      await runWaitlistPrivyLogout({
        logout: async () => {
          await privy.logout().catch(() => null)
        },
        // Force logout on already-logged-in recovery handoff.
        shouldLogout: true,
      })
      await waitForPrivyLogoutSettlement()
      await runPrivyLoginWithTimeout(
        login as (options?: unknown) => Promise<unknown>,
        recoveryOptions as any,
      )
    }
  }, [login, privy, waitForPrivyLogoutSettlement])

  const handoffIntoExistingAccount = useCallback(async (): Promise<void> => {
    clearWaitlistRecoveryGate()
    recoveryRequiredBootstrapCooldownUntilRef.current = 0

    // Drop the colliding Privy session so recovery login can bind the canonical account.
    await runWaitlistPrivyLogout({
      logout: async () => {
        await privy.logout().catch(() => null)
      },
      // Force logout before recovery login to avoid stale-session reuse.
      shouldLogout: true,
    })
    await waitForPrivyLogoutSettlement({ tokenOnly: true })

    await runRecoveryPrivyLogin()

    const privyToken = await getAccessToken().catch(() => null)
    if (!privyToken) {
      throw new Error(STALE_PRIVY_SESSION_MESSAGE)
    }

    if (isOnCanonicalMarketingWaitlistPage()) {
      authBootstrapAutoAttemptedRef.current = true
      setRecoveryRequired(false)
      clearWaitlistRecoveryGate()
      setError(null)
      await settleBootstrapAfterRecoverableLoginError({ bypassRecoveryCooldown: true })
      // Bootstrap already authenticates via X-Privy-Token; bridge is best-effort for cookies.
      await bridgePrivySession(privyToken).catch(() => undefined)
      return
    }

    await bridgePrivySession(privyToken)

    let target = waitlistRecoveryUrl
    if (target.startsWith('http') && typeof window !== 'undefined') {
      try {
        const parsed = new URL(target)
        if (parsed.origin !== window.location.origin) {
          const handoffCode = await createAuthHandoffCode({ privyToken })
          if (handoffCode) {
            parsed.searchParams.set(HANDOFF_QUERY_KEY, handoffCode)
            target = parsed.toString()
          }
        }
      } catch {
        // Keep original target if URL parsing fails.
      }
      window.location.href = target
      return
    }

    window.location.assign(target)
  }, [
    getAccessToken,
    privy,
    recoveryRequiredBootstrapCooldownUntilRef,
    runRecoveryPrivyLogin,
    settleBootstrapAfterRecoverableLoginError,
    setError,
    setRecoveryRequired,
    waitlistRecoveryUrl,
    waitForPrivyLogoutSettlement,
  ])

  const onContinueAuth = useCallback(async () => {
    if (recoveryRequired) {
      if (!beginRecoveryHandoffAttempt()) return
      try {
        await handoffIntoExistingAccount()
      } catch (authError: unknown) {
        finalizeRecoveryHandoffError(authError)
      } finally {
        endRecoveryHandoffAttempt()
      }
      return
    }
    if (!beginAuthAttempt()) return
    privyAuthedBootstrapAttemptedRef.current = true
    authBootstrapAutoAttemptedRef.current = true
    tokenlessFinalizingBootstrapCooldownUntilRef.current = 0
    recoveryRequiredBootstrapCooldownUntilRef.current = 0
    try {
      if (!privyAuthed && privyClientStatus === 'disabled' && redirectToCanonicalWaitlist()) {
        return
      }
      if (!privyAuthed && privyClientStatus === 'loading') {
        setError('Sign-in service is still loading. Please wait a moment and try again.')
        return
      }
      if (privyAuthed) {
        await settleBootstrapAfterRecoverableLoginError({
          bypassRecoveryCooldown: true,
        })
      } else {
        // Pre-login cleanup should stay local to avoid force-logging out server cookies
        // around every Privy popup open.
        clearStoredWaitlistSessionToken()
        if (await tryResumeExistingPrivySession()) {
          return
        }
        loginStartedWhileLoggedOutRef.current = true
        loginAwaitInProgressRef.current = true
        try {
          await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, buildWaitlistEmailLoginOptions() as any)
          loginAwaitInProgressRef.current = false
          await settleBootstrapAfterRecoverableLoginError({
            bypassRecoveryCooldown: true,
          })
        } catch (loginError: unknown) {
          if (isWalletProviderCollisionError(loginError)) {
            throw new Error(getWalletProviderCollisionMessage())
          }
          if (!isAlreadyLoggedInAuthError(loginError)) throw loginError
          if (await tryResumeExistingPrivySession()) {
            return
          }
          await resetStalePrivySessionAndRetryEmailLogin()
        } finally {
          loginAwaitInProgressRef.current = false
          loginStartedWhileLoggedOutRef.current = false
        }
      }
    } catch (authError: any) {
      const isRecoveryRequired = isRecoveryRequiredAuthError(authError)
      if (isRecoveryRequired) {
        writeWaitlistRecoveryGate(true)
        clearWaitlistAuthPending()
        setRecoveryRequired(true)
        setError(privyAuthed ? RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE : RECOVERY_REQUIRED_MESSAGE)
        return
      }
      if (isStalePrivyTokenError(authError)) {
        setError(STALE_PRIVY_SESSION_MESSAGE)
        return
      }
      setError(
        isPrivyLoginBootstrapError(authError)
          ? getSignInNetworkUnstableMessage()
          : typeof authError?.message === 'string'
            ? authError.message
            : 'Failed to start sign-in.',
      )
    } finally {
      endAuthAttempt()
    }
  }, [
    beginAuthAttempt,
    beginRecoveryHandoffAttempt,
    endAuthAttempt,
    endRecoveryHandoffAttempt,
    finalizeRecoveryHandoffError,
    handoffIntoExistingAccount,
    login,
    privyAuthed,
    privyClientStatus,
    recoveryRequired,
    recoveryRequiredBootstrapCooldownUntilRef,
    resetStalePrivySessionAndRetryEmailLogin,
    redirectToCanonicalWaitlist,
    settleBootstrapAfterRecoverableLoginError,
    setError,
    setRecoveryRequired,
    tokenlessFinalizingBootstrapCooldownUntilRef,
    tryResumeExistingPrivySession,
  ])

  const clearStartAuthDeepLink = useCallback(() => {
    if (!isWaitlistStartAuthSearchParam(searchParams.get(WAITLIST_START_AUTH_QUERY_KEY))) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete(WAITLIST_START_AUTH_QUERY_KEY)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (step !== 'auth') return
    if (!isWaitlistStartAuthSearchParam(searchParams.get(WAITLIST_START_AUTH_QUERY_KEY))) return
    if (privyClientStatus !== 'ready') return
    if (busy || authAttemptInFlightRef.current) return
    if (startAuthAutoAttemptedRef.current) return

    startAuthAutoAttemptedRef.current = true
    clearStartAuthDeepLink()
    void onContinueAuth()
  }, [step, searchParams, privyClientStatus, busy, authAttemptInFlightRef, clearStartAuthDeepLink, onContinueAuth])

  const onRecoverAccount = useCallback(async () => {
    if (privyClientStatus === 'disabled' && redirectToCanonicalWaitlist()) {
      return
    }
    if (privyClientStatus === 'loading') {
      setError('Sign-in service is still loading. Please wait a moment and try again.')
      return
    }
    if (!beginRecoveryHandoffAttempt()) return
    try {
      await handoffIntoExistingAccount()
    } catch (recoverError: unknown) {
      finalizeRecoveryHandoffError(recoverError)
    } finally {
      endRecoveryHandoffAttempt()
    }
  }, [
    beginRecoveryHandoffAttempt,
    endRecoveryHandoffAttempt,
    finalizeRecoveryHandoffError,
    handoffIntoExistingAccount,
    privyClientStatus,
    redirectToCanonicalWaitlist,
    setError,
  ])

  const onSignOut = useCallback(async () => {
    if (signOutBusy) return
    setSignOutBusy(true)
    try {
      await runWaitlistPrivyLogout({
        logout: async () => {
          await privy.logout().catch(() => null)
        },
        readToken: getAccessToken,
        shouldLogout: privyAuthedRef.current,
      })
      await waitForPrivyLogoutSettlement().catch(() => undefined)
      resetResolvedAccountState()
      // Block auto-bootstrap until the user explicitly clicks Continue again.
      authBootstrapAutoAttemptedRef.current = true
      finalizingAutoRetryCountRef.current = 0
      finalizingBackgroundRetryCountRef.current = 0
      resetBootstrapCooldowns()
      clearWaitlistRecoveryGate()
      clearWaitlistAuthPending()
      clearStoredWaitlistVerifiedEmailHint()
      setStep('auth')
      setBusy(false)
      setRecoveryRequired(false)
      setError(null)
    } catch {
      setError('Could not fully sign out. Please retry.')
    } finally {
      setSignOutBusy(false)
    }
  }, [
    getAccessToken,
    privy,
    resetBootstrapCooldowns,
    resetResolvedAccountState,
    setBusy,
    setError,
    setRecoveryRequired,
    signOutBusy,
    waitForPrivyLogoutSettlement,
  ])

  const onRepairSession = useCallback(async (): Promise<boolean> => {
    if (sessionRepairBusy) return false
    setSessionRepairBusy(true)
    try {
      const token = await withTimeout(getAccessToken(), 4_000, 'Session refresh token').catch(() => null)
      if (!token) {
        const hasLiveCookie = privyAuthedRef.current
        console.info('[auth-repair]', {
          surface: 'waitlist',
          transition: 'repair-token-miss',
          outcome: hasLiveCookie ? 'transient' : 'true-stale',
        })
        if (!hasLiveCookie) {
          setStep('auth')
        }
        return false
      }

      console.info('[auth-repair]', { surface: 'waitlist', transition: 'bridging' })
      await withTimeout(bridgePrivySession(token), 6_000, 'Session bridge refresh').catch(() => undefined)
      const next = await withTimeout(
        requestBootstrap({ waitForTokenHydration: true }),
        12_000,
        'Session bootstrap refresh',
      )
      if (!next) {
        // Even when bootstrap is briefly stale, token/session repair may still be enough
        // for embedded-wallet reconnect paths to recover in-place.
        console.info('[auth-repair]', { surface: 'waitlist', transition: 'repaired', outcome: 'repaired' })
        setError(null)
        staleSessionProbeRef.current?.reset()
        return true
      }

      console.info('[auth-repair]', { surface: 'waitlist', transition: 'repaired', outcome: 'repaired' })
      setRecoveryRequired(false)
      setError(null)
      staleSessionProbeRef.current?.reset()
      return true
    } catch (repairError: unknown) {
      if (isSessionFinalizingError(repairError) || isStalePrivyTokenError(repairError)) {
        console.info('[auth-repair]', { surface: 'waitlist', transition: 'bridge-error', outcome: 'transient' })
        setError(SESSION_FINALIZING_RETRY_MESSAGE)
      } else if (isTimeoutErrorMessage((repairError as { message?: unknown })?.message)) {
        console.info('[auth-repair]', { surface: 'waitlist', transition: 'bridge-timeout', outcome: 'transient' })
        setError('Session refresh timed out. Tap Refresh session once more.')
      }
      return false
    } finally {
      setSessionRepairBusy(false)
    }
  }, [getAccessToken, requestBootstrap, sessionRepairBusy, setError, setRecoveryRequired])

  const navigateWithSessionHandoff = useCallback(
    async (initialTarget: string) => {
      let target = initialTarget
      let privyToken: string | null = null

      if (privyAuthed) {
        privyToken = await getAccessToken().catch(() => null)
        if (privyToken) {
          // Establishes the cv_auth_session cookie on the marketing origin.
          // We no longer receive a session token in JSON (FINDING-02); the
          // subsequent createAuthHandoffCode call authenticates via that
          // cookie via `withCredentials: true`.
          await bridgePrivySession(privyToken)
        }
      }

      if (target.startsWith('http') && typeof window !== 'undefined') {
        try {
          const parsed = new URL(target)
          if (parsed.origin !== window.location.origin) {
            const handoffCode = await createAuthHandoffCode({ privyToken })
            if (handoffCode) {
              parsed.searchParams.set(HANDOFF_QUERY_KEY, handoffCode)
              target = parsed.toString()
            }
          }
        } catch {
          // Keep original target if URL parsing fails.
        }
        window.location.href = target
        return
      }

      window.location.assign(target)
    },
    [getAccessToken, privyAuthed],
  )

  const onEnterApp = useCallback(async () => {
    if (completionBusy) return
    setCompletionBusy(true)
    try {
      await navigateWithSessionHandoff(enterAppUrl)
    } finally {
      setCompletionBusy(false)
    }
  }, [completionBusy, enterAppUrl, navigateWithSessionHandoff])

  /**
   * Privy can restore a cookie session that reports `authenticated` while its
   * token mint is broken (stale custom-auth-domain state). Detect that with a
   * bounded token probe so the flow resets instead of retrying forever.
   */
  const probeStalePrivyTokenSession = useCallback(async (): Promise<boolean> => {
    if (!privyAuthedRef.current) {
      staleSessionProbeRef.current?.reset()
      return false
    }
    const probe = staleSessionProbeRef.current
    if (!probe) return false
    const outcome = await probe.probe()
    console.info('[auth-repair]', {
      surface: 'waitlist',
      transition: 'probe',
      outcome,
      missCount: probe.missCount,
    })
    return outcome === 'true-stale'
  }, [])

  const resetStaleAuthenticatedPrivySession = useCallback(async (): Promise<void> => {
    clearWaitlistAuthPending()
    resetResolvedAccountState()
    await runWaitlistPrivyLogout({
      logout: async () => {
        await privy.logout().catch(() => null)
      },
      // Force logout when token/session drift is detected; token probes can be stale.
      shouldLogout: true,
    })
    setRecoveryRequired(false)
    setError(WAITLIST_STALE_SESSION_RESET_MESSAGE)
  }, [privy, resetResolvedAccountState, setError, setRecoveryRequired])

  const resumePendingWaitlistAuth = useCallback(async () => {
    clearWaitlistRecoveryGate()
    setRecoveryRequired(false)
    recoveryRequiredBootstrapCooldownUntilRef.current = 0
    try {
      await settleBootstrapAfterRecoverableLoginError({
        bypassRecoveryCooldown: true,
      })
      clearWaitlistAuthPending()
    } catch (bootstrapError: unknown) {
      if (isStalePrivyTokenError(bootstrapError)) {
        if (await probeStalePrivyTokenSession()) {
          await resetStaleAuthenticatedPrivySession()
          return
        }
        setError(SESSION_FINALIZING_RETRY_MESSAGE)
        return
      }
      if (isSessionFinalizingError(bootstrapError)) {
        if (await probeStalePrivyTokenSession()) {
          await resetStaleAuthenticatedPrivySession()
          return
        }
        setError(SESSION_FINALIZING_RETRY_MESSAGE)
        return
      }
      const message =
        typeof (bootstrapError as { message?: unknown })?.message === 'string'
          ? String((bootstrapError as { message: string }).message)
          : 'Failed to load account state.'
      const isSessionMismatch = isSessionEmailMismatchError(message)
      const isRecoveryRequired = isRecoveryRequiredAuthError(bootstrapError)
      if (isSessionMismatch) {
        resetResolvedAccountState()
        if (!disableAggressiveSessionReset) {
          await runWaitlistPrivyLogout({
            logout: privyLogoutRef.current,
            readToken: getAccessToken,
            shouldLogout: shouldDestroyPrivySession,
          })
        }
      }
      if (isRecoveryRequired) {
        writeWaitlistRecoveryGate(true)
        clearWaitlistAuthPending()
        setRecoveryRequired(true)
        setError(
          privyAuthed ? RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE : RECOVERY_REQUIRED_MESSAGE,
        )
        return
      }
      setError(
        isSessionMismatch
          ? SESSION_MISMATCH_MESSAGE
          : isTransientWaitlistNetworkError(bootstrapError)
            ? getWaitlistNetworkUnstableMessage()
            : message,
      )
    }
  }, [
    disableAggressiveSessionReset,
    getAccessToken,
    privyAuthed,
    probeStalePrivyTokenSession,
    recoveryRequiredBootstrapCooldownUntilRef,
    resetResolvedAccountState,
    resetStaleAuthenticatedPrivySession,
    setError,
    setRecoveryRequired,
    settleBootstrapAfterRecoverableLoginError,
    shouldDestroyPrivySession,
  ])

  useEffect(() => {
    if (step !== 'auth') return
    if (recoveryHandoffInFlightRef.current) return
    if (!privyAuthed || privyClientStatus !== 'ready') return
    if (account?.emailVerified) return
    if (recoveryRequired) return

    // Privy can mark the session authenticated before `login()` resolves (email link / redirect).
    if (authAttemptInFlightRef.current) {
      if (recoveryHandoffInFlightRef.current) return
      if (!loginAwaitInProgressRef.current || pendingAuthResumeStartedRef.current) return
      pendingAuthResumeStartedRef.current = true
      void (async () => {
        try {
          await resumePendingWaitlistAuth()
        } finally {
          endAuthAttempt()
          pendingAuthResumeStartedRef.current = false
        }
      })()
      return
    }

    if (privyAuthedBootstrapAttemptedRef.current) return
    privyAuthedBootstrapAttemptedRef.current = true
    authBootstrapAutoAttemptedRef.current = true

    void (async () => {
      setBusy(true)
      setError(null)
      try {
        await resumePendingWaitlistAuth()
      } finally {
        setBusy(false)
      }
    })()
  }, [
    account?.emailVerified,
    authAttemptInFlightRef,
    endAuthAttempt,
    privyAuthed,
    privyClientStatus,
    recoveryRequired,
    resumePendingWaitlistAuth,
    setBusy,
    setError,
    step,
  ])

  const onTryDifferentEmail = useCallback(async () => {
    await onSignOut()
  }, [onSignOut])

  useEffect(() => {
    void fetchWaitlistStats()
    const intervalId = window.setInterval(() => {
      void fetchWaitlistStats()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [fetchWaitlistStats])

  useEffect(() => {
    if (privyAuthed) return
    if (!account) return
    resetResolvedAccountState()
    setStep('auth')
  }, [account, privyAuthed, resetResolvedAccountState])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (step !== 'auth') return
    if (!busy) return
    if (error) return

    const timeoutId = window.setTimeout(() => {
      authAttemptInFlightRef.current = false
      loginAwaitInProgressRef.current = false
      pendingAuthResumeStartedRef.current = false
      clearWaitlistAuthPending()
      setBusy(false)
      setError(WAITLIST_SPINNER_TIMEOUT_MESSAGE)
    }, WAITLIST_BUSY_WATCHDOG_MS)

    return () => window.clearTimeout(timeoutId)
  }, [authAttemptInFlightRef, busy, error, setBusy, setError, step])

  useEffect(() => {
    if (step !== 'auth') {
      authBootstrapAutoAttemptedRef.current = false
      pendingAuthResumeStartedRef.current = false
      finalizingAutoRetryCountRef.current = 0
      finalizingBackgroundRetryCountRef.current = 0
      tokenlessFinalizingBootstrapCooldownUntilRef.current = 0
      recoveryRequiredBootstrapCooldownUntilRef.current = 0
      setBusy(false)
      setRecoveryRequired(false)
    }
  }, [
    recoveryRequiredBootstrapCooldownUntilRef,
    setBusy,
    setRecoveryRequired,
    step,
    tokenlessFinalizingBootstrapCooldownUntilRef,
  ])

  const authRecoveryUiActive = recoveryRequired
  const authUi = deriveWaitlistAuthUi({ recoveryRequired: authRecoveryUiActive })
  const privyEmail = resolveWaitlistPrivyDisplayEmail(privy.user)
  const authVisibleError = error
  const showAuthBootstrapLoader =
    step === 'auth' && busy && !authVisibleError && !authRecoveryUiActive
  const canEnterApp = canEnterAppFromAccountState({
    appAccessStatus: account?.appAccessStatus ?? null,
  })
  const setupWorkspace = account ? (
    <Suspense fallback={<PixelWaveLoader name="wave-lr" size={20} color="rgb(var(--brand-primary))" />}>
      <LazyWaitlistSetupWorkspace
        initialAccount={account as AccountSetupMe}
        canEnterApp={canEnterApp}
        completionBusy={completionBusy}
        onEnterApp={onEnterApp}
        onSignOut={onSignOut}
        signOutBusy={signOutBusy}
        onRepairSession={onRepairSession}
        repairBusy={sessionRepairBusy}
      />
    </Suspense>
  ) : null

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (step !== 'auth') return
    if (busy) return
    if (authAttemptInFlightRef.current) return
    if (error !== SESSION_FINALIZING_RETRY_MESSAGE) return

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setBusy(true)
          const next = await requestBootstrap({ waitForTokenHydration: true })
          if (cancelled) return
          if (next) {
            finalizingBackgroundRetryCountRef.current = 0
            setError(null)
          } else {
            finalizingBackgroundRetryCountRef.current += 1
            if (finalizingBackgroundRetryCountRef.current >= FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS) {
              setError(WAITLIST_SPINNER_TIMEOUT_MESSAGE)
            } else {
              setError(SESSION_FINALIZING_RETRY_MESSAGE)
            }
          }
        } catch (bootstrapError: unknown) {
          if (cancelled) return
          if (isStalePrivyTokenError(bootstrapError)) {
            if (await probeStalePrivyTokenSession()) {
              await resetStaleAuthenticatedPrivySession()
              return
            }
            finalizingBackgroundRetryCountRef.current += 1
            if (finalizingBackgroundRetryCountRef.current >= FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS) {
              setError(WAITLIST_SPINNER_TIMEOUT_MESSAGE)
              return
            }
            setError(SESSION_FINALIZING_RETRY_MESSAGE)
            return
          }
          if (isSessionFinalizingError(bootstrapError)) {
            if (await probeStalePrivyTokenSession()) {
              await resetStaleAuthenticatedPrivySession()
              return
            }
            finalizingBackgroundRetryCountRef.current += 1
            if (finalizingBackgroundRetryCountRef.current >= FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS) {
              setError(WAITLIST_SPINNER_TIMEOUT_MESSAGE)
              return
            }
            setError(SESSION_FINALIZING_RETRY_MESSAGE)
            return
          }

          finalizingBackgroundRetryCountRef.current = 0
          const message =
            typeof (bootstrapError as { message?: unknown })?.message === 'string'
              ? String((bootstrapError as { message: string }).message)
              : 'Failed to load account state.'
          const isSessionMismatch = isSessionEmailMismatchError(message)
          const isRecoveryRequired = isRecoveryRequiredAuthError(bootstrapError)

          if (isSessionMismatch) {
            resetResolvedAccountState()
            if (!disableAggressiveSessionReset) {
              await runWaitlistPrivyLogout({
                logout: privyLogoutRef.current,
                readToken: getAccessToken,
                shouldLogout: shouldDestroyPrivySession,
              })
            }
          }

          if (isRecoveryRequired) {
            writeWaitlistRecoveryGate(true)
            setRecoveryRequired(true)
            setError(
              privyAuthed ? RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE : RECOVERY_REQUIRED_MESSAGE,
            )
            return
          }

          setError(isSessionMismatch ? SESSION_MISMATCH_MESSAGE : message)
        } finally {
          // Always release the auth-bootstrap busy latch. When this effect reruns,
          // its cleanup marks `cancelled=true`; gating setBusy(false) on that flag
          // can orphan the app-loading registrar and leave the overlay stuck.
          setBusy(false)
        }
      })()
    }, FINALIZING_BACKGROUND_RETRY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    authAttemptInFlightRef,
    busy,
    disableAggressiveSessionReset,
    error,
    getAccessToken,
    privyAuthed,
    probeStalePrivyTokenSession,
    requestBootstrap,
    resetResolvedAccountState,
    resetStaleAuthenticatedPrivySession,
    setBusy,
    setError,
    setRecoveryRequired,
    shouldDestroyPrivySession,
    step,
  ])

  return (
    <AppLoadingBootstrapGate active={showAuthBootstrapLoader} label="waitlist-auth-bootstrap">
      <section id={sectionId} className={wrapClass}>
      {disableHeroMotion ? (
        step === 'auth' ? (
          <WaitlistAuthStep
            key="auth-static"
            authUi={authUi}
            waitlistStats={waitlistStats}
            busy={busy}
            privyAuthed={privyAuthed}
            privyClientStatus={privyClientStatus}
            privyEmail={privyEmail}
            error={authVisibleError}
            recoveryRequired={authRecoveryUiActive}
            referralCode={activeReferralCode}
            onContinueAuth={onContinueAuth}
            onRecoverAccount={onRecoverAccount}
            onTryDifferentEmail={onTryDifferentEmail}
            onSignOut={onSignOut}
            signOutBusy={signOutBusy}
            disableMotion
          />
        ) : step === 'done' && account ? (
          <div key="done-static">
            {setupWorkspace}
          </div>
        ) : null
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {step === 'auth' ? (
            <WaitlistAuthStep
              key="auth"
              authUi={authUi}
              waitlistStats={waitlistStats}
              busy={busy}
              privyAuthed={privyAuthed}
              privyClientStatus={privyClientStatus}
              privyEmail={privyEmail}
              error={authVisibleError}
              recoveryRequired={authRecoveryUiActive}
              referralCode={activeReferralCode}
              onContinueAuth={onContinueAuth}
              onRecoverAccount={onRecoverAccount}
              onTryDifferentEmail={onTryDifferentEmail}
              onSignOut={onSignOut}
              signOutBusy={signOutBusy}
            />
          ) : step === 'done' && account ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: WAITLIST_EASE }}
            >
              {setupWorkspace}
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </section>
    </AppLoadingBootstrapGate>
  )
}
