import { http, createConfig, fallback } from 'wagmi'
import { base, mainnet, arbitrum, optimism, polygon } from 'wagmi/chains'
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors'
import { DATA_SUFFIX, warnGlobalWagmiDataSuffixBehavior } from '@/lib/base/baseBuilderCodes'
import { BASE_RPC_PROXY_PATH, isBrowserRestrictedBaseRpc } from '@/lib/base/baseReadRpcPolicy'
import { injectedConnectorFlag, zoraGlobalWalletConnectorFlag } from '@/lib/flags/featureFlags'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { zoraGlobalWalletConnector } from '@/lib/wallet/zoraGlobalWalletConnector'

/**
 * Minimal Wagmi Config
 *
 * Connection paths:
 * 1. Coinbase Wallet (includes Smart Wallet)
 * 2. Injected (browser extension fallback, incl. Rabby targeted connector)
 * 3. [flagged] Zora Global Wallet — Privy Connect-mode cross-app connector.
 *
 * Historical note: Zora identity (Privy Auth-mode `useCrossAppAccounts`) is
 * wired via `PrivyClientProvider.externalWallets.crossApp` for login/link
 * only. That path is read-only by construction — it does not surface a
 * signer. Path #3 above is the transactional complement (Connect mode,
 * `@privy-io/cross-app-connect`) and is gated behind
 * `zoraGlobalWalletConnectorFlag` while we verify Zora's provider-side
 * config permits it. See `frontend/src/lib/wallet/zoraGlobalWalletConnector.ts`.
 */

const BASE_RPC_URL_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

const IS_BROWSER = typeof window !== 'undefined'

function isValidRpcUrl(url: string): boolean {
  const value = String(url || '').trim()
  if (!value) return false
  if (value.startsWith('/')) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}


const BASE_RPC_URL = (() => {
  if (!isValidRpcUrl(BASE_RPC_URL_RAW)) return ''
  if (IS_BROWSER && isBrowserRestrictedBaseRpc(BASE_RPC_URL_RAW)) return ''
  return BASE_RPC_URL_RAW
})()
const BASE_RPC_PROXY = IS_BROWSER ? BASE_RPC_PROXY_PATH : ''
const MAINNET_RPC_PROXY = IS_BROWSER ? '/api/rpc?chain=mainnet' : ''
const ARBITRUM_RPC_PROXY = IS_BROWSER ? '/api/rpc?chain=arbitrum' : ''
const OPTIMISM_RPC_PROXY = IS_BROWSER ? '/api/rpc?chain=optimism' : ''
const POLYGON_RPC_PROXY = IS_BROWSER ? '/api/rpc?chain=polygon' : ''
const ENABLE_INJECTED_CONNECTOR = injectedConnectorFlag()
const RPC_PROXY_PREFIX = '/api/rpc?chain='

function isWaitlistAuthPath(pathname: string): boolean {
  const path = String(pathname || '').trim().toLowerCase()
  if (!path) return false
  return (
    path === '/waitlist' ||
    path.startsWith('/waitlist/') ||
    path.startsWith('/r/') ||
    path.startsWith('/telegram/')
  )
}

function uniqueNonEmptyStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s) continue
    if (!isValidRpcUrl(s)) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function buildReadTransport(url: string) {
  const normalized = String(url || '').trim()
  if (normalized.startsWith(RPC_PROXY_PREFIX)) {
    // Same-origin proxy already retries upstream; keep client retries minimal.
    return http(normalized, {
      retryCount: 0,
      retryDelay: 150,
    })
  }
  return http(normalized)
}

type InjectedProviderWindow = { ethereum?: unknown } | undefined

function readInjectedProvidersFromWindow(windowRef: InjectedProviderWindow): any[] {
  if (!windowRef) return []
  try {
    const ethereum = (windowRef as any)?.ethereum
    const providers = Array.isArray(ethereum?.providers) ? ethereum.providers : []
    if (providers.length > 0) return providers
    return ethereum ? [ethereum] : []
  } catch {
    return []
  }
}

function findNamedInjectedProvider(windowRef: InjectedProviderWindow, predicate: (provider: any) => boolean): any | undefined {
  const providers = readInjectedProvidersFromWindow(windowRef)
  return providers.find((provider) => {
    try {
      return predicate(provider)
    } catch {
      return false
    }
  })
}

// Browser RPC reality: some providers (or API keys) block browser `fetch` via CORS / allowlists.
// Use a fallback list so reads don't hard-fail when a single endpoint is unreachable.
const BASE_READ_RPC_URLS = uniqueNonEmptyStrings(
  [
    BASE_RPC_PROXY,
    ...(IS_BROWSER ? [] : [BASE_RPC_URL]),
    // Base public RPCs (best-effort fallbacks)
    ...(IS_BROWSER
      ? []
      : [
          'https://base-mainnet.public.blastapi.io',
          'https://base.llamarpc.com',
          'https://base.meowrpc.com',
          'https://mainnet.base.org',
        ]),
  ].filter((url) => {
    if (!url) return false
    return !(IS_BROWSER && isBrowserRestrictedBaseRpc(url))
  }),
)

