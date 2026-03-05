import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrossAppAccounts, usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { isPrivyRedirectUrlNotAllowedError, sanitizeCrossAppRedirectUrlForAuth } from '@/hooks/siweAuthCrossApp'
import { StepIndicator } from '@/components/ui/StepIndicator'

import { selectZoraCrossAppAuthAction } from './ownerInstallMapping'
import type { Variant } from './waitlistTypes'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type WaitlistJoinResponse = {
  ok: true
  waitlistEntryId: number
}

type AccountsSummary = {
  privyUserId: string
  email: string | null
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
  creatorCoin: { address: string; name: string | null; symbol: string | null } | null
  zoraHandle: string | null
}

type WaitlistStep = 'email' | 'auth' | 'zora' | 'done'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function readErrorStatusCode(error: unknown): number | null {
  const candidate = Number(
    (error as any)?.status ??
      (error as any)?.statusCode ??
      (error as any)?.response?.status ??
      (error as any)?.cause?.status,
  )
  if (!Number.isFinite(candidate)) return null
  return candidate
}

function isUnauthorizedCrossAppLinkError(error: unknown): boolean {
  const status = readErrorStatusCode(error)
  if (status === 401 || status === 403) return true

  const message = String((error as any)?.message ?? '').trim().toLowerCase()
  if (!message) return false
  const mentionsCrossAppOAuth = message.includes('oauth/init') || message.includes('cross_app') || message.includes('cross-app')
  if (!mentionsCrossAppOAuth) return false
  return message.includes('401') || message.includes('unauthorized') || message.includes('not authorized')
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

function useSafeCrossAppAccounts() {
  try {
    return useCrossAppAccounts() as any
  } catch {
    return {
      loginWithCrossAppAccount: null,
      linkCrossAppAccount: null,
    } as any
  }
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function ThinWaitlistFlow(props: { variant?: Variant; sectionId?: string; onClose?: () => void }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  const privy = useSafePrivy()
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossAppAccounts()

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
  const [error, setError] = useState<string | null>(null)

  const [account, setAccount] = useState<AccountsSummary | null>(null)
  const [zoraSummary, setZoraSummary] = useState<ZoraResolveResponse | null>(null)

  const emailIsValid = EMAIL_RE.test(normalizeEmail(email))

  const isModal = variant === 'modal'
  const isPage = variant === 'page'

  const wrapClass = isPage ? 'mx-auto w-full max-w-lg' : 'w-full'
  const innerClass = isPage
    ? 'card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 space-y-6'
    : 'space-y-6'

  const runBootstrap = useCallback(async () => {
    const token = await getAccessToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['X-Privy-Token'] = token

    const response = await apiFetch('/api/waitlist/bootstrap', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: emailIsValid ? normalizeEmail(email) : undefined,
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
    setStep('zora')
  }, [email, emailIsValid, getAccessToken])

  const onJoinWaitlist = useCallback(async () => {
    if (!emailIsValid || busy) return
    setBusy(true)
    setError(null)
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

  const onLinkZora = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const action = selectZoraCrossAppAuthAction({
        privyAuthed,
        linkCrossAppAccount,
        loginWithCrossAppAccount,
      })
      if (!action) {
        throw new Error('Zora linking is unavailable in this environment.')
      }
      if (action === 'link') {
        try {
          const restoreCrossAppRedirect = sanitizeCrossAppRedirectUrlForAuth()
          try {
            await linkCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })
          } finally {
            restoreCrossAppRedirect?.()
          }
        } catch (linkError: unknown) {
          if (
            typeof loginWithCrossAppAccount === 'function' &&
            (isUnauthorizedCrossAppLinkError(linkError) || isPrivyRedirectUrlNotAllowedError(linkError))
          ) {
            const restoreCrossAppRedirect = sanitizeCrossAppRedirectUrlForAuth()
            try {
              await loginWithCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })
            } finally {
              restoreCrossAppRedirect?.()
            }
          } else {
            throw linkError
          }
        }
      } else {
        const restoreCrossAppRedirect = sanitizeCrossAppRedirectUrlForAuth()
        try {
          await loginWithCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })
        } finally {
          restoreCrossAppRedirect?.()
        }
      }

      const token = await getAccessToken()
      if (!token) throw new Error('Missing Privy token after linking Zora.')

      const response = await apiFetch('/api/zora/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Privy-Token': token,
        },
        body: JSON.stringify({}),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
      const data = payload?.data
      if (!response.ok || !payload?.success || !data) {
        throw new Error(readApiErrorMessage(payload, 'Failed to resolve Zora signals.'))
      }
      setZoraSummary(data)
      setAccount((prev) =>
        prev
          ? {
              ...prev,
              zora: {
                ...prev.zora,
                linked: true,
                canonicalCswAddress: data.canonicalCswAddress,
                creatorCoin: data.creatorCoin ? { address: data.creatorCoin.address } : null,
                zoraHandle: data.zoraHandle,
              },
            }
          : prev,
      )
    } catch (zoraError: any) {
      if (isPrivyRedirectUrlNotAllowedError(zoraError)) {
        setError('Privy redirect URL is not allowed for this origin. Add this app URL in Privy settings and retry.')
      } else {
        setError(typeof zoraError?.message === 'string' ? zoraError.message : 'Failed to link Zora.')
      }
    } finally {
      setBusy(false)
    }
  }, [busy, getAccessToken, linkCrossAppAccount, loginWithCrossAppAccount, privyAuthed])

  const onFinish = useCallback(() => {
    setStep('done')
  }, [])

  useEffect(() => {
    if (step !== 'auth') return
    if (!privyAuthed) return
    let cancelled = false
    ;(async () => {
      try {
        setBusy(true)
        setError(null)
        await runBootstrap()
      } catch (bootstrapError: any) {
        if (!cancelled) {
          setError(typeof bootstrapError?.message === 'string' ? bootstrapError.message : 'Failed to load account state.')
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [privyAuthed, runBootstrap, step])

  const zoraStatus = useMemo(() => {
    const summary = zoraSummary ?? (account ? {
      canonicalCswAddress: account.zora.canonicalCswAddress,
      creatorCoin: account.zora.creatorCoin ? { address: account.zora.creatorCoin.address, name: null, symbol: null } : null,
      zoraHandle: account.zora.zoraHandle,
    } : null)
    return summary
  }, [account, zoraSummary])

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
              <h2 className="text-2xl font-semibold tracking-tight text-white">Get early access</h2>
              <p className="text-sm text-zinc-400">
                Enter your email to join. Connect Zora next for extra points.
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && emailIsValid && !busy) void onJoinWaitlist() }}
                placeholder="you@example.com"
                disabled={step === 'auth'}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
              />
              <p className="text-xs text-zinc-600">No spam. Notifications only.</p>
            </div>

            <button
              type="button"
              disabled={!emailIsValid || busy}
              onClick={() => void onJoinWaitlist()}
              className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting up…
                </>
              ) : (
                'Join waitlist'
              )}
            </button>

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
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
              <p className="text-sm text-zinc-400">
                Link your Zora identity to unlock reputation signals, boost your ranking, and earn points.
              </p>
            </div>

            {zoraStatus ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                <p className="text-xs font-medium text-emerald-400">Zora connected</p>
                <div className="space-y-1 text-xs text-zinc-400">
                  {zoraStatus.zoraHandle ? (
                    <div><span className="text-zinc-600">Handle</span> · @{zoraStatus.zoraHandle}</div>
                  ) : null}
                  {zoraStatus.canonicalCswAddress ? (
                    <div><span className="text-zinc-600">Wallet</span> · {shortAddress(zoraStatus.canonicalCswAddress)}</div>
                  ) : null}
                  {zoraStatus.creatorCoin?.address ? (
                    <div><span className="text-zinc-600">Creator coin</span> · {shortAddress(zoraStatus.creatorCoin.address)}</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onLinkZora()}
                className="btn-primary btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Linking…
                  </>
                ) : zoraStatus ? (
                  'Reconnect Zora'
                ) : (
                  'Connect Zora'
                )}
              </button>

              <button
                type="button"
                onClick={onFinish}
                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded py-1"
              >
                Skip for now →
              </button>
            </div>

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
                <h2 className="text-2xl font-semibold tracking-tight text-white">You&apos;re in!</h2>
                <p className="text-sm text-zinc-400 max-w-xs mx-auto">
                  Done! Visit{' '}
                  <Link to="/accounts" className="text-zinc-300 hover:text-white transition-colors">
                    /accounts
                  </Link>{' '}
                  to manage connected accounts, earn points, and see the leaderboard.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                to="/accounts"
                className="btn-accent btn-no-icon w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center"
              >
                Go to /accounts
              </Link>

              {isModal && props.onClose ? (
                <button
                  type="button"
                  onClick={props.onClose}
                  className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded py-1"
                >
                  Close
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  )
}

