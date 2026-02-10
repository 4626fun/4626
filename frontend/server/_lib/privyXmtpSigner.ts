/**
 * Privy XMTP SCW Signer
 *
 * Creates an XMTP-compatible SCW signer that uses Privy's server-side
 * wallet API to sign messages on behalf of a Coinbase Smart Wallet.
 *
 * This allows the agent to present as the creator's canonical CSW
 * on XMTP, rather than a separate throwaway EOA.
 *
 * Coinbase Smart Wallet ERC-1271 flow:
 *
 *   1. XMTP calls `signer.signMessage(text)` with the human-readable message.
 *   2. XMTP's backend calls `CSW.isValidSignature(hashMessage(text), signature)`.
 *   3. The CSW's `isValidSignature` wraps the hash with `replaySafeHash(hash)`
 *      (an EIP-712 domain-separated hash) before verifying.
 *   4. The CSW's `_isValidSignature` ABI-decodes the signature as
 *      `SignatureWrapper(uint256 ownerIndex, bytes signatureData)` and uses
 *      `ecrecover` on the replay-safe hash to check if the signer is an owner.
 *
 * Therefore, the signer must:
 *   a. Compute `hashMessage(text)` (EIP-191 prefix)
 *   b. Query `CSW.replaySafeHash(hash)` on-chain
 *   c. Sign the replay-safe hash with `secp256k1_sign` (raw, no prefix)
 *   d. ABI-encode as `SignatureWrapper` tuple struct
 */

import { createPublicClient, http, hashMessage, encodeAbiParameters } from 'viem'
import { base } from 'viem/chains'
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
// ABI fragments
// ---------------------------------------------------------------------------

const REPLAY_SAFE_HASH_ABI = [{
  type: 'function' as const,
  name: 'replaySafeHash' as const,
  inputs: [{ name: 'hash', type: 'bytes32' as const }],
  outputs: [{ name: '', type: 'bytes32' as const }],
  stateMutability: 'view' as const,
}]

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

/**
 * ABI-encode a Coinbase Smart Wallet `SignatureWrapper` as a **tuple struct**.
 *
 * The CSW's `_isValidSignature` does `abi.decode(signature, (SignatureWrapper))`
 * which expects tuple encoding (with the leading 32-byte offset pointer).
 *
 * Layout:
 *   [0..32]    offset to tuple data (= 0x20)
 *   [32..64]   ownerIndex (uint256)
 *   [64..96]   offset to signatureData within tuple (= 0x40)
 *   [96..128]  length of signatureData
 *   [128..]    signatureData (padded to 32-byte boundary)
 */
function encodeSignatureWrapperStruct(ownerIndex: number, signatureData: `0x${string}`): `0x${string}` {
  return encodeAbiParameters(
    [
      {
        type: 'tuple' as const,
        components: [
          { name: 'ownerIndex', type: 'uint256' as const },
          { name: 'signatureData', type: 'bytes' as const },
        ],
      },
    ],
    [{ ownerIndex: BigInt(ownerIndex), signatureData }],
  )
}

// ---------------------------------------------------------------------------
// Signer factory
// ---------------------------------------------------------------------------

/**
 * Create an XMTP SCW signer that signs via Privy's wallet API.
 *
 * @param walletId     Privy wallet ID (for the signer/owner EOA, not the CSW itself)
 * @param cswAddress   The canonical Coinbase Smart Wallet address
 * @param ownerIndex   The index of the Privy wallet in the CSW's MultiOwnable owner list.
 *                     Query `ownerAtIndex(i)` on the CSW to find the correct index.
 *                     If not provided, defaults to 0.
 * @param chainId      Chain ID where the CSW is deployed (default: 8453 for Base)
 * @param rpcUrl       RPC URL for on-chain queries (default: public Base RPC)
 */
export function createPrivyScwSigner(params: {
  walletId: string
  cswAddress: `0x${string}`
  ownerIndex?: number
  chainId?: number
  rpcUrl?: string
}): XmtpSigner {
  const chainId = BigInt(params.chainId ?? 8453)
  const ownerIndex = params.ownerIndex ?? 0

  // Lazy-init the public client (only created on first signMessage call)
  let _client: ReturnType<typeof createPublicClient> | null = null
  function getClient() {
    if (!_client) {
      _client = createPublicClient({
        chain: base,
        transport: http(params.rpcUrl ?? process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'),
      })
    }
    return _client
  }

  return {
    type: 'SCW',

    getIdentifier: () => ({
      identifier: params.cswAddress.toLowerCase(),
      identifierKind: 0 as IdentifierKindEthereum, // Ethereum
    }),

    signMessage: async (message: string): Promise<Uint8Array> => {
      // Step 1: Hash the message with EIP-191 prefix (same as hashMessage)
      const msgHash = hashMessage(message)

      // Step 2: Get the replay-safe hash from the CSW contract.
      // The CSW wraps the hash with its EIP-712 domain separator to prevent
      // cross-account replay attacks.
      const replaySafeHashValue = await getClient().readContract({
        address: params.cswAddress,
        abi: REPLAY_SAFE_HASH_ABI,
        functionName: 'replaySafeHash',
        args: [msgHash],
      }) as `0x${string}`

      // Step 3: Sign the replay-safe hash with secp256k1_sign (raw, no prefix).
      // We MUST NOT use personal_sign here because it would add another EIP-191
      // prefix, causing ecrecover to recover the wrong address.
      const result = await walletRpc<any>({
        walletId: params.walletId,
        method: 'secp256k1_sign',
        rpcParams: { hash: replaySafeHashValue },
      })

      const signature = String(result?.data?.signature ?? '')
      if (!signature || !signature.startsWith('0x')) {
        throw new Error('privy_sign_failed: invalid secp256k1_sign signature')
      }

      // Step 4: Wrap in SignatureWrapper struct for the CSW's isValidSignature.
      const wrapped = encodeSignatureWrapperStruct(ownerIndex, signature as `0x${string}`)

      return hexToBytes(wrapped)
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
