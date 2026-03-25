import type { ReactNode } from 'react'

import { PrivyClientProvider } from '@/lib/privy/client'
import { WalletProviders } from '@/web3/Web3Providers'

export default function AppAuthProviders(props: { children: ReactNode }) {
  return (
    <PrivyClientProvider>
      <WalletProviders>{props.children}</WalletProviders>
    </PrivyClientProvider>
  )
}
