import { http, createConfig, fallback } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, walletConnect, injected } from 'wagmi/connectors'

/**
 * Minimal Wagmi Config
 * 
 * Three connection paths:
 * 1. Coinbase Wallet (includes Smart Wallet)
 * 2. WalletConnect (MetaMask, Rainbow, etc.)
 * 3. Injected (browser extension fallback)
 * 
 * Note: Zora wallet integration uses Privy SDK's useCrossAppAccounts
 * hook directly, not a wagmi connector, because cross-app transactions
 * must go through Privy's popup flow on Zora's domain.
 */

const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || 'bc3dfd319b4a0ecaa25cdee7e36bd0c4'

const BASE_RPC_URL_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

const IS_BROWSER = typeof window !== 'undefined'

function isCorsRestrictedRpc(url: string): boolean {
  // Alchemy browser CORS is opt-in; avoid hard failures by default.
  return /(^|\/\/)base-mainnet\.g\.alchemy\.com/i.test(url) || /\.g\.alchemy\.com\//i.test(url)
}

const BASE_RPC_URL = IS_BROWSER && isCorsRestrictedRpc(BASE_RPC_URL_RAW) ? '' : BASE_RPC_URL_RAW
const BASE_RPC_PROXY = IS_BROWSER ? '/api/rpc' : ''
const ENABLE_INJECTED_CONNECTOR =
  !['0', 'false', 'no', 'off'].includes(String(import.meta.env.VITE_ENABLE_INJECTED_CONNECTOR ?? '1').toLowerCase())

function uniqueNonEmptyStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

// Browser RPC reality: some providers (or API keys) block browser `fetch` via CORS / allowlists.
// Use a fallback list so reads don't hard-fail when a single endpoint is unreachable.
const BASE_READ_RPC_URLS = uniqueNonEmptyStrings(
  [
    BASE_RPC_PROXY,
    BASE_RPC_URL,
    // Base public RPCs (best-effort fallbacks)
    'https://base-mainnet.public.blastapi.io',
    'https://base.llamarpc.com',
    'https://base.meowrpc.com',
    'https://mainnet.base.org',
  ].filter((url) => {
    if (!url) return false
    return !(IS_BROWSER && isCorsRestrictedRpc(url))
  }),
)

const WALLETCONNECT_APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://4626.fun')
const WALLETCONNECT_ICON_URL = `${WALLETCONNECT_APP_URL.replace(/\/$/, '')}/miniapp-icon.svg`

function isLockedEthereumProviderGlobal(): boolean {
  if (!IS_BROWSER) return false
  const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum')
  if (!descriptor) return false
  const hasGetter = typeof descriptor.get === 'function'
  const hasSetter = typeof descriptor.set === 'function'
  return hasGetter && !hasSetter
}

function buildConnectors() {
  const baseConnectors = [
    coinbaseWallet({
      appName: 'Creator Vaults',
      preference: 'smartWalletOnly',
    }),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'Creator Vaults',
        description: 'Creator coin vaults on Base',
        url: WALLETCONNECT_APP_URL,
        icons: [WALLETCONNECT_ICON_URL],
      },
      showQrModal: true,
    }),
  ] as const

  // Some wallet extensions install a getter-only `window.ethereum`, which causes
  // other extensions to throw during provider injection. Avoid injected connector
  // in that state; users can still connect via Coinbase Wallet or WalletConnect.
  const shouldUseInjected = ENABLE_INJECTED_CONNECTOR && !isLockedEthereumProviderGlobal()
  if (!shouldUseInjected) return baseConnectors as any
  return [
    ...baseConnectors,
    injected({
      shimDisconnect: true,
    }),
  ] as any
}

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: buildConnectors(),
  transports: {
    [base.id]: BASE_READ_RPC_URLS.length > 0 ? fallback(BASE_READ_RPC_URLS.map((url) => http(url))) : http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
