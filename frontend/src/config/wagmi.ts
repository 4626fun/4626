import { http, createConfig, fallback } from 'wagmi'
import { base, mainnet, arbitrum, optimism, polygon } from 'wagmi/chains'
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors'
import { DATA_SUFFIX, warnGlobalWagmiDataSuffixBehavior } from '@/lib/base/baseBuilderCodes'
import { BASE_RPC_PROXY_PATH, isBrowserRestrictedBaseRpc } from '@/lib/base/baseReadRpcPolicy'
import { injectedConnectorFlag } from '@/lib/flags/featureFlags'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'

/**
 * Minimal Wagmi Config
 *
 * Connection paths:
 * 1. Coinbase Wallet / Base Account (includes Smart Wallet — primary path
 *    for adding 4626 as a CBSW owner via the sub-account flow).
 * 2. Injected (browser extension fallback, incl. Rabby targeted connector).
 *
 * Cross-app Privy auth-mode (`useCrossAppAccounts`) is wired in
 * `PrivyClientProvider.externalWallets.crossApp` for Zora identity linking.
 * It surfaces the user's Zora handle + canonical CBSW address but provides
 * no signer — appropriate for read/link flows only.
 * For users whose CBSW is exclusively passkey-controlled, the only working
 * onboarding path is to reconnect through Base Account SDK and use the
 * sub-account derivation in `useAccountSetupController.onEnable4626Signing`.
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
      // Deploy page can fire bursts of `eth_getCode`; allow enough time for
      // proxy-side failover before viem aborts the request.
      timeout: 20_000,
    })
  }
  return http(normalized)
}

type InjectedProviderWindow = { ethereum?: unknown } | undefined

type Eip6963ProviderDetail = {
  info?: {
    rdns?: string
    name?: string
  }
  provider?: unknown
}

const eip6963Providers = new Map<string, Eip6963ProviderDetail>()
let eip6963DiscoveryStarted = false

function rememberEip6963Provider(detail: Eip6963ProviderDetail | null | undefined) {
  const provider = detail?.provider
  if (!provider) return
  const rdns = String(detail?.info?.rdns ?? '').trim().toLowerCase()
  const name = String(detail?.info?.name ?? '').trim().toLowerCase()
  const key = rdns || name
  if (!key) return
  eip6963Providers.set(key, detail)
}

function requestEip6963Providers() {
  if (!IS_BROWSER || typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  } catch {
    // EIP-6963 is best-effort; fall back to legacy injected globals.
  }
}

function ensureEip6963Discovery() {
  if (!IS_BROWSER || typeof window === 'undefined' || eip6963DiscoveryStarted) return
  eip6963DiscoveryStarted = true
  window.addEventListener('eip6963:announceProvider', ((event: CustomEvent<Eip6963ProviderDetail>) => {
    rememberEip6963Provider(event.detail)
  }) as EventListener)
  requestEip6963Providers()
}

function findEip6963Provider(predicate: (detail: Eip6963ProviderDetail) => boolean): any | undefined {
  ensureEip6963Discovery()
  requestEip6963Providers()
  for (const detail of eip6963Providers.values()) {
    try {
      if (predicate(detail)) return detail.provider as any
    } catch {
      // ignore malformed provider detail
    }
  }
  return undefined
}

function readInjectedProvidersFromWindow(windowRef: InjectedProviderWindow): any[] {
  if (!windowRef) return []
  const directRabby = (windowRef as any)?.rabby
  const eip6963Rabby = findEip6963Provider((detail) => {
    const rdns = String(detail.info?.rdns ?? '').trim().toLowerCase()
    const name = String(detail.info?.name ?? '').trim().toLowerCase()
    return rdns === 'io.rabby' || name.includes('rabby') || (detail.provider as any)?.isRabby === true
  })
  try {
    const ethereum = (windowRef as any)?.ethereum
    const providers = Array.isArray(ethereum?.providers) ? ethereum.providers : []
    const out = providers.length > 0 ? [...providers] : ethereum ? [ethereum] : []
    if (eip6963Rabby) out.unshift(eip6963Rabby)
    if (directRabby) out.unshift(directRabby)
    return out
  } catch {
    return [directRabby, eip6963Rabby].filter(Boolean)
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

function findTargetedEip6963Provider(target: 'rabby' | 'metamask'): any | undefined {
  return findEip6963Provider((detail) => {
    const rdns = String(detail.info?.rdns ?? '').trim().toLowerCase()
    const name = String(detail.info?.name ?? '').trim().toLowerCase()
    if (target === 'rabby') {
      return rdns === 'io.rabby' || name.includes('rabby') || (detail.provider as any)?.isRabby === true
    }
    return rdns === 'io.metamask' || name.includes('metamask')
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
  const providerCollision = detectEthereumProviderCollision()
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

  if (!providerCollision.shouldDisableInjectedConnector) {
    baseConnectors.push(
      metaMask({
        enableAnalytics: false,
      }),
    )
  } else {
    baseConnectors.push(
      injected({
        target: {
          id: 'io.metamask',
          name: 'MetaMask',
          provider(window) {
            return (
              findTargetedEip6963Provider('metamask') ??
              findNamedInjectedProvider(window, (provider) => provider?.isMetaMask === true && provider?.isRabby !== true)
            )
          },
        },
        shimDisconnect: true,
      }),
    )
  }

  baseConnectors.push(
    injected({
      target: {
        id: 'rabby',
        name: 'Rabby',
        provider(window) {
          return findTargetedEip6963Provider('rabby') ?? findNamedInjectedProvider(window, (provider) => provider?.isRabby === true)
        },
      },
      shimDisconnect: true,
    }),
  )

  // Some wallet extensions install a getter-only `window.ethereum`, which causes
  // other extensions to throw during provider injection. Avoid injected connector
  // in that state (or when multiple injected providers conflict); users can still
  // connect via Coinbase Wallet / Base app or targeted connectors like Rabby.
  const shouldUseInjected = ENABLE_INJECTED_CONNECTOR && !providerCollision.shouldDisableInjectedConnector
  const connectors = shouldUseInjected
    ? [...baseConnectors, injected({ shimDisconnect: true })]
    : baseConnectors

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
