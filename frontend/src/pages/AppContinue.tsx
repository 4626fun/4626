import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'

import { apiFetch } from '@/lib/apiBase'
import { shouldNavigateAfterWaitlistHandoff } from '@/lib/auth/appContinueGate'
import { readSafeNextPath } from '@/lib/auth/appEntry'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { ensureTelegramMiniAppSession, isTelegramMiniAppContext, loadTelegramWebApp, setupTelegramMiniAppUi } from '@/lib/telegramWebApp'
import { PageMeta } from '@/components/seo/PageMeta'
import { useSiweAuth, writeStoredSessionToken } from '@/hooks/useSiweAuth'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

const AUTH_HANDOFF_QUERY_KEY = 'cv_handoff'

type HandoffRedeemResponse = {
  address: string
  sessionToken: string
  privyToken: string | null
}

type AppContinueRetryDirective = {
  resetState: 'idle'
  clearError: true
  shouldForceLogout: boolean
  loginOptions: { loginMethods: ['email', 'wallet'] }
}

type AppContinueReadyTimeoutInput = {
  autoLogin: boolean
  fromWaitlist: boolean
  handoffState: 'idle' | 'signingIn' | 'bridging' | 'ready' | 'error'
  authAddress: string | null | undefined
}

type AppContinueAutologinDecisionInput = {
  autoLogin: boolean
  fromWaitlist: boolean
  handoffState: 'idle' | 'signingIn' | 'bridging' | 'ready' | 'error'
  handoffCode: string
  handoffRedeemAttempted: boolean
  privyReady: boolean
  privyAuthenticated: boolean
  autoLoginAttempted: boolean
}

export type AppContinueAutologinDecision =
  | 'skip'
  | 'redeem_handoff'
  | 'wait_for_privy'
  | 'start_login'
  | 'bridge_existing_session'

const READY_WITHOUT_SESSION_TIMEOUT_MS = 10_000

export function getAppContinueRetryDirective(input: { privyAuthenticated: boolean }): AppContinueRetryDirective {
  return {
    resetState: 'idle',
    clearError: true,
    shouldForceLogout: input.privyAuthenticated,
    loginOptions: { loginMethods: ['email', 'wallet'] },
  }
}

export function shouldScheduleReadyWithoutSessionTimeout(input: AppContinueReadyTimeoutInput): boolean {
  if (!input.autoLogin || !input.fromWaitlist) return false
  if (input.handoffState !== 'ready') return false
  return !(typeof input.authAddress === 'string' && input.authAddress.trim().length > 0)
}

export function shouldBootstrapTelegramMiniAppFlow(input: {
  nextPath: string
  hasTelegramWebApp: boolean
}): boolean {
  return input.hasTelegramWebApp || input.nextPath.startsWith('/telegram/link')
}

export function resolveAppContinueAutologinDecision(
  input: AppContinueAutologinDecisionInput,
): AppContinueAutologinDecision {
  if (!input.autoLogin || !input.fromWaitlist) return 'skip'
  if (input.handoffState === 'ready' || input.handoffState === 'error') return 'skip'
  if (input.handoffCode.trim() && !input.handoffRedeemAttempted) return 'redeem_handoff'
  if (!input.privyReady) return 'wait_for_privy'
  if (!input.privyAuthenticated) {
    return input.autoLoginAttempted ? 'wait_for_privy' : 'start_login'
  }
  return 'bridge_existing_session'
}

function useSafeAppContinuePrivy() {
  try {
    return usePrivy() as {
      ready?: boolean
      authenticated?: boolean
      getAccessToken?: () => Promise<string | null>
      logout?: () => Promise<void>
    }
  } catch {
    return {
      ready: false,
      authenticated: false,
      getAccessToken: async () => null,
      logout: async () => {},
    }
  }
}

function useSafeAppContinueLogin() {
  try {
    return useLogin({}) as { login: (options?: unknown) => Promise<void> }
  } catch {
    return {
      login: async () => {},
    }
  }
}

