import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLogin, useLoginWithTelegram, usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { getAppBaseUrl } from '@/lib/host'
import { StepIndicator } from '@/components/ui/StepIndicator'

import type { Variant } from './waitlistTypes'
import { shouldAutoStartWaitlistPrivyAuth } from './waitlistAuthState'
import { buildWaitlistPrivyLoginOptions, buildWaitlistRecoveryLoginOptions } from './waitlistLoginOptions'
import { canEnterAppFromAccountState, deriveWaitlistDoneUi, deriveWaitlistEmailUi, deriveWaitlistZoraUi } from './waitlistFlowUi'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type WaitlistJoinResponse = {
  ok: true
  waitlistEntryId: number
}

type AccountsSummary = {
  privyUserId: string
  email: string | null
  appAccessStatus: string | null
  linkedMethods: Record<string, string[]>
  zora: {
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

type ZoraResolveResponse = {
  canonicalCswAddress: string | null
  creatorCoin: { address: string; name: string | null; symbol: string | null; imageUrl: string | null } | null
  zoraHandle: string | null
}

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

type WaitlistStep = 'email' | 'auth' | 'zora' | 'done'
type TelegramAuthFlowState =
  | { status: 'initial' }
  | { status: 'loading' }
  | { status: 'done' }
  | { status: 'error'; error: Error | null }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HANDOFF_QUERY_KEY = 'cv_handoff'

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
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

function isRecoveryRequiredAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const record = error as { recoveryRequired?: unknown; code?: unknown; message?: unknown }
    if (record.recoveryRequired === true) return true
    const code = typeof record.code === 'string' ? record.code.toLowerCase() : ''
    if (code.includes('recovery_required')) return true
    const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
    if (
      message.includes('recovery required') ||
      message.includes('already linked to another account') ||
      message.includes('recovery_required')
    ) {
      return true
    }
    return false
  }

  const text = typeof error === 'string' ? error.toLowerCase() : ''
  return (
    text.includes('recovery required') ||
    text.includes('already linked to another account') ||
    text.includes('recovery_required')
  )
}

function useSafePrivy() {
  try {
    return usePrivy() as any
  } catch {
    return {
      authenticated: false,
      ready: false,
      getAccessToken: async () => null,
    } as any
  }
}

function useSafeLogin() {
  try {
    return useLogin({}) as any
  } catch {
    return {
      login: async () => {},
    } as any
  }
}

function useSafeLoginWithTelegram() {
  try {
    return useLoginWithTelegram() as { login: () => Promise<void>; state: TelegramAuthFlowState }
  } catch {
    return {
      login: async () => {},
      state: { status: 'initial' } as TelegramAuthFlowState,
    }
  }
}

function hasLinkedTelegramAccount(user: unknown): boolean {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return false
  const camel = Array.isArray(record.linkedAccounts) ? (record.linkedAccounts as any[]) : []
  const snake = Array.isArray(record.linked_accounts) ? (record.linked_accounts as any[]) : []
  const linked = [...camel, ...snake]
  return linked.some((account) => String((account as any)?.type ?? '').trim().toLowerCase().includes('telegram'))
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
}

function CoinbaseLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#0052FF" />
      <path
        d="M12 4.8C8.03 4.8 4.8 8.03 4.8 12S8.03 19.2 12 19.2 19.2 15.97 19.2 12 15.97 4.8 12 4.8Zm0 9.9c-1.48 0-2.7-1.22-2.7-2.7S10.52 9.3 12 9.3s2.7 1.22 2.7 2.7-1.22 2.7-2.7 2.7Z"
        fill="white"
      />
    </svg>
  )
}

function ZoraLogo({ className }: { className?: string }) {
  return (
    <img
      src="/protocols/zora.svg"
      alt="Zora"
      aria-hidden="true"
      className={className}
      style={{ borderRadius: '50%' }}
    />
  )
}

