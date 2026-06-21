import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useConnect } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { filterHiddenInjectedConnectors } from '@/lib/wallet/wagmiConnectorSelection'

type WaitlistBootstrapResponse = {
  requiresPrivyAuth: boolean
}

function useSafePrivyHook() {
  try {
    return usePrivy() as {
      getAccessToken?: (() => Promise<string | null>) | null
    }
  } catch {
    return {
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
  const { isConnected, address } = useAccount()
  const { connectAsync, connectors, isPending } = useConnect()

  const [emailBusy, setEmailBusy] = useState(false)
  const [walletBusy, setWalletBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const visibleConnectors = useMemo(
    () => filterHiddenInjectedConnectors(connectors, providerCollision.shouldDisableInjectedConnector),
    [connectors, providerCollision.shouldDisableInjectedConnector],
  )

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

  const handleConnectWallet = useCallback(
    async (connectorId: string) => {
      setError(null)
      const connector = visibleConnectors.find((item) => item.id === connectorId)
      if (!connector) return
      await connectAsync({ connector })
    },
    [connectAsync, visibleConnectors],
  )

  const handleWalletSignIn = useCallback(async () => {
    setError(null)
    setStatus(null)
    setWalletBusy(true)
    try {
      const signedIn = await auth.signIn({ method: 'siwe' })
      if (!signedIn) return
      setStatus('Wallet sign-in complete. Welcome back.')
    } catch (signinError) {
      setError(signinError instanceof Error ? signinError.message : 'Wallet sign-in failed.')
    } finally {
      setWalletBusy(false)
    }
  }, [auth])

  const isBusy = emailBusy || walletBusy || auth.busy
  const walletSignInReady = isConnected && Boolean(address)

  return (
    <section id={sectionId} className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="rounded-3xl border-0 bg-black/40 p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Join the waitlist</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          New users join with email. Returning users can sign in with their EOA wallet.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-0 p-4">
            <p className="label text-zinc-400">New user</p>
            <h2 className="mt-1 text-lg font-medium text-white">Email signup</h2>
            <p className="mt-2 text-sm text-zinc-400">Use email OTP to create or recover your 4626 account.</p>
            <Button
              type="button"
              variant="primary"
              className="mt-4 w-full border-0"
              onClick={() => void handleEmailSignup()}
              disabled={isBusy}
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

          <div className="rounded-2xl border-0 p-4">
            <p className="label text-zinc-400">Returning user</p>
            <h2 className="mt-1 text-lg font-medium text-white">EOA wallet sign-in</h2>
            <p className="mt-2 text-sm text-zinc-400">Connect your wallet, then complete SIWE sign-in.</p>
            {!walletSignInReady ? (
              <div className="mt-4 space-y-2">
                {visibleConnectors.map((connector) => (
                  <Button
                    key={connector.uid}
                    type="button"
                    variant="primary"
                    className="w-full border-0"
                    onClick={() => void handleConnectWallet(connector.id)}
                    disabled={isBusy || isPending}
                  >
                    Connect {connector.name}
                  </Button>
                ))}
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                className="mt-4 w-full border-0"
                onClick={() => void handleWalletSignIn()}
                disabled={isBusy}
              >
                {walletBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
                    Signing in…
                  </span>
                ) : (
                  'Sign in with wallet'
                )}
              </Button>
            )}
          </div>
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
