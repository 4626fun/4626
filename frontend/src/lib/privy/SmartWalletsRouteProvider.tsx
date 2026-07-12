import { Suspense, lazy, type ReactNode } from 'react'
import { usePrivy } from '@privy-io/react-auth'

import { usePrivyClientStatus } from './client'
import { usePrivyAccessTokenReady } from './usePrivyAccessTokenReady'

const LazySmartWalletsProvider = lazy(async () => {
  const mod = await import('@privy-io/react-auth/smart-wallets')
  return { default: mod.SmartWalletsProvider }
})

/**
 * Route-scoped SmartWallets provider.
 *
 * Keep this out of the global app shell so smart-wallet internals only load
 * on routes that actually call `useSmartWallets()`.
 *
 * Gate on a live access token — not merely `authenticated` — so Privy does
 * not auto-migrate / create smart wallets while the embedded-wallet iframe
 * still 401s with "Missing auth token" right after OTP.
 *
 * When authenticated but the token is still settling, render nothing instead of
 * children without a provider — consumers call `useSmartWallets()` and would
 * crash if the provider were omitted for one paint.
 */
export function SmartWalletsRouteProvider({ children }: { children: ReactNode }) {
  const status = usePrivyClientStatus()
  const { authenticated } = usePrivy()
  const tokenReady = usePrivyAccessTokenReady({ enabled: status === 'ready' && authenticated === true })

  // Avoid mounting SmartWallets internals before auth has completed.
  // Waitlist itself must not mount this provider; consumers are explicit
  // non-waitlist / owner-install compatibility routes only.
  if (status !== 'ready' || !authenticated) return <>{children}</>
  if (!tokenReady) return null
  return (
    <Suspense fallback={null}>
      <LazySmartWalletsProvider>{children}</LazySmartWalletsProvider>
    </Suspense>
  )
}
