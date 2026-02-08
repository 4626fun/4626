import type { ReactNode } from 'react'
import { Component, createContext, useContext, useMemo } from 'react'
import { getPrivyAppId, isPrivyClientEnabled } from '@/lib/flags'
import { PrivyProvider } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
import { base } from 'viem/chains'

type PrivyClientStatus = 'disabled' | 'loading' | 'ready'

const PrivyClientContext = createContext<PrivyClientStatus>('disabled')

export function usePrivyClientStatus(): PrivyClientStatus {
  return useContext(PrivyClientContext)
}

type PrivyProviderConfig = Parameters<typeof PrivyProvider>[0]['config']

class PrivyProviderSafetyBoundary extends Component<
  { appId: string; baseConfig: PrivyProviderConfig; safeConfig: PrivyProviderConfig; children: ReactNode },
  { safeMode: boolean }
> {
  state = { safeMode: false }

  static getDerivedStateFromError(error: unknown): { safeMode: boolean } | null {
    const msg = String((error as any)?.message ?? error ?? '')
    const m = msg.toLowerCase()
    // Privy embedded wallets throw in insecure contexts (HTTP / non-secure origin).
    // Fall back to a config without embedded wallets instead of blank-screening.
    if (m.includes('embedded wallet') && m.includes('https')) return { safeMode: true }
    return null
  }

  componentDidCatch(error: unknown) {
    // Intentionally no-op: state transition handled in `getDerivedStateFromError`.
    void error
  }

  render() {
    const { appId, baseConfig, safeConfig, children } = this.props
    const config = this.state.safeMode ? safeConfig : baseConfig

    return (
      <PrivyProvider appId={appId} config={config as any}>
        {children}
      </PrivyProvider>
    )
  }
}

/**
 * Privy Client Provider
 *
 * Privy handles:
 * - Authentication (email, Farcaster, etc.)
 * - Global Wallet access (shared with Zora via Privy's global wallet feature)
 * - Smart wallet operations via useSmartWallets hook
 *
 * With Zora Global Wallet enabled:
 * - Users who created their coin on Zora can access the SAME Coinbase Smart Wallet
 * - The embedded wallet from Zora is shared with CreatorVaults
 * - No new wallet is created - they use their existing Zora wallet
 */
export function PrivyClientProvider({ children }: { children: ReactNode }) {
  const enabled = isPrivyClientEnabled()
  const appId = enabled ? getPrivyAppId() : null

  const status: PrivyClientStatus = !enabled || !appId ? 'disabled' : 'ready'
  const ctx = useMemo(() => status, [status])

  if (status !== 'ready' || !appId) {
    return <PrivyClientContext.Provider value={ctx}>{children}</PrivyClientContext.Provider>
  }

  const appearance = {
    // Wallet-only auth should keep wallet login options at the top.
    showWalletLoginFirst: true,
    // This app is EVM-only in current flows; hide Solana wallet choices.
    walletChainType: 'ethereum-only',
    walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets'],
  } as const
  // Featured guidelines: keep auth in-app and avoid email/phone verification flows.
  const loginMethods = ['wallet'] as const

  // Zora's Privy App ID - enables cross-app wallet sharing (Global Wallet)
  const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'
  // Keep Solana connector config lightweight to avoid importing Privy's Solana bundle
  // (which requires optional peers that are not installed in this app).
  const solanaConnectors = useMemo(
    () => ({
      onMount: () => {},
      onUnmount: () => {},
      get: () => [],
    }),
    [],
  )
  const externalWallets = useMemo(
    () => ({
      // WalletConnect is handled through wagmi in this app; disable Privy's WC core to avoid duplicate init.
      walletConnect: { enabled: false },
      // Enable cross-app wallets from Zora so users get the same wallet they created on Zora.
      crossApp: {
        providerAppIds: [ZORA_PRIVY_APP_ID],
      },
      // Provide Solana connector config to satisfy Privy runtime validation when Solana is enabled in dashboard.
      solana: { connectors: solanaConnectors },
    }),
    [solanaConnectors],
  )

  const baseConfig: PrivyProviderConfig = {
    appearance,
    // Enable embedded wallets - this is the signer for the Coinbase Smart Wallet
    embeddedWallets: {
      ethereum: { createOnLogin: 'users-without-wallets' },
    },
    loginMethods,
    defaultChain: base,
    supportedChains: [base],
    externalWallets,
  } as any

  const safeConfig: PrivyProviderConfig = {
    appearance,
    // Intentionally omit `embeddedWallets` so HTTP/insecure dev origins don't crash the app.
    loginMethods,
    defaultChain: base,
    supportedChains: [base],
    externalWallets,
  } as any

  return (
    <PrivyClientContext.Provider value="ready">
      <PrivyProviderSafetyBoundary appId={appId} baseConfig={baseConfig} safeConfig={safeConfig}>
        <SmartWalletsProvider>
          {children}
        </SmartWalletsProvider>
      </PrivyProviderSafetyBoundary>
    </PrivyClientContext.Provider>
  )
}
