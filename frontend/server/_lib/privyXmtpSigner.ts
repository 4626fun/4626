/**
 * Privy XMTP SCW Signer
 *
 * Creates an XMTP-compatible SCW signer that uses Privy's server-side
 * wallet API to sign messages on behalf of a Coinbase Smart Wallet.
 *
 * This allows the agent to present as the creator's canonical CSW
 * on XMTP, rather than a separate throwaway EOA.
 */

import { walletRpc } from './privyWalletApi.js'

// Re-use the Signer shape from @xmtp/agent-sdk (re-exports from @xmtp/node-sdk)
// We define the interface here to avoid import issues with transitive deps.

type IdentifierKindEthereum = 0

interface Identifier {
  identifier: string
  identifierKind: IdentifierKindEthereum
}

interface ScwSigner {
  type: 'SCW'
  getIdentifier: () => Identifier
  signMessage: (message: string) => Promise<Uint8Array>
  getChainId: () => bigint
}

interface EoaSigner {
  type: 'EOA'
  getIdentifier: () => Identifier
  signMessage: (message: string) => Promise<Uint8Array>
}

export type XmtpSigner = ScwSigner | EoaSigner

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// Signer factory
// ---------------------------------------------------------------------------

/**
 * Create an XMTP SCW signer that signs via Privy's wallet API.
 *
 * @param walletId     Privy wallet ID (for the signer/owner EOA, not the CSW itself)
 * @param cswAddress   The canonical Coinbase Smart Wallet address
 * @param chainId      Chain ID where the CSW is deployed (default: 8453 for Base)
 */
export function createPrivyScwSigner(params: {
  walletId: string
  cswAddress: `0x${string}`
  chainId?: number
}): XmtpSigner {
  const chainId = BigInt(params.chainId ?? 8453)

  return {
    type: 'SCW',

    getIdentifier: () => ({
      identifier: params.cswAddress.toLowerCase(),
      identifierKind: 0 as IdentifierKindEthereum, // Ethereum
    }),

    signMessage: async (message: string): Promise<Uint8Array> => {
      // Use Privy's wallet RPC to sign the message with the agent wallet
      const result = await walletRpc<any>({
        walletId: params.walletId,
        method: 'personal_sign',
        rpcParams: {
          message,
        },
      })

      const signature = String(result?.data?.signature ?? result?.signature ?? '')
      if (!signature || !signature.startsWith('0x')) {
        throw new Error('privy_sign_failed: invalid signature')
      }

      return hexToBytes(signature)
    },

    getChainId: () => chainId,
  }
}

/**
 * Create an XMTP EOA signer from a raw private key.
 * Fallback for agents that don't have a CSW.
 *
 * NOTE: This is async because we need dynamic import for ESM.
 */
export async function createEoaSignerFromKey(privateKey: `0x${string}`): Promise<XmtpSigner> {
  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(privateKey)

  return {
    type: 'EOA',

    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: 0 as IdentifierKindEthereum,
    }),

    signMessage: async (message: string): Promise<Uint8Array> => {
      const sig = await account.signMessage({ message })
      return hexToBytes(sig)
    },
  }
}
