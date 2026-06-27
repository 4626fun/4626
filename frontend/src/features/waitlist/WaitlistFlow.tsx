import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react'
import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { APP_ORIGIN } from '@/lib/env/host'
import { bridgePrivySession } from '@/features/waitlist/waitlistHandoff'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'

type WaitlistBootstrapResponse = {
  requiresPrivyAuth: boolean
}

type AuthMeResponse = {
  address: string
} | null

const PRIVY_ACCESS_TOKEN_TIMEOUT_MS = 4_000
const PRIVY_ACCESS_TOKEN_ATTEMPTS = 8
const PRIVY_ACCESS_TOKEN_RETRY_DELAY_MS = 250
const OTP_RESEND_DELAY_MS = 30_000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

type SafeLoginWithEmail = {
  sendCode: (input: { email: string }) => Promise<unknown>
  loginWithCode: (input: { code: string }) => Promise<unknown>
}

function useSafeLoginWithEmail(): SafeLoginWithEmail {
  try {
    return useLoginWithEmail() as unknown as SafeLoginWithEmail
  } catch {
    return {
      sendCode: async () => {},
      loginWithCode: async () => {},
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

type SignupStep = 'email' | 'code'

export function WaitlistFlow(props: { sectionId?: string }) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const privy = useSafePrivyHook()
  const { sendCode, loginWithCode } = useSafeLoginWithEmail()

  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [sessionAddress, setSessionAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listCount, setListCount] = useState<number | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const signupInFlightRef = useRef(false)
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const codeInputRef = useRef<HTMLInputElement | null>(null)

  // Intentional entry from the marketing "Join waitlist" CTA (`/waitlist?join=1`).
  // Used only to auto-focus the inline email field. The email/OTP entry renders
  // inside the card, so there is no modal to auto-open (preserves UX-002: a
  // passive arrival just shows the card).
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

  // Auto-focus the email field on intentional CTA arrival.
  useEffect(() => {
    if (!joinIntent || !privy.ready || sessionAddress || step !== 'email') return
    emailInputRef.current?.focus()
  }, [joinIntent, privy.ready, sessionAddress, step])

  // Focus the code field as soon as we advance to the OTP step.
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus()
  }, [step])

  // Tick the resend countdown while it is pending.
  useEffect(() => {
    if (resendAvailableAt == null || resendAvailableAt <= Date.now()) return
    const timer = globalThis.setInterval(() => setNowMs(Date.now()), 1_000)
    return () => globalThis.clearInterval(timer)
  }, [resendAvailableAt])

  // Shared post-authentication tail: once Privy is authenticated (after
  // `loginWithCode`), bridge it into a 4626 session, bootstrap the waitlist row,
  // and confirm the HttpOnly session. Identical to the prior modal path — only
  // the trigger changed (inline OTP instead of a popup).
  const finishJoinAfterPrivyAuth = useCallback(async () => {
    let bridged = false
    try {
      const privyToken = await readPrivyAccessTokenWithRetries({
        read: privy.getAccessToken?.bind(privy) ?? null,
      })
      if (!privyToken) {
        // Most common cause: the `privy-session` marker cookie is blocked as a
        // third-party cookie (see loopbackSessionMarkerShim.ts), or a wallet
        // extension destabilized embedded-wallet init.
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
    } catch (joinError) {
      // R4: if the Privy->4626 bridge succeeded but a later step failed, clear
      // the stale HttpOnly session so a retry does not inherit a session for an
      // incomplete account.
      if (bridged) {
        await runWaitlistPrivyLogout({
          logout: privy.logout ?? null,
          readToken: privy.getAccessToken ?? null,
        }).catch(() => {})
      }
      throw joinError
    }
  }, [privy])

  // Step 1 — send the 6-digit OTP to the entered email (inline, no modal).
  const handleSendCode = useCallback(
    async (resend = false) => {
      if (signupInFlightRef.current) return
      const normalizedEmail = email.trim()
      if (!isValidEmail(normalizedEmail)) {
        setError('Enter a valid email address.')
        return
      }
      signupInFlightRef.current = true
      setError(null)
      setEmailBusy(true)
      try {
        await sendCode({ email: normalizedEmail })
        setStep('code')
        setCode('')
        setResendAvailableAt(Date.now() + OTP_RESEND_DELAY_MS)
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : `Could not ${resend ? 'resend' : 'send'} the verification code. Please try again.`,
        )
      } finally {
        signupInFlightRef.current = false
        setEmailBusy(false)
      }
    },
    [email, sendCode],
  )

  // Step 2 — verify the OTP, then bridge + bootstrap the waitlist session.
  const handleVerifyCode = useCallback(async () => {
    if (signupInFlightRef.current) return
    const normalizedCode = code.replace(/\s+/g, '')
    if (normalizedCode.length < 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    signupInFlightRef.current = true
    setError(null)
    setCodeBusy(true)
    try {
      await loginWithCode({ code: normalizedCode })
      await finishJoinAfterPrivyAuth()
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify the code. Please try again.')
    } finally {
      signupInFlightRef.current = false
      setCodeBusy(false)
    }
  }, [code, loginWithCode, finishJoinAfterPrivyAuth])

  const handleEditEmail = useCallback(() => {
    setStep('email')
    setCode('')
    setError(null)
  }, [])

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
      setStep('email')
      setEmail('')
      setCode('')
    } finally {
      setSignOutBusy(false)
    }
  }, [privy.getAccessToken, privy.logout, signOutBusy])

  const handleEmailFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleSendCode(false)
  }

  const handleCodeFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleVerifyCode()
  }

  const isBusy = emailBusy || codeBusy || signOutBusy
  const canResend = resendAvailableAt == null || resendAvailableAt <= nowMs
  const resendSeconds =
    resendAvailableAt != null && resendAvailableAt > nowMs ? Math.ceil((resendAvailableAt - nowMs) / 1_000) : 0

  return (
    <section
      id={sectionId}
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
    >
      {/* Ambient background — faint wire grid + bottom fade */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-wire-grid opacity-[0.035]" />
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgb(var(--vault-bg) / 0.9))',
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-md px-4 py-10 sm:px-6 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full space-y-6 sm:space-y-7"
        >
          <div className="space-y-2 text-center">
            <h1 className="headline text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
              {sessionAddress ? "You're on the list" : 'Join the waitlist'}
            </h1>
            {sessionAddress ? (
              <p className="text-sm leading-relaxed text-zinc-400">
                Finish setup in the app, then start swapping.
              </p>
            ) : null}
            {sessionAddress && listCount != null && listCount > 0 ? (
              <p className="text-[11px] tracking-[0.2px] text-zinc-500">
                {listCount.toLocaleString()} creators on the list
              </p>
            ) : null}
          </div>

          <div className="relative">
            <div
              className="relative rounded-2xl p-5 sm:p-6"
              style={{
                background:
                  'linear-gradient(165deg, rgb(var(--vault-card)), rgb(var(--vault-card-raised)))',
                boxShadow:
                  '0 18px 45px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgb(var(--brand-primary) / 0.1), 0 0 28px 4px rgb(var(--brand-primary) / 0.16), 0 0 52px 14px rgb(var(--brand-primary) / 0.1), 0 0 84px 28px rgb(var(--brand-primary) / 0.05)',
              }}
            >
            {sessionAddress ? (
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
            ) : step === 'email' ? (
              <form className="space-y-4" onSubmit={handleEmailFormSubmit}>
                <div className="space-y-2">
                  <label htmlFor="waitlist-email" className="block text-xs font-medium tracking-wide text-zinc-400">
                    Email address
                  </label>
                  <input
                    ref={emailInputRef}
                    id="waitlist-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    disabled={emailBusy || !privy.ready}
                    className="block h-12 w-full rounded-xl border border-white/10 bg-[rgb(var(--vault-bg))] px-4 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgb(var(--brand-primary)/0.7)] disabled:opacity-60"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full transition-shadow hover:shadow-[0_0_28px_rgb(var(--brand-primary)/0.25)]"
                  disabled={emailBusy || !privy.ready || !isValidEmail(email)}
                >
                  {emailBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                      Sending code…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Join with email
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  )}
                </Button>
                <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                  {!privy.ready ? 'Preparing secure session…' : 'We’ll send a 6-digit code to your email.'}
                </p>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={handleCodeFormSubmit}>
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span className="truncate">
                    Code sent to <span className="font-mono text-zinc-300">{email.trim()}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleEditEmail}
                    disabled={isBusy}
                    className="inline-flex shrink-0 items-center gap-1 tracking-wide text-zinc-400 transition hover:text-zinc-200 disabled:opacity-50"
                  >
                    <ArrowLeft className="size-3" aria-hidden="true" />
                    Edit
                  </button>
                </div>
                <label htmlFor="waitlist-code" className="sr-only">
                  Email verification code
                </label>
                <input
                  ref={codeInputRef}
                  id="waitlist-code"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  enterKeyHint="go"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\s+/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={codeBusy}
                  className="block h-12 w-full rounded-xl border border-white/10 bg-[rgb(var(--vault-bg))] px-4 text-center font-mono text-lg tracking-[0.4em] text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgb(var(--brand-primary)/0.7)] disabled:opacity-60"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full transition-shadow hover:shadow-[0_0_28px_rgb(var(--brand-primary)/0.25)]"
                  disabled={codeBusy || code.replace(/\s+/g, '').length < 6}
                >
                  {codeBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                      Verifying…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Verify &amp; join
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => void handleSendCode(true)}
                  disabled={emailBusy || !canResend}
                  className="block w-full text-center text-[11px] tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                >
                  {canResend ? 'Resend code' : `Resend in ${resendSeconds}s`}
                </button>
              </form>
            )}
            </div>
          </div>

          {error ? (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-rose-200">{error}</p>
            </div>
          ) : null}

          <p className="text-center text-[10px] tracking-wide text-zinc-600">
            <span className="text-zinc-500">Powered by</span>{' '}
            <a
              href="https://privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 transition hover:text-zinc-300"
            >
              Privy
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
