import { http, createConfig } from 'wagmi'
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
    [base.id]: BASE_RPC_URL ? http(BASE_RPC_URL) : http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
