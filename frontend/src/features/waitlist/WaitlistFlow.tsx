import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { APP_ORIGIN } from '@/lib/env/host'
import { bridgePrivySession } from '@/features/waitlist/waitlistHandoff'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import { WaitlistTwitterLinkPanel } from '@/features/waitlist/WaitlistTwitterLinkPanel'
import { computeProgress } from '@/features/waitlist/waitlistTiers'
import { readPrivyAccessTokenWithRetries } from '@/lib/privy/accessToken'
import { linkAndSyncPrivyProvider } from '@/lib/privy/providerLink'
import { usePrivyOAuthReturnBackendSync } from '@/lib/privy/usePrivyOAuthReturnBackendSync'
import { useSafeLogin, useSafeLoginWithEmail, useSafePrivy } from '@/lib/privy/safeHooks'
import { computeAcceptedFromAppAccessStatus } from '@/app/accessShared'
import { useAccountMe } from '@/hooks/useAccountMe'
import { fetchAccountTrayPoints } from '@/lib/waitlist/accountTrayPoints'

type WaitlistBootstrapResponse = {
  requiresPrivyAuth: boolean
}

type AuthMeResponse = {
  address: string
} | null

const OTP_RESEND_DELAY_MS = 30_000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
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

const WAITLIST_PANEL_STYLE = {
  background: 'linear-gradient(165deg, rgb(var(--vault-card)), rgb(var(--vault-card-raised)))',
  boxShadow:
    '0 18px 45px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgb(var(--brand-primary) / 0.1), 0 0 28px 4px rgb(var(--brand-primary) / 0.16), 0 0 52px 14px rgb(var(--brand-primary) / 0.1), 0 0 84px 28px rgb(var(--brand-primary) / 0.05)',
} as const

export function WaitlistFlow(props: { sectionId?: string }) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const privy = useSafePrivy()
  const { sendCode, loginWithCode } = useSafeLoginWithEmail()
  const { login } = useSafeLogin()

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

  const { me: accountMe, refresh: refreshAccountMe } = useAccountMe()
  const [pointsTotal, setPointsTotal] = useState<number | null>(null)
  const [pointsRefreshKey, setPointsRefreshKey] = useState(0)
  const [twitterBusy, setTwitterBusy] = useState(false)
  const [twitterError, setTwitterError] = useState<string | null>(null)

  const handleLinkTwitter = useCallback(async () => {
    if (twitterBusy) return
    setTwitterBusy(true)
    setTwitterError(null)
    try {
      const data = await linkAndSyncPrivyProvider({
        privy,
        provider: 'twitter',
        login: login ?? null,
        getAccessToken: privy.getAccessToken?.bind(privy) ?? null,
      })
      if (data) {
        refreshAccountMe()
        setPointsRefreshKey((key) => key + 1)
      }
    } catch (linkError) {
      setTwitterError(linkError instanceof Error ? linkError.message : 'Could not connect Twitter.')
    } finally {
      setTwitterBusy(false)
    }
  }, [login, privy, refreshAccountMe, twitterBusy])

  usePrivyOAuthReturnBackendSync({
    providers: ['twitter'],
    privyReady: privy.ready,
    privyAuthenticated: privy.authenticated,
    privyUser: privy.user,
    linkedMethods: accountMe?.linkedMethods,
    getAccessToken: privy.getAccessToken?.bind(privy) ?? null,
    onSynced: () => {
      refreshAccountMe()
      setPointsRefreshKey((key) => key + 1)
    },
    onError: (syncError, provider) => {
      if (provider !== 'twitter') return
      setTwitterError(syncError instanceof Error ? syncError.message : 'Could not sync Twitter link.')
    },
  })

  // Real waitlist points come from the scored snapshot (`/api/accounts/me/points`).
  // `/api/accounts/me` does not populate `score`, so reading `accountMe.score`
  // always returned 0 — fetch the snapshot directly once the session exists.
  const getPointsAccessToken = privy.getAccessToken ?? null
  useEffect(() => {
    if (!sessionAddress || !getPointsAccessToken) return
    let cancelled = false
    void (async () => {
      try {
        const token = await getPointsAccessToken().catch(() => null)
        if (!token || cancelled) return
        const snapshot = await fetchAccountTrayPoints(40, token)
        if (!cancelled) setPointsTotal(snapshot.points.total)
      } catch {
        // auth-required or transient — keep any prior value
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionAddress, getPointsAccessToken, pointsRefreshKey])

  const appAccepted = computeAcceptedFromAppAccessStatus(accountMe?.appAccessStatus ?? null)
  const twitterLinked = (accountMe?.linkedMethods?.twitter ?? []).length > 0
  const points = pointsTotal ?? accountMe?.score?.points ?? 0
  const progress = computeProgress(points)

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
          {sessionAddress ? (
            <div className="relative">
              <div className="relative rounded-2xl p-6 text-center sm:p-8" style={WAITLIST_PANEL_STYLE}>
                <div className="space-y-3">
                  <h1 className="headline text-2xl leading-tight tracking-[-0.03em] sm:text-3xl">
                    {appAccepted ? "You're approved" : "You're on the list"}
                  </h1>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    {appAccepted
                      ? 'Open the app to continue.'
                      : "We'll notify you when your spot opens."}
                  </p>
                </div>

                {!appAccepted ? (
                  <div className="mt-7 flex flex-col items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                      <span
                        className="size-1.5 rounded-full bg-[rgb(var(--brand-primary))]"
                        aria-hidden="true"
                      />
                      {progress.currentTier.name}
                    </span>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="bg-gradient-to-b from-white to-zinc-400/90 bg-clip-text text-[40px] font-semibold leading-none tracking-tight tabular-nums text-transparent">
                        {points.toLocaleString()}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">pts</span>
                    </div>
                  </div>
                ) : null}

                {!appAccepted ? (
                  <WaitlistTwitterLinkPanel
                    linked={twitterLinked}
                    busy={twitterBusy}
                    onConnect={() => {
                      setTwitterError(null)
                      void handleLinkTwitter()
                    }}
                  />
                ) : null}

                {twitterError ? (
                  <p className="mt-3 text-left text-[11px] leading-relaxed text-rose-300">{twitterError}</p>
                ) : null}

                {!appAccepted ? (
                  <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                    {listCount != null && listCount > 0 ? (
                      <>
                        <span>{listCount.toLocaleString()} on the list</span>
                        <span aria-hidden="true">·</span>
                      </>
                    ) : null}
                    <Link
                      to="/leaderboard"
                      className="group inline-flex items-center gap-1 font-medium text-zinc-400 transition hover:text-white"
                    >
                      See leaderboard
                      <ArrowRight
                        className="size-3 transition group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col items-stretch gap-3">
                  {appAccepted ? (
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
                  ) : null}
                  <button
                    type="button"
                    className="text-xs tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                    onClick={() => void handleSignOut()}
                    disabled={isBusy}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="headline text-center text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
                Join the waitlist
              </h1>

              <div className="relative">
                <div className="relative rounded-2xl p-5 sm:p-6" style={WAITLIST_PANEL_STYLE}>
                  {step === 'email' ? (
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
            </>
          )}

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
