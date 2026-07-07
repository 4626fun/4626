import { useMemo, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'

import { useDeferUntilAfterCommit } from '@/hooks/useDeferUntilMounted'
import { createWaitlistMessagingWagmiConfig } from '@/config/waitlistMessagingWagmi'

import type { WaitlistConnectTrack } from './waitlistFlowState'

type WaitlistMessagingWalletProvidersProps = {
  connectTrack: WaitlistConnectTrack
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Mount wagmi only for waitlist XMTP messaging — never for email OTP / owner install.
 * Defers hook consumers until after commit to avoid wagmi Hydrate setState-in-render.
 */
export function WaitlistMessagingWalletProviders(props: WaitlistMessagingWalletProvidersProps) {
  const ready = useDeferUntilAfterCommit()
  const config = useMemo(
    () => createWaitlistMessagingWagmiConfig(props.connectTrack),
    [props.connectTrack],
  )

  if (!ready) return props.fallback ?? null

  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      {props.children}
    </WagmiProvider>
  )
}
