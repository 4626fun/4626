import { Outlet } from 'react-router-dom'

import { AccessStateProvider } from './accessRuntime'
import { WalletProviders } from '@/web3/Web3Providers'

export default function AppAccessShell() {
  return (
    <WalletProviders>
      <AccessStateProvider>
        <Outlet />
      </AccessStateProvider>
    </WalletProviders>
  )
}
