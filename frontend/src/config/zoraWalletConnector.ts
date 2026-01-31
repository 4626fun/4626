import { toPrivyWalletProvider } from '@privy-io/cross-app-connect'
import { base } from 'wagmi/chains'
import type { Connector } from 'wagmi'

// Zora's Privy App ID
export const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'

export interface ZoraWalletOptions {
  smartWalletMode?: boolean
}

type Provider = ReturnType<typeof toPrivyWalletProvider>

/**
 * Creates a Zora Global Wallet connector for use with wagmi
 * 
 * This allows users to connect with their Zora wallet directly,
 * and Privy handles the authorization popup on Zora's domain.
 * 
 * Uses Privy's cross-app-connect SDK which opens a popup to
 * Zora's domain for user authorization.
 */
export function zoraWalletConnector(
  options: ZoraWalletOptions = {}
): () => Connector {
  const { smartWalletMode = true } = options

  let provider: Provider | null = null

  const getProvider = (): Provider => {
    if (!provider) {
      provider = toPrivyWalletProvider({
        providerAppId: ZORA_PRIVY_APP_ID,
        chains: [base],
        smartWalletMode,
      })
    }
    return provider
  }

  // Return a function that creates the connector
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (): any => ({
    id: 'zora-global-wallet',
    name: 'Zora Wallet',
    type: 'injected',

    async setup() {},

    async connect(params: { chainId?: number } = {}) {
      const p = getProvider()
      await p.request({ method: 'eth_requestAccounts' })

      if (params?.chainId) {
        try {
          await p.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${params.chainId.toString(16)}` }],
          })
        } catch (e) {
          console.warn('[ZoraWallet] Chain switch failed:', e)
        }
      }

      const accounts = (await p.request({
        method: 'eth_accounts',
      })) as `0x${string}`[]

      const chainId = Number(await p.request({ method: 'eth_chainId' }))

      return { accounts, chainId }
    },

    async disconnect() {
      const p = getProvider()
      try {
        await p.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
      } catch {
        // Ignore - not all providers support this
      }
      provider = null
    },

    async getAccounts() {
      const p = getProvider()
      const accounts = (await p.request({
        method: 'eth_accounts',
      })) as `0x${string}`[]
      return accounts
    },

    async getChainId() {
      const p = getProvider()
      const chainId = await p.request({ method: 'eth_chainId' })
      return Number(chainId)
    },

    async getProvider() {
      return getProvider()
    },

    async isAuthorized() {
      try {
        const p = getProvider()
        const accounts = (await p.request({
          method: 'eth_accounts',
        })) as `0x${string}`[]
        return accounts.length > 0
      } catch {
        return false
      }
    },

    async switchChain({ chainId }: { chainId: number }) {
      const p = getProvider()
      await p.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
      return base // Only Base is supported
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onConnect() {},
    onDisconnect() {},
  })
}
