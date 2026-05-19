import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import {
  clearStoredWaitlistReferralCode,
  getMarketingWaitlistEntryUrl,
  readStoredWaitlistReferralCode,
  storeWaitlistReferralCode,
} from '@/lib/auth/waitlistEntry'
import { getAppBaseUrl } from '@/lib/env/host'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import type { ApiEnvelope, OnboardingBootstrapResponse } from '@/lib/wallet/onboardingWallet'

import {
  mergeCanonicalWaitlistAccount,
  type WaitlistStep,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
} from './waitlistFlowState'
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
import { WaitlistSetupTray } from './WaitlistSetupTray'
import { ReferrerGreetingBanner } from './ReferrerGreetingBanner'
import { WaitlistConnectBaseApp } from './WaitlistConnectBaseApp'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'

type AccountsSummary = {
  privyUserId: string
  email: string | null
  emailVerified: boolean
  appAccessStatus: string | null
  baseSubAccount: string | null
  linkedMethods: Record<string, string[]>
  accountSignals: {
    linked: boolean
    canonicalCswAddress: string | null
    baseSubAccount: {
      address: string | null
      registered: boolean
      isDistinctFromCsw: boolean
    }
    executionTrack: 'sub-account' | 'legacy-owner-install' | 'migration-pending' | 'none-yet'
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: boolean | null
    creatorCoin: { address: string } | null
    zoraHandle: string | null
    lastResolvedAt: string | null
  }
  score: { points: number; tier: number }
}

type WaitlistBootstrapResponse =
  | {
      requiresPrivyAuth: true
      email: string | null
      waitlistEntryId: number | null
    }
  | ({
      requiresPrivyAuth: false
    } & AccountsSummary)

type WaitlistStatsData = {
  signedUpCount: number
  capacity: number
  spotsRemaining: number
}

function getSubAccountCompletionAccountKey(account: Pick<AccountsSummary, 'privyUserId' | 'email'> | null): string | null {
  const privyUserId = account?.privyUserId?.trim()
  if (privyUserId) return `privy:${privyUserId}`
  const email = account?.email?.trim().toLowerCase()
  if (email) return `email:${email}`
  return null
}

const HANDOFF_QUERY_KEY = 'cv_handoff'
const FLOW_TIMEOUT_MS = 20_000
const WAITLIST_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(t))
  })
}

async function runPrivyLoginWithTimeout(
  login: (options?: unknown) => Promise<unknown>,
  options: unknown,
): Promise<void> {
  await withTimeout(Promise.resolve().then(() => login(options)), FLOW_TIMEOUT_MS, 'Sign-in')
}

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: unknown }).error
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError
  }
  return fallback
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

function isWalletProviderCollisionError(error: unknown): boolean {
  const text = typeof error === 'string' ? error : typeof (error as any)?.message === 'string' ? (error as any).message : ''
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('cannot set property ethereum of #<window> which has only a getter') ||
    normalized.includes('cannot redefine property: ethereum') ||
    normalized.includes('wallet proxy not initialized')
  )
}

function getWalletProviderCollisionMessage(): string {
  return 'A browser wallet extension is interfering with sign-in. Disable conflicting wallet extensions, then reload and try again.'
}

