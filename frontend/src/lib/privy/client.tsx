import type { ReactNode } from 'react'
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPrivyAppId, isPrivyClientEnabled } from '@/lib/flags'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { base } from 'viem/chains'
import { createPrivyAppearance } from './clientAppearance'

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

function PrivyStatusObserver(props: { onStatus: (status: PrivyClientStatus) => void }) {
  const { ready } = usePrivy()
  const { onStatus } = props
  useEffect(() => {
    onStatus(ready ? 'ready' : 'loading')
  }, [onStatus, ready])
  return null
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
 * - The embedded wallet from Zora is shared with 4626
 * - No new wallet is created - they use their existing Zora wallet
 */
export function PrivyClientProvider(props: { children: ReactNode; showWalletLoginFirst?: boolean }) {
  const { children, showWalletLoginFirst = true } = props
  const enabled = isPrivyClientEnabled()
  const appId = enabled ? getPrivyAppId() : null
  const hasRuntimeConfig = Boolean(enabled && appId)
  const [runtimeStatus, setRuntimeStatus] = useState<PrivyClientStatus>('loading')
  const handleRuntimeStatus = useCallback((next: PrivyClientStatus) => {
    setRuntimeStatus((prev) => (prev === next ? prev : next))
  }, [])
  const ctx = useMemo<PrivyClientStatus>(
    () => (hasRuntimeConfig ? runtimeStatus : 'disabled'),
    [hasRuntimeConfig, runtimeStatus],
  )

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

  if (!hasRuntimeConfig || !appId) {
    return <PrivyClientContext.Provider value={ctx}>{children}</PrivyClientContext.Provider>
  }

  const appearance = createPrivyAppearance({ showWalletLoginFirst })
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
    <PrivyClientContext.Provider value={ctx}>
      <PrivyProviderSafetyBoundary appId={appId} baseConfig={baseConfig} safeConfig={safeConfig}>
        <PrivyStatusObserver onStatus={handleRuntimeStatus} />
        {children}
      </PrivyProviderSafetyBoundary>
    </PrivyClientContext.Provider>
  )
}
