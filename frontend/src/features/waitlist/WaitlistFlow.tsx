import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

type WaitlistBootstrapResponse = {
  requiresPrivyAuth: boolean
}

function useSafePrivyHook() {
  try {
    return usePrivy() as {
      ready?: boolean
      getAccessToken?: (() => Promise<string | null>) | null
    }
  } catch {
    return {
      ready: false,
      getAccessToken: null as null | (() => Promise<string | null>),
    }
  }
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
  const auth = useSiweAuth()
  const privy = useSafePrivyHook()

  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const autoPromptAttemptedRef = useRef(false)

  const handleEmailSignup = useCallback(async () => {
    setError(null)
    setStatus(null)
    setEmailBusy(true)
    try {
      const signedIn = await auth.signIn({ method: 'privy' })
      if (!signedIn) return

      const privyToken = (await privy.getAccessToken?.().catch(() => null)) ?? ''
      const bootstrap = await bootstrapWaitlist(privyToken)
      if (bootstrap.requiresPrivyAuth) {
        throw new Error('Could not verify waitlist signup. Please try again.')
      }
      setStatus('You are on the waitlist. You can now continue to app sign-in anytime.')
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Email signup failed.')
    } finally {
      setEmailBusy(false)
    }
  }, [auth, privy])

  useEffect(() => {
    if (autoPromptAttemptedRef.current) return
    if (!privy.ready) return
    if (auth.hasSession || auth.busy || emailBusy) return

    autoPromptAttemptedRef.current = true
    void handleEmailSignup()
  }, [auth.busy, auth.hasSession, emailBusy, handleEmailSignup, privy.ready])

  const isBusy = emailBusy || auth.busy

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
        {error || auth.error ? (
          <p className="mt-5 rounded-xl border-0 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {error || auth.error}
          </p>
        ) : null}

        {auth.hasSession ? (
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
              onClick={() => void auth.signOut()}
              disabled={auth.busy}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
