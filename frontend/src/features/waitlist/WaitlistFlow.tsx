import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import {
  clearStoredWaitlistReferralCode,
  getMarketingWaitlistEntryUrl,
  readStoredWaitlistReferralCode,
  storeWaitlistReferralCode,
} from '@/lib/auth/waitlistEntry'
import { getAppBaseUrl } from '@/lib/host'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import type { ApiEnvelope, OnboardingBootstrapResponse } from '@/lib/wallet/onboardingWallet'
import { StepIndicator } from '@/components/ui/StepIndicator'
import type { StepStatus } from '@/components/ui/StepIndicator'

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
import {
  type WaitlistDoneUi,
  type WaitlistEmailUi,
  canEnterAppFromAccountState,
  deriveWaitlistAuthUi,
  deriveWaitlistDoneUi,
} from './waitlistFlowUi'

type AccountsSummary = {
  privyUserId: string
  email: string | null
  emailVerified: boolean
  appAccessStatus: string | null
  linkedMethods: Record<string, string[]>
  accountSignals: {
    linked: boolean
    canonicalCswAddress: string | null
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

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

const HANDOFF_QUERY_KEY = 'cv_handoff'
const FLOW_TIMEOUT_MS = 20_000

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

function shortAddress(value: string | null | undefined): string {
  if (!value) return '--'
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
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
  busy: boolean
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  error: string | null
  recoveryRequired: boolean
  onContinueAuth: () => void | Promise<void>
  onRecoverAccount: () => void | Promise<void>
}) {
  const {
    authUi,
    busy,
    privyClientStatus,
    error,
    recoveryRequired,
    onContinueAuth,
    onRecoverAccount,
  } = props

  const privyReady = privyClientStatus === 'ready'
  const buttonsDisabled = busy || !privyReady

  return (
    <motion.div
      key="step-auth"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-white">{authUi.title}</h2>
        <p className="text-sm text-zinc-400">{authUi.subtitle}</p>
      </div>

      <button
        type="button"
        disabled={buttonsDisabled}
        onClick={() => void onContinueAuth()}
        className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {authUi.busyLabel}
          </>
        ) : !privyReady ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin opacity-60" />
            Loading sign-in...
          </>
        ) : (
          authUi.ctaLabel
        )}
      </button>

      {error ? (
        <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <div>{error}</div>
          {recoveryRequired ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRecoverAccount()}
              className="inline-flex items-center rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60"
            >
              Try existing account sign-in
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )
}

