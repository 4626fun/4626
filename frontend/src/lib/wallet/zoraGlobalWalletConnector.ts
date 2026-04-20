/**
 * Wagmi connector that exposes a Privy Connect-mode cross-app session for
 * Zora's Privy app, via `@privy-io/cross-app-connect`.
 *
 * Status: KEPT FOR DIAGNOSTIC USE ONLY. Off by default in `wagmi.ts`.
 * Do NOT enable in production. Reasoning is captured below — read before
 * re-enabling.
 *
 * What we hoped this would do
 * ---------------------------
 * Surface the user's Zora-controlled Coinbase Smart Wallet (CBSW) as a
 * wagmi-connected account so the existing legacy owner-install path
 * (`useAccountSetupController.onEnable4626Signing` → Path B) could request
 * `eth_sendTransaction { from: csw, to: csw, data: addOwnerAddress(agent) }`
 * via a Zora-domain popup. Privy would server-side wrap that into a UserOp
 * signed by the CBSW owner.
 *
 * What we actually got (verified empirically — see the probe page)
 * ----------------------------------------------------------------
 * 1. Connect step succeeds — Zora has authorized the 4626 appId for
 *    Connect mode, so the popup opens and returns an account address.
 * 2. The address returned is NOT the user's CBSW. With `smartWalletMode: true`
 *    Privy gave us a Privy-side embedded EOA (no bytecode on Base) that has
 *    no on-chain relationship to the user's actual CBSW.
 * 3. Even so, sign/transact requests are rejected by `privy.zora.co` with
 *    a generic "Something went wrong" page — consistent with Zora having
 *    Read-only mode enabled on the cross-app config for this appId.
 *
 * Two compounding blockers, only one of which is fixable on Zora's side:
 *
 *   a) READ-ONLY: Zora would have to flip read-only off in their Privy
 *      dashboard. One-line ask, but only Zora can do it.
 *   b) WRONG SIGNER: Even if (a) is fixed, the cross-app session signs
 *      with a Privy embedded EOA that is NOT one of the CBSW's owners
 *      (the CBSW's owners are P256 passkeys held in Coinbase Wallet /
 *      Base Account). So the resulting signature would not satisfy
 *      `validateUserOp` on the CBSW.
 *
 * Bottom line: cross-app Connect mode is the wrong primitive for adding
 * 4626 as a CBSW owner. The right primitive is the Base Account SDK path
 * (sub-account derivation), which `useAccountSetupController.ts` already
 * implements via `useSubAccountSetup` and the `subAccount.canSetup` branch.
 *
 * What this connector is still useful for
 * ---------------------------------------
 * Re-running the diagnostic if Privy or Zora changes their cross-app
 * config in the future. The probe page at `/dev/zora-connector-probe`
 * exercises connect / signMessage / self-addOwner and classifies the
 * bucket so we can re-evaluate without re-deriving the conclusions above.
 */

import { createConnector } from 'wagmi'
import { toPrivyWalletProvider } from '@privy-io/cross-app-connect'
import type { EIP1193Provider } from 'viem'

import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'

export const ZORA_GLOBAL_WALLET_CONNECTOR_ID = `privy-global:${ZORA_PRIVY_APP_ID}`

export function zoraGlobalWalletConnector() {
  // wagmi v2's `createConnector<TProvider, TProperties, TStorageItem>` has
  // overly strict return-shape generics that don't accept a hand-rolled
  // provider wrapping (the `TStorageItem` inference in particular fails
  // without a ton of type gymnastics). Cast the factory to `any` — the
  // runtime contract (EIP-1193 + wagmi's connector lifecycle methods) is
  // fully satisfied by the returned object. Same pattern used in Privy's
  // own ConnectKit sample.
  return createConnector(((config: any) => {
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

      async connect({ chainId }: { chainId?: number } = {}) {
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

      async switchChain({ chainId }: { chainId: number }) {
        const p = ensureProvider()
        const chain = config.chains.find((c: { id: number }) => c.id === chainId)
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
  }) as any)
}
