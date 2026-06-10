import type { ReactNode } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
import { usePrivyClientStatus } from './client'

/**
 * Route-scoped SmartWallets provider.
 *
 * Keep this out of the global app shell so smart-wallet internals only load
 * on routes that actually call `useSmartWallets()`.
 */
export function SmartWalletsRouteProvider({ children }: { children: ReactNode }) {
  const status = usePrivyClientStatus()
  const { authenticated } = usePrivy()
  // Avoid mounting SmartWallets internals before auth has completed.
  // Otherwise Privy can log/throw "User must be authenticated before migrating wallets"
  // during waitlist step 1 and interfere with the email-only bootstrap lane.
  if (status !== 'ready' || !authenticated) return <>{children}</>
  return <SmartWalletsProvider>{children}</SmartWalletsProvider>
}
