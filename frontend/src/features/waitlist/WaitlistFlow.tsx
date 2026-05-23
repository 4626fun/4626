import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { Button } from '@/components/ui/Button'
import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import {
  getMarketingWaitlistEntryUrl,
  isWaitlistStartAuthSearchParam,
  readStoredWaitlistReferralCode,
  storeWaitlistReferralCode,
  WAITLIST_START_AUTH_QUERY_KEY,
} from '@/lib/auth/waitlistEntry'
import { getAppBaseUrl } from '@/lib/env/host'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import type { ApiEnvelope } from '@/lib/wallet/onboardingWallet'

import {
  applyWaitlistSubAccountConnectOverlay,
  type WaitlistStep,
  type WaitlistSubAccountConnectOverlay,
  isSubAccountExecutionReady,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldForceBaseAppConnectStep,
  shouldForceOwnerInstallSetupStep,
} from './waitlistFlowState'
import { useWaitlistSigningStepComplete } from './useWaitlistSigningStepComplete'
import {
  writePersistedSubAccountConnectOverlay,
} from './waitlistSubAccountConnectCache'
import {
  clearStoredWaitlistSessionToken,
  isAlreadyLoggedInAuthError,
  isEmailAlreadyLinkedAuthError,
  isRecoveryRequiredAuthError,
  runWaitlistPrivyLogout,
} from './waitlistAuthState'
import { buildWaitlistEmailLoginOptions, buildWaitlistRecoveryLoginOptions } from './waitlistLoginOptions'
import { type WaitlistEmailUi, canEnterAppFromAccountState, deriveWaitlistAuthUi } from './waitlistFlowUi'
import { bridgePrivySession, createAuthHandoffCode } from './waitlistHandoff'
import { WaitlistSetupWorkspace } from './WaitlistSetupWorkspace'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { getSubAccountCompletionAccountKey, type WaitlistAccountsSummary } from './waitlistAccountTypes'
import {
  FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS,
  FINALIZING_BACKGROUND_RETRY_MS,
  FLOW_TIMEOUT_MS,
  PRIVY_LOGOUT_SETTLE_ATTEMPTS,
  PRIVY_LOGOUT_SETTLE_DELAY_MS,
  RECOVERY_REQUIRED_MESSAGE,
  SESSION_FINALIZING_RETRY_MESSAGE,
  SESSION_MISMATCH_MESSAGE,
  STALE_PRIVY_SESSION_MESSAGE,
  getWalletProviderCollisionMessage,
  isSessionFinalizingError,
  isWalletProviderCollisionError,
  withTimeout,
} from './waitlistBootstrapUtils'
import { useWaitlistBootstrap } from './useWaitlistBootstrap'
import { ReferrerGreetingBanner } from './ReferrerGreetingBanner'
import { WaitlistConnectBaseApp, type WaitlistConnectBaseAppResult } from './WaitlistConnectBaseApp'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'

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
  const text = typeof error === 'string' ? error : typeof (error as any)?.message === 'string' ? (error as any).message : ''
  const normalized = text.trim().toLowerCase()
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('blocked by cors') ||
    (normalized.includes('access-control-allow-origin') && normalized.includes('privy')) ||
    normalized.includes('email verification is unavailable in this client')
  )
}

function getSignInNetworkUnstableMessage(): string {
  return 'Sign-in network is unstable right now. Stay on this page and retrying will continue automatically.'
}

async function maybeCallMethod(target: any, methodNames: string[], args: unknown[] = []): Promise<boolean> {
  if (!target) return false
  for (const methodName of methodNames) {
    if (typeof target?.[methodName] === 'function') {
      await target[methodName](...args)
      return true
    }
  }
  return false
}

function isTelegramMiniAppRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const maybeTelegram = (window as any)?.Telegram?.WebApp
  if (maybeTelegram) return true
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('telegram')
}

function isBaseInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    ua.includes('coinbase') ||
    ua.includes('cbios') ||
    ua.includes('cbandroid') ||
    ua.includes('baseapp') ||
    ua.includes(' base/')
  )
}

function hasCoinbaseInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false
  const ethereum = (window as any).ethereum
  if (!ethereum) return false
  if (Boolean(ethereum.isCoinbaseWallet)) return true
  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.some((provider: any) => Boolean(provider?.isCoinbaseWallet))
  }
  return false
}