export function ThinWaitlistFlow(props: { variant?: Variant; sectionId?: string }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  const privy = useSafePrivy()
  const { login } = useSafeLogin()
  const { login: loginWithTelegram, state: telegramAuthState } = useSafeLoginWithTelegram()

  const privyReady = Boolean(privy?.ready)
  const privyAuthed = Boolean(privy?.authenticated)
  const getAccessToken = useMemo(
    () =>
      typeof privy?.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy],
  )

  const [step, setStep] = useState<WaitlistStep>('email')
  const [email, setEmail] = useState('')

  const [busy, setBusy] = useState(false)
  const [enterAppBusy, setEnterAppBusy] = useState(false)
  const [zoraAutoResolving, setZoraAutoResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryRequired, setRecoveryRequired] = useState(false)

  const [account, setAccount] = useState<AccountsSummary | null>(null)
  const [zoraSummary, setZoraSummary] = useState<ZoraResolveResponse | null>(null)
  const authAttemptInFlightRef = useRef(false)
  const authAutoAttemptedRef = useRef(false)
  const authBootstrapAutoAttemptedRef = useRef(false)
  const zoraAutoResolvedRef = useRef(false)
  const privyLogoutRef = useRef<null | (() => Promise<void>)>(null)

  const emailIsValid = EMAIL_RE.test(normalizeEmail(email))
  const telegramAuthLoading = telegramAuthState.status === 'loading'
  const telegramAlreadyLinked = useMemo(() => hasLinkedTelegramAccount((privy as any)?.user), [privy])

  const isPage = variant === 'page'

  const wrapClass = isPage ? 'mx-auto w-full max-w-lg' : 'w-full'
  const innerClass = isPage
    ? 'card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 space-y-6'
    : 'space-y-6'
  const enterAppUrl = useMemo(() => buildAppEntryUrl(getAppBaseUrl()), [])

  useEffect(() => {
    if (typeof privy?.logout === 'function') {
      privyLogoutRef.current = async () => {
        await privy.logout().catch(() => null)
      }
      return
    }
    privyLogoutRef.current = null
  }, [privy])

  const runBootstrap = useCallback(async () => {
    const token = await getAccessToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) {
      headers['X-Privy-Token'] = token
      await runCanonicalizationPipeline({
        privyToken: token,
      })
    }
    const emailForBootstrap = !token && emailIsValid ? normalizeEmail(email) : undefined

    const response = await apiFetch('/api/waitlist/bootstrap', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: emailForBootstrap,
      }),
    })
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null
    if (!response.ok || !payload?.success || !payload.data) {
      throw new Error(readApiErrorMessage(payload, 'Failed to bootstrap waitlist state.'))
    }

    if (payload.data.requiresPrivyAuth) {
      setStep('auth')
      return
    }

    const nextAccount = payload.data
    setAccount(nextAccount)
    setRecoveryRequired(false)
    setStep('zora')
  }, [email, emailIsValid, getAccessToken])

  const onJoinWaitlist = useCallback(async () => {
    if (!emailIsValid || busy) return
    setBusy(true)
    setError(null)
    setRecoveryRequired(false)
    try {
      const response = await apiFetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistJoinResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiErrorMessage(payload, 'Failed to join waitlist.'))
      }
      setStep('auth')
      if (privyAuthed) {
        await runBootstrap()
      }
    } catch (joinError: any) {
      setError(typeof joinError?.message === 'string' ? joinError.message : 'Failed to join waitlist.')
    } finally {
      setBusy(false)
    }
  }, [busy, email, emailIsValid, privyAuthed, runBootstrap])

  const onContinueAuth = useCallback(async () => {
    if (busy || authAttemptInFlightRef.current) return
    authAttemptInFlightRef.current = true
    setBusy(true)
    setError(null)
    setRecoveryRequired(false)
    try {
      if (privyAuthed) {
        await runBootstrap()
      } else {
        await login(buildWaitlistPrivyLoginOptions() as any)
      }
      authAttemptInFlightRef.current = false
      setBusy(false)
    } catch (authError: any) {
      const isRecoveryRequired = isRecoveryRequiredAuthError(authError)
      if (isRecoveryRequired) {
        authAutoAttemptedRef.current = true
        await privyLogoutRef.current?.()
        setRecoveryRequired(true)
      }
      setError(
        isRecoveryRequired
          ? 'Recovery required: this email is already linked to another account. Sign in with your original email/social account to recover, then continue.'
          : typeof authError?.message === 'string'
            ? authError.message
            : 'Failed to start sign-in.',
      )
      authAttemptInFlightRef.current = false
      setBusy(false)
    }
  }, [busy, login, privyAuthed, runBootstrap])

  const onRecoverAccount = useCallback(async () => {
    if (busy || authAttemptInFlightRef.current) return
    authAttemptInFlightRef.current = true
    setBusy(true)
    setError(null)
    setRecoveryRequired(false)
    try {
      await privyLogoutRef.current?.()
      await login(buildWaitlistRecoveryLoginOptions() as any)
    } catch (recoverError: any) {
      setError(typeof recoverError?.message === 'string' ? recoverError.message : 'Failed to start account recovery sign-in.')
      setRecoveryRequired(true)
    } finally {
      authAttemptInFlightRef.current = false
      setBusy(false)
    }
  }, [busy, login])

  const onContinueWithTelegram = useCallback(async () => {
    if (step !== 'auth') return
    if (busy || authAttemptInFlightRef.current || telegramAuthLoading) return
    authAttemptInFlightRef.current = true
    setBusy(true)
    setError(null)
    setRecoveryRequired(false)
    try {
      if (privyAuthed) {
        if (telegramAlreadyLinked) {
          await runBootstrap()
        } else {
          await loginWithTelegram()
          await runBootstrap()
        }
      } else {
        await loginWithTelegram()
      }
      authAttemptInFlightRef.current = false
      setBusy(false)
    } catch (authError: any) {
      setError(typeof authError?.message === 'string' ? authError.message : 'Failed to start Telegram sign-in.')
      authAttemptInFlightRef.current = false
      setBusy(false)
    }
  }, [busy, loginWithTelegram, privyAuthed, runBootstrap, step, telegramAlreadyLinked, telegramAuthLoading])

  useEffect(() => {
    if (step !== 'auth') return
    if (telegramAuthState.status !== 'error') return
    const errorMessage =
      typeof telegramAuthState.error?.message === 'string' && telegramAuthState.error.message.trim()
        ? telegramAuthState.error.message
        : 'Telegram sign-in was cancelled. Try again.'
    setError(errorMessage)
    setBusy(false)
    authAttemptInFlightRef.current = false
  }, [step, telegramAuthState])

  const resolveZora = useCallback(async (token: string): Promise<ZoraResolveResponse | null> => {
    const response = await apiFetch('/api/zora/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Privy-Token': token },
      body: JSON.stringify({}),
    })
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
    if (!response.ok || !payload?.success || !payload.data) return null
    return payload.data
  }, [])

  const applyZoraResult = useCallback((data: ZoraResolveResponse) => {
    setZoraSummary(data)
  }, [])

  const onLinkZora = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (typeof privy?.linkWallet !== 'function') {
        throw new Error('Wallet linking is unavailable in this environment.')
      }
      await privy.linkWallet()

      const token = await getAccessToken()
      if (!token) throw new Error('Missing auth token after linking wallet.')

      const data = await resolveZora(token)
      if (!data) throw new Error('Could not find a Zora profile for that wallet.')
      applyZoraResult(data)
      await runBootstrap()
    } catch (zoraError: any) {
      setError(typeof zoraError?.message === 'string' ? zoraError.message : 'Failed to link wallet.')
    } finally {
      setBusy(false)
    }
  }, [applyZoraResult, busy, getAccessToken, privy, resolveZora, runBootstrap])

  const onFinish = useCallback(async () => {
    if (busy) return
    setError(null)
    try {
      if (privyAuthed) {
        setBusy(true)
        await runBootstrap()
      }
      setStep('done')
    } catch (finishError: any) {
      setError(typeof finishError?.message === 'string' ? finishError.message : 'Failed to refresh account state.')
    } finally {
      if (privyAuthed) setBusy(false)
    }
  }, [busy, privyAuthed, runBootstrap])

  const onEnterApp = useCallback(async () => {
    if (enterAppBusy) return
    setEnterAppBusy(true)
    try {
      let target = enterAppUrl
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
    } finally {
      setEnterAppBusy(false)
    }
  }, [enterAppBusy, enterAppUrl, getAccessToken, privyAuthed])

  useEffect(() => {
    if (
      !shouldAutoStartWaitlistPrivyAuth({
        step,
        privyReady,
        privyAuthed,
        busy,
        authAttemptInFlight: authAttemptInFlightRef.current,
        authAutoAttempted: authAutoAttemptedRef.current,
      })
    ) {
      return
    }
    authAutoAttemptedRef.current = true
    void onContinueAuth()
  }, [busy, onContinueAuth, privyAuthed, privyReady, step])

  useEffect(() => {
    if (step !== 'auth' || !privyAuthed) {
      authBootstrapAutoAttemptedRef.current = false
      return
    }
    if (authBootstrapAutoAttemptedRef.current) return

    authBootstrapAutoAttemptedRef.current = true
    let cancelled = false
    authAttemptInFlightRef.current = false
    authAutoAttemptedRef.current = false
    ;(async () => {
      try {
        setBusy(true)
        setError(null)
        await runBootstrap()
      } catch (bootstrapError: any) {
        const message =
          typeof bootstrapError?.message === 'string' ? bootstrapError.message : 'Failed to load account state.'
        const isSessionMismatch = isSessionEmailMismatchError(message)
        const isRecoveryRequired = isRecoveryRequiredAuthError(bootstrapError)
        if (isSessionMismatch || isRecoveryRequired) {
          await privyLogoutRef.current?.()
        }
        if (!cancelled) {
          if (isRecoveryRequired) setRecoveryRequired(true)
          setError(
            isSessionMismatch
              ? 'Signed in as a different account. Click Continue to sign in again.'
              : isRecoveryRequired
                ? 'Recovery required: this email is already linked to another account. Sign in with your original email/social account to recover, then continue.'
                : message,
          )
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [privyAuthed, runBootstrap, step])

  useEffect(() => {
    if (step !== 'auth') {
      authAttemptInFlightRef.current = false
      authAutoAttemptedRef.current = false
      authBootstrapAutoAttemptedRef.current = false
      setRecoveryRequired(false)
    }
  }, [step])

  useEffect(() => {
    if (step !== 'zora') return
    if (zoraAutoResolvedRef.current || zoraSummary) return
    zoraAutoResolvedRef.current = true
    let cancelled = false
    ;(async () => {
      setZoraAutoResolving(true)
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const data = await resolveZora(token)
        if (cancelled || !data) return
        const hasProfile = !!(data.zoraHandle || data.canonicalCswAddress || data.creatorCoin)
        if (hasProfile) {
          applyZoraResult(data)
          await runBootstrap()
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setZoraAutoResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [applyZoraResult, getAccessToken, resolveZora, runBootstrap, step, zoraSummary])

  const zoraStatus = useMemo(() => {
    const summary: ZoraResolveResponse | null = zoraSummary ?? (account ? {
      canonicalCswAddress: account.zora.canonicalCswAddress,
      creatorCoin: account.zora.creatorCoin ? { address: account.zora.creatorCoin.address, name: null, symbol: null, imageUrl: null } : null,
      zoraHandle: account.zora.zoraHandle,
    } : null)
    return summary
  }, [account, zoraSummary])
  const emailUi = step === 'auth' ? deriveWaitlistEmailUi('auth') : deriveWaitlistEmailUi('email')
  const zoraUi = deriveWaitlistZoraUi(Boolean(zoraStatus))
  const canEnterApp = canEnterAppFromAccountState({
    appAccessStatus: account?.appAccessStatus ?? null,
    tier: account?.score?.tier ?? 0,
  })
  const doneUi = deriveWaitlistDoneUi(canEnterApp)

  const stepOrder: WaitlistStep[] = ['email', 'auth', 'zora', 'done']
  const stepIdx = stepOrder.indexOf(step)

  const indicatorSteps = [
    {
      label: 'Email',
      status: (stepIdx >= 2 ? 'complete' : stepIdx <= 1 ? (stepIdx === 0 || step === 'auth' ? 'active' : 'pending') : 'pending') as 'pending' | 'active' | 'complete',
    },
    {
      label: 'Zora',
      status: (step === 'zora' ? 'active' : step === 'done' ? 'complete' : 'pending') as 'pending' | 'active' | 'complete',
    },
    {
      label: 'Done',
      status: (step === 'done' ? 'active' : 'pending') as 'pending' | 'active' | 'complete',
    },
  ]

  return (
    <section id={sectionId} className={wrapClass}>
      <div className={innerClass}>
        {/* Step progress indicator */}
        <StepIndicator steps={indicatorSteps} />

        {/* Email step — also used while 'auth' is running in background */}
        {(step === 'email' || step === 'auth') ? (
          <motion.div
            key="step-email"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-white">{emailUi.title}</h2>
              <p className="text-sm text-zinc-400">{emailUi.subtitle}</p>
            </div>

            <div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && emailIsValid && !busy) void onJoinWaitlist() }}
                placeholder="you@example.com"
                disabled={step === 'auth'}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              disabled={step === 'email' ? !emailIsValid || busy : busy}
              onClick={() => void (step === 'auth' ? onContinueAuth() : onJoinWaitlist())}
              className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {emailUi.busyLabel}
                </>
              ) : (
                emailUi.ctaLabel
              )}
            </button>

            {step === 'auth' ? (
              <button
                type="button"
                disabled={busy || telegramAuthLoading}
                onClick={() => void onContinueWithTelegram()}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm font-medium text-white transition hover:border-[#229ED9]/60 hover:bg-[#229ED9]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#229ED9]/40 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {telegramAuthLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting Telegram…
                  </>
                ) : (
                  <>
                    <img src="/brands/telegram.svg" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
                    Continue with Telegram
                  </>
                )}
              </button>
            ) : null}

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
                    Recover account sign-in
                  </button>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {/* Zora step */}
        {step === 'zora' ? (
          <motion.div
            key="step-zora"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-5"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-white">Connect Zora</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Optional
                </span>
              </div>
              <p className="text-sm text-zinc-400">{zoraUi.subtitle}</p>
            </div>

            {zoraAutoResolving ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-4">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-400">Checking your wallets for a Zora profile…</span>
              </div>
            ) : zoraStatus ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                <p className="text-xs font-medium text-emerald-400">{zoraUi.connectedLabel}</p>
                <div className="space-y-2">
                  {zoraStatus.zoraHandle ? (
                    <div className="flex items-center gap-2 text-xs">
                      <ZoraLogo className="w-4 h-4 shrink-0 rounded-full" />
                      <span className="text-zinc-400">@{zoraStatus.zoraHandle}</span>
                    </div>
                  ) : null}
                  {zoraStatus.canonicalCswAddress ? (
                    <div className="flex items-center gap-2 text-xs pl-1">
                      <CoinbaseLogo className="w-4 h-4 shrink-0" />
                      <span className="text-zinc-500">Smart Wallet</span>
                      <span className="text-zinc-400 font-mono">{shortAddress(zoraStatus.canonicalCswAddress)}</span>
                    </div>
                  ) : null}
                  {zoraStatus.creatorCoin?.address ? (
                    <div className="flex items-center gap-2 text-xs pl-1">
                      {zoraStatus.creatorCoin.imageUrl ? (
                        <img
                          src={zoraStatus.creatorCoin.imageUrl}
                          alt={zoraStatus.creatorCoin.symbol ?? 'coin'}
                          className="w-4 h-4 rounded-full shrink-0 object-cover"
                        />
                      ) : (
                        <ZoraLogo className="w-4 h-4 shrink-0 rounded-full" />
                      )}
                      <span className="text-zinc-500">Creator coin</span>
                      {zoraStatus.creatorCoin.symbol ? (
                        <span className="text-zinc-400">{zoraStatus.creatorCoin.symbol}</span>
                      ) : (
                        <span className="text-zinc-400 font-mono">{shortAddress(zoraStatus.creatorCoin.address)}</span>
                      )}
                    </div>
                  ) : null}
                  {!zoraStatus.zoraHandle && !zoraStatus.canonicalCswAddress && !zoraStatus.creatorCoin?.address ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <ZoraLogo className="w-4 h-4 shrink-0 rounded-full opacity-80" />
                      <span>{zoraUi.resolvingLabel}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!zoraAutoResolving ? (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void (zoraUi.primaryAction === 'finish' ? onFinish() : onLinkZora())}
                  className="btn-primary btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Linking…
                    </>
                  ) : (
                    zoraUi.primaryLabel
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void (zoraUi.secondaryAction === 'reconnect' ? onLinkZora() : onFinish())}
                  className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded py-1"
                >
                  {zoraUi.secondaryLabel}
                </button>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {/* Done step */}
        {step === 'done' ? (
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
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,52,204,0.35) 0%, rgba(91,168,255,0.18) 100%)',
                    border: '1px solid rgba(91,168,255,0.28)',
                  }}
                >
                  <CheckCircle2 className="h-5 w-5 text-[#7DBCFF]" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  style={{ border: '1px solid rgba(91,168,255,0.35)' }}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                />
              </motion.div>

              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight text-white">{doneUi.title}</h2>
                <p className="text-sm text-zinc-400 max-w-xs mx-auto">{doneUi.subtitle}</p>
              </div>
            </div>

            <div className="space-y-3">
              {canEnterApp ? (
                <button
                  type="button"
                  onClick={() => void onEnterApp()}
                  disabled={enterAppBusy}
                  className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {enterAppBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entering App…
                    </>
                  ) : (
                    doneUi.primaryLabel
                  )}
                </button>
              ) : (
                <Link
                  to="/accounts"
                  className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center"
                >
                  {doneUi.primaryLabel}
                </Link>
              )}

              {doneUi.secondaryLabel ? (
                <Link
                  to="/accounts"
                  className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded py-1 inline-block"
                >
                  {doneUi.secondaryLabel}
                </Link>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  )
}

