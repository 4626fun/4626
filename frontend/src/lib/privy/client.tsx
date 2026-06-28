import type { ReactNode } from 'react'
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPrivyApiUrl, getPrivyAppId, getPrivyClientId, isPrivyClientEnabled, isLocalDevOrigin, canUsePrivyEmbeddedWallets } from '@/lib/flags/flags'
import { CONFIGURED_APP_ORIGIN, resolveAuthRedirectOrigin } from '@/lib/env/host'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { base } from 'viem/chains'
import { AppLoadingBootstrapGate } from '@/components/layout/AppLoadingOverlay'
import { createPrivyAppearance } from './clientAppearance'
import { applyLoopbackPrivySessionMarkerShim } from './loopbackSessionMarkerShim'
import { PrivyWalletHooksContextProvider } from './walletHooksContext'

// Must run before the Privy SDK's first getAccessToken() call — see the shim
// module for why loopback and *.4626.fun origins need the first-party
// `privy-session` marker cookie.
applyLoopbackPrivySessionMarkerShim()

// One-time dev guidance for the common "401 on oauth/link" / "Missing auth token" on custom domain.
if (typeof window !== 'undefined') {
  const h = window.location.hostname.toLowerCase()
  if ((h === 'localhost' || h === '127.0.0.1') && ! (window as any).__cv_privy_local_guidance_logged) {
    ;(window as any).__cv_privy_local_guidance_logged = true
    console.info(
      '[privy] Using custom domain privy.4626.fun on localhost.\n' +
        'If you hit 401 on /oauth/link or "Missing auth token" for embedded signing/XMTP:\n' +
        '  • In Privy dashboard (Local Dev client): allowlist http://localhost:5173 + :5174 + 127.0.0.1 variants in Allowed Origins.\n' +
        '  • Allow the redirect URLs your VITE_APP_ORIGIN / VITE_MARKETING_ORIGIN resolve to.\n' +
        '  • Restart the dev server. See .env.example section "Privy Local Dev with custom domain".'
    )
  }
  if (isLocalDevOrigin(window.location.origin) && !window.isSecureContext && ! (window as any).__cv_privy_insecure_origin_logged) {
    ;(window as any).__cv_privy_insecure_origin_logged = true
    console.info(
      '[privy] Embedded wallets are disabled on this URL (HTTP on a non-localhost host).\n' +
        '  • Waitlist email OTP still works.\n' +
        '  • For embedded-wallet signing (deploy/swap), open http://localhost:5174 with WSL mirrored networking,\n' +
        '    or connect an external wallet on this page.',
    )
  }
}

type PrivyClientStatus = 'disabled' | 'loading' | 'ready'
export const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'
type PrivyClientMode = 'default' | 'waitlist-email-only'

const PrivyClientContext = createContext<PrivyClientStatus>('disabled')

function isLoopbackHostname(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
}

function coerceLoopbackAuthRedirectOrigin(input: {
  resolvedOrigin: string
  currentOrigin: string
}): string {
  try {
    const resolved = new URL(input.resolvedOrigin)
    const current = new URL(input.currentOrigin)
    if (!isLoopbackHostname(current.hostname)) return input.resolvedOrigin
    if (isLoopbackHostname(resolved.hostname)) return input.resolvedOrigin
    return current.origin
  } catch {
    return input.currentOrigin
  }
}

export function usePrivyClientStatus(): PrivyClientStatus {
  return useContext(PrivyClientContext)
}

type PrivyProviderConfig = Parameters<typeof PrivyProvider>[0]['config']

class PrivyProviderSafetyBoundary extends Component<
  {
    appId: string
    clientId: string | null
    apiUrl: string | null
    baseConfig: PrivyProviderConfig
    safeConfig: PrivyProviderConfig
    children: ReactNode
  },
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
    const { appId, clientId, apiUrl, baseConfig, safeConfig, children } = this.props
    const config = this.state.safeMode ? safeConfig : baseConfig

    return (
      <PrivyProvider
        appId={appId}
        {...(clientId ? { clientId } : null)}
        {...(apiUrl ? ({ apiUrl } as any) : null)}
        config={config as any}
      >
        {children}
      </PrivyProvider>
    )
  }
}

const LOOPBACK_PRIVY_INIT_WATCHDOG_MS = 3_000

function PrivyStatusObserver(props: { onStatus: (status: PrivyClientStatus) => void }) {
  const { ready } = usePrivy()
  const { onStatus } = props
  useEffect(() => {
    onStatus(ready ? 'ready' : 'loading')
  }, [onStatus, ready])
  return null
}

