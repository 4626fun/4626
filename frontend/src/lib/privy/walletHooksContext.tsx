import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useActiveWallet, useConnectWallet, useWallets } from '@privy-io/react-auth'

type ConnectedWalletLike = {
  address?: string
  walletClientType?: string
  wallet_client_type?: string
  getEthereumProvider?: () => Promise<unknown>
  provider?: unknown
}

type ConnectWalletFn = ReturnType<typeof useConnectWallet>['connectWallet']
type SetActiveWalletFn = ReturnType<typeof useActiveWallet>['setActiveWallet']

type PrivyWalletHooksSnapshot = {
  wallets: ConnectedWalletLike[]
  ready: boolean
  connectWallet?: ConnectWalletFn
  setActiveWallet?: SetActiveWalletFn
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

/** Privy wallet action hooks bridged once inside `PrivyProvider`. */
export function usePrivyConnectWalletFromContext(): ConnectWalletFn | undefined {
  return usePrivyWalletsSnapshot().connectWallet
}

export function usePrivySetActiveWalletFromContext(): SetActiveWalletFn | undefined {
  return usePrivyWalletsSnapshot().setActiveWallet
}

/** Must render as a direct descendant of `PrivyProvider`. */
function PrivyWalletHooksBridge(props: { children: ReactNode }) {
  const { wallets, ready } = useWallets()
  const { connectWallet } = useConnectWallet()
  const { setActiveWallet } = useActiveWallet()
  const value = useMemo(
    () => ({
      wallets: wallets as ConnectedWalletLike[],
      ready,
      connectWallet,
      setActiveWallet,
    }),
    [connectWallet, ready, setActiveWallet, wallets],
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
