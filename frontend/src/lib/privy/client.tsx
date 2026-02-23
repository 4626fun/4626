import type { ReactNode } from 'react'
import { Component, createContext, useContext, useMemo } from 'react'
import { getPrivyAppId, isPrivyClientEnabled } from '@/lib/flags'
import { PrivyProvider } from '@privy-io/react-auth'
import { base } from 'viem/chains'

type PrivyClientStatus = 'disabled' | 'loading' | 'ready'
export const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'

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

  // Keep hooks unconditional; the objects are only consumed when Privy is enabled.
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
      walletConnect: { enabled: false },
      crossApp: {
        providerAppIds: [ZORA_PRIVY_APP_ID],
      },
      solana: { connectors: solanaConnectors },
    }),
    [solanaConnectors],
  )

  if (status !== 'ready' || !appId) {
    return <PrivyClientContext.Provider value={ctx}>{children}</PrivyClientContext.Provider>
  }

  const appearance = {
    showWalletLoginFirst: true,
    // Signup flow provisions both embedded EVM + Solana wallets.
    walletChainType: 'all',
    walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets'],
    logo: '',
    landingHeader: 'Sign in to 4626',
    loginMessage: 'Connect your wallet or continue with email.',
    theme: '#0f1117',
  } as const
  const loginMethods = ['wallet', 'email', 'google', 'twitter', 'farcaster'] as const

  // Privy OAuth redirects are validated against an allowlist and must match exactly (no query params).
  // Our marketing waitlist commonly adds `?wl=1` / `?ref=...`, so defaulting to `window.location.href`
  // can cause OAuth init to fail with "Redirect URL is not allowed".
  const customOAuthRedirectUrl = typeof window !== 'undefined' ? window.location.origin : null

  const baseConfig: PrivyProviderConfig = {
    appearance,
    ...(customOAuthRedirectUrl ? { customOAuthRedirectUrl } : {}),
    // Enable embedded wallets - this is the signer for the Coinbase Smart Wallet
    embeddedWallets: {
      ethereum: { createOnLogin: 'users-without-wallets' },
      solana: { createOnLogin: 'users-without-wallets' },
    },
    loginMethods,
    defaultChain: base,
    supportedChains: [base],
    externalWallets,
  } as any

  const safeConfig: PrivyProviderConfig = {
    appearance,
    ...(customOAuthRedirectUrl ? { customOAuthRedirectUrl } : {}),
    // Intentionally omit `embeddedWallets` so HTTP/insecure dev origins don't crash the app.
    loginMethods,
    defaultChain: base,
    supportedChains: [base],
    externalWallets,
  } as any

  return (
    <PrivyClientContext.Provider value="ready">
      <PrivyProviderSafetyBoundary appId={appId} baseConfig={baseConfig} safeConfig={safeConfig}>
        {children}
      </PrivyProviderSafetyBoundary>
    </PrivyClientContext.Provider>
  )
}