// Browser reads use same-origin RPC proxy to avoid third-party CORS failures.
const MAINNET_READ_RPC_URLS = uniqueNonEmptyStrings(
  [
    MAINNET_RPC_PROXY,
    ...(IS_BROWSER ? [] : ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth', 'https://eth.llamarpc.com']),
  ].filter(Boolean),
)

const ARBITRUM_READ_RPC_URLS = uniqueNonEmptyStrings(
  [
    ARBITRUM_RPC_PROXY,
    ...(IS_BROWSER ? [] : ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum', 'https://arbitrum.llamarpc.com']),
  ].filter(Boolean),
)

const OPTIMISM_READ_RPC_URLS = uniqueNonEmptyStrings(
  [
    OPTIMISM_RPC_PROXY,
    ...(IS_BROWSER ? [] : ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism', 'https://optimism.llamarpc.com']),
  ].filter(Boolean),
)

const POLYGON_READ_RPC_URLS = uniqueNonEmptyStrings(
  [
    POLYGON_RPC_PROXY,
    ...(IS_BROWSER ? [] : ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon', 'https://polygon.llamarpc.com']),
  ].filter(Boolean),
)

function buildConnectors() {
  const onWaitlistAuthPath = IS_BROWSER && isWaitlistAuthPath(window.location.pathname)
  const baseConnectors: any[] = [
    coinbaseWallet({
      appName: 'Creator Vaults',
      preference: 'smartWalletOnly',
    }),
  ]

  // Waitlist/email auth routes should avoid eager injected-provider discovery.
  // This keeps extension collision noise out of OTP-first onboarding.
  if (onWaitlistAuthPath) {
    return baseConnectors as any
  }

  // Keep waitlist/email-auth surfaces extension-light to avoid injected-provider
  // races and analytics retry noise before users opt into wallet linking.
  baseConnectors.push(
    metaMask({
      enableAnalytics: false,
    }),
  )

  baseConnectors.push(
    injected({
      target: {
        id: 'rabby',
        name: 'Rabby',
        provider(window) {
          return findNamedInjectedProvider(window, (provider) => provider?.isRabby === true)
        },
      },
      shimDisconnect: true,
    }),
  )

  // Some wallet extensions install a getter-only `window.ethereum`, which causes
  // other extensions to throw during provider injection. Avoid injected connector
  // in that state (or when multiple injected providers conflict); users can still
  // connect via Coinbase Wallet / Base app, MetaMask, or targeted connectors like Rabby.
  const providerCollision = detectEthereumProviderCollision()
  const shouldUseInjected = ENABLE_INJECTED_CONNECTOR && !providerCollision.shouldDisableInjectedConnector
  const connectors = shouldUseInjected
    ? [...baseConnectors, injected({ shimDisconnect: true })]
    : baseConnectors

  // Zora Global Wallet (Privy Connect-mode) — flagged probe. Any failure to
  // instantiate is non-fatal; the other connectors remain usable.
  if (zoraGlobalWalletConnectorFlag()) {
    try {
      connectors.push(zoraGlobalWalletConnector())
    } catch (err) {
      if (IS_BROWSER) {
        console.warn('[wagmi] Zora global wallet connector failed to initialize:', err)
      }
    }
  }

  return connectors as any
}

/**
 * Builder Codes attribution path:
 * - We intentionally use wagmi's global `dataSuffix` config (Path B).
 * - Privy's `dataSuffix` plugin is NOT used because it's documented as unsupported
 *   with `@privy-io/wagmi`.
 */
warnGlobalWagmiDataSuffixBehavior(DATA_SUFFIX)

export const wagmiConfig = createConfig({
  chains: [base, mainnet, arbitrum, optimism, polygon],
  connectors: buildConnectors(),
  // Avoid eager EIP-6963 provider discovery on page load.
  // Some extension stacks respond to `requestProvider` by racing to assign
  // `window.ethereum`, which can throw when another extension already owns it.
  multiInjectedProviderDiscovery: false,
  ...(DATA_SUFFIX ? { dataSuffix: DATA_SUFFIX } : {}),
  transports: {
    [base.id]: BASE_READ_RPC_URLS.length > 0 ? fallback(BASE_READ_RPC_URLS.map(buildReadTransport)) : http(),
    [mainnet.id]: MAINNET_READ_RPC_URLS.length > 0 ? fallback(MAINNET_READ_RPC_URLS.map(buildReadTransport)) : http(),
    [arbitrum.id]: ARBITRUM_READ_RPC_URLS.length > 0 ? fallback(ARBITRUM_READ_RPC_URLS.map(buildReadTransport)) : http(),
    [optimism.id]: OPTIMISM_READ_RPC_URLS.length > 0 ? fallback(OPTIMISM_READ_RPC_URLS.map(buildReadTransport)) : http(),
    [polygon.id]: POLYGON_READ_RPC_URLS.length > 0 ? fallback(POLYGON_READ_RPC_URLS.map(buildReadTransport)) : http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
