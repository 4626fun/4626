import { useEffect, type ReactNode } from 'react'
import { getAccount, watchAccount } from '@wagmi/core'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { useDeferUntilAfterCommit } from '@/hooks/useDeferUntilMounted'
import { applyChainBrandTheme, resolveChainBrandTheme } from '@/theme/chainBrandTheme'
import { AppQueryProvider } from './AppQueryProvider'
export { AppQueryProvider } from './AppQueryProvider'

export function WalletProviders({
  children,
  reconnectOnMount = true,
}: {
  children: ReactNode
  reconnectOnMount?: boolean
}) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={reconnectOnMount}>
      <DeferWagmiConsumers>
        <ChainBrandThemeSync />
        {children}
      </DeferWagmiConsumers>
    </WagmiProvider>
  )
}

/** Wait one commit before mounting wagmi hook consumers — avoids Hydrate reconnect setState during render. */
function DeferWagmiConsumers({ children }: { children: ReactNode }) {
  const ready = useDeferUntilAfterCommit()
  if (!ready) return null
  return children
}

function ChainBrandThemeSync() {
  useEffect(() => {
    const syncFromAccount = () => {
      const account = getAccount(wagmiConfig)
      const activeChainId = account.isConnected ? (account.chainId ?? null) : null
      applyChainBrandTheme(resolveChainBrandTheme(activeChainId))
    }

    // Apply immediately on mount, then keep in sync with wallet/account changes.
    syncFromAccount()
    const unwatch = watchAccount(wagmiConfig, {
      onChange(account) {
        const activeChainId = account.isConnected ? (account.chainId ?? null) : null
        applyChainBrandTheme(resolveChainBrandTheme(activeChainId))
      },
    })

    return () => {
      unwatch()
    }
  }, [])

  return null
}

/**
 * Shared query + wallet stack for routes that need both.
 */
export function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <WalletProviders>{children}</WalletProviders>
    </AppQueryProvider>
  )
}