function isSessionFinalizingError(error: unknown): boolean {
  const text =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? String((error as { message: string }).message)
      : typeof error === 'string'
        ? error
        : ''
  return text.toLowerCase().includes('session is still finalizing')
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

const RECOVERY_REQUIRED_MESSAGE = 'This email already has a 4626 account. Use existing account sign-in to continue.'
const SESSION_MISMATCH_MESSAGE = 'Signed in as a different account. Click Continue with email to try again.'
const SESSION_FINALIZING_RETRY_MESSAGE = 'Sign-in session is still finalizing. We will keep retrying automatically.'
const STALE_PRIVY_SESSION_MESSAGE = 'Sign-in got stuck in an old session. Tap Continue to retry with a fresh email sign-in.'
const WAITLIST_SPINNER_TIMEOUT_MESSAGE = 'Sign-in is taking longer than expected. Tap Continue to retry.'
const WAITLIST_BUSY_WATCHDOG_MS = 25_000
const TOKENLESS_FINALIZING_BOOTSTRAP_COOLDOWN_MS = 2_500
const RECOVERY_REQUIRED_BOOTSTRAP_COOLDOWN_MS = 15_000
const FINALIZING_BACKGROUND_RETRY_MS = 1_500
const FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS = 5
const PRIVY_LOGOUT_SETTLE_ATTEMPTS = 10
const PRIVY_LOGOUT_SETTLE_DELAY_MS = 150

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
  const progressLabel = hasWaitlistStats
    ? `Waitlist progress ${signedUpCount.toLocaleString()} / ${capacity.toLocaleString()}`
    : null
  const urgencyLabel = hasWaitlistStats
    ? spotsRemaining <= 0
      ? 'Current round full. Next approvals unlock the next batch.'
      : `Only ${spotsRemaining.toLocaleString()} spots remaining!`
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
      className="relative flex min-h-[460px] items-center justify-center py-12 sm:py-20"
    >
      {/* dot grid texture — Base brand pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* film grain overlay */}
      {motionEnabled ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(var(--brand-primary)/0.14),transparent_60%)]"
        />
      )}

      {/* dual ambient glow — app brand blue core + halo */}
      {motionEnabled ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ opacity: [0.18, 0.28, 0.18], scale: [1, 1.04, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute h-64 w-64 rounded-full bg-[rgb(var(--brand-primary)/0.2)] blur-[80px]"
          />
          <motion.div
            animate={{ opacity: [0.08, 0.15, 0.08], scale: [1, 1.08, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute h-96 w-96 rounded-full bg-[rgb(var(--brand-hover)/0.1)] blur-[120px]"
          />
        </div>
      ) : null}

      <div className="relative z-10 w-full max-w-sm space-y-8 text-center">
        {/* headline */}
        <motion.div {...stagger(0)} className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand-primary)/0.8)]">
            Secure onboarding
          </p>
          <h2 className="text-[2.6rem] font-light leading-tight tracking-tight text-white">{authUi.title}</h2>
          {progressLabel ? (
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-zinc-400">{progressLabel}</p>
          ) : null}
        </motion.div>

        {/* Referral greeting — only renders when a code is present and resolves. */}
        {referralCode ? (
          <motion.div {...stagger(0)} className="text-left">
            <ReferrerGreetingBanner referralCode={referralCode} />
          </motion.div>
        ) : null}

        {/* CTA — uses the refined btn-accent base; full width on this
            hero surface. We only hard-`disabled` the button while the
            user's action is actively processing (`busy`). During Privy
            boot (`!privyReady`), we keep the button at full brightness
            and block interaction via aria-disabled + a click guard —
            that way the hero reads as intentional, not grayed out.

            Busy content uses PixelWaveLoader (not the CDS Spinner wrapper)
            so the button stays at its canonical 42px height instead of
            being stretched by an opinionated spinner container. */}
        <motion.div {...stagger(1)} className="space-y-3">
          <button
            type="button"
            disabled={busy}
            aria-disabled={buttonsDisabled}
            onClick={() => {
              if (buttonsDisabled) return
              void onContinueAuth()
            }}
            className="btn-accent btn-no-icon w-full"
          >
            {busy || !privyReady ? (
              <span className="inline-flex items-center gap-2 text-[13.5px] font-medium text-white/90">
                <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.92)" />
                <span>{busy ? authUi.busyLabel : 'Loading secure sign-in…'}</span>
              </span>
            ) : (
              authUi.ctaLabel
            )}
          </button>
          {urgencyLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {urgencyLabel}
            </p>
          ) : null}
        </motion.div>

        {/* error */}
        {error ? (
          <motion.div
            {...stagger(2)}
            role="alert"
            aria-live="polite"
            className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-left text-sm text-blue-200"
          >
            <div>{error}</div>
            {recoveryRequired ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRecoverAccount()}
                className="inline-flex items-center rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
              >
                Try existing account sign-in
              </button>
            ) : null}
          </motion.div>
        ) : null}
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

  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<WaitlistStep>('auth')
  const [subAccountStepCompletedAccountKey, setSubAccountStepCompletedAccountKey] = useState<string | null>(null)
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

  useEffect(() => {
    const setup = (searchParams.get('setup') ?? '').trim().toLowerCase()
    if (setup !== 'base-app' || !subAccountFlowEnabled) return
    if (!account?.emailVerified) return
    setStep('connect-base-app')
  }, [account?.emailVerified, searchParams, subAccountFlowEnabled])

  const authBootstrapAutoAttemptedRef = useRef(false)
  const finalizingAutoRetryCountRef = useRef(0)
  const finalizingBackgroundRetryCountRef = useRef(0)
  const tokenlessFinalizingBootstrapCooldownUntilRef = useRef(0)
  const recoveryRequiredBootstrapCooldownUntilRef = useRef(0)
  const bootstrapRequestSeqRef = useRef(0)
  const bootstrapInFlightPromiseRef = useRef<Promise<AccountsSummary | null> | null>(null)
  const privyLogoutRef = useRef<null | (() => Promise<void>)>(null)
  const privyAuthedRef = useRef(privyAuthed)
  const privyClientStatusRef = useRef(privyClientStatus)

  const wrapClass = 'mx-auto w-full max-w-5xl'
  const activeReferralCode = useMemo(() => readStoredWaitlistReferralCode(), [])
  const enterAppUrl = useMemo(() => buildAppEntryUrl(getAppBaseUrl()), [])
  const accountsUrl = useMemo(() => buildAppEntryUrl(getAppBaseUrl(), '/accounts'), [])
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

  const runBootstrap = useCallback(
    async (opts?: {
      waitForTokenHydration?: boolean
      bypassRecoveryCooldown?: boolean
    }): Promise<AccountsSummary | null> => {
      let bootstrappedCanonicalWallet: OnboardingBootstrapResponse | null = null
      let embeddedEoaAddressForStep = embeddedEoaAddress
      const waitForTokenHydration = opts?.waitForTokenHydration === true
      const bypassRecoveryCooldown = opts?.bypassRecoveryCooldown === true
      const recoveryCooldownActive = recoveryRequiredBootstrapCooldownUntilRef.current > Date.now()
      if (!bypassRecoveryCooldown && recoveryCooldownActive) {
        setStep('auth')
        setRecoveryRequired(true)
        const err = new Error(RECOVERY_REQUIRED_MESSAGE) as Error & { recoveryRequired?: boolean; code?: string }
        err.recoveryRequired = true
        err.code = 'RECOVERY_REQUIRED_EMAIL_BOUND'
        throw err
      }

      const readPrivyToken = async (): Promise<string | null> => {
        try {
          return await withTimeout(getAccessToken(), FLOW_TIMEOUT_MS, 'Sign-in token')
        } catch (tokenError: unknown) {
          if (isWalletProviderCollisionError(tokenError)) {
            throw new Error(getWalletProviderCollisionMessage())
          }
          return null
        }
      }

      let token = await readPrivyToken()
      if (!token && waitForTokenHydration) {
        const tokenRetryDelaysMs = [250, 500, 900]
        for (const delayMs of tokenRetryDelaysMs) {
          if (token) break
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
          token = await readPrivyToken()
        }
      }

      if (!token) {
        setStep('auth')
        throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
      }

      if (tokenlessFinalizingBootstrapCooldownUntilRef.current > Date.now()) {
        setStep('auth')
        throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['X-Privy-Token'] = token
        try {
          let canonicalization = await withTimeout(
            runCanonicalizationPipeline({
              privyToken: token,
            }),
            FLOW_TIMEOUT_MS,
            'Account sync',
          )
          if (!canonicalization.onboardingBootstrapped && canonicalization.flags.needsEmbeddedWallet) {
            const embeddedWallet = await withTimeout(ensureEmbeddedWallet(), FLOW_TIMEOUT_MS, 'Embedded wallet provisioning')
            embeddedEoaAddressForStep = embeddedWallet.address
            canonicalization = await withTimeout(
              runCanonicalizationPipeline({
                privyToken: token,
              }),
              FLOW_TIMEOUT_MS,
              'Account sync',
            )
          }
          if (canonicalization.onboardingBootstrapped && canonicalization.onboarding) {
            bootstrappedCanonicalWallet = canonicalization.onboarding
          }
        } catch (canonicalizationError: unknown) {
          if (isRecoveryRequiredAuthError(canonicalizationError)) throw canonicalizationError
        }
      }

      const response = await withTimeout(
        apiFetch('/api/waitlist/bootstrap', {
          method: 'POST',
          headers,
          body: JSON.stringify(activeReferralCode ? { referralCode: activeReferralCode } : {}),
        }),
        FLOW_TIMEOUT_MS,
        'Waitlist bootstrap',
      )
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        const err = new Error(readApiErrorMessage(payload, 'Failed to bootstrap waitlist state.')) as Error & {
          status?: number
          code?: string
          recoveryRequired?: boolean
        }
        err.status = response.status
        const code = typeof (payload as any)?.code === 'string' ? String((payload as any).code).trim() : ''
        if (code) err.code = code
        const nextRecoveryRequired =
          response.status === 409 || Boolean((payload as any)?.recoveryRequired) || code.toUpperCase().includes('RECOVERY_REQUIRED')
        if (nextRecoveryRequired) err.recoveryRequired = true
        if (nextRecoveryRequired) {
          recoveryRequiredBootstrapCooldownUntilRef.current = Date.now() + RECOVERY_REQUIRED_BOOTSTRAP_COOLDOWN_MS
        }
        throw err
      }

      if (payload.data.requiresPrivyAuth) {
        tokenlessFinalizingBootstrapCooldownUntilRef.current = Date.now() + TOKENLESS_FINALIZING_BOOTSTRAP_COOLDOWN_MS
        setStep('auth')
        if (privyAuthed) {
          throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
        }
        return null
      }

      const nextAccount = mergeCanonicalWaitlistAccount(payload.data, bootstrappedCanonicalWallet)
      setAccount(nextAccount)
      finalizingAutoRetryCountRef.current = 0
      finalizingBackgroundRetryCountRef.current = 0
      tokenlessFinalizingBootstrapCooldownUntilRef.current = 0
      recoveryRequiredBootstrapCooldownUntilRef.current = 0
      setRecoveryRequired(false)
      if (activeReferralCode) clearStoredWaitlistReferralCode()
      if (!nextAccount.emailVerified) {
        setStep('auth')
        setError('Verify your email with 4626 to finish creating this account.')
        return nextAccount
      }
      // Track C2 requires the actual Privy embedded EOA signer. Linked
      // external wallets can also hydrate on `privy.user.wallet`, so only
      // trust the embedded-wallet helper used by the signer setup path.
      const accountCompletionKey = getSubAccountCompletionAccountKey(nextAccount)
      const embeddedEoaAvailable = Boolean(embeddedEoaAddressForStep)
      const subAccountStepCompleted = Boolean(
        accountCompletionKey && subAccountStepCompletedAccountKey === accountCompletionKey,
      )
      setStep(
        resolveWaitlistStep({
          account: nextAccount,
          subAccountFlowEnabled,
          embeddedEoaAvailable,
          subAccountStepCompleted,
        }),
      )
      return nextAccount
    },
    [
      activeReferralCode,
      embeddedEoaAddress,
      ensureEmbeddedWallet,
      getAccessToken,
      privyAuthed,
      setError,
      setRecoveryRequired,
      subAccountFlowEnabled,
      subAccountStepCompletedAccountKey,
    ],
  )

  const requestBootstrap = useCallback(
    (opts?: {
      waitForTokenHydration?: boolean
      forceNew?: boolean
      bypassRecoveryCooldown?: boolean
    }): Promise<AccountsSummary | null> => {
      if (!opts?.forceNew && bootstrapInFlightPromiseRef.current) {
        return bootstrapInFlightPromiseRef.current
      }
      const requestSeq = ++bootstrapRequestSeqRef.current
      const managedPromise = runBootstrap({
        waitForTokenHydration: opts?.waitForTokenHydration === true,
        bypassRecoveryCooldown: opts?.bypassRecoveryCooldown === true,
      }).finally(() => {
        if (bootstrapRequestSeqRef.current === requestSeq) {
          bootstrapInFlightPromiseRef.current = null
        }
      })
      bootstrapInFlightPromiseRef.current = managedPromise
      return managedPromise
    },
    [runBootstrap],
  )

  const settleBootstrapAfterRecoverableLoginError = useCallback(
    async (opts?: { bypassRecoveryCooldown?: boolean }): Promise<AccountsSummary> => {
      const retryDelaysMs = [300, 600, 900, 1_200]
      finalizingAutoRetryCountRef.current = 0
      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        finalizingAutoRetryCountRef.current = attempt + 1
        try {
          const next = await requestBootstrap({
            waitForTokenHydration: true,
            bypassRecoveryCooldown: opts?.bypassRecoveryCooldown === true,
          })
          if (next) {
            finalizingAutoRetryCountRef.current = 0
            return next
          }
        } catch (bootstrapError: unknown) {
          if (!isSessionFinalizingError(bootstrapError)) throw bootstrapError
        }
        const delayMs = retryDelaysMs[attempt]
        if (typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
        }
      }

      throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
    },
    [requestBootstrap],
  )

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

    let target = accountsUrl
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
  }, [accountsUrl, getAccessToken, login])

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
    resetStalePrivySessionAndRetryEmailLogin,
    redirectToCanonicalWaitlist,
    settleBootstrapAfterRecoverableLoginError,
    setError,
    setRecoveryRequired,
    tryResumeExistingPrivySession,
  ])

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
    redirectToCanonicalWaitlist,
    setError,
    setRecoveryRequired,
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

  const handleSubAccountSkip = useCallback(() => {
    setSubAccountStepCompletedAccountKey(getSubAccountCompletionAccountKey(account))
    setStep('done')
  }, [account])

  const handleSubAccountComplete = useCallback(() => {
    setSubAccountStepCompletedAccountKey(getSubAccountCompletionAccountKey(account))
    setStep('done')
    void requestBootstrap({ forceNew: true }).catch(() => null)
  }, [account, requestBootstrap])

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
  }, [setBusy, setRecoveryRequired, step])

  const authUi = deriveWaitlistAuthUi()
  const authVisibleError = error === SESSION_FINALIZING_RETRY_MESSAGE ? null : error
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
    <section id={sectionId} className={wrapClass}>
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
            <WaitlistConnectBaseApp onSkip={handleSubAccountSkip} onComplete={handleSubAccountComplete} />
          </div>
        ) : step === 'done' && account ? (
          <div key="done-static">
            <WaitlistSetupTray
              account={account}
              canEnterApp={canEnterApp}
              completionBusy={completionBusy}
              onEnterApp={onEnterApp}
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
              <WaitlistConnectBaseApp onSkip={handleSubAccountSkip} onComplete={handleSubAccountComplete} />
            </motion.div>
          ) : step === 'done' && account ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: WAITLIST_EASE }}
            >
              <WaitlistSetupTray
                account={account}
                canEnterApp={canEnterApp}
                completionBusy={completionBusy}
                onEnterApp={onEnterApp}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </section>
  )
}
