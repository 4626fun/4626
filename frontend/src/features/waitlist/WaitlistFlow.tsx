import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
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
  PRIVY_LOGOUT_SETTLE_ATTEMPTS,
  PRIVY_LOGOUT_SETTLE_DELAY_MS,
  RECOVERY_REQUIRED_MESSAGE,
  RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE,
  SESSION_MISMATCH_MESSAGE,
  STALE_PRIVY_SESSION_MESSAGE,
  WAITLIST_STALE_SESSION_RESET_MESSAGE,
  getWalletProviderCollisionMessage,
  isSessionFinalizingError,
  isStalePrivyTokenError,
  isTimeoutErrorMessage,
  isTransientWaitlistNetworkError,
  isWalletProviderCollisionError,
} from './waitlistBootstrapUtils'
export { isPrivyLoginBootstrapError } from './waitlistBootstrapUtils'
import { useWaitlistAuthState } from './useWaitlistAuthState'
import { ReferrerGreetingBanner } from './ReferrerGreetingBanner'
import {
  captureWaitlistVerifiedEmailHint,
  clearStoredWaitlistVerifiedEmailHint,
  clearWaitlistAuthPending,
  clearWaitlistRecoveryGate,
  resolveWaitlistPrivyDisplayEmail,
  resolveWaitlistVerifiedEmailHint,
  writeWaitlistAuthPending,
  writeWaitlistRecoveryGate,
} from './waitlistStorage'
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
const PRIVY_OAUTH_QUERY_KEYS = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'] as const

function isTelegramMiniAppRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const maybeTelegram = (window as any)?.Telegram?.WebApp
  if (maybeTelegram) return true
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('telegram')
}

// useWaitlistAuthState provides busy/error/recovery/finalizing + guarded attempt logic
// Extracted to reduce the giant component. More logic can migrate here over time.

function WaitlistAuthStep(props: {
  authUi: WaitlistEmailUi
  waitlistStats: WaitlistStatsData | null
  busy: boolean
  finalizing: boolean
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
    finalizing,
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

  // Use explicit finalizing flag + clear error for UI.
  // The finalizing state indicates we are still waiting for Privy token / bootstrap
  // to settle after a successful email login.
  const working = privyAuthed && !recoveryRequired && (busy || finalizing)
  const visibleError =
    error && !finalizing && (!recoveryRequired || privyAuthed) ? error : null
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
                  Setting up your account
                </p>
                {privyEmail ? <p className="text-xs text-zinc-500">{privyEmail}</p> : null}
              </div>
              {finalizing && !busy ? (
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

  const privy = usePrivy()
  const privyClientStatus = usePrivyClientStatus()
  const { login } = useLogin()

  const privyAuthed = privy.authenticated
  const shouldDestroyPrivySession = privyAuthed && privyClientStatus === 'ready'
  const { getAccessToken } = privy
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()

  const [searchParams, setSearchParams] = useSearchParams()
  const [step, setStep] = useState<WaitlistStep>('auth')

  // waitlistStats is display-only (progress banner); keep local here.
  const [waitlistStats, setWaitlistStats] = useState<WaitlistStatsData | null>(null)

  const clearStartAuthDeepLink = useCallback(() => {
    if (!isWaitlistStartAuthSearchParam(searchParams.get(WAITLIST_START_AUTH_QUERY_KEY))) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete(WAITLIST_START_AUTH_QUERY_KEY)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

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
    busy,
    setBusy,
    error,
    setError,
    recoveryRequired,
    setRecoveryRequired,
    finalizing,
    setFinalizing,
    completionBusy,
    setCompletionBusy,
    signOutBusy,
    setSignOutBusy,
    sessionRepairBusy,
    setSessionRepairBusy,
    account,
    onContinueAuth,
    onRecoverAccount,
    onSignOut,
    onRepairSession,
    onTryDifferentEmail,
    onEnterApp,
    // Internal refs/cooldowns etc. owned by hook; not destructured here unless needed for render.
  } = useWaitlistAuthState({
    privyAuthed,
    redirectToCanonicalWaitlist,
    getAccessToken,
    disableAggressiveSessionReset,
    runWaitlistPrivyLogout,
    privy,
    setStep,
    activeReferralCode,
    ensureEmbeddedWallet,
    getVerifiedEmailHint: () => resolveWaitlistVerifiedEmailHint(privy.user),
    step,
    privyClientStatus,
    login,
    clearStartAuthDeepLink,
    searchParams,
    setSearchParams,
    navigateWithSessionHandoff,
    enterAppUrl,
    bridgePrivySession,
    createAuthHandoffCode,
    isOnCanonicalMarketingWaitlistPage,
    waitlistRecoveryUrl,
    HANDOFF_QUERY_KEY,
    clearStoredWaitlistVerifiedEmailHint,
  })

  // NOTE: Guarded setter pattern (setErrorGuarded etc.) is already established in
  // useAccountSetupController and useAddUserOpOwnerInstall. The attempt state here
  // already uses ref-based in-flight guards; additional guarded wrappers can be
  // added when specific long-OTP or bootstrap churn is observed.
  const wrapClass =
    step === 'done'
      ? 'mx-auto w-full max-w-none px-0 py-5 sm:py-8'
      : 'mx-auto w-full max-w-5xl px-4 py-6 sm:py-8'
  const activeReferralCode = useMemo(() => readStoredWaitlistReferralCode(), [])
  const enterAppUrl = useMemo(() => buildAppEntryUrl(getAppBaseUrl()), [])
  const waitlistRecoveryUrl = useMemo(() => getMarketingWaitlistEntryUrl(), [])
  const disableAggressiveSessionReset = useMemo(() => isTelegramMiniAppRuntime(), [])

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

  // Stats polling (non-core auth; kept local for separation).
  useEffect(() => {
    void fetchWaitlistStats()
    const intervalId = window.setInterval(() => {
      void fetchWaitlistStats()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [fetchWaitlistStats])

  const authRecoveryUiActive = recoveryRequired
  const authUi = deriveWaitlistAuthUi({ recoveryRequired: authRecoveryUiActive })
  const privyEmail = resolveWaitlistPrivyDisplayEmail(privy.user)
  const authVisibleError = error
  const showAuthBootstrapLoader =
    step === 'auth' && busy && !authVisibleError && !authRecoveryUiActive && !finalizing
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
            finalizing={finalizing}
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
              finalizing={finalizing}
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
