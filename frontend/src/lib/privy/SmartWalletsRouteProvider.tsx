import type { ReactNode } from 'react'
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
  if (status !== 'ready') return <>{children}</>
  return <SmartWalletsProvider>{children}</SmartWalletsProvider>
}