export function AppContinue() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const siwe = useSiweAuth()
  const authAddress = siwe.authAddress
  const refreshSiweSession = siwe.refresh
  const signInWithPrivyToken = siwe.signInWithPrivyToken
  const privyClientStatus = usePrivyClientStatus()
  const privy = useSafeAppContinuePrivy()
  const { login } = useSafeAppContinueLogin()
  const privyReady = Boolean(privy.ready)
  const privyAuthenticated = Boolean(privy.authenticated)
  const getAccessToken = useMemo(
    () => (typeof privy.getAccessToken === 'function' ? privy.getAccessToken : async () => null),
    [privy.getAccessToken],
  )
  const logout = useMemo(
    () => (typeof privy.logout === 'function' ? privy.logout : async () => {}),
    [privy.logout],
  )

  const nextPath = useMemo(() => readSafeNextPath(searchParams.get('next')), [searchParams])
  const autoLoginRaw = (searchParams.get('autologin') ?? '').trim().toLowerCase()
  const fromRaw = (searchParams.get('from') ?? '').trim().toLowerCase()
  const autoLogin = autoLoginRaw === '1' || autoLoginRaw === 'true' || autoLoginRaw === 'yes'
  const fromWaitlist = fromRaw === 'waitlist'
  const handoffCode = (searchParams.get(AUTH_HANDOFF_QUERY_KEY) ?? '').trim()
  const likelyTelegramMiniAppFlow = useMemo(
    () =>
      shouldBootstrapTelegramMiniAppFlow({
        nextPath,
        hasTelegramWebApp: typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp),
      }),
    [nextPath],
  )

  const canNavigate = useMemo(
    () =>
      shouldNavigateAfterWaitlistHandoff({
        autoLogin,
        fromWaitlist,
        siweAuthAddress: authAddress,
        privyClientStatus,
        privyReady,
        privyAuthenticated,
      }),
    [authAddress, autoLogin, fromWaitlist, privyAuthenticated, privyClientStatus, privyReady],
  )

  const [handoffState, setHandoffState] = useState<'idle' | 'signingIn' | 'bridging' | 'ready' | 'error'>('idle')
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const autoLoginAttemptRef = useRef(false)
  const autoHandoffRedeemAttemptRef = useRef(false)

  useEffect(() => {
    if (!likelyTelegramMiniAppFlow) return
    let isCancelled = false
    let teardown: (() => void) | null = null
    void (async () => {
      await loadTelegramWebApp().catch(() => null)
      if (isCancelled) return
      teardown = setupTelegramMiniAppUi({ requestExpand: true })
      if (!isTelegramMiniAppContext()) return
      await ensureTelegramMiniAppSession().catch(() => null)
    })()
    return () => {
      isCancelled = true
      teardown?.()
    }
  }, [likelyTelegramMiniAppFlow])

  const restartHandoff = async () => {
    const retry = getAppContinueRetryDirective({ privyAuthenticated })
    autoLoginAttemptRef.current = false
    autoHandoffRedeemAttemptRef.current = false
    if (retry.clearError) setHandoffError(null)
    setHandoffState(retry.resetState)

    if (retry.shouldForceLogout && typeof logout === 'function') {
      try {
        await logout()
      } catch {
        // ignore
      }
    }
  }

  useEffect(() => {
    if (!canNavigate) return
    if (typeof authAddress === 'string' && authAddress.length > 0) {
      navigate(nextPath, { replace: true })
    }
  }, [authAddress, canNavigate, navigate, nextPath])

  useEffect(() => {
    if (!autoLogin || !fromWaitlist) return
    if (handoffState === 'ready' || handoffState === 'error') return

    const failHandoff = (message: string) => {
      setHandoffState('error')
      setHandoffError(message)
    }

    const redeemOneTimeHandoff = async (): Promise<boolean> => {
      const code = handoffCode.trim()
      if (!code || autoHandoffRedeemAttemptRef.current) return false
      autoHandoffRedeemAttemptRef.current = true

      try {
        setHandoffError(null)
        setHandoffState('bridging')
        const res = await apiFetch('/api/auth/handoff/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ code }),
        })
        const json = (await res.json().catch(() => null)) as ApiEnvelope<HandoffRedeemResponse> | null
        if (!res.ok || !json?.success) return false

        const sessionToken =
          json?.data && typeof json.data.sessionToken === 'string' ? json.data.sessionToken.trim() : ''
        if (sessionToken) {
          writeStoredSessionToken(sessionToken)
        }

        // Bridge the Privy session from the marketing origin so the
        // server resolves wallets and sets a richer cv_auth_session
        // cookie (linked wallets, CSW, etc.).  Privy client-side
        // auth is domain-specific so this is best-effort.
        const bridgedPrivyToken =
          json?.data && typeof json.data.privyToken === 'string' ? json.data.privyToken.trim() : ''
        if (bridgedPrivyToken) {
          await apiFetch('/api/auth/privy', {
            method: 'POST',
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${bridgedPrivyToken}`,
              Accept: 'application/json',
            },
          }).catch(() => null)
        }

        await refreshSiweSession().catch(() => null)
        setHandoffState('ready')
        setHandoffError(null)
        return true
      } catch {
        return false
      }
    }

    void (async () => {
      if (handoffState === 'idle') setHandoffState('signingIn')
      const decision = resolveAppContinueAutologinDecision({
        autoLogin,
        fromWaitlist,
        handoffState,
        handoffCode,
        handoffRedeemAttempted: autoHandoffRedeemAttemptRef.current,
        privyReady,
        privyAuthenticated,
        autoLoginAttempted: autoLoginAttemptRef.current,
      })

      if (decision === 'skip' || decision === 'wait_for_privy') return
      let nextDecision: AppContinueAutologinDecision = decision
      if (decision === 'redeem_handoff') {
        const redeemed = await redeemOneTimeHandoff()
        if (redeemed) return
        nextDecision = resolveAppContinueAutologinDecision({
          autoLogin,
          fromWaitlist,
          handoffState,
          handoffCode,
          handoffRedeemAttempted: true,
          privyReady,
          privyAuthenticated,
          autoLoginAttempted: autoLoginAttemptRef.current,
        })
      }

      if (nextDecision === 'skip' || nextDecision === 'wait_for_privy') return
      if (nextDecision === 'start_login') {
        autoLoginAttemptRef.current = true
        try {
          setHandoffError(null)
          setHandoffState('signingIn')
          const retry = getAppContinueRetryDirective({ privyAuthenticated })
          await login(retry.loginOptions as any)
        } catch {
          autoLoginAttemptRef.current = false
          failHandoff('Account connection was cancelled. Click "Restore account connection" to continue.')
        }
        return
      }

      if (nextDecision !== 'bridge_existing_session') return

      // Privy is already authenticated on this domain (e.g. user had
      // a prior session). Bridge into a server session.
      try {
        setHandoffError(null)
        setHandoffState('bridging')
        const token = await getAccessToken()
        if (!token) {
          failHandoff('Could not read Privy access token. Click "Restore account connection" to retry.')
          return
        }
        const addr = await signInWithPrivyToken(token)
        if (!addr) {
          failHandoff('Could not establish a session. Click "Restore account connection" and retry.')
          return
        }
        setHandoffState('ready')
        setHandoffError(null)
      } catch {
        failHandoff('Could not establish a session. Click "Restore account connection" and retry.')
      }
    })()
  }, [
    autoLogin,
    fromWaitlist,
    getAccessToken,
    handoffCode,
    handoffState,
    login,
    logout,
    privyAuthenticated,
    privyReady,
    refreshSiweSession,
    signInWithPrivyToken,
  ])

  useEffect(() => {
    if (!autoLogin || !fromWaitlist) return
    if (handoffState !== 'signingIn' && handoffState !== 'bridging') return
    const t = window.setTimeout(() => {
      setHandoffState('error')
      setHandoffError('This is taking longer than expected. Click "Restore account connection" to continue.')
    }, 25_000)
    return () => window.clearTimeout(t)
  }, [autoLogin, fromWaitlist, handoffState])

  useEffect(() => {
    if (
      !shouldScheduleReadyWithoutSessionTimeout({
        autoLogin,
        fromWaitlist,
        handoffState,
        authAddress,
      })
    ) {
      return
    }
    const t = window.setTimeout(() => {
      setHandoffState('error')
      setHandoffError('Could not finish restoring your session. Click "Restore account connection" to continue.')
    }, READY_WITHOUT_SESSION_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [authAddress, autoLogin, fromWaitlist, handoffState])

  if (!autoLogin || !fromWaitlist) {
    return <Navigate to={nextPath} replace />
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta title="Continuing to app" description="Finishing secure sign-in handoff into the 4626 app." canonicalPath="/continue" />
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
        <div className="card w-full rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">4626</div>
            <h1 className="text-2xl font-semibold tracking-tight">Entering app</h1>
            <p className="text-sm text-zinc-400">
              We&apos;re restoring your session and sending you to the app.
            </p>
          </div>

          {handoffError ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {handoffError}
              </div>
              <button
                type="button"
                onClick={() => {
                  void restartHandoff()
                }}
                className="btn-accent btn-no-icon inline-flex"
              >
                Restore account connection
              </button>
              <Link to={nextPath} className="text-sm text-zinc-500 hover:text-zinc-300">
                Continue without auto sign-in
              </Link>
            </div>
          ) : (
            <div className="text-sm text-zinc-400">
              {handoffState === 'signingIn'
                ? 'Restoring your 4626 account connection…'
                : handoffState === 'bridging'
                  ? 'Setting up your session…'
                  : 'Restoring your session…'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
