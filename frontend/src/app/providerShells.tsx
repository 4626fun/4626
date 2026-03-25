import type { ReactNode } from 'react'

import { Outlet } from 'react-router-dom'

import { Layout } from '@/components/Layout'
import { PrivyClientProvider } from '@/lib/privy/client'
import { AccountContextProvider } from '@/wallet/accountContext'
import { WalletProviders } from '@/web3/Web3Providers'
import { AccessStateProvider } from './accessRuntime'

export function AppAuthProviders(props: { children: ReactNode }) {
  return (
    <PrivyClientProvider>
      <WalletProviders>{props.children}</WalletProviders>
    </PrivyClientProvider>
  )
}

export function AppWalletShell() {
  return (
    <WalletProviders>
      <Outlet />
    </WalletProviders>
  )
}

export function AppAuthShell() {
  return (
    <AppAuthProviders>
      <Outlet />
    </AppAuthProviders>
  )
}

export function AppAccessShell() {
  return (
    <AppAuthProviders>
      <AccessStateProvider>
        <Outlet />
      </AccessStateProvider>
    </AppAuthProviders>
  )
}

export function LayoutWithAccountContext() {
  return (
    <AccountContextProvider>
      <Layout />
    </AccountContextProvider>
  )
}
