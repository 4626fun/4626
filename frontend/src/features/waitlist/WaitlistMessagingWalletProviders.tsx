import { useMemo, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'

import { useDeferOneMacrotask } from '@/hooks/useDeferUntilMounted'
import { createWaitlistMessagingWagmiConfig } from '@/config/waitlistMessagingWagmi'

import type { WaitlistConnectTrack } from './waitlistFlowState'

type WaitlistMessagingWalletProvidersProps = {
  connectTrack: WaitlistConnectTrack
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Mount hook consumers only after WagmiProvider's first commit so wagmi's
 * internal Hydrate pass does not race AccountContextProvider queries.
 */
function WaitlistMessagingWagmiReadyGate(props: { children: ReactNode; fallback?: ReactNode }) {
  const ready = useDeferOneMacrotask()

  if (!ready) return props.fallback ?? null
  return props.children
}

/**
 * Route-scoped wagmi for waitlist XMTP messaging — never for email OTP / owner install.
 * WagmiProvider mounts immediately; hook consumers defer until after Hydrate settles.
 */
export function WaitlistMessagingWalletProviders(props: WaitlistMessagingWalletProvidersProps) {
  const config = useMemo(
    () => createWaitlistMessagingWagmiConfig(props.connectTrack),
    [props.connectTrack],
  )

  return (
    <WagmiProvider config={config as never} reconnectOnMount={false}>
      <WaitlistMessagingWagmiReadyGate fallback={props.fallback}>
        {props.children}
      </WaitlistMessagingWagmiReadyGate>
    </WagmiProvider>
  )
}
