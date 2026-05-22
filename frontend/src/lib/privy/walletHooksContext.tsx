import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useWallets } from '@privy-io/react-auth'

type ConnectedWalletLike = {
  address?: string
  walletClientType?: string
  wallet_client_type?: string
  getEthereumProvider?: () => Promise<unknown>
  provider?: unknown
}

type PrivyWalletHooksSnapshot = {
  wallets: ConnectedWalletLike[]
  ready: boolean
}

const EMPTY_SNAPSHOT: PrivyWalletHooksSnapshot = { wallets: [], ready: false }

const PrivyWalletHooksContext = createContext<PrivyWalletHooksSnapshot>(EMPTY_SNAPSHOT)

export function usePrivyWalletsSnapshot(): PrivyWalletHooksSnapshot {
  return useContext(PrivyWalletHooksContext)
}

/** Read wallet state from the single in-tree `useWallets()` bridge. */
export function usePrivyWalletsFromContext(): ConnectedWalletLike[] {
  return usePrivyWalletsSnapshot().wallets
}

/** Must render as a direct descendant of `PrivyProvider`. */
function PrivyWalletHooksBridge(props: { children: ReactNode }) {
  const { wallets, ready } = useWallets()
  const value = useMemo(
    () => ({ wallets: wallets as ConnectedWalletLike[], ready }),
    [ready, wallets],
  )
  return <PrivyWalletHooksContext.Provider value={value}>{props.children}</PrivyWalletHooksContext.Provider>
}

export function PrivyWalletHooksContextProvider(props: { children: ReactNode; enabled: boolean }) {
  if (!props.enabled) {
    return (
      <PrivyWalletHooksContext.Provider value={EMPTY_SNAPSHOT}>{props.children}</PrivyWalletHooksContext.Provider>
    )
  }
  return <PrivyWalletHooksBridge>{props.children}</PrivyWalletHooksBridge>
}
