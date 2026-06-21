import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLogin, usePrivy } from '@privy-io/react-auth'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
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

export function WaitlistFlow(props: { sectionId?: string }) {
  const sectionId = props.sectionId ?? 'waitlist-page'
  const { login } = useSafeWaitlistLogin()
  const privy = useSafePrivyHook()

  const [emailBusy, setEmailBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [sessionAddress, setSessionAddress] = useState<string | null>(null)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const autoPromptAttemptedRef = useRef(false)
  const signupInFlightRef = useRef(false)

  useEffect(() => {
    if (!privy.ready) return
    let cancelled = false
    void (async () => {
      const address = await readAuthSessionAddress()
      if (cancelled) return
      setSessionAddress(address)
      setSessionHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [privy.ready])

  const handleEmailSignup = useCallback(async () => {
    // R5 fix: in-flight guard prevents concurrent execution when the
    // auto-prompt effect and a manual button click overlap on the same tick.
    if (signupInFlightRef.current) return
    signupInFlightRef.current = true
    setError(null)
    setStatus(null)
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
        throw new Error('Could not verify your email session. Please try again.')
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
      setStatus('You are on the waitlist. You can now continue to app sign-in anytime.')
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
    setStatus(null)
    try {
      await runWaitlistPrivyLogout({
        logout: privy.logout ?? null,
        readToken: privy.getAccessToken ?? null,
      })
      setSessionAddress(null)
      setSessionHydrated(true)
    } finally {
      setSignOutBusy(false)
    }
  }, [privy.getAccessToken, privy.logout, signOutBusy])

  useEffect(() => {
    if (autoPromptAttemptedRef.current) return
    if (!sessionHydrated) return
    if (!privy.ready) return
    if (sessionAddress || emailBusy || signOutBusy) return

    autoPromptAttemptedRef.current = true
    void handleEmailSignup()
  }, [emailBusy, handleEmailSignup, privy.ready, sessionAddress, sessionHydrated, signOutBusy])

  const isBusy = emailBusy || signOutBusy

  return (
    <section id={sectionId} className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="rounded-3xl border-0 bg-black/40 p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Join the waitlist</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          Email sign-up opens automatically when this page loads.
        </p>
        <p className="mt-1 text-sm leading-6 text-zinc-400">
          If the pop-up does not appear, use the button below.
        </p>

        <div className="mt-8 rounded-2xl border-0 p-4">
          <p className="label text-zinc-400">Email signup</p>
          <h2 className="mt-1 text-lg font-medium text-white">Sign up with email</h2>
          <p className="mt-2 text-sm text-zinc-400">Use email OTP to create or recover your 4626 account.</p>
          <Button
            type="button"
            variant="primary"
            className="mt-4 w-full border-0"
            onClick={() => void handleEmailSignup()}
            disabled={isBusy || !privy.ready}
          >
            {emailBusy ? (
              <span className="inline-flex items-center gap-2">
                <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                Signing up…
              </span>
            ) : (
              'Sign up with email'
            )}
          </Button>
        </div>

        {status ? (
          <p className="mt-5 rounded-xl border-0 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 rounded-xl border-0 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        ) : null}

        {sessionAddress ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/swap"
              className="inline-flex h-10 items-center rounded-lg bg-[rgb(var(--brand-primary))] px-4 text-sm font-medium text-white transition hover:bg-[rgb(var(--brand-hover))]"
            >
              Enter app
            </Link>
            <button
              type="button"
              className="text-sm text-red-300/90 transition hover:text-red-200"
              onClick={() => void handleSignOut()}
              disabled={isBusy}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