function WaitlistDoneStep(props: {
  doneUi: WaitlistDoneUi
  accountCanonicalCswAddress: string | null
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onOpenAccounts: () => void | Promise<void>
}) {
  const { doneUi, accountCanonicalCswAddress, canEnterApp, completionBusy, onEnterApp, onOpenAccounts } = props
  const statusLabel = canEnterApp ? 'App unlocked' : 'Pending app access'
  const helperCopy = canEnterApp
    ? 'We will carry your signed-in session into the app now.'
    : 'Accounts is the right place while approval is pending. You can manage linked identities and points there without hitting an app-access redirect.'
  const iconShellStyle = canEnterApp
    ? {
        background: 'linear-gradient(135deg, rgba(0,52,204,0.42) 0%, rgba(91,168,255,0.22) 100%)',
        border: '1px solid rgba(91,168,255,0.32)',
      }
    : {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(148,163,184,0.06) 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
      }
  const pulseStyle = canEnterApp
    ? { border: '1px solid rgba(91,168,255,0.35)' }
    : { border: '1px solid rgba(255,255,255,0.18)' }
  const primaryButtonClass = canEnterApp
    ? 'btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60'
    : 'w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 border border-white/12 bg-white/5 text-zinc-100 hover:bg-white/8 transition-colors disabled:opacity-60'

  return (
    <motion.div
      key="step-done"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-5"
    >
      <div className="flex flex-col items-center text-center space-y-3 pt-2">
        <motion.div
          className="relative"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.05 }}
        >
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={iconShellStyle}
          >
            <CheckCircle2 className={`h-5 w-5 ${canEnterApp ? 'text-[#7DBCFF]' : 'text-zinc-200'}`} />
          </div>
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={pulseStyle}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
          />
        </motion.div>

        <div className="space-y-1">
          <div className="flex justify-center">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${
                canEnterApp
                  ? 'border border-brand-primary/25 bg-brand-primary/12 text-[#B8D7FF]'
                  : 'border border-white/10 bg-white/6 text-zinc-300'
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{doneUi.title}</h2>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto">{doneUi.subtitle}</p>
          {accountCanonicalCswAddress ? (
            <p className="text-xs text-zinc-500">
              Canonical CSW <span className="font-mono text-zinc-300">{shortAddress(accountCanonicalCswAddress)}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div
          className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
            canEnterApp
              ? 'border-brand-primary/18 bg-brand-primary/[0.07] text-[#C9DEFF]'
              : 'border-white/10 bg-white/[0.03] text-zinc-300'
          }`}
        >
          {helperCopy}
        </div>

        {canEnterApp ? (
          <button
            type="button"
            onClick={() => void onEnterApp()}
            disabled={completionBusy}
            className={primaryButtonClass}
          >
            {completionBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entering App...
              </>
            ) : (
              doneUi.primaryLabel
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onOpenAccounts()}
            disabled={completionBusy}
            className={primaryButtonClass}
          >
            {completionBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening Accounts...
              </>
            ) : (
              doneUi.primaryLabel
            )}
          </button>
        )}

        {doneUi.secondaryLabel ? (
          <button
            type="button"
            onClick={() => void onOpenAccounts()}
            disabled={completionBusy}
            className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded py-1 inline-block"
          >
            {doneUi.secondaryLabel}
          </button>
        ) : null}
      </div>
    </motion.div>
  )
}

export function WaitlistFlow(props: {
  sectionId?: string
}) {
  const sectionId = props.sectionId ?? 'waitlist'

  const privy = usePrivy()
  const privyClientStatus = usePrivyClientStatus()
  const { login } = useLogin({})

  const privyAuthed = privy.authenticated
  const shouldDestroyPrivySession = privyAuthed && privyClientStatus === 'ready'
  const { getAccessToken } = privy
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()

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
  const [completionBusy, setCompletionBusy] = useState(false)
  const [account, setAccount] = useState<AccountsSummary | null>(null)

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

  const wrapClass = 'mx-auto w-full max-w-4xl'
  const innerClass = 'card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 space-y-6'
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
  }, [])

  const runBootstrap = useCallback(
    async (opts?: {
      waitForTokenHydration?: boolean
      bypassRecoveryCooldown?: boolean
    }): Promise<AccountsSummary | null> => {
      let bootstrappedCanonicalWallet: OnboardingBootstrapResponse | null = null
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
            await withTimeout(ensureEmbeddedWallet(), FLOW_TIMEOUT_MS, 'Embedded wallet provisioning')
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
      setStep(resolveWaitlistStep({ account: nextAccount }))
      return nextAccount
    },
    [activeReferralCode, ensureEmbeddedWallet, getAccessToken, privyAuthed, setError, setRecoveryRequired],
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

    await apiFetch('/api/auth/privy', {
      method: 'POST',
      withCredentials: true,
      headers: {
        Authorization: `Bearer ${privyToken}`,
        Accept: 'application/json',
      },
    }).catch(() => null)

    let target = accountsUrl
    if (target.startsWith('http') && typeof window !== 'undefined') {
      try {
        const parsed = new URL(target)
        if (parsed.origin !== window.location.origin) {
          const handoffRes = await apiFetch('/api/auth/handoff/create', {
            method: 'POST',
            withCredentials: true,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ privyToken }),
          }).catch(() => null)
          const handoffJson =
            handoffRes ? ((await handoffRes.json().catch(() => null)) as ApiEnvelope<HandoffCreateResponse> | null) : null
          const handoffCode =
            handoffRes?.ok && handoffJson?.success && typeof handoffJson?.data?.code === 'string'
              ? handoffJson.data.code.trim()
              : ''
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
          await apiFetch('/api/auth/privy', {
            method: 'POST',
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${privyToken}`,
              Accept: 'application/json',
            },
          }).catch(() => null)
        }
      }

      if (target.startsWith('http') && typeof window !== 'undefined') {
        try {
          const parsed = new URL(target)
          if (parsed.origin !== window.location.origin) {
            const handoffRes = await apiFetch('/api/auth/handoff/create', {
              method: 'POST',
              withCredentials: true,
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ privyToken }),
            }).catch(() => null)
            const handoffJson = handoffRes
              ? ((await handoffRes.json().catch(() => null)) as ApiEnvelope<HandoffCreateResponse> | null)
              : null
            const handoffCode =
              handoffRes?.ok && handoffJson?.success && typeof handoffJson?.data?.code === 'string'
                ? handoffJson.data.code.trim()
                : ''
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

  const onOpenAccounts = useCallback(async () => {
    if (completionBusy) return
    setCompletionBusy(true)
    try {
      await navigateWithSessionHandoff(accountsUrl)
    } finally {
      setCompletionBusy(false)
    }
  }, [accountsUrl, completionBusy, navigateWithSessionHandoff])

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
  const canEnterApp = canEnterAppFromAccountState({
    appAccessStatus: account?.appAccessStatus ?? null,
  })
  const doneUi = deriveWaitlistDoneUi(canEnterApp)

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

  const indicatorSteps = [
    { label: 'Sign in', status: (step === 'auth' ? 'active' : 'complete') as StepStatus },
    { label: 'Finish setup', status: (step === 'auth' ? 'pending' : 'complete') as StepStatus },
  ]

  return (
    <section id={sectionId} className={wrapClass}>
      <div className={innerClass}>
        <StepIndicator steps={indicatorSteps} />

        {step === 'auth' ? (
          <WaitlistAuthStep
            authUi={authUi}
            busy={busy}
            privyClientStatus={privyClientStatus}
            error={error}
            recoveryRequired={recoveryRequired}
            onContinueAuth={onContinueAuth}
            onRecoverAccount={onRecoverAccount}
          />
        ) : null}

        {step === 'done' ? (
          <WaitlistDoneStep
            doneUi={doneUi}
            accountCanonicalCswAddress={account?.accountSignals?.canonicalCswAddress ?? null}
            canEnterApp={canEnterApp}
            completionBusy={completionBusy}
            onEnterApp={onEnterApp}
            onOpenAccounts={onOpenAccounts}
          />
        ) : null}
      </div>
    </section>
  )
}
