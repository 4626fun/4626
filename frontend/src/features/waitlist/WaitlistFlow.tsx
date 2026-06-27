import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, AlertCircle, Layers, Shield, TrendingUp } from 'lucide-react'
import { useLogin, usePrivy } from '@privy-io/react-auth'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { APP_ORIGIN } from '@/lib/env/host'
import { bridgePrivySession } from '@/features/waitlist/waitlistHandoff'
import { isAlreadyLoggedInAuthError, runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'

type WaitlistBootstrapResponse = {
  requiresPrivyAuth: boolean
}

type AuthMeResponse = {
  address: string
} | null

const PRIVY_ACCESS_TOKEN_TIMEOUT_MS = 4_000
const PRIVY_ACCESS_TOKEN_ATTEMPTS = 8
const PRIVY_ACCESS_TOKEN_RETRY_DELAY_MS = 250

function useSafeWaitlistLogin() {
  try {
    return useLogin() as {
      login: (options?: unknown) => Promise<void>
    }
  } catch {
    return {
      login: async () => {},
    }
  }
}

function useSafePrivyHook() {
  try {
    return usePrivy() as {
      ready?: boolean
      authenticated?: boolean
      getAccessToken?: (() => Promise<string | null>) | null
      logout?: (() => Promise<void>) | null
    }
  } catch {
    return {
      ready: false,
      authenticated: false,
      getAccessToken: null as null | (() => Promise<string | null>),
      logout: null as null | (() => Promise<void>),
    }
  }
}

async function readAuthSessionAddress(): Promise<string | null> {
  const response = await apiFetch('/api/auth/me', {
    headers: { Accept: 'application/json' },
  }).catch(() => null)
  if (!response?.ok) return null
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<AuthMeResponse> | null
  if (!payload?.success) return null
  const address = payload.data && typeof payload.data.address === 'string' ? payload.data.address.trim() : ''
  return address || null
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => globalThis.clearTimeout(timeoutId))
  })
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export async function readPrivyAccessTokenWithRetries(params: {
  read: (() => Promise<string | null>) | null | undefined
  attempts?: number
  retryDelayMs?: number
  timeoutMs?: number
}): Promise<string> {
  const read = params.read
  if (typeof read !== 'function') return ''
  const attempts = Math.max(1, Number(params.attempts ?? PRIVY_ACCESS_TOKEN_ATTEMPTS))
  const retryDelayMs = Math.max(0, Number(params.retryDelayMs ?? PRIVY_ACCESS_TOKEN_RETRY_DELAY_MS))
  const timeoutMs = Math.max(1, Number(params.timeoutMs ?? PRIVY_ACCESS_TOKEN_TIMEOUT_MS))

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const token = await withTimeout(
      Promise.resolve()
        .then(() => read())
        .then((value) => String(value ?? '').trim())
        .catch(() => ''),
      timeoutMs,
      'Privy access token read timed out.',
    ).catch(() => '')
    if (token) return token
    if (attempt < attempts - 1 && retryDelayMs > 0) {
      await sleep(retryDelayMs)
    }
  }
  return ''
}

async function bootstrapWaitlist(privyAccessToken: string): Promise<WaitlistBootstrapResponse> {
  const token = privyAccessToken.trim()
  if (!token) {
    throw new Error('Missing Privy auth token.')
  }
  const response = await apiFetch('/api/waitlist/bootstrap', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || 'Could not finish waitlist signup.')
  }
  return payload.data
}

const FEATURES = [
  { icon: Layers, label: 'Creator vaults' },
  { icon: Shield, label: 'Non-custodial' },
  { icon: TrendingUp, label: 'Early access' },
] as const

const FOOTER_TRUST = 'Built on Base · Non-custodial · ERC-4626 standard' as const

