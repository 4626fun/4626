import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Layers,
  Shield,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
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

const TRUST_CHIPS = [
  'Email-only access',
  'Base-native',
  'Creator vault launch',
  'No wallet required to join',
] as const

const VALUE_PROPS = [
  {
    icon: Layers,
    title: 'Creator vaults',
    desc: 'Turn creator coins into redeemable onchain shares.',
  },
  {
    icon: Shield,
    title: 'Non-custodial',
    desc: 'Transparent, self-sovereign ownership on Base.',
  },
  {
    icon: TrendingUp,
    title: 'Early access',
    desc: 'Position before public vaults open to everyone.',
  },
  {
    icon: Sparkles,
    title: '4626 rollout',
    desc: 'Be first in line for the ERC-4626 launch wave.',
  },
] as const

const FOOTER_TRUST = 'Built on Base · Non-custodial · ERC-4626 standard' as const

/* Staggered entrance — children fade in one by one after the container mounts */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
}
const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

export function WaitlistFlow(props: { sectionId?: string }) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const { login } = useSafeWaitlistLogin()
  const privy = useSafePrivyHook()

  const [emailBusy, setEmailBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [sessionAddress, setSessionAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listCount, setListCount] = useState<number | null>(null)
  const signupInFlightRef = useRef(false)

  useEffect(() => {
    if (!privy.ready) return
    let cancelled = false
    void (async () => {
      const address = await readAuthSessionAddress()
      if (cancelled) return
      setSessionAddress(address)
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

  // UX-002: Do not auto-open the Privy login modal on page load. Previously
  // this effect fired handleEmailSignup() as soon as the session hydrated with
  // no address, which auto-opened the Privy "log in or sign up" dialog on top
  // of the waitlist card — most visibly when an unauthenticated visitor was
  // redirected from /swap to /waitlist. The card's "Join with email" button is
  // the intended entry point; let the user click it themselves.
  const isBusy = emailBusy || signOutBusy

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

      <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.95fr] lg:gap-12">
          {/* ─── Left column — hero copy ─── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col justify-center"
          >
            <div className="flex items-center gap-2 self-start">
              <div className="status-active">
                <span className="label">Creator vault launch · Base</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/15 bg-amber-500/[0.05] px-2 py-0.5 text-[9px] font-medium tracking-wide text-amber-300/70">
                <Sparkles className="size-2" aria-hidden="true" />
                Limited early access
              </span>
            </div>

            <h1 className="headline mt-4 text-4xl leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-[3.25rem]">
              Early access to
              <br />
              <span className="glow-brand">creator-owned vaults.</span>
            </h1>

            <p className="mt-4 max-w-md text-[14px] font-light leading-relaxed text-zinc-400">
              The first wave of creators turning their coins into redeemable onchain vault shares. Email gets you on the list. No wallet required to start.
            </p>

            {/* trust chips — staggered entrance */}
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="mt-5 flex flex-wrap gap-1.5"
            >
              {TRUST_CHIPS.map((chip) => (
                <motion.li
                  key={chip}
                  variants={staggerItem}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium tracking-[0.5px] text-zinc-300"
                >
                  {chip}
                </motion.li>
              ))}
            </motion.ul>

            {/* value props — staggered entrance with icons */}
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="mt-5 space-y-2.5"
            >
              {VALUE_PROPS.map((vp) => {
                const Icon = vp.icon
                return (
                  <motion.li key={vp.title} variants={staggerItem} className="flex items-start gap-2.5">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.02]">
                      <Icon className="size-2.5 text-[rgb(var(--brand-primary))]" aria-hidden="true" />
                    </span>
                    <span className="text-[12.5px] leading-snug text-zinc-400">
                      <span className="font-medium text-zinc-200">{vp.title}</span>
                      <span> — {vp.desc}</span>
                    </span>
                  </motion.li>
                )
              })}
            </motion.ul>
          </motion.div>

          {/* ─── Right column — access pass card ─── */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center lg:justify-end"
          >
            <div
              className={`glass-card relative w-full max-w-md overflow-hidden p-6 ring-1 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-8 ${
                sessionAddress
                  ? 'ring-[rgb(var(--brand-primary)/0.18)] shadow-[0_30px_90px_rgba(0,0,0,0.65)]'
                  : 'ring-white/5'
              }`}
            >
              {/* card top accent — gradient hairline */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgb(var(--brand-primary) / 0.4), transparent)',
                }}
                aria-hidden="true"
              />

              {/* card accent glow */}
              <div
                className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgb(var(--brand-primary) / 0.16) 0%, transparent 70%)',
                }}
                aria-hidden="true"
              />

              {/* vault preview — prominent only before joining for visual interest */}
              {!sessionAddress && (
                <div className="relative mb-6 flex justify-center" aria-hidden="true">
                  <div className="relative size-24">
                    {/* outer ring */}
                    <div className="absolute inset-0 rounded-full border border-white/10" />
                    {/* animated pulse */}
                    <motion.div
                      className="absolute inset-0 rounded-full border border-[rgb(var(--brand-primary)/0.3)]"
                      animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* mid ring */}
                    <div className="absolute inset-[12px] rounded-full border border-[rgb(var(--brand-primary)/0.35)]" />
                    {/* inner glow */}
                    <div
                      className="absolute inset-[22px] rounded-full"
                      style={{
                        background: 'radial-gradient(circle, rgb(var(--brand-primary) / 0.22) 0%, transparent 72%)',
                      }}
                    />
                    {/* core symbol */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="font-mono text-lg font-light"
                        style={{ color: 'rgb(var(--brand-primary))' }}
                      >
                        ■
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* minimal confirmation for joined state */}
              {sessionAddress && (
                <div className="mb-2 flex justify-center">
                  <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-2 py-0.5 text-[9px] uppercase tracking-[1px] text-emerald-400">
                    <CheckCircle2 className="size-2.5" aria-hidden="true" />
                    <span>On the list</span>
                  </div>
                </div>
              )}

              {/* card header */}
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className="label">Access pass</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-zinc-400">
                    <span
                      className={`size-1.5 rounded-full ${sessionAddress ? 'bg-emerald-400' : 'bg-zinc-500'}`}
                    />
                    {sessionAddress ? 'On the list' : 'Open'}
                  </span>
                </div>

                <h2 className="mt-2 text-lg font-medium tracking-tight text-white">
                  {sessionAddress ? 'You are on the list' : 'Join the launch list'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {sessionAddress
                    ? "You're on the launch list. Enter the app to finish one-time wallet setup and start swapping."
                    : 'Use email OTP to create or recover your 4626 account. No wallet required to join.'}
                </p>

                {sessionAddress && listCount != null && listCount > 0 ? (
                  <div className="mt-1 text-[10px] text-zinc-500 tracking-[0.2px]">
                    {listCount.toLocaleString()} creators on the list
                  </div>
                ) : null}
              </div>

              {/* Primary action — context aware. When you can enter the app, we do not show "Join with email". */}
              <div className={`relative ${sessionAddress ? 'mt-7' : 'mt-6'}`}>
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
                      {!privy.ready
                        ? 'Preparing secure session…'
                        : 'A secure code will be sent to your email.'}
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
                    <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                      You're on the list. One-time wallet setup remains before swaps can execute.
                    </p>
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
                  className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-rose-200">{error}</p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>

        {/* footer trust line */}
        <p className="mt-8 text-center text-[11px] font-light tracking-wide text-zinc-600">
          {FOOTER_TRUST}
        </p>
      </div>
    </section>
  )
}
