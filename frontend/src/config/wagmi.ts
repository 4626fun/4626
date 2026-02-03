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

const BASE_RPC_URL =
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  ''

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
const BASE_READ_RPC_URLS = uniqueNonEmptyStrings([
  BASE_RPC_URL,
  // Base public RPCs (best-effort fallbacks)
  'https://mainnet.base.org',
  'https://base-mainnet.public.blastapi.io',
])

const WALLETCONNECT_APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://4626.fun')
const WALLETCONNECT_ICON_URL = `${WALLETCONNECT_APP_URL.replace(/\/$/, '')}/pwa-512.png`

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
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
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [base.id]: BASE_READ_RPC_URLS.length > 0 ? fallback(BASE_READ_RPC_URLS.map((url) => http(url))) : http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
