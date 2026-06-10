import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { Button } from '@/components/ui/Button'
import { AppLoadingBootstrapGate } from '@/components/layout/AppLoadingOverlay'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
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
import { WaitlistSetupWorkspace } from './WaitlistSetupWorkspace'
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
  getWalletProviderCollisionMessage,
  getWaitlistNetworkUnstableMessage,
  isSessionFinalizingError,
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

type WaitlistStatsData = {
  signedUpCount: number
  capacity: number
  spotsRemaining: number
}

const HANDOFF_QUERY_KEY = 'cv_handoff'
const WAITLIST_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]
const WAITLIST_SPINNER_TIMEOUT_MESSAGE = 'Sign-in is taking longer than expected. Tap Continue to retry.'
const WAITLIST_BUSY_WATCHDOG_MS = 25_000

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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-[min(100%,22rem)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgb(var(--brand-primary)/0.07),transparent_72%)]"
        />

        <motion.div
          {...stagger(0)}
          className="relative px-2 sm:px-4"
        >
          <div className="space-y-2">
            <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white sm:text-[2rem]">{authUi.title}</h2>
            {waitlistProgressLine ? (
              <p className="text-xs text-zinc-400">{waitlistProgressLine}</p>
            ) : null}
          </div>

          {/* Referral greeting — only renders when a code is present and resolves. */}
          {referralCode ? (
            <div className="mt-3.5 text-left">
              <ReferrerGreetingBanner referralCode={referralCode} />
            </div>
          ) : null}

          <p className="mt-2 text-sm text-zinc-400">{authUi.subtitle}</p>

          {privyAuthed && !recoveryRequired ? (
            <div className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3.5 py-2.5 text-left text-sm">
              <div className="text-zinc-300">
                Signed in with Privy
                {privyEmail ? (
                  <>
                    {' '}
                    as <span className="font-medium text-white">{privyEmail}</span>
                  </>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {busy
                  ? 'Creating your 4626 account…'
                  : 'Tap Continue if the waitlist screen does not advance automatically.'}
              </p>
              {onSignOut ? (
                <button
                  type="button"
                  disabled={busy || signOutBusy}
                  onClick={() => void onSignOut()}
                  className="mt-2 text-xs text-red-400 transition hover:text-red-300 disabled:opacity-60"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          ) : null}

          {privyAuthed && recoveryRequired ? (
            <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 text-left text-sm text-amber-100/90">
              {privyEmail ? (
                <>
                  Signed in with Privy as{' '}
                  <span className="font-medium text-white">{privyEmail}</span>, but that session is not
                  linked to your existing 4626 account yet.
                </>
              ) : (
                <>
                  Your wallet session is connected in Privy, but it is not linked to your existing 4626
                  account yet. Use existing account and sign in with email OTP.
                </>
              )}
            </div>
          ) : null}

          {/* CTA */}
          <motion.div {...stagger(1)} className="mt-4 space-y-2.5">
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
          </motion.div>

          {/* error */}
          {error && (!recoveryRequired || privyAuthed) ? (
            <motion.div
              {...stagger(2)}
              role="alert"
              aria-live="polite"
              className="mt-3.5 space-y-2.5 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-left text-sm text-blue-200"
            >
              <div>{error}</div>
            </motion.div>
          ) : null}
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
    const target = getMarketingWaitlistEntryUrl()
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
        shouldLogout: true,
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
    privy,
    resetBootstrapCooldowns,
    resetResolvedAccountState,
    setBusy,
    setError,
    setRecoveryRequired,
    signOutBusy,
    waitForPrivyLogoutSettlement,
  ])

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
      if (isSessionFinalizingError(bootstrapError)) {
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
          await runWaitlistPrivyLogout({ logout: privyLogoutRef.current, shouldLogout: shouldDestroyPrivySession })
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
    privyAuthed,
    recoveryRequiredBootstrapCooldownUntilRef,
    resetResolvedAccountState,
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
    // Only timeout explicit user-initiated attempts; background auto-resume uses busy without inFlight.
    if (!authAttemptInFlightRef.current) return
    if (error) return

    const timeoutId = window.setTimeout(() => {
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
          if (!cancelled && next) {
            finalizingBackgroundRetryCountRef.current = 0
            setError(null)
          }
        } catch (bootstrapError: unknown) {
          if (cancelled) return
          if (isSessionFinalizingError(bootstrapError)) {
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
              await runWaitlistPrivyLogout({ logout: privyLogoutRef.current, shouldLogout: shouldDestroyPrivySession })
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
          if (!cancelled) setBusy(false)
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
    privyAuthed,
    requestBootstrap,
    resetResolvedAccountState,
    setBusy,
    setError,
    setRecoveryRequired,
    shouldDestroyPrivySession,
    step,
  ])

  return (
    <AppLoadingBootstrapGate active={showAuthBootstrapLoader}>
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
            <WaitlistSetupWorkspace
              initialAccount={account as AccountSetupMe}
              canEnterApp={canEnterApp}
              completionBusy={completionBusy}
              onEnterApp={onEnterApp}
              onSignOut={onSignOut}
              signOutBusy={signOutBusy}
            />
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
              <WaitlistSetupWorkspace
                initialAccount={account as AccountSetupMe}
                canEnterApp={canEnterApp}
                completionBusy={completionBusy}
                onEnterApp={onEnterApp}
                onSignOut={onSignOut}
                signOutBusy={signOutBusy}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </section>
    </AppLoadingBootstrapGate>
  )
}
