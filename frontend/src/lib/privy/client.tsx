import type { ReactNode } from 'react'
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPrivyApiUrl, getPrivyAppId, getPrivyClientId, isPrivyClientEnabled, isLocalDevOrigin } from '@/lib/flags/flags'
import { resolveLoopbackPrivyClientId } from '@/lib/flags/featureFlags'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { AppLoadingBootstrapGate } from '@/components/layout/AppLoadingOverlay'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { applyLoopbackPrivySessionMarkerShim } from './loopbackSessionMarkerShim'
import { latchPrivyClientStatus, type PrivyClientStatus } from './privyClientStatus'
import {
  buildPrivyExternalWallets,
  buildPrivyProviderConfigs,
  resolvePrivyProviderApiUrl,
  type PrivyClientMode,
} from './providerConfig'
import { PrivyWalletHooksContextProvider } from './walletHooksContext'

export { latchPrivyClientStatus } from './privyClientStatus'
export type { PrivyClientStatus } from './privyClientStatus'
export { ZORA_PRIVY_APP_ID } from './providerConfig'
export type { PrivyClientMode } from './providerConfig'

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
      '[privy] Local dev pins auth.privy.io, strips custom_api_url, and rewrites privy.4626.fun API calls.\n' +
        'All Privy surfaces use the same loopback app client when enabled so identity stays stable through linking.\n' +
        'If you hit 401 on /oauth/link: add Redirect URLs http://localhost:5174/waitlist (and :5173), allowlist that origin on the matching Privy client, sign out, re-verify email, retry.\n' +
        'See .env.example section "Privy Local Dev with custom domain".',
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

function isLocalDevPrivyApiBypass(): boolean {
  if (typeof window === 'undefined') return false
  return isLocalDevOrigin(window.location.origin)
}

const PrivyClientContext = createContext<PrivyClientStatus>('disabled')

function resolvePrivyProviderClientId(params: {
  clientId: string | null
  bypassCustomPrivyDomain: boolean
}): string | null {
  // Client selection is origin-scoped, never route-mode-scoped. Switching a
  // client id inside an authenticated flow can restore a different Privy
  // session while the 4626 cookie still belongs to the email-joined profile.
  if (params.bypassCustomPrivyDomain) {
    return resolveLoopbackPrivyClientId() ?? params.clientId
  }
  return params.clientId
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
/** Base App WebViews often stall Privy `ready` on injected-provider races; unblock the shell. */
const BASE_APP_PRIVY_INIT_WATCHDOG_MS = 5_000

function PrivyStatusObserver(props: { onStatus: (status: PrivyClientStatus) => void }) {
  const { ready } = usePrivy()
  const { onStatus } = props
  useEffect(() => {
    onStatus(ready ? 'ready' : 'loading')
  }, [onStatus, ready])
  return null
}

/**
 * Unblock the route shell when Privy init hangs.
 * - Loopback: extension races on `window.ethereum`.
 * - Base App in-app browser: injected provider / Privy iframe races leave `ready` false.
 */
function usePrivyInitWatchdog(active: boolean, onForceReady: () => void) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const isLoopback = isLocalDevOrigin(window.location.origin)
    const inBaseApp = isBaseAppInAppContext()
    if (!isLoopback && !inBaseApp) return

    const timeoutMs = isLoopback ? LOOPBACK_PRIVY_INIT_WATCHDOG_MS : BASE_APP_PRIVY_INIT_WATCHDOG_MS
    const id = window.setTimeout(() => {
      console.warn(
        isLoopback
          ? '[privy] Init still pending after 3s on local dev — unblocking route shell so /deploy/vault can render.\n' +
              'If auth or signing fails next, retry in a private window with wallet extensions disabled,\n' +
              'confirm your dev URL is allowlisted (localhost:5174 or WSL IP:5174), then hard-reload.'
          : '[privy] Init still pending after 5s in Base App — unblocking waitlist shell.\n' +
              'Email OTP may still work; if auth fails, retry after a hard reload.',
      )
      onForceReady()
    }, timeoutMs)

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
  walletList?: readonly string[]
  walletChainType?: 'ethereum-only' | 'solana-only' | 'ethereum-and-solana'
}) {
  const { children, showWalletLoginFirst = false, mode = 'default', walletList, walletChainType } = props
  const enabled = isPrivyClientEnabled()
  const appId = enabled ? getPrivyAppId() : null
  const clientId = enabled ? getPrivyClientId() : null
  const apiUrl = enabled ? getPrivyApiUrl() : null
  const bypassCustomPrivyDomain = isLocalDevPrivyApiBypass()
  // Localhost: pin apiUrl to auth.privy.io so Privy never enters server-cookie mode
  // against privy.4626.fun (refresh_token:"deprecated"). Fetch rewrite strips
  // custom_api_url from app config and no-ops stray deprecated session refresh POSTs.
  // Loopback uses one origin-scoped App Client for every Privy surface.
  const resolvedClientId = resolvePrivyProviderClientId({ clientId, bypassCustomPrivyDomain })
  const resolvedApiUrl = resolvePrivyProviderApiUrl({
    configuredApiUrl: apiUrl,
    bypassCustomPrivyDomain,
  })
  const hasRuntimeConfig = Boolean(enabled && appId)
  const [runtimeStatus, setRuntimeStatus] = useState<PrivyClientStatus>('loading')
  const [forcedReady, setForcedReady] = useState(false)
  const handleRuntimeStatus = useCallback((next: PrivyClientStatus) => {
    setRuntimeStatus((prev) => {
      const latched = latchPrivyClientStatus(prev, next)
      return latched === prev ? prev : latched
    })
  }, [])
  const forcePrivyReady = useCallback(() => {
    setForcedReady(true)
    setRuntimeStatus('ready')
  }, [])
  usePrivyInitWatchdog(hasRuntimeConfig && runtimeStatus === 'loading' && !forcedReady, forcePrivyReady)
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
  const externalWallets = useMemo(
    () => buildPrivyExternalWallets({ mode, solanaConnectors }),
    [mode, solanaConnectors],
  )

  if (!hasRuntimeConfig || !appId) {
    return (
      <PrivyClientContext.Provider value={ctx}>
        <PrivyWalletHooksContextProvider enabled={false}>{children}</PrivyWalletHooksContextProvider>
      </PrivyClientContext.Provider>
    )
  }

  const { baseConfig, safeConfig } = buildPrivyProviderConfigs({
    mode,
    showWalletLoginFirst,
    walletList,
    walletChainType,
    externalWallets,
  })

  return (
    <PrivyClientContext.Provider value={ctx}>
      <PrivyProviderSafetyBoundary
        appId={appId}
        clientId={resolvedClientId}
        apiUrl={resolvedApiUrl}
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
