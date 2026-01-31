import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, walletConnect, injected } from 'wagmi/connectors'
import { zoraWalletConnector } from './zoraWalletConnector'

/**
 * Minimal Wagmi Config
 * 
 * Four connection paths:
 * 1. Zora Wallet (cross-app global wallet - recommended for Creator Coin holders)
 * 2. Coinbase Wallet (includes Smart Wallet)
 * 3. WalletConnect (MetaMask, Rainbow, etc.)
 * 4. Injected (browser extension fallback)
 */

const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || 'bc3dfd319b4a0ecaa25cdee7e36bd0c4'

const BASE_RPC_URL =
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  ''

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    // Zora Wallet - connects to user's Zora smart wallet via Privy cross-app
    zoraWalletConnector({ smartWalletMode: true }),
    coinbaseWallet({
      appName: 'Creator Vaults',
      preference: 'smartWalletOnly',
    }),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'Creator Vaults',
        description: 'Creator coin vaults on Base',
        url: 'https://4626.fun',
        icons: ['https://4626.fun/pwa-512.png'],
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
