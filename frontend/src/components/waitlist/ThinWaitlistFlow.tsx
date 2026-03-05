import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrossAppAccounts, useLogin, usePrivy } from '@privy-io/react-auth'

import { apiFetch } from '@/lib/apiBase'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { isPrivyRedirectUrlNotAllowedError, sanitizeCrossAppRedirectUrlForAuth } from '@/hooks/siweAuthCrossApp'

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

function useSafeLogin() {
  try {
    return useLogin({}) as any
  } catch {
    return { login: async () => {} } as any
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

export function ThinWaitlistFlow(props: { variant?: Variant; sectionId?: string }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  const privy = useSafePrivy()
  const { login } = useSafeLogin()
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
  const [waitlistEntryId, setWaitlistEntryId] = useState<number | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [account, setAccount] = useState<AccountsSummary | null>(null)
  const [zoraSummary, setZoraSummary] = useState<ZoraResolveResponse | null>(null)

  const emailIsValid = EMAIL_RE.test(normalizeEmail(email))

  const cardClass = variant === 'page'
    ? 'card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8'
    : 'rounded-2xl border border-white/10 bg-black/40 p-5'

  const wrapClass = variant === 'page'
    ? 'mx-auto w-full max-w-2xl'
    : 'w-full'

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
      setWaitlistEntryId(payload.data.waitlistEntryId)
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

  const onPrivyContinue = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (!privyAuthed && typeof login === 'function') {
        await login()
      }
      await runBootstrap()
    } catch (authError: any) {
      setError(typeof authError?.message === 'string' ? authError.message : 'Privy sign-in failed.')
    } finally {
      setBusy(false)
    }
  }, [busy, login, privyAuthed, runBootstrap])

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

  return (
    <section id={sectionId} className={wrapClass}>
      <div className={cardClass}>
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">4626 Waitlist</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Join in one tap, manage identities later</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Email is required for notifications. You can link additional identities in <code>/accounts</code>.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
          {(['email', 'auth', 'zora', 'done'] as WaitlistStep[]).map((item, index) => {
            const active = item === step
            const completed = ['email', 'auth', 'zora', 'done'].indexOf(step) > index
            return (
              <span
                key={item}
                className={`rounded-full border px-3 py-1 ${
                  active
                    ? 'border-brand-primary/50 bg-brand-primary/20 text-brand-primary'
                    : completed
                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-zinc-400'
                }`}
              >
                {index + 1}. {item === 'auth' ? 'privy' : item}
              </span>
            )
          })}
        </div>

        {step === 'email' ? (
          <div className="space-y-3">
            <label className="block text-xs text-zinc-400">Email (notifications)</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-primary/50"
            />
            <button
              type="button"
              disabled={!emailIsValid || busy}
              onClick={() => void onJoinWaitlist()}
              className="btn-accent btn-no-icon inline-flex"
            >
              {busy ? 'Joining…' : 'Sign up'}
            </button>
          </div>
        ) : null}

        {step === 'auth' ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">
              Step 2: Sign in with Privy to attach your canonical internal account (Privy user id).
            </p>
            <button type="button" disabled={busy} onClick={() => void onPrivyContinue()} className="btn-accent btn-no-icon inline-flex">
              {busy ? 'Connecting…' : privyAuthed ? 'Continue' : 'Sign in / Continue'}
            </button>
            {waitlistEntryId ? <p className="text-xs text-zinc-500">Waitlist entry #{waitlistEntryId}</p> : null}
          </div>
        ) : null}

        {step === 'zora' ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              Step 3 (optional): Link your Zora account to boost your profile signal.
            </p>
            <button type="button" disabled={busy} onClick={() => void onLinkZora()} className="btn-primary btn-no-icon inline-flex">
              {busy ? 'Linking Zora…' : 'Link Zora to boost'}
            </button>
            {zoraStatus ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-300 space-y-2">
                <div><span className="text-zinc-500">Zora handle:</span> {zoraStatus.zoraHandle ? `@${zoraStatus.zoraHandle}` : '—'}</div>
                <div><span className="text-zinc-500">Canonical CSW:</span> {shortAddress(zoraStatus.canonicalCswAddress)}</div>
                <div><span className="text-zinc-500">Creator coin:</span> {shortAddress(zoraStatus.creatorCoin?.address)}</div>
              </div>
            ) : null}
            <button type="button" onClick={onFinish} className="btn-secondary btn-no-icon inline-flex">
              Continue to done
            </button>
          </div>
        ) : null}

        {step === 'done' ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              You are on the waitlist. Identity linking, social boosts, and advanced wallet permissions now live in <code>/accounts</code>.
            </p>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <div>Email: {(account?.email ?? normalizeEmail(email)) || '—'}</div>
              <div>Points: {account?.score?.points ?? 0}</div>
              <div>Tier: {account?.score?.tier ?? 0}</div>
            </div>
            <Link to="/accounts" className="btn-accent btn-no-icon inline-flex">
              Manage identities in /accounts
            </Link>
          </div>
        ) : null}

        {error ? <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
      </div>
    </section>
  )
}