/** Dev-only: Privy connector init can hang forever on loopback when EVM extensions race `window.ethereum`. */
function useLoopbackPrivyInitWatchdog(active: boolean, onForceReady: () => void) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    if (!isLocalDevOrigin(window.location.origin)) return

    const id = window.setTimeout(() => {
      console.warn(
        '[privy] Init still pending after 3s on local dev — unblocking route shell so /deploy/vault can render.\n' +
          'If auth or signing fails next, retry in a private window with wallet extensions disabled,\n' +
          'confirm your dev URL is allowlisted (localhost:5174 or WSL IP:5174), then hard-reload.',
      )
      onForceReady()
    }, LOOPBACK_PRIVY_INIT_WATCHDOG_MS)

    return () => window.clearTimeout(id)
  }, [active, onForceReady])
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
  const apiUrl = enabled ? getPrivyApiUrl() : null
  const hasRuntimeConfig = Boolean(enabled && appId)
  const [runtimeStatus, setRuntimeStatus] = useState<PrivyClientStatus>('loading')
  const [forcedReady, setForcedReady] = useState(false)
  const handleRuntimeStatus = useCallback((next: PrivyClientStatus) => {
    setRuntimeStatus((prev) => (prev === next ? prev : next))
  }, [])
  const forcePrivyReady = useCallback(() => {
    setForcedReady(true)
    setRuntimeStatus('ready')
  }, [])
  useLoopbackPrivyInitWatchdog(hasRuntimeConfig && runtimeStatus === 'loading' && !forcedReady, forcePrivyReady)
  const ctx = useMemo<PrivyClientStatus>(
    () => (hasRuntimeConfig ? runtimeStatus : 'disabled'),
    [hasRuntimeConfig, runtimeStatus],
  )
  const bootstrapActive = hasRuntimeConfig && runtimeStatus === 'loading' && !forcedReady

  // Keep hooks unconditional; the objects are only consumed when Privy is enabled.
  const solanaConnectors = useMemo(
    () => ({
      onMount: () => {},
      onUnmount: () => {},
      get: () => [],
    }),
    [],
  )
  const externalWallets = useMemo(() => {
    // Some extension stacks expose a getter-only `window.ethereum`, and EIP-6963
    // provider discovery can trigger extension-side assignment crashes.
    const sharedWalletConnectors = {
      walletConnect: { enabled: true },
      coinbaseWallet: { connectionOptions: 'all' as const },
      solana: { connectors: solanaConnectors },
    }

    // Waitlist auth is intentionally email-only. Do NOT initialize any external
    // wallet connector (Coinbase Wallet SDK, WalletConnect) on this route: those
    // SDKs inject content scripts that race with installed EVM extensions
    // (Rabby/MetaMask) for `window.ethereum`, producing the
    // "injected is not defined" / "Cannot redefine property: ethereum" errors
    // that destabilize the email OTP bootstrap. Email OTP needs no external
    // wallet. Account-setup surfaces mount a fresh PrivyClientProvider without
    // this mode and get the full connector set there.
    if (mode === 'waitlist-email-only') {
      return {
        solana: { connectors: solanaConnectors },
      }
    }

    return {
      ...sharedWalletConnectors,
      crossApp: {
        providerAppIds: [ZORA_PRIVY_APP_ID],
      },
    }
  }, [mode, solanaConnectors])

  if (!hasRuntimeConfig || !appId) {
    return (
      <PrivyClientContext.Provider value={ctx}>
        <PrivyWalletHooksContextProvider enabled={false}>{children}</PrivyWalletHooksContextProvider>
      </PrivyClientContext.Provider>
    )
  }

  const appearance = createPrivyAppearance({
    showWalletLoginFirst,
  })
  // Keep generic web login methods aligned with the canonical account model:
  // verified email first, wallet-native Base second. Zora uses cross-app auth.
  const loginMethods =
    mode === 'waitlist-email-only' ? (['email', 'twitter'] as const) : (['email', 'wallet'] as const)

  const embeddedWalletsSupported = canUsePrivyEmbeddedWallets()
  const embeddedWallets =
    !embeddedWalletsSupported
      ? undefined
      : mode === 'waitlist-email-only'
        ? {
            ethereum: { createOnLogin: 'all-users' },
          }
        : {
            ethereum: { createOnLogin: 'all-users' },
            solana: { createOnLogin: 'all-users' },
          }

  // Privy OAuth redirects are validated against an allowlist and must match exactly.
  // Use the bare origin so transient search/hash state on the current page never breaks OAuth init.
  const customOAuthRedirectUrl =
    typeof window !== 'undefined'
      ? (() => {
          const resolvedOrigin = coerceLoopbackAuthRedirectOrigin({
            resolvedOrigin: resolveAuthRedirectOrigin({
              configuredOrigin: CONFIGURED_APP_ORIGIN,
              currentOrigin: window.location.origin,
            }),
            currentOrigin: window.location.origin,
          })
          if (mode !== 'waitlist-email-only') return resolvedOrigin
          try {
            return new URL('/waitlist', resolvedOrigin).toString()
          } catch {
            return `${window.location.origin}/waitlist`
          }
        })()
      : null

  const baseConfig: PrivyProviderConfig = {
    appearance,
    ...(customOAuthRedirectUrl ? { customOAuthRedirectUrl } : {}),
    ...(embeddedWallets ? { embeddedWallets } : {}),
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
      <PrivyProviderSafetyBoundary
        appId={appId}
        clientId={clientId}
        apiUrl={apiUrl}
        baseConfig={baseConfig}
        safeConfig={safeConfig}
      >
        <PrivyStatusObserver onStatus={handleRuntimeStatus} />
        <AppLoadingBootstrapGate active={bootstrapActive} label="privy-init">
          <PrivyWalletHooksContextProvider enabled>{children}</PrivyWalletHooksContextProvider>
        </AppLoadingBootstrapGate>
      </PrivyProviderSafetyBoundary>
    </PrivyClientContext.Provider>
  )
}