function isBaseInAppContext(): boolean {
  return isBaseInAppBrowser() || hasCoinbaseInjectedProvider()
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
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  error: string | null
  recoveryRequired: boolean
  referralCode: string | null
  onContinueAuth: () => void | Promise<void>
  onRecoverAccount: () => void | Promise<void>
  disableMotion?: boolean
}) {
  const {
    authUi,
    waitlistStats,
    busy,
    privyClientStatus,
    error,
    recoveryRequired,
    referralCode,
    onContinueAuth,
    onRecoverAccount,
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

          {/* CTA */}
          <motion.div {...stagger(1)} className="mt-4 space-y-2.5">
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              aria-disabled={buttonsDisabled}
              onClick={() => {
                if (buttonsDisabled) return
                void onContinueAuth()
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
          </motion.div>

          {/* error */}
          {error ? (
            <motion.div
              {...stagger(2)}
              role="alert"
              aria-live="polite"
              className="mt-3.5 space-y-2.5 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-left text-sm text-blue-200"
            >
              <div>{error}</div>
              {recoveryRequired ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRecoverAccount()}
                  className="inline-flex items-center rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                >
                  Use existing account
                </button>
              ) : null}
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
  const baseInAppContext = useMemo(() => isBaseInAppContext(), [])
  const disableHeroMotion = Boolean(prefersReducedMotion || baseInAppContext)

  const privy = usePrivy()
  const privyClientStatus = usePrivyClientStatus()
  const { login } = useLogin()

  const privyAuthed = privy.authenticated
  const shouldDestroyPrivySession = privyAuthed && privyClientStatus === 'ready'
  const { getAccessToken } = privy
  const { embeddedEoaAddress, ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()

  const [searchParams, setSearchParams] = useSearchParams()
  const [step, setStep] = useState<WaitlistStep>('auth')
  const [subAccountStepCompletedAccountKey, setSubAccountStepCompletedAccountKey] = useState<string | null>(null)
  const subAccountStepCompletedAccountKeyRef = useRef<string | null>(null)
  const subAccountConnectOverlayRef = useRef<WaitlistSubAccountConnectOverlay | null>(null)
  const subAccountFlowEnabled = useMemo(() => waitlistSubAccountFlowFlag(), [])

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
  const [completionBusy, setCompletionBusy] = useState(false)
  const [account, setAccount] = useState<AccountsSummary | null>(null)
  const [waitlistStats, setWaitlistStats] = useState<WaitlistStatsData | null>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)

  const resolveSubAccountStepCompleted = useCallback(
    (targetAccount: Pick<AccountsSummary, 'privyUserId' | 'email'> | null): boolean => {
      const accountCompletionKey = getSubAccountCompletionAccountKey(targetAccount)
      if (!accountCompletionKey) return false
      return (
        subAccountStepCompletedAccountKey === accountCompletionKey ||
        subAccountStepCompletedAccountKeyRef.current === accountCompletionKey
      )
    },
    [subAccountStepCompletedAccountKey],
  )

  const setupIntent = searchParams.get('setup')
  const ownerInstallRequested = setupIntent?.trim().toLowerCase() === 'owner-install'
  const { signingStepComplete, signingProbePending } = useWaitlistSigningStepComplete({
    accountSignals: account?.accountSignals,
    baseSubAccount: account?.baseSubAccount ?? null,
    canonicalCswAddress:
      typeof account?.accountSignals?.canonicalCswAddress === 'string'
        ? account.accountSignals.canonicalCswAddress
        : null,
    ownerInstallRequested,
  })

  useEffect(() => {
    const setup = searchParams.get('setup')
    if (!subAccountFlowEnabled || !account?.emailVerified) return
    if (
      shouldForceOwnerInstallSetupStep({
        setupIntent: setup,
        subAccountFlowEnabled,
        account,
      })
    ) {
      setStep('done')
      return
    }
    if (
      shouldForceBaseAppConnectStep({
        setupIntent: setup,
        subAccountFlowEnabled,
        account,
        signingStepComplete,
        signingProbePending,
      })
    ) {
      setStep('connect-base-app')
      return
    }
    const nextStep = resolveWaitlistStep({
      account,
      subAccountFlowEnabled,
      embeddedEoaAvailable: Boolean(embeddedEoaAddress),
      subAccountStepCompleted: resolveSubAccountStepCompleted(account),
      setupIntent: setup,
    })
    setStep(nextStep)
  }, [
    account,
    embeddedEoaAddress,
    resolveSubAccountStepCompleted,
    searchParams,
    signingProbePending,
    signingStepComplete,
    subAccountFlowEnabled,
  ])

  const authBootstrapAutoAttemptedRef = useRef(false)
  const startAuthAutoAttemptedRef = useRef(false)
  const finalizingAutoRetryCountRef = useRef(0)
  const finalizingBackgroundRetryCountRef = useRef(0)
  const privyLogoutRef = useRef<null | (() => Promise<void>)>(null)
  const privyAuthedRef = useRef(privyAuthed)
  const privyClientStatusRef = useRef(privyClientStatus)

  const wrapClass = 'mx-auto w-full max-w-5xl px-4 py-6 sm:py-8'
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

  useEffect(() => {
    privyAuthedRef.current = privyAuthed
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
    subAccountStepCompletedAccountKeyRef.current = null
    subAccountConnectOverlayRef.current = null
    setSubAccountStepCompletedAccountKey(null)
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
    embeddedEoaAddress,
    ensureEmbeddedWallet,
    getAccessToken,
    privyAuthed,
    subAccountFlowEnabled,
    subAccountStepCompletedAccountKey,
    setSubAccountStepCompletedAccountKey,
    subAccountStepCompletedAccountKeyRef,
    subAccountConnectOverlayRef,
    setAccount,
    setStep,
    setError,
    setRecoveryRequired,
    finalizingAutoRetryCountRef,
    finalizingBackgroundRetryCountRef,
  })

  const tryResumeExistingPrivySession = useCallback(async (): Promise<boolean> => {
    const existingToken = await getAccessToken().catch(() => null)
    if (!existingToken) return false
    await settleBootstrapAfterRecoverableLoginError({
      bypassRecoveryCooldown: true,
    })
    return true
  }, [getAccessToken, settleBootstrapAfterRecoverableLoginError])

  const waitForPrivyLogoutSettlement = useCallback(async (): Promise<void> => {
    for (let attempt = 0; attempt < PRIVY_LOGOUT_SETTLE_ATTEMPTS; attempt += 1) {
      const token = await getAccessToken().catch(() => null)
      const tokenMissing = !token
      const authCleared = privyAuthedRef.current === false
      const clientNotReady = privyClientStatusRef.current !== 'ready'
      if (tokenMissing && (authCleared || clientNotReady)) return
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

  const handoffIntoExistingAccount = useCallback(async (): Promise<void> => {
    let privyToken = await getAccessToken().catch(() => null)

    if (!privyToken) {
      try {
        await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, buildWaitlistRecoveryLoginOptions() as any)
      } catch (loginError: unknown) {
        if (isWalletProviderCollisionError(loginError)) {
          throw new Error(getWalletProviderCollisionMessage())
        }
        if (!isAlreadyLoggedInAuthError(loginError)) throw loginError
      }
      privyToken = await getAccessToken().catch(() => null)
    }

    if (!privyToken) {
      throw new Error(STALE_PRIVY_SESSION_MESSAGE)
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
  }, [waitlistRecoveryUrl, getAccessToken, login])

  const onContinueAuth = useCallback(async () => {
    if (!beginAuthAttempt()) return
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
        try {
          const linked = await maybeCallMethod(privy, ['linkEmail', 'linkEmailAccount'])
          if (!linked) throw new Error('Email verification is unavailable in this client. Sign out and retry with email.')
        } catch (linkEmailError: unknown) {
          if (!isEmailAlreadyLinkedAuthError(linkEmailError)) throw linkEmailError
        }
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
        try {
          await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, buildWaitlistEmailLoginOptions() as any)
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
        }
      }
    } catch (authError: any) {
      const isRecoveryRequired = isRecoveryRequiredAuthError(authError)
      if (isRecoveryRequired) {
        setRecoveryRequired(true)
        setError(RECOVERY_REQUIRED_MESSAGE)
        return
      }
      setError(
        !privyAuthed && isPrivyLoginBootstrapError(authError)
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
    endAuthAttempt,
    login,
    privy,
    privyAuthed,
    privyClientStatus,
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
    if (!beginAuthAttempt()) return
    recoveryRequiredBootstrapCooldownUntilRef.current = 0
    try {
      if (privyClientStatus === 'disabled' && redirectToCanonicalWaitlist()) {
        return
      }
      if (privyClientStatus === 'loading') {
        setError('Sign-in service is still loading. Please wait a moment and try again.')
        return
      }
      await handoffIntoExistingAccount()
    } catch (recoverError: any) {
      if (isPrivyLoginBootstrapError(recoverError) && redirectToCanonicalWaitlist()) {
        setError('Redirecting back to the waitlist sign-in flow...')
        return
      }
      setError(typeof recoverError?.message === 'string' ? recoverError.message : 'Failed to start account recovery sign-in.')
      setRecoveryRequired(true)
    } finally {
      endAuthAttempt()
    }
  }, [
    beginAuthAttempt,
    endAuthAttempt,
    handoffIntoExistingAccount,
    privyClientStatus,
    recoveryRequiredBootstrapCooldownUntilRef,
    redirectToCanonicalWaitlist,
    setError,
    setRecoveryRequired,
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

  const markSubAccountStepCompleted = useCallback((targetAccount: Pick<AccountsSummary, 'privyUserId' | 'email'> | null) => {
    const completionKey = getSubAccountCompletionAccountKey(targetAccount)
    subAccountStepCompletedAccountKeyRef.current = completionKey
    setSubAccountStepCompletedAccountKey(completionKey)
  }, [])

  const clearBaseAppSetupDeepLink = useCallback(() => {
    if ((searchParams.get('setup') ?? '').trim().toLowerCase() !== 'base-app') return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('setup')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const handleSubAccountSkip = useCallback(() => {
    markSubAccountStepCompleted(account)
    clearBaseAppSetupDeepLink()
    setStep('done')
  }, [account, clearBaseAppSetupDeepLink, markSubAccountStepCompleted])

  const handleSubAccountComplete = useCallback(
    (result: WaitlistConnectBaseAppResult) => {
      subAccountConnectOverlayRef.current = {
        parentAddress: result.parentAddress,
        subAccountAddress: result.subAccountAddress,
      }
      const completionKey = getSubAccountCompletionAccountKey(account)
      if (completionKey) {
        writePersistedSubAccountConnectOverlay(completionKey, subAccountConnectOverlayRef.current)
        markSubAccountStepCompleted(account)
      }
      clearBaseAppSetupDeepLink()
      setAccount((current) => {
        const base = current ?? account
        if (!base) return current
        return applyWaitlistSubAccountConnectOverlay(base, subAccountConnectOverlayRef.current, true)
      })
      setStep('done')
      void requestBootstrap({ forceNew: true }).catch(() => null)
    },
    [account, clearBaseAppSetupDeepLink, markSubAccountStepCompleted, requestBootstrap],
  )

  useEffect(() => {
    if (!shouldAutoBootstrapWaitlistSession({ step, privyAuthed, recoveryRequired })) {
      return
    }
    if (authBootstrapAutoAttemptedRef.current) return

    authBootstrapAutoAttemptedRef.current = true
    let cancelled = false
    ;(async () => {
      try {
        setBusy(true)
        setError(null)
        await requestBootstrap({ forceNew: true })
      } catch (bootstrapError: any) {
        if (isSessionFinalizingError(bootstrapError)) {
          try {
            await settleBootstrapAfterRecoverableLoginError()
            if (!cancelled) setError(null)
          } catch (finalizingError: unknown) {
            if (!cancelled) {
              setStep('auth')
              setError(
                typeof (finalizingError as { message?: unknown })?.message === 'string' &&
                  String((finalizingError as { message: string }).message).trim()
                  ? String((finalizingError as { message: string }).message)
                  : SESSION_FINALIZING_RETRY_MESSAGE,
              )
            }
          }
          return
        }
        const message = typeof bootstrapError?.message === 'string' ? bootstrapError.message : 'Failed to load account state.'
        const isSessionMismatch = isSessionEmailMismatchError(message)
        const isRecoveryRequired = isRecoveryRequiredAuthError(bootstrapError)
        if (isSessionMismatch) {
          resetResolvedAccountState()
          if (!disableAggressiveSessionReset) {
            await runWaitlistPrivyLogout({ logout: privyLogoutRef.current, shouldLogout: shouldDestroyPrivySession })
          }
        }
        if (isRecoveryRequired) {
          if (!cancelled) {
            setRecoveryRequired(true)
            setError(RECOVERY_REQUIRED_MESSAGE)
          }
          return
        }
        if (!cancelled) {
          setError(isSessionMismatch ? SESSION_MISMATCH_MESSAGE : isRecoveryRequired ? RECOVERY_REQUIRED_MESSAGE : message)
        }
      } finally {
        setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    privyAuthed,
    recoveryRequired,
    resetResolvedAccountState,
    requestBootstrap,
    settleBootstrapAfterRecoverableLoginError,
    setBusy,
    setError,
    setRecoveryRequired,
    shouldDestroyPrivySession,
    step,
    disableAggressiveSessionReset,
  ])

  useEffect(() => {
    void fetchWaitlistStats()
    const intervalId = window.setInterval(() => {
      void fetchWaitlistStats()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [fetchWaitlistStats])

  useEffect(() => {
    if (privyAuthed) return
    if (!account && !subAccountStepCompletedAccountKey) return
    resetResolvedAccountState()
    setStep('auth')
  }, [account, privyAuthed, resetResolvedAccountState, subAccountStepCompletedAccountKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (step !== 'auth') return
    if (!busy) return
    if (authAttemptInFlightRef.current) return
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

  const authUi = deriveWaitlistAuthUi()
  const authVisibleError = error === SESSION_FINALIZING_RETRY_MESSAGE ? null : error
  const showAuthBootstrapLoader = step === 'auth' && busy && !authVisibleError
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
            setRecoveryRequired(true)
            setError(RECOVERY_REQUIRED_MESSAGE)
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
    error,
    requestBootstrap,
    resetResolvedAccountState,
    setBusy,
    setError,
    setRecoveryRequired,
    shouldDestroyPrivySession,
    step,
    disableAggressiveSessionReset,
  ])

  return (
    <>
      {showAuthBootstrapLoader ? (
        <AppLoadingRegistrar
          intent="session"
          labelOverride={authUi.busyLabel}
          srStatusOverride={authUi.busyLabel}
        />
      ) : null}
      <section id={sectionId} className={wrapClass} aria-hidden={showAuthBootstrapLoader ? true : undefined}>
      {disableHeroMotion ? (
        step === 'auth' ? (
          <WaitlistAuthStep
            key="auth-static"
            authUi={authUi}
            waitlistStats={waitlistStats}
            busy={busy}
            privyClientStatus={privyClientStatus}
            error={authVisibleError}
            recoveryRequired={recoveryRequired}
            referralCode={activeReferralCode}
            onContinueAuth={onContinueAuth}
            onRecoverAccount={onRecoverAccount}
            disableMotion
          />
        ) : step === 'connect-base-app' ? (
          <div key="connect-base-app-static" className="flex min-h-[460px] items-center justify-center py-12 sm:py-20">
            <WaitlistConnectBaseApp
              onSkip={handleSubAccountSkip}
              onComplete={handleSubAccountComplete}
              parentAddress={account?.accountSignals?.canonicalCswAddress ?? null}
              subAccountAddress={
                account?.accountSignals?.baseSubAccount?.address ?? account?.baseSubAccount ?? null
              }
              embeddedEoaAddress={embeddedEoaAddress ?? null}
              linkRegistered={isSubAccountExecutionReady(account?.accountSignals)}
            />
          </div>
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
              privyClientStatus={privyClientStatus}
              error={authVisibleError}
              recoveryRequired={recoveryRequired}
              referralCode={activeReferralCode}
              onContinueAuth={onContinueAuth}
              onRecoverAccount={onRecoverAccount}
            />
          ) : step === 'connect-base-app' ? (
            <motion.div
              key="connect-base-app"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: WAITLIST_EASE }}
              className="flex min-h-[460px] items-center justify-center py-12 sm:py-20"
            >
              <WaitlistConnectBaseApp
              onSkip={handleSubAccountSkip}
              onComplete={handleSubAccountComplete}
              parentAddress={account?.accountSignals?.canonicalCswAddress ?? null}
              subAccountAddress={
                account?.accountSignals?.baseSubAccount?.address ?? account?.baseSubAccount ?? null
              }
              embeddedEoaAddress={embeddedEoaAddress ?? null}
              linkRegistered={isSubAccountExecutionReady(account?.accountSignals)}
            />
            </motion.div>
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
    </>
  )
}