export function WaitlistFlow(props: { sectionId?: string }) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const { login } = useSafeWaitlistLogin()
  const privy = useSafePrivyHook()

  const [emailBusy, setEmailBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [sessionAddress, setSessionAddress] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listCount, setListCount] = useState<number | null>(null)
  const [autoJoinResolved, setAutoJoinResolved] = useState(false)
  const signupInFlightRef = useRef(false)
  const autoJoinAttemptedRef = useRef(false)

  // Intentional entry from the marketing "Join waitlist" CTA (`/waitlist?join=1`).
  // Captured once on mount so a later URL cleanup does not re-trigger the popup
  // on refresh. A passive arrival (no flag) never auto-opens — preserves UX-002.
  const joinIntent = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(window.location.search).get('join') === '1'
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!privy.ready) return
    let cancelled = false
    void (async () => {
      const address = await readAuthSessionAddress()
      if (cancelled) return
      setSessionAddress(address)
      setSessionChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [privy.ready])

  // Lightweight social proof — only used for quiet display when real data exists.
  // Never fabricates "full" or capacity states.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/api/waitlist/stats', { headers: { Accept: 'application/json' } })
        if (!res?.ok || cancelled) return
        const json = (await res.json().catch(() => null)) as ApiEnvelope<{ signedUpCount?: number }> | null
        if (json?.success && typeof json.data?.signedUpCount === 'number' && json.data.signedUpCount > 0) {
          setListCount(json.data.signedUpCount)
        }
      } catch {
        // fail open — no stats shown
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleEmailSignup = useCallback(async () => {
    // R5 fix: in-flight guard prevents concurrent execution when a user
    // double-clicks the "Join with email" button on the same tick.
    if (signupInFlightRef.current) return
    signupInFlightRef.current = true
    setError(null)
    setEmailBusy(true)
    let bridged = false
    try {
      const needsInteractiveLogin = !privy.authenticated
      if (needsInteractiveLogin) {
        try {
          await login({ loginMethods: ['email'] } as any)
        } catch (loginError) {
          if (!isAlreadyLoggedInAuthError(loginError)) {
            throw loginError
          }
        }
      }

      const privyToken = await readPrivyAccessTokenWithRetries({
        read: privy.getAccessToken?.bind(privy) ?? null,
      })
      if (!privyToken) {
        // Diagnostic logging to help identify the root cause when
        // getAccessToken() returns empty after OTP. The most common cause is
        // the privy-session marker cookie being a blocked third-party cookie
        // (see loopbackSessionMarkerShim.ts). Browser wallet extensions can
        // also destabilize Privy's embedded wallet initialization.
        console.warn('[waitlist] getAccessToken returned empty after OTP', {
          origin: typeof window !== 'undefined' ? window.location.origin : 'ssr',
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'ssr',
          hasMarkerCookie:
            typeof document !== 'undefined' ? document.cookie.includes('privy-session') : false,
          authenticated: privy.authenticated,
          ready: privy.ready,
          hasGetAccessToken: typeof privy.getAccessToken === 'function',
        })
        throw new Error(
          'Could not verify your email session. Please try again. If the issue persists, try an incognito/private window or temporarily disable browser wallet extensions.',
        )
      }

      bridged = await bridgePrivySession(privyToken)
      if (!bridged) {
        throw new Error('Could not create your app session. Please try again.')
      }

      let bootstrap = await bootstrapWaitlist(privyToken)
      if (bootstrap.requiresPrivyAuth) {
        // One bounded retry handles the post-OTP session race where the first
        // token read can be transiently empty even after Privy sign-in succeeds.
        const retryToken = await readPrivyAccessTokenWithRetries({
          read: privy.getAccessToken?.bind(privy) ?? null,
          attempts: 4,
          retryDelayMs: 200,
        })
        if (retryToken) {
          bootstrap = await bootstrapWaitlist(retryToken)
        }
      }
      if (bootstrap.requiresPrivyAuth) {
        throw new Error('Could not verify waitlist signup. Please try again.')
      }

      const confirmedSessionAddress = await readAuthSessionAddress()
      if (!confirmedSessionAddress) {
        throw new Error('Sign-in finished but session is still syncing. Please try once more.')
      }
      setSessionAddress(confirmedSessionAddress)
      // No banner needed — the card itself transforms into the confirmed state.
    } catch (signupError) {
      // R4 fix: if the Privy->4626 session bridge succeeded but a later step
      // (e.g. bootstrap) failed, clear the stale HttpOnly session cookie so
      // a retry does not inherit a session for an incomplete account.
      if (bridged) {
        await runWaitlistPrivyLogout({
          logout: privy.logout ?? null,
          readToken: privy.getAccessToken ?? null,
        }).catch(() => {})
      }
      setError(signupError instanceof Error ? signupError.message : 'Email signup failed.')
    } finally {
      signupInFlightRef.current = false
      setEmailBusy(false)
    }
  }, [login, privy])

  const handleSignOut = useCallback(async () => {
    if (signOutBusy) return
    setSignOutBusy(true)
    setError(null)
    try {
      await runWaitlistPrivyLogout({
        logout: privy.logout ?? null,
        readToken: privy.getAccessToken ?? null,
      })
      setSessionAddress(null)
    } finally {
      setSignOutBusy(false)
    }
  }, [privy.getAccessToken, privy.logout, signOutBusy])

  // UX-002: Never auto-open the Privy modal on *passive* page load (e.g. an
  // unauthenticated visitor redirected from /swap to /waitlist). It only opens
  // automatically when the user explicitly clicked the marketing "Join waitlist"
  // CTA, which carries `?join=1`. We wait for the initial session check so an
  // already-listed user lands on the "Enter app" state instead of a popup, and
  // we fire exactly once. After attempting, the `join` flag is stripped from the
  // URL so a refresh does not re-trigger the popup.
  useEffect(() => {
    if (!joinIntent) return
    if (!privy.ready || !sessionChecked) return
    if (autoJoinAttemptedRef.current) return
    if (sessionAddress) {
      setAutoJoinResolved(true)
      return
    }
    autoJoinAttemptedRef.current = true
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('join')
        window.history.replaceState(window.history.state, '', url.toString())
      } catch {
        // non-fatal — URL cleanup is best-effort
      }
    }
    void (async () => {
      try {
        await handleEmailSignup()
      } finally {
        setAutoJoinResolved(true)
      }
    })()
  }, [joinIntent, privy.ready, sessionChecked, sessionAddress, handleEmailSignup])

  const isBusy = emailBusy || signOutBusy

  // While the CTA-triggered popup is opening, keep the page as a quiet backdrop
  // (just the ambient background + a small status line) instead of the full
  // hero card. If the user cancels or an error occurs, the card is revealed so
  // they can retry with the button.
  const autoJoinActive = joinIntent && !autoJoinResolved && !sessionAddress && !error

  return (
    <section
      id={sectionId}
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
    >
      {/* Ambient background — radial brand glow + faint wire grid + bottom fade */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 0%, rgb(var(--brand-primary) / 0.14) 0%, transparent 65%)',
          }}
        />
        <div className="absolute inset-0 bg-wire-grid opacity-[0.035]" />
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgb(var(--vault-bg) / 0.9))',
          }}
        />
      </div>

      {autoJoinActive ? (
        <div className="relative flex flex-col items-center justify-center gap-4 px-6 text-center">
          <PixelWaveLoader name="wave-lr" size={18} color="rgba(255,255,255,0.85)" />
          <p className="text-sm font-light tracking-wide text-zinc-400">
            {privy.ready ? 'Opening secure email sign-in…' : 'Preparing secure session…'}
          </p>
        </div>
      ) : (
      <div className="relative mx-auto w-full max-w-md px-4 py-10 sm:px-6 sm:py-14">
        {/* ─── Single access-pass card — hero copy + signup in one ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`glass-card relative w-full overflow-hidden p-6 ring-1 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-8 ${
            sessionAddress
              ? 'ring-[rgb(var(--brand-primary)/0.18)] shadow-[0_30px_90px_rgba(0,0,0,0.65)]'
              : 'ring-white/5'
          }`}
        >
          {/* top accent hairline + corner glow */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, rgb(var(--brand-primary) / 0.4), transparent)',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgb(var(--brand-primary) / 0.16) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />

          {/* status row */}
          <div className="relative flex items-center justify-between gap-3">
            <div className="status-active">
              <span className="label">Creator vault launch · Base</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-zinc-400">
              <span className={`size-1.5 rounded-full ${sessionAddress ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              {sessionAddress ? 'On the list' : 'Open'}
            </span>
          </div>

          {/* headline + subcopy */}
          <h1 className="headline relative mt-4 text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
            {sessionAddress ? (
              "You're on the list"
            ) : (
              <>
                Early access to <span className="glow-brand">creator-owned vaults.</span>
              </>
            )}
          </h1>
          <p className="relative mt-3 text-sm leading-relaxed text-zinc-400">
            {sessionAddress
              ? 'Enter the app to finish one-time wallet setup and start swapping.'
              : 'Creators turning their coins into redeemable onchain vault shares. Email gets you on the list — no wallet required to join.'}
          </p>

          {sessionAddress && listCount != null && listCount > 0 ? (
            <div className="relative mt-2 text-[10px] tracking-[0.2px] text-zinc-500">
              {listCount.toLocaleString()} creators on the list
            </div>
          ) : null}

          {/* compact feature strip — only before joining */}
          {!sessionAddress && (
            <ul className="relative mt-5 flex flex-wrap gap-1.5">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium tracking-[0.5px] text-zinc-300"
                >
                  <Icon className="size-2.5 text-[rgb(var(--brand-primary))]" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          )}

          {/* primary action — context aware */}
          <div className="relative mt-6">
            {!sessionAddress ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full transition-shadow hover:shadow-[0_0_28px_rgb(var(--brand-primary)/0.25)]"
                  onClick={() => void handleEmailSignup()}
                  disabled={isBusy || !privy.ready}
                >
                  {emailBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                      Securing access…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Join with email
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  )}
                </Button>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
                  {!privy.ready ? 'Preparing secure session…' : 'A secure code will be sent to your email.'}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-stretch gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full transition-shadow hover:shadow-[0_0_28px_rgb(var(--brand-primary)/0.25)]"
                  asChild
                >
                  <a href={`${APP_ORIGIN}/swap`}>
                    Enter app
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </Button>
                <button
                  type="button"
                  className="self-center text-xs tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                  onClick={() => void handleSignOut()}
                  disabled={isBusy}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* error feedback only — success is communicated by the card transforming */}
          {error ? (
            <div
              className="relative mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-rose-200">{error}</p>
            </div>
          ) : null}
        </motion.div>

        {/* footer trust line */}
        <p className="mt-6 text-center text-[11px] font-light tracking-wide text-zinc-600">
          {FOOTER_TRUST}
        </p>
      </div>
      )}
    </section>
  )
}
