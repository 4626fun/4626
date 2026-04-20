/**
 * Wagmi connector that exposes Zora's Coinbase Smart Wallet (CBSW) via
 * Privy's Connect-mode cross-app protocol.
 *
 * This is a probe connector gated by `zoraGlobalWalletConnectorFlag`.
 *
 * Why this exists
 * ---------------
 * The existing `@privy-io/react-auth` integration uses `useCrossAppAccounts`
 * in *Auth mode* only (identity linking). That surfaces the user's Zora
 * profile + canonical CBSW address, but does not expose a signer — which is
 * why vanilla Zora users dead-end at `onEnable4626Signing` when asked to
 * sign `addOwnerAddress`.
 *
 * Privy's `@privy-io/cross-app-connect` package is a separate, complementary
 * SDK that implements *Connect mode* (Mobile Wallet Protocol) and ships a
 * full EIP-1193 provider. When `smartWalletMode: true`, the provider
 * surfaces the provider app's smart wallet (Zora CBSW) as the connected
 * account, and every `eth_sendTransaction` opens a popup on Zora's
 * isolated Privy subdomain where Zora signs the underlying UserOp server-
 * side. This is the only path that lets us request a self-call like
 * `addOwnerAddress(agent)` from an externally-provisioned CBSW whose only
 * owner is Zora's embedded EOA.
 *
 * Whether this actually works depends on Zora's provider-side Privy config:
 *   - Transactional Connect mode enabled for this appId → works end-to-end
 *   - Read-only mode → connect succeeds, sign/send refused
 *   - Connect mode not authorized → connect itself errors 401/403
 *
 * The `ZoraConnectorProbe` page exercises each capability and classifies
 * the bucket. Do not roll this out to prod until bucket #1 is confirmed.
 */

import { createConnector } from 'wagmi'
import { toPrivyWalletProvider } from '@privy-io/cross-app-connect'
import type { EIP1193Provider } from 'viem'

import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'

export const ZORA_GLOBAL_WALLET_CONNECTOR_ID = `privy-global:${ZORA_PRIVY_APP_ID}`

export function zoraGlobalWalletConnector() {
  return createConnector((config) => {
    let provider: EIP1193Provider | undefined

    function ensureProvider(): EIP1193Provider {
      if (!provider) {
        provider = toPrivyWalletProvider({
          providerAppId: ZORA_PRIVY_APP_ID,
          chains: config.chains as any,
          // Critical: expose the CBSW as the connected account so
          // `eth_sendTransaction { from: csw, to: csw, data: addOwnerAddress(agent) }`
          // routes through the smart-wallet UserOp pipeline on Zora's side.
          smartWalletMode: true,
        }) as EIP1193Provider
      }
      return provider
    }

    return {
      id: ZORA_GLOBAL_WALLET_CONNECTOR_ID,
      name: 'Zora (Global Wallet)',
      // 'injected' is required for ConnectKit/RainbowKit compat per Privy's
      // docs. Wagmi only uses the field for picker categorization.
      type: 'injected',

      async setup() {},

      async connect({ chainId } = {}) {
        const p = ensureProvider()
        await p.request({ method: 'eth_requestAccounts' })
        if (chainId) {
          try {
            await this.switchChain?.({ chainId })
          } catch (err) {
            console.warn('[zora-global-wallet] switchChain failed:', err)
          }
        }
        const accounts = (await p.request({ method: 'eth_accounts' })) as `0x${string}`[]
        const currentChainId = Number(await p.request({ method: 'eth_chainId' }))
        return { accounts, chainId: currentChainId }
      },

      async disconnect() {
        const p = ensureProvider()
        try {
          await p.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          } as any)
        } catch {
          // Some providers don't implement revokePermissions; ignore.
        }
      },

      async getAccounts() {
        const p = ensureProvider()
        return (await p.request({ method: 'eth_accounts' })) as `0x${string}`[]
      },

      async getChainId() {
        const p = ensureProvider()
        return Number(await p.request({ method: 'eth_chainId' }))
      },

      async getProvider() {
        return ensureProvider()
      },

      async isAuthorized() {
        try {
          const accounts = await this.getAccounts()
          return accounts.length > 0
        } catch {
          return false
        }
      },

      async switchChain({ chainId }) {
        const p = ensureProvider()
        const chain = config.chains.find((c) => c.id === chainId)
        if (!chain) throw new Error(`Chain ${chainId} not configured`)
        await p.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        })
        return chain
      },

      onAccountsChanged(accounts: string[]) {
        if (accounts.length === 0) {
          config.emitter.emit('disconnect')
        } else {
          config.emitter.emit('change', { accounts: accounts as `0x${string}`[] })
        }
      },
      onChainChanged(chainId: string | number) {
        config.emitter.emit('change', { chainId: Number(chainId) })
      },
      onDisconnect() {
        config.emitter.emit('disconnect')
      },
    }
  })
}
