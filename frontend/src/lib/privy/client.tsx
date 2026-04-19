import type { ReactNode } from 'react'
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPrivyAppId, getPrivyClientId, isPrivyClientEnabled } from '@/lib/flags/flags'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { base } from 'viem/chains'
import { createPrivyAppearance } from './clientAppearance'

type PrivyClientStatus = 'disabled' | 'loading' | 'ready'
export const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'
type PrivyClientMode = 'default' | 'waitlist-email-only'

const PrivyClientContext = createContext<PrivyClientStatus>('disabled')

export function usePrivyClientStatus(): PrivyClientStatus {
  return useContext(PrivyClientContext)
}

type PrivyProviderConfig = Parameters<typeof PrivyProvider>[0]['config']

class PrivyProviderSafetyBoundary extends Component<
  { appId: string; clientId: string | null; baseConfig: PrivyProviderConfig; safeConfig: PrivyProviderConfig; children: ReactNode },
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
    const { appId, clientId, baseConfig, safeConfig, children } = this.props
    const config = this.state.safeMode ? safeConfig : baseConfig

    return (
      <PrivyProvider appId={appId} {...(clientId ? { clientId } : null)} config={config as any}>
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
export function PrivyClientProvider(props: {
  children: ReactNode
  showWalletLoginFirst?: boolean
  mode?: PrivyClientMode
}) {
  const { children, showWalletLoginFirst = false, mode = 'default' } = props
  const enabled = isPrivyClientEnabled()
  const appId = enabled ? getPrivyAppId() : null
  const clientId = enabled ? getPrivyClientId() : null
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
      // Some extension stacks expose a getter-only `window.ethereum`, and EIP-6963
      // provider discovery can trigger extension-side assignment crashes. Keep waitlist
      // auth email-first, but do not disable connectors entirely because Step 3 owner
      // install requires external wallet connection on this page.
      walletConnect: { enabled: true },
      coinbaseWallet: { connectionOptions: 'all' as const },
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

  const appearance = createPrivyAppearance({
    showWalletLoginFirst,
  })
  // Keep generic web login methods aligned with the canonical account model:
  // verified email first, wallet-native Base second. Zora uses cross-app auth.
  const loginMethods = mode === 'waitlist-email-only' ? (['email'] as const) : (['email', 'wallet'] as const)

  // Privy OAuth redirects are validated against an allowlist and must match exactly.
  // Use the bare origin so transient search/hash state on the current page never breaks OAuth init.
  const customOAuthRedirectUrl = typeof window !== 'undefined' ? window.location.origin : null

  const baseConfig: PrivyProviderConfig = {
    appearance,
    ...(customOAuthRedirectUrl ? { customOAuthRedirectUrl } : {}),
    // Enable embedded wallets - this is the signer for the Coinbase Smart Wallet
    embeddedWallets:
      mode === 'waitlist-email-only'
        ? {
            ethereum: { createOnLogin: 'all-users' },
          }
        : {
            ethereum: { createOnLogin: 'all-users' },
            solana: { createOnLogin: 'all-users' },
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
      <PrivyProviderSafetyBoundary appId={appId} clientId={clientId} baseConfig={baseConfig} safeConfig={safeConfig}>
        <PrivyStatusObserver onStatus={handleRuntimeStatus} />
        {children}
      </PrivyProviderSafetyBoundary>
    </PrivyClientContext.Provider>
  )
}
