import { useCallback, useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'

import { useWaitlistBootstrap } from './useWaitlistBootstrap'

import { createStaleSessionProbe, withSessionRepairTimeout } from '@/lib/auth/sessionRepair'
import {
  getMarketingWaitlistEntryUrl,
  isOnCanonicalMarketingWaitlistPage as isOnCanonicalMarketingWaitlistPageFn,
  isWaitlistStartAuthSearchParam,
  readStoredWaitlistReferralCode,
  WAITLIST_START_AUTH_QUERY_KEY,
} from '@/lib/auth/waitlistEntry'
import {
  RECOVERY_REQUIRED_MESSAGE,
  RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE,
  SESSION_MISMATCH_MESSAGE,
  STALE_PRIVY_SESSION_MESSAGE,
  WAITLIST_STALE_SESSION_RESET_MESSAGE,
  FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS,
  FINALIZING_BACKGROUND_RETRY_MS,
  FLOW_TIMEOUT_MS,
  getSignInNetworkUnstableMessage,
  getWalletProviderCollisionMessage as getWalletProviderCollisionMessageDefault,
  getWaitlistNetworkUnstableMessage,
  isPrivyLoginBootstrapError,
  isSessionFinalizingError,
  isStalePrivyTokenError,
  isTimeoutErrorMessage,
  isTransientWaitlistNetworkError,
  isWalletProviderCollisionError as isWalletProviderCollisionErrorDefault,
  runPrivyLoginWithTimeout,
} from './waitlistBootstrapUtils'
import {
  isAlreadyLoggedInAuthError as isAlreadyLoggedInAuthErrorDefault,
  clearStoredWaitlistSessionToken as clearStoredWaitlistSessionTokenDefault,
  runWaitlistPrivyLogout as runWaitlistPrivyLogoutFn,
} from './waitlistAuthState'

import {
  clearWaitlistAuthPending,
  writeWaitlistAuthPending,
  writeWaitlistRecoveryGate,
  clearWaitlistRecoveryGate,
  clearStoredWaitlistVerifiedEmailHint as clearStoredWaitlistVerifiedEmailHintFromStorage,
  captureWaitlistVerifiedEmailHint,
  resolveWaitlistVerifiedEmailHint,
} from './waitlistStorage'
import { isRecoveryRequiredAuthError } from './waitlistAuthState'

import { bridgePrivySession as bridgePrivySessionFn, createAuthHandoffCode as createAuthHandoffCodeFn } from './waitlistHandoff'
import { buildWaitlistEmailLoginOptions, buildWaitlistRecoveryLoginOptions } from './waitlistLoginOptions'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { getAppBaseUrl } from '@/lib/env/host'

const DEFAULT_STALE_PRIVY_SESSION_MESSAGE =
  'Sign-in session expired. Tap Use existing account to sign in again with email.'
const NOOP_SET_STEP = (_step: unknown) => {}
const NOOP_CALLBACK = () => {}
const FINALIZING_STUCK_MESSAGE =
  'Sign-in is taking longer than expected. Retries continue automatically; tap Retry now or Continue to nudge, or sign out to restart.'
const FINALIZING_LOGIN_INCOMPLETE_MESSAGE =
  'Email sign-in did not complete. Request a fresh code and try again.'

/**
 * Extracted state + guards for waitlist auth flow.
 * Owns the attempt state machine pieces that were previously duplicated across
 * many refs and manual checks in WaitlistFlow.
 *
 * This reduces the surface area of the giant component. Can grow to own more
 * (e.g. cooldowns, probe, phase) as we iterate.
 */
export function useWaitlistAuthState(params?: {
  activeReferralCode?: string | null
  ensureEmbeddedWallet?: () => Promise<{ address: string }>
  getVerifiedEmailHint?: () => string | null
  setStep?: (s: any) => void
  disableAggressiveSessionReset?: boolean
  shouldDestroyPrivySession?: boolean
  requestBootstrap?: (opts?: any) => Promise<any>
  resetBootstrapCooldowns?: () => void
  tokenlessFinalizingBootstrapCooldownUntilRef?: { current: number }
  account?: any
  step?: any
  privyClientStatus?: string
  login?: any
  clearStoredWaitlistSessionToken?: () => void
  onEnterApp?: () => Promise<void>
  onTryDifferentEmail?: () => Promise<void>
}) {
  const PRIVY_LOGOUT_SETTLE_ATTEMPTS = 10
  const PRIVY_LOGOUT_SETTLE_DELAY_MS = 150
  const withTimeout = withSessionRepairTimeout

  // ALL hooks MUST be at the very top before any other statements (no TDZ for their results).
  const [internalSearchParams, internalSetSearchParams] = useSearchParams()
  const internalPrivy = usePrivy()
  const { login: internalLogin } = useLogin()

  // Default redirect impl inside hook (no need to pass from component).
  const redirectToCanonicalFallback = useCallback(() => {
    if (typeof window === 'undefined') return false
    const localHost = (window.location?.hostname ?? '').toLowerCase()
    if (localHost === 'localhost' || localHost === '127.0.0.1' || localHost === '::1' || localHost === '[::1]') {
      return false
    }
    let target = getMarketingWaitlistEntryUrl()
    try {
      const currentUrl = new URL(window.location.href)
      const targetUrl = new URL(target)
      const PRIVY_OAUTH_QUERY_KEYS = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'] as const
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
  const redirectToCanonical = params?.redirectToCanonicalWaitlist ?? redirectToCanonicalFallback

  // Now safe to derive from hooks + params.
  const privyAuthed = params?.privyAuthed ?? internalPrivy.authenticated
  const ensureEmbeddedWallet = params?.ensureEmbeddedWallet || (async () => ({ address: '' }))
  const getVerifiedEmailHint = params?.getVerifiedEmailHint || (() => resolveWaitlistVerifiedEmailHint(internalPrivy.user))
  const setStep = params?.setStep ?? NOOP_SET_STEP
  const getAccessToken = params?.getAccessToken || internalPrivy.getAccessToken
  const disableAggressive = params?.disableAggressiveSessionReset ?? (() => {
    if (typeof window === 'undefined') return false
    const maybeTelegram = (window as any)?.Telegram?.WebApp
    if (maybeTelegram) return true
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent.toLowerCase()
    return ua.includes('telegram')
  })()
  const shouldDestroy = params?.shouldDestroyPrivySession ?? false
  const privy = params?.privy || internalPrivy
  const runLogout = params?.runWaitlistPrivyLogout || runWaitlistPrivyLogoutFn
  const login = params?.login || internalLogin
  const getNetworkMsg = getWaitlistNetworkUnstableMessage
  const requestBootstrap = params?.requestBootstrap
  const resetBootstrapCooldowns = params?.resetBootstrapCooldowns ?? NOOP_CALLBACK
  const localTokenlessFinalizingBootstrapCooldownUntilRef = useRef(0)
  const tokenlessFinalizingBootstrapCooldownUntilRef =
    params?.tokenlessFinalizingBootstrapCooldownUntilRef ??
    localTokenlessFinalizingBootstrapCooldownUntilRef
  const step = params?.step
  const privyClientStatus = params?.privyClientStatus
  const isWalletProviderCollisionError =
    params?.isWalletProviderCollisionError || isWalletProviderCollisionErrorDefault
  const getWalletProviderCollisionMessage =
    params?.getWalletProviderCollisionMessage || getWalletProviderCollisionMessageDefault
  const isAlreadyLoggedInAuthError =
    params?.isAlreadyLoggedInAuthError || isAlreadyLoggedInAuthErrorDefault
  const clearStoredWaitlistSessionToken =
    params?.clearStoredWaitlistSessionToken || clearStoredWaitlistSessionTokenDefault
  const isOnCanonicalMarketingWaitlistPage = params?.isOnCanonicalMarketingWaitlistPage || isOnCanonicalMarketingWaitlistPageFn
  const waitlistRecoveryUrl = params?.waitlistRecoveryUrl ?? getMarketingWaitlistEntryUrl()
  const HANDOFF_QUERY_KEY = params?.HANDOFF_QUERY_KEY ?? 'cv_handoff'
  const clearStoredWaitlistVerifiedEmailHint =
    params?.clearStoredWaitlistVerifiedEmailHint || clearStoredWaitlistVerifiedEmailHintFromStorage
  const STALE_PRIVY_SESSION_MESSAGE =
    params?.STALE_PRIVY_SESSION_MESSAGE ?? DEFAULT_STALE_PRIVY_SESSION_MESSAGE

  // Always have a referral value (pure read; no need to pass from component)
  const activeReferralCode = params?.activeReferralCode ?? readStoredWaitlistReferralCode()
  const isLoopbackHost = (host: string): boolean =>
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'

  // search/clear with internal fallback so component doesn't need to pass router state
  const searchParams = params?.searchParams || internalSearchParams
  const setSearchParams = params?.setSearchParams || internalSetSearchParams
  const clearStartAuthDeepLinkInternal = useCallback(() => {
    if (!isWaitlistStartAuthSearchParam(searchParams.get(WAITLIST_START_AUTH_QUERY_KEY))) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete(WAITLIST_START_AUTH_QUERY_KEY)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])
  const clearStartAuthDeepLink = params?.clearStartAuthDeepLink ?? clearStartAuthDeepLinkInternal

  // Use direct imports for self-contained handoff + login option logic (reduces param surface)
  const bridgePrivySession = bridgePrivySessionFn
  const createAuthHandoffCode = createAuthHandoffCodeFn
  const enterAppUrl = buildAppEntryUrl(getAppBaseUrl())

  // Core UI states owned here (centralized from component) — declared early to avoid TDZ
  // when passed into useWaitlistBootstrap and early callbacks.
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryRequired, setRecoveryRequired] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [completionBusy, setCompletionBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [sessionRepairBusy, setSessionRepairBusy] = useState(false)
  const [account, setAccount] = useState<any>(null)
  const authAttemptInFlightRef = useRef(false)
  const attemptInFlightRef = authAttemptInFlightRef
  const authBootstrapAutoAttemptedRef = useRef(false)
  const privyAuthedBootstrapAttemptedRef = useRef(false)
  const recoveryHandoffInFlightRef = useRef(false)
  const pendingAuthResumeStartedRef = useRef(false)
  const loginStartedWhileLoggedOutRef = useRef(false)
  const loginAwaitInProgressRef = useRef(false)
  const startAuthAutoAttemptedRef = useRef(false)
  const finalizingAutoRetryCountRef = useRef(0)
  const finalizingBackgroundRetryCountRef = useRef(0)
  const finalizingBgTimerRef = useRef<number | null>(null)
  const finalizingRetryExhaustedRef = useRef(false)
  const privyAuthedRef = useRef(privyAuthed)
  const privyClientStatusRef = useRef<'disabled' | 'loading' | 'ready'>('loading')

  const waitForPrivyLogoutSettlement = useCallback(async (opts?: { tokenOnly?: boolean }): Promise<void> => {
    const maxAttempts = PRIVY_LOGOUT_SETTLE_ATTEMPTS || 10
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const token = getAccessToken ? await getAccessToken().catch(() => null) : null
      const tokenMissing = !token
      const authCleared = privyAuthedRef.current === false
      const clientNotReady = privyClientStatusRef.current !== 'ready'
      if (tokenMissing && (opts?.tokenOnly === true || authCleared || clientNotReady)) return
      await new Promise<void>((resolve) => setTimeout(resolve, PRIVY_LOGOUT_SETTLE_DELAY_MS || 150))
    }
    throw new Error(STALE_PRIVY_SESSION_MESSAGE)
  }, [getAccessToken, STALE_PRIVY_SESSION_MESSAGE])

  // Bootstrap encapsulated inside the auth controller for simplification
  const bootstrap = useWaitlistBootstrap({
    activeReferralCode,
    ensureEmbeddedWallet,
    getAccessToken: getAccessToken || (async () => null),
    getVerifiedEmailHint,
    privyAuthed,
    setAccount,
    setStep,
    setError,
    setRecoveryRequired,
    finalizingAutoRetryCountRef,
    finalizingBackgroundRetryCountRef,
  })

  const {
    requestBootstrap: requestFromBootstrap,
    settleBootstrapAfterRecoverableLoginError: settleFromBootstrap,
    resetBootstrapCooldowns: resetFromBootstrap,
    tokenlessFinalizingBootstrapCooldownUntilRef: tokenlessFromBootstrap,
    recoveryRequiredBootstrapCooldownUntilRef: recoveryFromBootstrap,
  } = bootstrap
  const settle = settleFromBootstrap
  const recoveryRequiredBootstrapCooldownUntilRef = recoveryFromBootstrap
  const recoveryCooldownRef = recoveryFromBootstrap

  // Internal helpers defined here using passed deps (for simplification, no local in component)
  const tryResumeExistingPrivySession = useCallback(async (): Promise<boolean> => {
    const existingToken = getAccessToken ? await getAccessToken().catch(() => null) : null
    if (!existingToken) return false
    if (settleFromBootstrap) await settleFromBootstrap({ bypassRecoveryCooldown: true })
    return true
  }, [getAccessToken, settleFromBootstrap])

  const resetStalePrivySessionAndRetryEmailLogin = useCallback(async (): Promise<void> => {
    if (runLogout && privy) {
      await runLogout({
        logout: async () => {
          await privy.logout().catch(() => null)
        },
        shouldLogout: true,
      })
    }
    await waitForPrivyLogoutSettlement()
    try {
      if (login && buildWaitlistEmailLoginOptions) {
        await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, buildWaitlistEmailLoginOptions() as any)
      }
      const next = requestFromBootstrap ? await requestFromBootstrap({ forceNew: true, waitForTokenHydration: true, bypassRecoveryCooldown: true }) : null
      if (!next) {
        throw new Error(STALE_PRIVY_SESSION_MESSAGE)
      }
    } catch (error: unknown) {
      if (isSessionFinalizingError(error)) {
        throw new Error(STALE_PRIVY_SESSION_MESSAGE)
      }
      throw error
    }
  }, [
    runLogout,
    privy,
    login,
    requestFromBootstrap,
    waitForPrivyLogoutSettlement,
    STALE_PRIVY_SESSION_MESSAGE,
  ])

  const handoffIntoExistingAccount = useCallback(async (): Promise<void> => {
    if (runLogout && privy) {
      await runLogout({
        logout: async () => {
          await privy.logout().catch(() => null)
        },
        shouldLogout: true,
      })
    }
    await waitForPrivyLogoutSettlement({ tokenOnly: true })

    // runRecovery logic inline
    const recoveryOptions = buildWaitlistRecoveryLoginOptions ? buildWaitlistRecoveryLoginOptions() : {}
    try {
      if (login) {
        await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, recoveryOptions as any)
      }
    } catch (loginError: unknown) {
      if (isWalletProviderCollisionError && isWalletProviderCollisionError(loginError)) {
        throw new Error(getWalletProviderCollisionMessage ? getWalletProviderCollisionMessage() : '')
      }
      if (isAlreadyLoggedInAuthError && !isAlreadyLoggedInAuthError(loginError)) throw loginError
      if (runLogout && privy) {
        await runLogout({ logout: async () => { await privy.logout().catch(() => null) }, shouldLogout: true })
      }
      await waitForPrivyLogoutSettlement({ tokenOnly: true })
      if (login && buildWaitlistRecoveryLoginOptions) {
        await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, recoveryOptions as any)
      }
    }

    const privyToken = getAccessToken ? await getAccessToken().catch(() => null) : null
    if (!privyToken) {
      throw new Error(STALE_PRIVY_SESSION_MESSAGE)
    }

    if (isOnCanonicalMarketingWaitlistPage && isOnCanonicalMarketingWaitlistPage()) {
      setRecoveryRequired(false)
      clearWaitlistRecoveryGate()
      setError(null)
      if (settleFromBootstrap) await settleFromBootstrap({ bypassRecoveryCooldown: true })
      if (bridgePrivySession) await bridgePrivySession(privyToken).catch(() => undefined)
      return
    }

    if (bridgePrivySession) await bridgePrivySession(privyToken)

    let target = waitlistRecoveryUrl || ''
    if (target.startsWith('http') && typeof window !== 'undefined') {
      try {
        const parsed = new URL(target)
        if (parsed.origin !== window.location.origin) {
          if (isLoopbackHost(window.location.hostname.toLowerCase())) {
            target = `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
          } else if (createAuthHandoffCode) {
            const handoffCode = await createAuthHandoffCode({ privyToken })
            if (handoffCode) {
              parsed.searchParams.set(HANDOFF_QUERY_KEY || 'cv_handoff', handoffCode)
              target = parsed.toString()
            }
          }
        }
      } catch {}
      window.location.href = target
      return
    }

    window.location.assign(target)
  }, [
    runLogout,
    privy,
    login,
    isWalletProviderCollisionError,
    getWalletProviderCollisionMessage,
    isAlreadyLoggedInAuthError,
    getAccessToken,
    isOnCanonicalMarketingWaitlistPage,
    setRecoveryRequired,
    settleFromBootstrap,
    bridgePrivySession,
    createAuthHandoffCode,
    waitlistRecoveryUrl,
    HANDOFF_QUERY_KEY,
    waitForPrivyLogoutSettlement,
    STALE_PRIVY_SESSION_MESSAGE,
  ])

  const navigateWithSessionHandoff = useCallback(async (initialTarget: string) => {
    let target = initialTarget
    let privyToken = getAccessToken ? await getAccessToken().catch(() => null) : null
    if (privyAuthed && privyToken && bridgePrivySession) {
      await bridgePrivySession(privyToken)
    }
    if (target.startsWith('http') && typeof window !== 'undefined') {
      try {
        const parsed = new URL(target)
        if (parsed.origin !== window.location.origin) {
          if (isLoopbackHost(window.location.hostname.toLowerCase())) {
            target = `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
          } else if (createAuthHandoffCode) {
            const handoffCode = await createAuthHandoffCode({ privyToken })
            if (handoffCode) {
              parsed.searchParams.set(HANDOFF_QUERY_KEY || 'cv_handoff', handoffCode)
              target = parsed.toString()
            }
          }
        }
      } catch {}
      window.location.href = target
      return
    }
    window.location.assign(target)
  }, [getAccessToken, privyAuthed, bridgePrivySession, createAuthHandoffCode, HANDOFF_QUERY_KEY])

  // Effect to reset when not authed (moved from component)
  useEffect(() => {
    if (privyAuthed) return
    if (!account) return
    setAccount(null)
    if (setStep) setStep('auth')
  }, [account, privyAuthed, setAccount, setStep])

  // Watchdog for busy timeout (moved)
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
      setFinalizing(false)
      setError('Sign-in is taking longer than expected. Retries continue automatically; tap Retry now or Continue to nudge, or sign out to restart.')
    }, 25000)

    return () => window.clearTimeout(timeoutId)
  }, [authAttemptInFlightRef, busy, error, setBusy, setError, step])

  // Transition reset effect (moved)
  useEffect(() => {
    if (privyAuthed) {
      if (!authAttemptInFlightRef.current) {
        privyAuthedBootstrapAttemptedRef.current = false
        authBootstrapAutoAttemptedRef.current = false
      }
      clearWaitlistRecoveryGate()
      setRecoveryRequired(false)
      recoveryRequiredBootstrapCooldownUntilRef.current = 0
    }
  }, [privyAuthed, authAttemptInFlightRef, recoveryRequiredBootstrapCooldownUntilRef, setRecoveryRequired])

  useEffect(() => {
    privyAuthedRef.current = privyAuthed
    if (!privyAuthed) {
      privyAuthedBootstrapAttemptedRef.current = false
    }
  }, [privyAuthed])

  // Drop stale recovery flags on mount so normal email flow is used.
  useEffect(() => {
    clearWaitlistRecoveryGate()
  }, [])

  // Stale probe (moved)
  const staleSessionProbeRef = useRef<any>(null)
  if (!staleSessionProbeRef.current && getAccessToken) {
    staleSessionProbeRef.current = createStaleSessionProbe({
      getToken: getAccessToken,
      hasLiveCookie: () => Boolean(privyAuthedRef.current),
      withTimeout: withSessionRepairTimeout,
    })
  }

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
    setAccount(null)
    if (runLogout && privy) {
      await runLogout({
        logout: async () => {
          await privy.logout().catch(() => null)
        },
        shouldLogout: true,
      })
    }
    setRecoveryRequired(false)
    setError(WAITLIST_STALE_SESSION_RESET_MESSAGE)
  }, [privy, setAccount, runLogout, setError, setRecoveryRequired])

  const resumePendingWaitlistAuth = useCallback(async () => {
    finalizingRetryExhaustedRef.current = false
    clearWaitlistRecoveryGate()
    setRecoveryRequired(false)
    recoveryCooldownRef.current = 0
    try {
      if (settle) {
        await settle({ bypassRecoveryCooldown: true })
      }
      clearWaitlistAuthPending()
    } catch (bootstrapError: unknown) {
      if (isStalePrivyTokenError(bootstrapError)) {
        if (await probeStalePrivyTokenSession()) {
          await resetStaleAuthenticatedPrivySession()
          return
        }
        setFinalizing(true)
        setError(null)
        return
      }
      if (isSessionFinalizingError(bootstrapError)) {
        if (await probeStalePrivyTokenSession()) {
          await resetStaleAuthenticatedPrivySession()
          return
        }
        setFinalizing(true)
        setError(null)
        return
      }
      const message =
        typeof (bootstrapError as { message?: unknown })?.message === 'string'
          ? String((bootstrapError as { message: string }).message)
          : 'Failed to load account state.'
      const isSessionMismatch = (m: string) => m.toLowerCase().includes('email does not match') || m.toLowerCase().includes('session email mismatch')
      const isSessionMismatchErr = isSessionMismatch(message)
      const isRecoveryRequired = isRecoveryRequiredAuthError(bootstrapError)
      if (isSessionMismatchErr) {
        setAccount(null)
      }
      if (isRecoveryRequired) {
        writeWaitlistRecoveryGate(true)
        clearWaitlistAuthPending()
        setRecoveryRequired(true)
        setError(
          privyAuthedRef.current
            ? RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE
            : RECOVERY_REQUIRED_MESSAGE,
        )
        return
      }
      setError(
        isSessionMismatchErr
          ? SESSION_MISMATCH_MESSAGE
          : isTransientWaitlistNetworkError(bootstrapError)
            ? getNetworkMsg()
            : message,
      )
    }
  }, [
    settle,
    probeStalePrivyTokenSession,
    resetStaleAuthenticatedPrivySession,
    setAccount,
    getNetworkMsg,
    setError,
    setRecoveryRequired,
    recoveryCooldownRef,
  ])

  const clearFeedback = useCallback(() => {
    setError(null)
  }, [])

  const beginAttempt = useCallback((): boolean => {
    if (busy || attemptInFlightRef.current) return false
    attemptInFlightRef.current = true
    finalizingRetryExhaustedRef.current = false
    authBootstrapAutoAttemptedRef.current = true
    privyAuthedBootstrapAttemptedRef.current = true
    setBusy(true)
    clearFeedback()
    setRecoveryRequired(false)
    setFinalizing(false)
    writeWaitlistAuthPending(true)
    return true
  }, [busy, clearFeedback, attemptInFlightRef])

  const endAttempt = useCallback(() => {
    attemptInFlightRef.current = false
    setBusy(false)
  }, [attemptInFlightRef])
  const endAuthAttempt = endAttempt

  const beginRecoveryHandoffAttempt = useCallback((): boolean => {
    if (busy || attemptInFlightRef.current || recoveryHandoffInFlightRef.current) return false
    recoveryHandoffInFlightRef.current = true
    attemptInFlightRef.current = true
    finalizingRetryExhaustedRef.current = false
    privyAuthedBootstrapAttemptedRef.current = true
    authBootstrapAutoAttemptedRef.current = true
    setBusy(true)
    setError(null)
    writeWaitlistAuthPending(true)
    return true
  }, [busy, attemptInFlightRef])

  const endRecoveryHandoffAttempt = useCallback(() => {
    recoveryHandoffInFlightRef.current = false
    attemptInFlightRef.current = false
    setBusy(false)
  }, [attemptInFlightRef])

  const setFinalizingState = useCallback((value: boolean) => {
    setFinalizing(value)
    if (value) {
      setError(null)
    }
  }, [])

  const resetAuthAttemptFlags = useCallback(() => {
    authBootstrapAutoAttemptedRef.current = false
    privyAuthedBootstrapAttemptedRef.current = false
    recoveryHandoffInFlightRef.current = false
    pendingAuthResumeStartedRef.current = false
    loginStartedWhileLoggedOutRef.current = false
    loginAwaitInProgressRef.current = false
    startAuthAutoAttemptedRef.current = false
    attemptInFlightRef.current = false
    finalizingRetryExhaustedRef.current = false
  }, [attemptInFlightRef])

  const finalizeRecoveryHandoffError = useCallback(
    (recoverError: unknown) => {
      if (isTransientWaitlistNetworkError(recoverError) && redirectToCanonical()) {
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
    [redirectToCanonical, setError, setRecoveryRequired],
  )

  const onContinueAuth = useCallback(async () => {
    if (recoveryRequired) {
      recoveryCooldownRef.current = 0
      if (!beginRecoveryHandoffAttempt()) return
      try {
        if (handoffIntoExistingAccount) await handoffIntoExistingAccount()
      } catch (authError: unknown) {
        if (finalizeRecoveryHandoffError) finalizeRecoveryHandoffError(authError)
      } finally {
        endRecoveryHandoffAttempt()
      }
      return
    }
    if (!beginAttempt()) return
    privyAuthedBootstrapAttemptedRef.current = true
    authBootstrapAutoAttemptedRef.current = true
    tokenlessFinalizingBootstrapCooldownUntilRef.current = 0
    recoveryCooldownRef.current = 0
    try {
      if (!privyAuthed && privyClientStatus === 'disabled' && redirectToCanonical()) {
        return
      }
      if (!privyAuthed && privyClientStatus === 'loading') {
        setError('Sign-in service is still loading. Please wait a moment and try again.')
        return
      }
      if (privyAuthed) {
        captureWaitlistVerifiedEmailHint(privy.user)
        if (settleFromBootstrap) await settleFromBootstrap({ bypassRecoveryCooldown: true })
      } else {
        if (clearStoredWaitlistSessionToken) clearStoredWaitlistSessionToken()
        if (tryResumeExistingPrivySession && await tryResumeExistingPrivySession()) {
          return
        }
        loginStartedWhileLoggedOutRef.current = true
        loginAwaitInProgressRef.current = true
        try {
          if (login && buildWaitlistEmailLoginOptions) await runPrivyLoginWithTimeout(login as (options?: unknown) => Promise<unknown>, buildWaitlistEmailLoginOptions() as any)
          loginAwaitInProgressRef.current = false
          captureWaitlistVerifiedEmailHint(privy.user)
          await new Promise<void>((resolve) => setTimeout(resolve, 120))
          if (settleFromBootstrap) await settleFromBootstrap({ bypassRecoveryCooldown: true })
        } catch (loginError: unknown) {
          if (isWalletProviderCollisionError(loginError)) {
            throw new Error(getWalletProviderCollisionMessage())
          }
          if (!isAlreadyLoggedInAuthError(loginError)) throw loginError
          if (tryResumeExistingPrivySession && await tryResumeExistingPrivySession()) {
            return
          }
          if (resetStalePrivySessionAndRetryEmailLogin) await resetStalePrivySessionAndRetryEmailLogin()
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
        setError(privyAuthedRef.current ? RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE : RECOVERY_REQUIRED_MESSAGE)
        return
      }
      if (isStalePrivyTokenError(authError)) {
        setError(STALE_PRIVY_SESSION_MESSAGE)
        return
      }
      setError(
        isPrivyLoginBootstrapError(authError)
          ? getSignInNetworkUnstableMessage()
          : typeof authError?.message === 'string' ? authError.message : 'Failed to start sign-in.',
      )
    } finally {
      endAttempt()
    }
  }, [
    beginAttempt,
    beginRecoveryHandoffAttempt,
    endAttempt,
    endRecoveryHandoffAttempt,
    finalizeRecoveryHandoffError,
    handoffIntoExistingAccount,
    login,
    privyAuthed,
    privyClientStatus,
    recoveryRequired,
    recoveryCooldownRef,
    resetStalePrivySessionAndRetryEmailLogin,
    redirectToCanonical,
    settleFromBootstrap,
    setError,
    setRecoveryRequired,
    tokenlessFinalizingBootstrapCooldownUntilRef,
    tryResumeExistingPrivySession,
    STALE_PRIVY_SESSION_MESSAGE,
    clearStoredWaitlistSessionToken,
    getWalletProviderCollisionMessage,
    isAlreadyLoggedInAuthError,
    isWalletProviderCollisionError,
    privy.user,
  ])

  const onRecoverAccount = useCallback(async () => {
    if (privyClientStatus === 'disabled' && redirectToCanonical()) {
      return
    }
    if (privyClientStatus === 'loading') {
      setError('Sign-in service is still loading. Please wait a moment and try again.')
      return
    }
    recoveryCooldownRef.current = 0
    if (!beginRecoveryHandoffAttempt()) return
    try {
      if (handoffIntoExistingAccount) await handoffIntoExistingAccount()
    } catch (recoverError: unknown) {
      if (finalizeRecoveryHandoffError) finalizeRecoveryHandoffError(recoverError)
    } finally {
      endRecoveryHandoffAttempt()
    }
  }, [
    beginRecoveryHandoffAttempt,
    endRecoveryHandoffAttempt,
    finalizeRecoveryHandoffError,
    handoffIntoExistingAccount,
    privyClientStatus,
    redirectToCanonical,
    setError,
    recoveryCooldownRef,
  ])

  const onSignOut = useCallback(async () => {
    if (signOutBusy) return
    if (setSignOutBusy) setSignOutBusy(true)
    try {
      if (runLogout && privy) {
        await runLogout({
          logout: async () => {
            await privy.logout().catch(() => null)
          },
          readToken: getAccessToken,
          shouldLogout: privyAuthedRef.current,
        })
      }
      await waitForPrivyLogoutSettlement().catch(() => undefined)
      setAccount(null)
      resetAuthAttemptFlags()
      finalizingAutoRetryCountRef.current = 0
      finalizingBackgroundRetryCountRef.current = 0
      if (finalizingBgTimerRef.current) {
        window.clearTimeout(finalizingBgTimerRef.current)
        finalizingBgTimerRef.current = null
      }
      if (resetBootstrapCooldowns) resetBootstrapCooldowns()
      clearWaitlistRecoveryGate()
      clearWaitlistAuthPending()
      clearStoredWaitlistVerifiedEmailHint()
      if (setStep) setStep('auth')
      setBusy(false)
      setRecoveryRequired(false)
      setFinalizing(false)
      setError(null)
    } catch {
      setError('Could not fully sign out. Please retry.')
    } finally {
      if (setSignOutBusy) setSignOutBusy(false)
    }
  }, [
    getAccessToken,
    privy,
    setAccount,
    resetAuthAttemptFlags,
    resetBootstrapCooldowns,
    runLogout,
    setBusy,
    setError,
    setRecoveryRequired,
    setFinalizing,
    setSignOutBusy,
    signOutBusy,
    clearStoredWaitlistVerifiedEmailHint,
    setStep,
    waitForPrivyLogoutSettlement,
  ])

  const onRepairSession = useCallback(async (): Promise<boolean> => {
    if (sessionRepairBusy) return false
    if (setSessionRepairBusy) setSessionRepairBusy(true)
    try {
      const token = getAccessToken ? await withTimeout(getAccessToken(), 4_000, 'Session refresh token').catch(() => null) : null
      if (!token) {
        const hasLiveCookie = privyAuthedRef.current
        console.info('[auth-repair]', { surface: 'waitlist', transition: 'repair-token-miss', outcome: hasLiveCookie ? 'transient' : 'true-stale' })
        if (!hasLiveCookie && setStep) setStep('auth')
        return false
      }
      console.info('[auth-repair]', { surface: 'waitlist', transition: 'bridging' })
      if (bridgePrivySession) await withTimeout(bridgePrivySession(token), 6_000, 'Session bridge refresh').catch(() => undefined)
      const next = requestFromBootstrap ? await withTimeout(requestFromBootstrap({ waitForTokenHydration: true }), 12_000, 'Session bootstrap refresh') : null
      if (!next) {
        console.info('[auth-repair]', { surface: 'waitlist', transition: 'repaired', outcome: 'repaired' })
        setError(null)
        return true
      }
      console.info('[auth-repair]', { surface: 'waitlist', transition: 'repaired', outcome: 'repaired' })
      setRecoveryRequired(false)
      setError(null)
      return true
    } catch (repairError: unknown) {
      if (isSessionFinalizingError(repairError) || isStalePrivyTokenError(repairError)) {
        console.info('[auth-repair]', { surface: 'waitlist', transition: 'bridge-error', outcome: 'transient' })
        setFinalizing(true)
        setError(null)
      } else if (isTimeoutErrorMessage((repairError as { message?: unknown })?.message)) {
        console.info('[auth-repair]', { surface: 'waitlist', transition: 'bridge-timeout', outcome: 'transient' })
        setError('Session refresh timed out. Tap Refresh session once more.')
      }
      return false
    } finally {
      if (setSessionRepairBusy) setSessionRepairBusy(false)
    }
  }, [
    getAccessToken,
    requestFromBootstrap,
    sessionRepairBusy,
    setError,
    setRecoveryRequired,
    setFinalizing,
    setSessionRepairBusy,
    bridgePrivySession,
    setStep,
    withTimeout,
  ])

  // Reset on step change (moved below callback declarations for exhaustive-deps correctness)
  useEffect(() => {
    if (step !== 'auth') {
      resetAuthAttemptFlags()
      finalizingAutoRetryCountRef.current = 0
      finalizingBackgroundRetryCountRef.current = 0
      finalizingRetryExhaustedRef.current = false
      if (finalizingBgTimerRef.current) {
        window.clearTimeout(finalizingBgTimerRef.current)
        finalizingBgTimerRef.current = null
      }
      tokenlessFinalizingBootstrapCooldownUntilRef.current = 0
      recoveryRequiredBootstrapCooldownUntilRef.current = 0
      setBusy(false)
      setRecoveryRequired(false)
      setFinalizing(false)
      setError(null)
    }
  }, [
    recoveryRequiredBootstrapCooldownUntilRef,
    setBusy,
    setRecoveryRequired,
    setError,
    setFinalizing,
    step,
    tokenlessFinalizingBootstrapCooldownUntilRef,
    resetAuthAttemptFlags,
  ])

  // Finalizing background retry effect (moved below callback declarations for exhaustive-deps correctness)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!finalizing) return
    if (busy) return
    if (authAttemptInFlightRef.current) return

    if (finalizingBgTimerRef.current) {
      window.clearTimeout(finalizingBgTimerRef.current)
      finalizingBgTimerRef.current = null
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const exhaustFinalizingRetries = (message: string) => {
          finalizingRetryExhaustedRef.current = true
          clearWaitlistAuthPending()
          setFinalizing(false)
          setError(message)
        }
        try {
          const next = requestBootstrap ? await requestBootstrap({ waitForTokenHydration: true }) : null
          if (cancelled) return
          if (next) {
            finalizingBackgroundRetryCountRef.current = 0
            finalizingRetryExhaustedRef.current = false
            setFinalizing(false)
            setError(null)
          } else {
            finalizingBackgroundRetryCountRef.current += 1
            const retries = finalizingBackgroundRetryCountRef.current
            if (!privyAuthedRef.current && retries >= 3) {
              exhaustFinalizingRetries(FINALIZING_LOGIN_INCOMPLETE_MESSAGE)
            } else if (retries >= FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS) {
              exhaustFinalizingRetries(FINALIZING_STUCK_MESSAGE)
            } else {
              finalizingRetryExhaustedRef.current = false
              setFinalizing(true)
              setError(null)
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
            const retries = finalizingBackgroundRetryCountRef.current
            if (!privyAuthedRef.current && retries >= 3) {
              exhaustFinalizingRetries(FINALIZING_LOGIN_INCOMPLETE_MESSAGE)
              return
            }
            if (retries >= FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS) {
              exhaustFinalizingRetries(FINALIZING_STUCK_MESSAGE)
              return
            }
            finalizingRetryExhaustedRef.current = false
            setFinalizing(true)
            setError(null)
            return
          }
          if (isSessionFinalizingError(bootstrapError)) {
            if (await probeStalePrivyTokenSession()) {
              await resetStaleAuthenticatedPrivySession()
              return
            }
            finalizingBackgroundRetryCountRef.current += 1
            const retries = finalizingBackgroundRetryCountRef.current
            if (!privyAuthedRef.current && retries >= 3) {
              exhaustFinalizingRetries(FINALIZING_LOGIN_INCOMPLETE_MESSAGE)
              return
            }
            if (retries >= FINALIZING_BACKGROUND_RETRY_MAX_ATTEMPTS) {
              exhaustFinalizingRetries(FINALIZING_STUCK_MESSAGE)
              return
            }
            finalizingRetryExhaustedRef.current = false
            setFinalizing(true)
            setError(null)
            return
          }

          finalizingBackgroundRetryCountRef.current = 0
          const message =
            typeof (bootstrapError as { message?: unknown })?.message === 'string'
              ? String((bootstrapError as { message: string }).message)
              : 'Failed to load account state.'
          const isSessionMismatch =
            message.toLowerCase().includes('email does not match') ||
            message.toLowerCase().includes('session email mismatch')
          const isRecoveryRequired = isRecoveryRequiredAuthError(bootstrapError)

          if (isSessionMismatch) {
            setAccount(null)
          }

          if (isRecoveryRequired) {
            writeWaitlistRecoveryGate(true)
            setRecoveryRequired(true)
            setError(
              privyAuthedRef.current
                ? RECOVERY_REQUIRED_WHILE_PRIVY_AUTHED_MESSAGE
                : RECOVERY_REQUIRED_MESSAGE,
            )
            return
          }

          setError(isSessionMismatch ? 'Session mismatch. Tap Continue to try again.' : message)
        } finally {
          setBusy(false)
        }
      })()
    }, FINALIZING_BACKGROUND_RETRY_MS)

    finalizingBgTimerRef.current = timeoutId

    return () => {
      cancelled = true
      if (finalizingBgTimerRef.current === timeoutId) {
        window.clearTimeout(timeoutId)
        finalizingBgTimerRef.current = null
      }
    }
  }, [
    finalizing,
    busy,
    authAttemptInFlightRef,
    requestBootstrap,
    setAccount,
    getNetworkMsg,
    setBusy,
    setError,
    setRecoveryRequired,
    setFinalizing,
    probeStalePrivyTokenSession,
    resetStaleAuthenticatedPrivySession,
  ])

  // Auto bootstrap trigger on privyAuthed (moved below callback declarations for exhaustive-deps correctness)
  useEffect(() => {
    if (step !== 'auth') return
    if (recoveryHandoffInFlightRef.current) return
    if (!privyAuthed || privyClientStatus !== 'ready') return
    if (account?.emailVerified) return
    if (recoveryRequired) return
    if (finalizingRetryExhaustedRef.current) return

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
      setError((current) => (finalizing ? current : null))
      setFinalizing(true)
      try {
        await resumePendingWaitlistAuth()
      } finally {
        setBusy(false)
      }
    })()
  }, [
    account?.emailVerified,
    authAttemptInFlightRef,
    privyAuthed,
    privyClientStatus,
    recoveryRequired,
    setBusy,
    setError,
    step,
    endAuthAttempt,
    finalizing,
    resumePendingWaitlistAuth,
    finalizingRetryExhaustedRef,
  ])

  // Deep link auto start effect (moved below callback declarations for exhaustive-deps correctness)
  useEffect(() => {
    if (step !== 'auth') return
    if (!isWaitlistStartAuthSearchParam(searchParams ? searchParams.get(WAITLIST_START_AUTH_QUERY_KEY) : null))
      return
    if (privyClientStatus !== 'ready') return
    if (busy || authAttemptInFlightRef.current) return
    if (startAuthAutoAttemptedRef.current) return

    startAuthAutoAttemptedRef.current = true
    if (clearStartAuthDeepLink) clearStartAuthDeepLink()
    if (onContinueAuth) void onContinueAuth()
  }, [step, searchParams, privyClientStatus, busy, authAttemptInFlightRef, clearStartAuthDeepLink, onContinueAuth])

  const onTryDifferentEmail = useCallback(async () => {
    await onSignOut()
  }, [onSignOut])

  const onEnterApp = useCallback(async () => {
    if (completionBusy) return
    if (setCompletionBusy) setCompletionBusy(true)
    try {
      if (navigateWithSessionHandoff && enterAppUrl) await navigateWithSessionHandoff(enterAppUrl)
    } finally {
      if (setCompletionBusy) setCompletionBusy(false)
    }
  }, [completionBusy, enterAppUrl, navigateWithSessionHandoff, setCompletionBusy])

  return {
    busy,
    setBusy,
    error,
    setError,
    recoveryRequired,
    setRecoveryRequired,
    finalizing,
    setFinalizing: setFinalizingState,
    privyAuthed,
    completionBusy,
    setCompletionBusy,
    signOutBusy,
    setSignOutBusy,
    sessionRepairBusy,
    setSessionRepairBusy,
    account,
    setAccount,
    activeReferralCode,
    attemptInFlightRef,
    authBootstrapAutoAttemptedRef,
    privyAuthedBootstrapAttemptedRef,
    recoveryHandoffInFlightRef,
    pendingAuthResumeStartedRef,
    loginStartedWhileLoggedOutRef,
    loginAwaitInProgressRef,
    startAuthAutoAttemptedRef,
    finalizingAutoRetryCountRef,
    finalizingBackgroundRetryCountRef,
    finalizingBgTimerRef,
    privyAuthedRef,
    privyClientStatusRef,
    clearFeedback,
    beginAttempt,
    endAttempt,
    beginRecoveryHandoffAttempt,
    endRecoveryHandoffAttempt,
    resetAuthAttemptFlags,
    finalizeRecoveryHandoffError,
    probeStalePrivyTokenSession,
    resetStaleAuthenticatedPrivySession,
    resumePendingWaitlistAuth,
    requestBootstrap: requestFromBootstrap,
    settleBootstrapAfterRecoverableLoginError: settleFromBootstrap,
    resetBootstrapCooldowns: resetFromBootstrap,
    tokenlessFinalizingBootstrapCooldownUntilRef: tokenlessFromBootstrap,
    recoveryRequiredBootstrapCooldownUntilRef: recoveryFromBootstrap,
    onContinueAuth,
    onRecoverAccount,
    onSignOut,
    onRepairSession,
    onTryDifferentEmail,
    onEnterApp,
  }
}
