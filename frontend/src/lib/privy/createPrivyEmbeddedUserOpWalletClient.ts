import type { Address, Hex } from 'viem'
import { toHex } from 'viem'

import { ensureSignatureHex } from '@/lib/aa/coinbaseErc4337Signature'
import { ensureProviderOnBase } from '@/lib/wallet/safeSwitchToBase'

const RAW_DIGEST_RE = /^0x[0-9a-fA-F]{64}$/

type ProviderLike = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
}

/**
 * WalletClient-shaped adapter for ERC-4337 UserOp signing with a Privy
 * embedded EOA provider. Intercepts `eth_sign` and prefers `secp256k1_sign`
 * for 32-byte digests (desktop / legacy-owner-install lane).
 */
export function createPrivyEmbeddedUserOpWalletClient(params: {
  address: Address
  getProvider: () => Promise<ProviderLike | null>
  label?: string
  onSecp256k1Fallback?: (error: unknown) => void
}): {
  request: (args: { method: string; params?: any[] }) => Promise<Hex | unknown>
  signMessage: (args: { account?: Address; message: unknown }) => Promise<Hex>
  signTypedData: (typedData: unknown) => Promise<Hex>
} {
  const { address, getProvider, label = 'Privy embedded EOA', onSecp256k1Fallback } = params

  return {
    request: async (args: { method: string; params?: any[] }) => {
      const provider = await getProvider()
      if (!provider?.request) {
        throw new Error('Privy embedded EOA provider not available')
      }
      await ensureProviderOnBase({ provider, label })
      if (args?.method === 'eth_sign') {
        const p = Array.isArray(args.params) ? args.params : []
        const hashCandidate =
          p.find((value): value is string => typeof value === 'string' && RAW_DIGEST_RE.test(value)) ?? ''
        if (hashCandidate) {
          try {
            const rawSig = await provider.request({
              method: 'secp256k1_sign',
              params: [hashCandidate],
            })
            return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.secp256k1_sign')
          } catch (signErr) {
            onSecp256k1Fallback?.(signErr)
          }
        }
      }
      return await provider.request(args as { method: string; params?: unknown })
    },
    signMessage: async (args: { account?: Address; message: unknown }) => {
      const provider = await getProvider()
      if (!provider?.request) {
        throw new Error('Privy embedded EOA provider not available')
      }
      await ensureProviderOnBase({ provider, label })
      const raw =
        typeof args?.message === 'object' && args.message !== null && 'raw' in (args.message as Record<string, unknown>)
          ? (args.message as Record<string, unknown>).raw
          : args?.message
      const msgHex = typeof raw === 'string' && raw.startsWith('0x') ? raw : toHex(String(raw ?? ''))
      const rawSig = await provider.request({
        method: 'personal_sign',
        params: [msgHex, address],
      })
      return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.personal_sign')
    },
    signTypedData: async (typedData: unknown) => {
      const provider = await getProvider()
      if (!provider?.request) {
        throw new Error('Privy embedded EOA provider not available')
      }
      await ensureProviderOnBase({ provider, label })
      const rawSig = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      })
      return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
    },
  }
}
