/**
 * ERC-1271 contract-signature wrapper for Coinbase Smart Wallet (CSW) + Permit2.
 *
 * Why this wrapping is needed
 * ---------------------------
 * When the Zora quote API returns Permit2 permit objects for a sell trade, the
 * permit must be authorized by the *signer* that Permit2 knows — in our case
 * the CSW itself (a contract). Permit2 checks authorization by calling
 * `isValidSignature(digest, signature)` on the signer (ERC-1271). For a
 * contract signer, the raw 65-byte ECDSA signature that a standard EOA would
 * produce is not accepted — Permit2 expects the Coinbase SmartWallet
 * `SignatureWrapper` encoding instead.
 *
 * The `SignatureWrapper` struct (from Coinbase SmartWallet source):
 *   struct SignatureWrapper {
 *     uint256 ownerIndex;
 *     bytes   signatureData;
 *   }
 * Encoded as `abi.encode(SignatureWrapper(...))` (tuple/struct layout), **not**
 * bare `abi.encode(uint256, bytes)` — the latter makes `isValidSignature` revert.
 *
 * Where the owner signature comes from
 * -------------------------------------
 * The CSW owner EOA's private key is held by Privy in the backend quorum.
 * We compute the Permit2 typed-data digest off-chain (via viem's
 * `hashTypedData`) and call `secp256k1SignHash` (Privy's raw secp256k1 RPC)
 * with that digest. The resulting 65-byte ECDSA signature is then wrapped with
 * `wrapCswOwnerSignature` before being sent back to Zora in the re-quote call.
 */

import { encodeAbiParameters, type Address, type Hex, type PublicClient } from 'viem'

export const CSW_REPLAY_SAFE_HASH_ABI = [
  {
    type: 'function' as const,
    name: 'replaySafeHash' as const,
    inputs: [{ name: 'hash', type: 'bytes32' as const }],
    outputs: [{ name: '', type: 'bytes32' as const }],
    stateMutability: 'view' as const,
  },
] as const

export async function readCswReplaySafeHash(params: {
  publicClient: PublicClient
  smartWallet: Address
  innerHash: Hex
}): Promise<Hex> {
  return (await params.publicClient.readContract({
    address: params.smartWallet,
    abi: CSW_REPLAY_SAFE_HASH_ABI,
    functionName: 'replaySafeHash',
    args: [params.innerHash],
  })) as Hex
}

const SIGNATURE_WRAPPER_TUPLE = [
  {
    type: 'tuple' as const,
    components: [
      { name: 'ownerIndex', type: 'uint256' as const },
      { name: 'signatureData', type: 'bytes' as const },
    ],
  },
] as const

/**
 * Wrap a raw 65-byte secp256k1 owner signature into the ERC-1271
 * `SignatureWrapper` format that Permit2 expects when the signer is a
 * Coinbase Smart Wallet.
 */
export function wrapCswOwnerSignature(ownerSignature: Hex, ownerIndex: number = 0): Hex {
  if (!ownerSignature.startsWith('0x') || ownerSignature.length !== 132) {
    throw new Error(
      `wrapCswOwnerSignature: expected a 65-byte (132-hex-char) signature, got length ${ownerSignature.length}. ` +
        'Ensure the signature comes from Privy secp256k1_sign and is not truncated.',
    )
  }
  return encodeAbiParameters(SIGNATURE_WRAPPER_TUPLE, [
    { ownerIndex: BigInt(ownerIndex), signatureData: ownerSignature },
  ])
}
